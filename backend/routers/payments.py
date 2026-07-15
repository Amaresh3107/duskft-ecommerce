from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import Payment
from deps import require_roles, get_session
from business import now_iso


router = APIRouter(prefix='/api/payments', tags=['payments'])


async def recalc_invoice_status(invoice_id: str):
    invoice = await db.invoices.find_one({'_id': ObjectId(invoice_id)})
    if not invoice:
        return
    status = 'unpaid'
    if invoice['amountPaid'] >= invoice['totalAmount']:
        status = 'paid'
    elif invoice['amountPaid'] > 0:
        status = 'partial'
    await db.invoices.update_one({'_id': ObjectId(invoice_id)}, {'$set': {'status': status}})

    if status in ('paid', 'partial'):
        await db.orders.update_one({'_id': ObjectId(invoice['orderId'])}, {'$set': {'paymentStatus': status}})


@router.post('')
async def create_payment(payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    invoice = await db.invoices.find_one({'_id': ObjectId(payload['invoiceId'])})
    if not invoice:
        raise HTTPException(status_code=404, detail='Invoice not found.')

    amount = float(payload.get('amount', 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail='Payment amount must be greater than zero.')

    outstanding = invoice['totalAmount'] - invoice['amountPaid']
    if amount > outstanding + 0.01:
        raise HTTPException(status_code=400, detail=f'Payment ({amount}) exceeds outstanding balance ({outstanding}).')

    payment = Payment(
        invoiceId=payload['invoiceId'], orderId=invoice['orderId'], amount=amount,
        method=payload.get('method', 'bank_transfer'), reference=payload.get('reference', ''),
        recordedBy=session['user_id'], createdAt=now_iso(),
    )
    result = await db.payments.insert_one(payment.to_mongo())

    await db.invoices.update_one({'_id': ObjectId(payload['invoiceId'])}, {'$inc': {'amountPaid': amount}})
    await recalc_invoice_status(payload['invoiceId'])

    doc = await db.payments.find_one({'_id': result.inserted_id})
    return Payment.from_mongo(doc)


@router.get('/by-invoice/{invoice_id}')
async def list_by_invoice(invoice_id: str, session: dict = Depends(get_session)):
    if session['role'] == 'customer':
        invoice = await db.invoices.find_one({'_id': ObjectId(invoice_id)})
        if not invoice or invoice.get('customerId') != session['user_id']:
            raise HTTPException(status_code=403, detail='Not authorized to view payments for this invoice.')
    docs = await db.payments.find({'invoiceId': invoice_id}).sort('createdAt', -1).to_list(1000)
    return [Payment.from_mongo(d) for d in docs]


@router.get('')
async def list_payments(invoiceId: str | None = None, orderId: str | None = None, session: dict = Depends(require_roles('admin', 'staff'))):
    query = {}
    if invoiceId:
        query['invoiceId'] = invoiceId
    if orderId:
        query['orderId'] = orderId
    docs = await db.payments.find(query).sort('createdAt', -1).to_list(1000)
    return [Payment.from_mongo(d) for d in docs]
