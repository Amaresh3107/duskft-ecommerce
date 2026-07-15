from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import Invoice
from deps import require_roles, get_session
from business import gen_number, now_iso

router = APIRouter(prefix='/api/invoices', tags=['invoices'])


@router.post('')
async def create_invoice(payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    order = await db.orders.find_one({'_id': ObjectId(payload['orderId'])})
    if not order:
        raise HTTPException(status_code=404, detail='Order not found.')

    existing = await db.invoices.find_one({'orderId': payload['orderId']})
    if existing:
        return Invoice.from_mongo(existing)

    invoice = Invoice(
        invoiceNumber=gen_number('INV'),
        orderId=payload['orderId'],
        customerId=order.get('customerId', ''),
        amount={
            'subtotal': order['subtotal'], 'shippingCost': order['shippingCost'],
            'tax': order['tax'], 'taxBreakdown': order.get('taxBreakdown', {}), 'discount': order.get('discount', 0),
        },
        totalAmount=order['total'],
        amountPaid=0,
        status='unpaid',
        dueDate=payload.get('dueDate', ''),
        createdAt=now_iso(),
    )
    result = await db.invoices.insert_one(invoice.to_mongo())
    doc = await db.invoices.find_one({'_id': result.inserted_id})
    return Invoice.from_mongo(doc)


@router.get('')
async def list_invoices(status: str | None = None, session: dict = Depends(get_session)):
    query = {}
    if session['role'] == 'customer':
        query['customerId'] = session['user_id']
    elif status:
        query['status'] = status
    docs = await db.invoices.find(query).sort('createdAt', -1).to_list(1000)
    return [Invoice.from_mongo(d) for d in docs]


@router.get('/{invoice_id}')
async def get_invoice(invoice_id: str, session: dict = Depends(get_session)):
    doc = await db.invoices.find_one({'_id': ObjectId(invoice_id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Invoice not found.')
    if session['role'] == 'customer' and doc.get('customerId') != session['user_id']:
        raise HTTPException(status_code=403, detail='Not authorized to view this invoice.')
    return Invoice.from_mongo(doc)


@router.post('/{invoice_id}/email')
async def email_invoice(invoice_id: str, session: dict = Depends(require_roles('admin', 'staff'))):
    invoice = await db.invoices.find_one({'_id': ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(status_code=404, detail='Invoice not found.')
    customer = await db.customers.find_one({'_id': ObjectId(invoice['customerId'])}) if invoice.get('customerId') else None
    if not customer or not customer.get('email'):
        raise HTTPException(status_code=400, detail='Customer has no email on file.')
    # Email dispatch is stubbed for now — no outbound mail provider configured yet.
    return {'sent': True, 'to': customer['email'], 'stubbed': True}
