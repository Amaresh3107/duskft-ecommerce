from fastapi import APIRouter, Depends
from database import db
from deps import require_roles

router = APIRouter(prefix='/api/dashboard', tags=['dashboard'])

LOW_STOCK_THRESHOLD = 15


@router.get('/admin')
async def admin_dashboard(session: dict = Depends(require_roles('admin', 'staff'))):
    orders = await db.orders.find().to_list(10000)
    total_sales = sum(o.get('total', 0) for o in orders if o.get('orderStatus') != 'cancelled')
    open_orders = [o for o in orders if o.get('orderStatus') in ('pending', 'confirmed', 'processing', 'shipped')]
    valid_orders = [o for o in orders if o.get('orderStatus') != 'cancelled']
    avg_order_value = (total_sales / len(valid_orders)) if valid_orders else 0

    products = await db.products.find({'status': 'active'}).to_list(10000)
    low_stock = [{'id': str(p['_id']), 'name': p['name'], 'stock': p.get('stock', 0)} for p in products if p.get('stock', 0) < LOW_STOCK_THRESHOLD]

    return {
        'totalSales': total_sales,
        'openOrders': len(open_orders),
        'averageOrderValue': round(avg_order_value, 2),
        'lowStockProducts': low_stock,
        'totalOrders': len(orders),
    }
