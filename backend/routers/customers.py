from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import Address, Customer
from deps import require_roles, get_session
from business import now_iso

router = APIRouter(prefix='/api/customers', tags=['customers'])


def safe_customer(doc: dict) -> dict:
    out = dict(doc)
    out['id'] = str(out.pop('_id'))
    out.pop('passwordHash', None)
    return out


@router.get('/me')
async def me(session: dict = Depends(get_session)):
    if session['role'] != 'customer':
        raise HTTPException(status_code=403, detail='Not a customer session.')
    doc = await db.customers.find_one({'_id': ObjectId(session['user_id'])})
    if not doc:
        raise HTTPException(status_code=404, detail='Customer not found.')
    return safe_customer(doc)


@router.put('/me')
async def update_profile(payload: dict, session: dict = Depends(get_session)):
    if session['role'] != 'customer':
        raise HTTPException(status_code=403, detail='Not a customer session.')
    updates = {f: payload[f] for f in ('name', 'phone', 'businessName', 'gstNumber') if f in payload}
    await db.customers.update_one({'_id': ObjectId(session['user_id'])}, {'$set': updates})
    doc = await db.customers.find_one({'_id': ObjectId(session['user_id'])})
    return safe_customer(doc)


@router.get('/addresses')
async def list_addresses(session: dict = Depends(get_session)):
    docs = await db.addresses.find({'customerId': session['user_id']}).to_list(1000)
    return [Address.from_mongo(d) for d in docs]


@router.post('/addresses')
async def save_address(payload: dict, session: dict = Depends(get_session)):
    record = {
        'customerId': session['user_id'], 'label': payload.get('label', 'Home'),
        'line1': payload['line1'], 'line2': payload.get('line2', ''), 'city': payload['city'],
        'state': payload['state'], 'pincode': payload['pincode'], 'isDefault': bool(payload.get('isDefault', False)),
    }
    if payload.get('id'):
        await db.addresses.update_one({'_id': ObjectId(payload['id']), 'customerId': session['user_id']}, {'$set': record})
        doc = await db.addresses.find_one({'_id': ObjectId(payload['id'])})
    else:
        result = await db.addresses.insert_one(record)
        doc = await db.addresses.find_one({'_id': result.inserted_id})
    # Only one address can be default at a time — unset it on all others.
    if record['isDefault']:
        await db.addresses.update_many(
            {'customerId': session['user_id'], '_id': {'$ne': doc['_id']}},
            {'$set': {'isDefault': False}},
        )
    return Address.from_mongo(doc)


@router.delete('/addresses/{address_id}')
async def delete_address(address_id: str, session: dict = Depends(get_session)):
    result = await db.addresses.delete_one({'_id': ObjectId(address_id), 'customerId': session['user_id']})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Address not found.')
    return {'success': True}


@router.post('/wishlist/toggle')
async def toggle_wishlist(payload: dict, session: dict = Depends(get_session)):
    product_id = payload['productId']
    existing = await db.wishlist.find_one({'customerId': session['user_id'], 'productId': product_id})
    if existing:
        await db.wishlist.delete_one({'_id': existing['_id']})
        return {'added': False}
    await db.wishlist.insert_one({'customerId': session['user_id'], 'productId': product_id, 'createdAt': now_iso()})
    return {'added': True}


@router.get('/wishlist')
async def list_wishlist(session: dict = Depends(get_session)):
    entries = await db.wishlist.find({'customerId': session['user_id']}).to_list(1000)
    results = []
    for entry in entries:
        product = await db.products.find_one({'_id': ObjectId(entry['productId'])})
        if product:
            product_out = dict(product)
            product_out['id'] = str(product_out.pop('_id'))
            product_out['wishlistId'] = str(entry['_id'])
            results.append(product_out)
    return results


@router.get('/dashboard')
async def dashboard(session: dict = Depends(get_session)):
    if session['role'] != 'customer':
        raise HTTPException(status_code=403, detail='Not a customer session.')
    orders = await db.orders.find({'customerId': session['user_id']}).sort('createdAt', -1).to_list(1000)
    active_orders = [o for o in orders if o['orderStatus'] in ('pending', 'confirmed', 'processing', 'shipped')]
    # "Total spent" excludes cancelled orders — money never actually committed.
    total_spent = sum(o.get('total', 0) for o in orders if o['orderStatus'] != 'cancelled')
    # "Pieces ordered" only counts orders that reached confirmed+ (i.e. stock was
    # actually deducted for them), not pending (not yet committed) or cancelled.
    counted_statuses = ('confirmed', 'processing', 'shipped', 'delivered')
    total_pieces = sum(
        sum(i.get('quantity', 0) for i in o.get('items', []))
        for o in orders if o['orderStatus'] in counted_statuses
    )

    def order_out(o):
        d = dict(o)
        d['id'] = str(d.pop('_id'))
        return d

    return {
        'activeOrderCount': len(active_orders), 'totalOrders': len(orders),
        'totalSpent': total_spent, 'totalPieces': total_pieces,
        'recentOrders': [order_out(o) for o in orders[:5]],
    }


@router.get('')
async def list_customers(session: dict = Depends(require_roles('admin', 'staff'))):
    docs = await db.customers.find().sort('createdAt', -1).to_list(2000)
    return [safe_customer(d) for d in docs]


@router.put('/{customer_id}/status')
async def update_customer_status(customer_id: str, payload: dict, session: dict = Depends(require_roles('admin'))):
    result = await db.customers.update_one({'_id': ObjectId(customer_id)}, {'$set': {'status': payload['status']}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Customer not found.')
    doc = await db.customers.find_one({'_id': ObjectId(customer_id)})
    return safe_customer(doc)
