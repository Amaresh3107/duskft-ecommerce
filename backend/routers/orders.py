from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import Order
from deps import require_roles, get_optional_session, get_session
from business import calculate_price, calculate_shipping, calculate_tax, gen_number, now_iso, log_activity, deduct_stock_for_items, restore_stock_for_items

router = APIRouter(prefix='/api/orders', tags=['orders'])

VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
PRE_SHIPPED = ['pending', 'confirmed', 'processing']


@router.post('')
async def create_order(payload: dict, session: dict = Depends(get_optional_session)):
    items = payload.get('items') or []
    if not items:
        raise HTTPException(status_code=400, detail='Cart is empty.')

    by_product = {}
    for item in items:
        by_product[item['productId']] = by_product.get(item['productId'], 0) + int(item['quantity'])

    product_cache = {}
    subtotal = 0.0
    priced_items = []
    for item in items:
        pid = item['productId']
        if pid not in product_cache:
            doc = await db.products.find_one({'_id': ObjectId(pid)})
            if not doc:
                raise HTTPException(status_code=404, detail=f'Product {pid} not found.')
            product_cache[pid] = doc
        product = product_cache[pid]
        total_qty_for_product = by_product[pid]
        price_info = calculate_price(product, total_qty_for_product)
        if not price_info['moqMet']:
            raise HTTPException(status_code=400, detail=f'MOQ not met for "{product["name"]}" — minimum {price_info["moq"]} units required.')
        qty = int(item['quantity'])
        line_total = price_info['unitPrice'] * qty
        subtotal += line_total
        priced_items.append({
            'productId': pid,
            'color': item.get('color', ''),
            'size': item.get('size', ''),
            'quantity': qty,
            'unitPrice': price_info['unitPrice'],
            'lineTotal': line_total,
        })

    shipping_address = payload.get('shippingAddress') or {}
    shipping_cost = await calculate_shipping(shipping_address.get('pincode'), subtotal)
    tax_breakdown = await calculate_tax(subtotal, shipping_address.get('state'))

    discount = 0.0
    if session and session['role'] in ('admin', 'staff'):
        discount = float(payload.get('discount', 0) or 0)

    total = subtotal + shipping_cost + tax_breakdown['total'] - discount

    customer_id = ''
    customer_name = payload.get('guestName') or 'Guest'
    if session and session['role'] == 'customer':
        customer_id = session['user_id']
        customer_doc = await db.customers.find_one({'_id': ObjectId(customer_id)})
        customer_name = customer_doc['name'] if customer_doc else customer_name

    order = Order(
        orderNumber=gen_number('ORD'),
        customerId=customer_id,
        customerName=customer_name,
        guestEmail=payload.get('guestEmail', '') if not customer_id else '',
        guestPhone=payload.get('guestPhone', '') if not customer_id else '',
        items=priced_items,
        subtotal=subtotal,
        shippingCost=shipping_cost,
        tax=tax_breakdown['total'],
        taxBreakdown=tax_breakdown,
        discount=discount,
        total=total,
        paymentMethod=payload.get('paymentMethod', 'cod'),
        paymentStatus='pending',
        orderStatus='pending',
        shippingAddress=shipping_address,
        notes=payload.get('notes', ''),
        createdAt=now_iso(),
    )
    result = await db.orders.insert_one(order.to_mongo())
    doc = await db.orders.find_one({'_id': result.inserted_id})
    await log_activity('order', str(doc['_id']), 'created', customer_id, session['role'] if session else 'guest')
    return Order.from_mongo(doc)


@router.get('')
async def list_orders(status: str | None = None, session: dict = Depends(get_session)):
    query = {}
    if session['role'] == 'customer':
        query['customerId'] = session['user_id']
    elif status:
        query['orderStatus'] = status
    docs = await db.orders.find(query).sort('createdAt', -1).to_list(1000)
    return [Order.from_mongo(d) for d in docs]


@router.get('/{order_id}')
async def get_order(order_id: str, session: dict = Depends(get_session)):
    doc = await db.orders.find_one({'_id': ObjectId(order_id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Order not found.')
    if session['role'] == 'customer' and doc.get('customerId') != session['user_id']:
        raise HTTPException(status_code=403, detail='Not authorized to view this order.')
    return Order.from_mongo(doc)


@router.put('/{order_id}/status')
async def update_order_status(order_id: str, payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    status = payload.get('status')
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f'Invalid order status: {status}')

    doc = await db.orders.find_one({'_id': ObjectId(order_id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Order not found.')

    current = doc['orderStatus']
    if current == 'cancelled':
        raise HTTPException(status_code=400, detail='Cannot change status of a cancelled order.')
    if status == 'cancelled' and current not in PRE_SHIPPED:
        raise HTTPException(status_code=400, detail='Order can only be cancelled before it has shipped.')

    updates = {'orderStatus': status, 'updatedAt': now_iso()}
    if status == 'delivered':
        updates['deliveredAt'] = now_iso()

    # Stock is deducted the moment an admin/staff confirms an order — not at
    # checkout — per business decision. Deduct exactly once (guarded by
    # stockDeducted), and restore it if a confirmed+ order is cancelled
    # before shipping.
    if status == 'confirmed' and not doc.get('stockDeducted'):
        await deduct_stock_for_items(doc.get('items', []))
        updates['stockDeducted'] = True
    elif status == 'cancelled' and doc.get('stockDeducted'):
        await restore_stock_for_items(doc.get('items', []))
        updates['stockDeducted'] = False

    await db.orders.update_one({'_id': ObjectId(order_id)}, {'$set': updates})
    await log_activity('order', order_id, f'status_changed:{current}->{status}', session['user_id'], session['role'])
    updated = await db.orders.find_one({'_id': ObjectId(order_id)})
    return Order.from_mongo(updated)
