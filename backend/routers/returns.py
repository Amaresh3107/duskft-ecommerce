from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime, timezone
from database import db
from models import Return
from deps import require_roles, get_session
from business import now_iso, log_activity

router = APIRouter(prefix='/api/returns', tags=['returns'])

RETURN_WINDOW_DAYS = 7
TRANSITIONS = {
    'requested': ['approved', 'rejected'],
    'approved': ['received', 'rejected'],
    'received': ['refunded', 'rejected'],
}


@router.post('')
async def create_return(payload: dict, session: dict = Depends(get_session)):
    order = await db.orders.find_one({'_id': ObjectId(payload['orderId'])})
    if not order:
        raise HTTPException(status_code=404, detail='Order not found.')
    if session['role'] == 'customer' and order.get('customerId') != session['user_id']:
        raise HTTPException(status_code=403, detail='Not authorized to request a return for this order.')
    if order['orderStatus'] != 'delivered':
        raise HTTPException(status_code=400, detail='Returns can only be requested for orders that have been delivered.')

    delivered_at = order.get('deliveredAt')
    if delivered_at:
        delivered_dt = datetime.fromisoformat(delivered_at)
        days_since = (datetime.now(timezone.utc) - delivered_dt).days
        if days_since > RETURN_WINDOW_DAYS:
            raise HTTPException(status_code=400, detail=f'Return window ({RETURN_WINDOW_DAYS} days from delivery) has expired.')

    reason = payload.get('reason', '')
    is_defect = 'defect' in reason.lower() or 'wrong' in reason.lower() or 'error' in reason.lower()

    ret = Return(
        orderId=payload['orderId'], items=payload.get('items', []), reason=reason,
        status='requested', refundAmount=0,
        returnShippingPaidBy='store' if is_defect else 'customer',
        createdAt=now_iso(),
    )
    result = await db.returns.insert_one(ret.to_mongo())
    doc = await db.returns.find_one({'_id': result.inserted_id})
    await log_activity('return', str(doc['_id']), 'requested', session['user_id'], session['role'])
    return Return.from_mongo(doc)


@router.get('')
async def list_returns(session: dict = Depends(get_session)):
    if session['role'] == 'customer':
        my_order_ids = [o['_id'] for o in await db.orders.find({'customerId': session['user_id']}, {'_id': 1}).to_list(2000)]
        docs = await db.returns.find({'orderId': {'$in': [str(i) for i in my_order_ids]}}).sort('createdAt', -1).to_list(1000)
    else:
        docs = await db.returns.find().sort('createdAt', -1).to_list(1000)
    return [Return.from_mongo(d) for d in docs]


@router.put('/{return_id}/status')
async def update_return_status(return_id: str, payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    doc = await db.returns.find_one({'_id': ObjectId(return_id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Return not found.')

    status = payload.get('status')
    allowed_next = TRANSITIONS.get(doc['status'], [])
    if status not in allowed_next:
        raise HTTPException(status_code=400, detail=f'Cannot move return from "{doc["status"]}" to "{status}".')

    updates = {'status': status, 'updatedAt': now_iso()}
    if status == 'refunded':
        updates['refundAmount'] = float(payload.get('refundAmount', 0))

    await db.returns.update_one({'_id': ObjectId(return_id)}, {'$set': updates})
    await log_activity('return', return_id, f'status_changed:{doc["status"]}->{status}', session['user_id'], session['role'])
    updated = await db.returns.find_one({'_id': ObjectId(return_id)})
    return Return.from_mongo(updated)
