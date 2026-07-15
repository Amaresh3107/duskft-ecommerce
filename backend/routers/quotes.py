from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import Quote, Order
from deps import require_roles, get_session
from business import calculate_price, gen_number, now_iso, log_activity

router = APIRouter(prefix='/api/quotes', tags=['quotes'])

VALID_STATUSES = ['draft', 'open', 'approved', 'converted', 'lost']


@router.post('')
async def create_quote(payload: dict, session: dict = Depends(get_session)):
    items = payload.get('items') or []
    is_staff = session['role'] in ('admin', 'staff')

    priced_items = []
    subtotal = 0.0
    for item in items:
        qty = int(item['quantity'])
        if is_staff and item.get('unitPrice') is not None:
            unit_price = float(item['unitPrice'])
        else:
            product = await db.products.find_one({'_id': ObjectId(item['productId'])})
            if not product:
                raise HTTPException(status_code=404, detail=f'Product {item["productId"]} not found.')
            unit_price = calculate_price(product, qty)['unitPrice']
        line_total = unit_price * qty
        subtotal += line_total
        priced_items.append({
            'productId': item['productId'], 'color': item.get('color', ''), 'size': item.get('size', ''),
            'quantity': qty, 'unitPrice': unit_price, 'lineTotal': line_total,
        })

    customer_id = payload.get('customerId') if is_staff else session['user_id']
    quote = Quote(
        quoteNumber=gen_number('QT'),
        customerId=customer_id,
        items=priced_items,
        subtotal=subtotal,
        status='draft',
        validUntil=payload.get('validUntil', ''),
        convertedOrderId='',
        notes=payload.get('notes', ''),
        createdAt=now_iso(),
    )
    result = await db.quotes.insert_one(quote.to_mongo())
    doc = await db.quotes.find_one({'_id': result.inserted_id})
    return Quote.from_mongo(doc)


@router.get('')
async def list_quotes(status: str | None = None, session: dict = Depends(get_session)):
    query = {}
    if session['role'] == 'customer':
        query['customerId'] = session['user_id']
    elif status:
        query['status'] = status
    docs = await db.quotes.find(query).sort('createdAt', -1).to_list(1000)
    return [Quote.from_mongo(d) for d in docs]


@router.put('/{quote_id}/status')
async def update_quote_status(quote_id: str, payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    status = payload.get('status')
    if status not in VALID_STATUSES or status == 'converted':
        raise HTTPException(status_code=400, detail=f'Invalid quote status: {payload.get("status")}. Use /convert to convert a quote.')

    doc = await db.quotes.find_one({'_id': ObjectId(quote_id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Quote not found.')
    if doc['status'] == 'converted':
        raise HTTPException(status_code=400, detail='This quote has already been converted and cannot be changed.')

    await db.quotes.update_one({'_id': ObjectId(quote_id)}, {'$set': {'status': status, 'updatedAt': now_iso()}})
    updated = await db.quotes.find_one({'_id': ObjectId(quote_id)})
    return Quote.from_mongo(updated)


@router.post('/{quote_id}/convert')
async def convert_to_order(quote_id: str, session: dict = Depends(require_roles('admin', 'staff'))):
    quote = await db.quotes.find_one({'_id': ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail='Quote not found.')
    if quote['status'] != 'approved':
        raise HTTPException(status_code=400, detail='Only approved quotes can be converted to an order.')

    customer = await db.customers.find_one({'_id': ObjectId(quote['customerId'])}) if quote.get('customerId') else None
    order = Order(
        orderNumber=gen_number('ORD'),
        customerId=quote['customerId'],
        customerName=customer['name'] if customer else 'Customer',
        items=quote['items'],
        subtotal=quote['subtotal'],
        shippingCost=0,
        tax=0,
        taxBreakdown={},
        discount=0,
        total=quote['subtotal'],
        paymentMethod='bank_transfer',
        paymentStatus='pending',
        orderStatus='confirmed',
        shippingAddress={},
        notes=f'Converted from quote {quote["quoteNumber"]}',
        createdAt=now_iso(),
    )
    result = await db.orders.insert_one(order.to_mongo())
    await db.quotes.update_one({'_id': ObjectId(quote_id)}, {'$set': {'status': 'converted', 'convertedOrderId': str(result.inserted_id), 'updatedAt': now_iso()}})
    await log_activity('quote', quote_id, 'converted_to_order', session['user_id'], session['role'], {'orderId': str(result.inserted_id)})
    doc = await db.orders.find_one({'_id': result.inserted_id})
    return Order.from_mongo(doc)
