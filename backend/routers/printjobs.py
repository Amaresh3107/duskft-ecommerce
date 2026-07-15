from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import PrintJob
from deps import require_roles, get_session
from business import now_iso, log_activity

router = APIRouter(prefix='/api/print-jobs', tags=['print-jobs'])

ADMIN_STATUSES = ['pending', 'artwork_uploaded', 'proof_sent', 'in_production', 'completed', 'customer_approved', 'customer_rejected']
CUSTOMER_ALLOWED_FROM = 'proof_sent'
CUSTOMER_ALLOWED_TO = ['customer_approved', 'customer_rejected']


def strip_vendor_cost(doc: dict) -> dict:
    out = PrintJob.from_mongo(doc).model_dump(by_alias=False)
    out.pop('vendorCost', None)
    out.pop('vendorId', None)
    return out


@router.post('')
async def create_print_job(payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    order = await db.orders.find_one({'_id': ObjectId(payload['orderId'])})
    if not order:
        raise HTTPException(status_code=404, detail='Order not found.')
    job = PrintJob(
        orderId=payload['orderId'], artworkFiles=payload.get('artworkFiles', []),
        status=payload.get('status', 'pending'), vendorId=payload.get('vendorId', ''),
        vendorCost=float(payload.get('vendorCost', 0)), notes=payload.get('notes', ''),
        createdAt=now_iso(),
    )
    result = await db.print_jobs.insert_one(job.to_mongo())
    doc = await db.print_jobs.find_one({'_id': result.inserted_id})
    return PrintJob.from_mongo(doc)


@router.get('')
async def list_print_jobs(session: dict = Depends(get_session)):
    if session['role'] == 'customer':
        my_order_ids = [str(o['_id']) for o in await db.orders.find({'customerId': session['user_id']}, {'_id': 1}).to_list(2000)]
        docs = await db.print_jobs.find({'orderId': {'$in': my_order_ids}}).sort('createdAt', -1).to_list(1000)
        return [strip_vendor_cost(d) for d in docs]
    docs = await db.print_jobs.find().sort('createdAt', -1).to_list(1000)
    return [PrintJob.from_mongo(d) for d in docs]


@router.get('/{job_id}')
async def get_print_job(job_id: str, session: dict = Depends(get_session)):
    doc = await db.print_jobs.find_one({'_id': ObjectId(job_id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Print job not found.')
    if session['role'] == 'customer':
        order = await db.orders.find_one({'_id': ObjectId(doc['orderId'])})
        if not order or order.get('customerId') != session['user_id']:
            raise HTTPException(status_code=403, detail='Not authorized to view this print job.')
        return strip_vendor_cost(doc)
    return PrintJob.from_mongo(doc)


@router.put('/{job_id}/status')
async def update_print_job_status(job_id: str, payload: dict, session: dict = Depends(get_session)):
    doc = await db.print_jobs.find_one({'_id': ObjectId(job_id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Print job not found.')

    status = payload.get('status')
    if session['role'] == 'customer':
        order = await db.orders.find_one({'_id': ObjectId(doc['orderId'])})
        if not order or order.get('customerId') != session['user_id']:
            raise HTTPException(status_code=403, detail='Not authorized to update this print job.')
        if doc['status'] != CUSTOMER_ALLOWED_FROM or status not in CUSTOMER_ALLOWED_TO:
            raise HTTPException(status_code=403, detail='Customers can only approve/reject a proof once it has been sent.')
    elif status not in ADMIN_STATUSES:
        raise HTTPException(status_code=400, detail=f'Invalid print job status: {status}')

    updates = {'status': status, 'updatedAt': now_iso()}
    if 'artworkFiles' in payload and session['role'] in ('admin', 'staff'):
        updates['artworkFiles'] = payload['artworkFiles']
    if 'vendorCost' in payload and session['role'] in ('admin', 'staff'):
        updates['vendorCost'] = float(payload['vendorCost'])
    if 'vendorId' in payload and session['role'] in ('admin', 'staff'):
        updates['vendorId'] = payload['vendorId']

    await db.print_jobs.update_one({'_id': ObjectId(job_id)}, {'$set': updates})
    await log_activity('print_job', job_id, f'status_changed:{doc["status"]}->{status}', session['user_id'], session['role'])
    updated = await db.print_jobs.find_one({'_id': ObjectId(job_id)})
    return strip_vendor_cost(updated) if session['role'] == 'customer' else PrintJob.from_mongo(updated)
