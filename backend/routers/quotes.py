from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import Quote, Order
from deps import require_roles, get_session
from business import calculate_price, calculate_shipping, calculate_tax, gen_number, now_iso, log_activity, deduct_stock_for_items, get_settings_dict

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

    if not is_staff:
        settings = await get_settings_dict()
        if not settings.get('quotationsEnabled'):
            raise HTTPException(status_code=403, detail='Quotation requests are not available right now.')
        min_qty = settings.get('quotationMinQty')
        min_price = settings.get('quotationMinPrice')
        total_qty = sum(i['quantity'] for i in priced_items)
        meets_qty = min_qty not in (None, '') and total_qty >= float(min_qty)
        meets_price = min_price not in (None, '') and subtotal >= float(min_price)
        require_both = settings.get('quotationRequireBoth')
        eligible = (meets_qty and meets_price) if require_both else (meets_qty or meets_price)
        if not eligible:
            raise HTTPException(status_code=403, detail='This order does not meet the minimum for a quote request yet.')

    quote = Quote(
        quoteNumber=gen_number('QT'),
        customerId=customer_id,
        items=priced_items,
        subtotal=subtotal,
        status='draft' if is_staff else 'open',
        validUntil=payload.get('validUntil', ''),
        convertedOrderId='',
        shippingAddress=payload.get('shippingAddress', {}),
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


@router.get('/{quote_id}')
async def get_quote(quote_id: str, session: dict = Depends(get_session)):
    doc = await db.quotes.find_one({'_id': ObjectId(quote_id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Quote not found.')
    if session['role'] == 'customer' and doc.get('customerId') != session['user_id']:
        raise HTTPException(status_code=403, detail='Not authorized to view this quote.')
    return Quote.from_mongo(doc)


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


@router.put('/{quote_id}')
async def update_quote_items(quote_id: str, payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    doc = await db.quotes.find_one({'_id': ObjectId(quote_id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Quote not found.')
    if doc['status'] in ('converted', 'lost'):
        raise HTTPException(status_code=400, detail=f'This quote is {doc["status"]} and its pricing can no longer be changed.')

    items = payload.get('items')
    if not items:
        raise HTTPException(status_code=400, detail='At least one item is required.')

    priced_items = []
    subtotal = 0.0
    for item in items:
        qty = int(item['quantity'])
        unit_price = float(item['unitPrice'])
        line_total = unit_price * qty
        subtotal += line_total
        priced_items.append({
            'productId': item['productId'], 'color': item.get('color', ''), 'size': item.get('size', ''),
            'quantity': qty, 'unitPrice': unit_price, 'lineTotal': line_total,
        })

    await db.quotes.update_one(
        {'_id': ObjectId(quote_id)},
        {'$set': {'items': priced_items, 'subtotal': subtotal, 'updatedAt': now_iso()}},
    )
    await log_activity('quote', quote_id, 'pricing_edited', session['user_id'], session['role'])
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

    shipping_address = quote.get('shippingAddress') or {}
    if not shipping_address and quote.get('customerId'):
        addr = await db.addresses.find_one({'customerId': quote['customerId'], 'isDefault': True})
        if not addr:
            addr = await db.addresses.find_one({'customerId': quote['customerId']})
        if addr:
            shipping_address = {
                'line1': addr.get('line1', ''), 'line2': addr.get('line2', ''),
                'city': addr.get('city', ''), 'state': addr.get('state', ''), 'pincode': addr.get('pincode', ''),
            }

    subtotal = quote['subtotal']
    shipping_cost = await calculate_shipping(shipping_address.get('pincode'), subtotal)
    tax_breakdown = await calculate_tax(subtotal, shipping_address.get('state'))
    total = subtotal + shipping_cost + tax_breakdown['total']

    order = Order(
        orderNumber=gen_number('ORD'),
        customerId=quote['customerId'],
        customerName=customer['name'] if customer else 'Customer',
        items=quote['items'],
        subtotal=subtotal,
        shippingCost=shipping_cost,
        tax=tax_breakdown['total'],
        taxBreakdown=tax_breakdown,
        discount=0,
        total=total,
        paymentMethod='bank_transfer',
        paymentStatus='pending',
        orderStatus='confirmed',
        stockDeducted=True,
        shippingAddress=shipping_address,
        notes=f'Converted from quote {quote["quoteNumber"]}',
        createdAt=now_iso(),
    )
    result = await db.orders.insert_one(order.to_mongo())
    await deduct_stock_for_items(quote['items'])
    await db.quotes.update_one({'_id': ObjectId(quote_id)}, {'$set': {'status': 'converted', 'convertedOrderId': str(result.inserted_id), 'updatedAt': now_iso()}})
    await log_activity('quote', quote_id, 'converted_to_order', session['user_id'], session['role'], {'orderId': str(result.inserted_id)})
    doc = await db.orders.find_one({'_id': result.inserted_id})
    return Order.from_mongo(doc)
