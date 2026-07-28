from datetime import datetime, timezone, timedelta
from collections import defaultdict
from fastapi import APIRouter, Depends, Query
from bson import ObjectId
from database import db
from deps import require_roles
from business import get_setting

router = APIRouter(prefix='/api/dashboard', tags=['dashboard'])

COMMITTED_STATUSES = ('confirmed', 'processing', 'shipped', 'delivered')


def _parse_dt(value):
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


@router.get('/admin')
async def admin_dashboard(session: dict = Depends(require_roles('admin', 'staff'))):
    orders = await db.orders.find().to_list(10000)
    total_sales = sum(o.get('total', 0) for o in orders if o.get('orderStatus') != 'cancelled')
    open_orders = [o for o in orders if o.get('orderStatus') in ('pending', 'confirmed', 'processing', 'shipped')]
    valid_orders = [o for o in orders if o.get('orderStatus') != 'cancelled']
    avg_order_value = (total_sales / len(valid_orders)) if valid_orders else 0

    threshold_percent = float(await get_setting('lowStockThresholdPercent', 15))
    products = await db.products.find({'status': 'active'}).to_list(10000)
    low_stock = []
    for p in products:
        stock = p.get('stock', 0)
        total_stock = p.get('totalStock', 0) or 0
        threshold = (total_stock * threshold_percent / 100) if total_stock > 0 else 15
        if stock <= threshold:
            low_stock.append({
                'id': str(p['_id']), 'name': p['name'], 'stock': stock,
                'totalStock': total_stock, 'critical': stock <= 0,
            })
    low_stock.sort(key=lambda x: x['stock'])

    return {
        'totalSales': total_sales,
        'openOrders': len(open_orders),
        'averageOrderValue': round(avg_order_value, 2),
        'lowStockProducts': low_stock,
        'totalOrders': len(orders),
    }


@router.get('/sales-over-time')
async def sales_over_time(period: str = Query('daily', pattern='^(daily|weekly|monthly|yearly)$'),
                           session: dict = Depends(require_roles('admin', 'staff'))):
    lookback = {'daily': timedelta(days=30), 'weekly': timedelta(weeks=12),
                'monthly': timedelta(days=365), 'yearly': timedelta(days=365 * 5)}[period]
    fmt = {'daily': '%Y-%m-%d', 'weekly': '%G-W%V', 'monthly': '%Y-%m', 'yearly': '%Y'}[period]
    cutoff = datetime.now(timezone.utc) - lookback

    orders = await db.orders.find({'orderStatus': {'$ne': 'cancelled'}}).to_list(10000)
    buckets = defaultdict(lambda: {'revenue': 0.0, 'orders': 0})
    for o in orders:
        dt = _parse_dt(o.get('createdAt', ''))
        if not dt or dt < cutoff:
            continue
        key = dt.strftime(fmt)
        buckets[key]['revenue'] += o.get('total', 0)
        buckets[key]['orders'] += 1

    series = [{'period': k, 'revenue': round(v['revenue'], 2), 'orders': v['orders']} for k, v in sorted(buckets.items())]
    return {'period': period, 'series': series}


@router.get('/top-products')
async def top_products(limit: int = 10, session: dict = Depends(require_roles('admin', 'staff'))):
    orders = await db.orders.find({'orderStatus': {'$in': list(COMMITTED_STATUSES)}}).to_list(10000)
    agg = defaultdict(lambda: {'quantity': 0, 'revenue': 0.0})
    for o in orders:
        for item in o.get('items', []):
            pid = item.get('productId')
            if not pid:
                continue
            agg[pid]['quantity'] += item.get('quantity', 0)
            agg[pid]['revenue'] += item.get('lineTotal', 0)

    top_ids = sorted(agg.keys(), key=lambda pid: -agg[pid]['quantity'])[:limit]
    results = []
    for pid in top_ids:
        product = await db.products.find_one({'_id': ObjectId(pid)}) if ObjectId.is_valid(pid) else None
        results.append({
            'productId': pid,
            'name': product['name'] if product else 'Unknown product',
            'image': (product.get('images') or [None])[0] if product else None,
            'quantity': agg[pid]['quantity'],
            'revenue': round(agg[pid]['revenue'], 2),
        })
    return results


@router.get('/order-breakdown')
async def order_breakdown(session: dict = Depends(require_roles('admin', 'staff'))):
    orders = await db.orders.find().to_list(10000)

    status_counts = defaultdict(int)
    source_counts = defaultdict(int)
    for o in orders:
        status_counts[o.get('orderStatus', 'pending')] += 1
        source_counts[o.get('source', 'cart')] += 1

    category_docs = await db.categories.find().to_list(1000)
    category_names = {str(c['_id']): c['name'] for c in category_docs}
    product_docs = await db.products.find().to_list(10000)
    product_category = {str(p['_id']): category_names.get(str(p.get('categoryId')), 'Uncategorized') for p in product_docs}

    category_revenue = defaultdict(float)
    for o in orders:
        if o.get('orderStatus') == 'cancelled':
            continue
        for item in o.get('items', []):
            cat = product_category.get(item.get('productId'), 'Uncategorized')
            category_revenue[cat] += item.get('lineTotal', 0)

    return {
        'statusBreakdown': [{'status': k, 'count': v} for k, v in status_counts.items()],
        'sourceBreakdown': [{'source': k, 'count': v} for k, v in source_counts.items()],
        'categoryRevenue': [{'category': k, 'revenue': round(v, 2)} for k, v in sorted(category_revenue.items(), key=lambda x: -x[1])],
    }
