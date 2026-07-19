from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import Invoice
from deps import require_roles, get_session
from business import gen_number, now_iso, send_email, EmailNotConfigured

router = APIRouter(prefix='/api/invoices', tags=['invoices'])


@router.post('')
async def create_invoice(payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    order = await db.orders.find_one({'_id': ObjectId(payload['orderId'])})
    if not order:
        raise HTTPException(status_code=404, detail='Order not found.')
    if order.get('orderStatus') == 'cancelled':
        raise HTTPException(status_code=400, detail='Cannot generate an invoice for a cancelled order.')

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

    order = await db.orders.find_one({'_id': ObjectId(invoice['orderId'])})
    outstanding = invoice['totalAmount'] - invoice['amountPaid']
    subject = f"Invoice {invoice['invoiceNumber']}" + (f" — Order {order['orderNumber']}" if order else '')
    html_body = f"""
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2 style="margin-bottom: 4px;">Invoice {invoice['invoiceNumber']}</h2>
          <p style="color: #5E6A7D; margin-top: 0;">Order {order['orderNumber'] if order else ''}</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
            <tr><td style="padding: 4px 0;">Subtotal</td><td style="text-align: right;">₹{invoice['amount'].get('subtotal', 0)}</td></tr>
            <tr><td style="padding: 4px 0;">Shipping</td><td style="text-align: right;">₹{invoice['amount'].get('shippingCost', 0)}</td></tr>
            <tr><td style="padding: 4px 0;">Tax</td><td style="text-align: right;">₹{invoice['amount'].get('tax', 0)}</td></tr>
            <tr style="font-weight: bold; border-top: 1px solid #ddd;"><td style="padding: 8px 0;">Total</td><td style="text-align: right;">₹{invoice['totalAmount']}</td></tr>
            <tr><td style="padding: 4px 0;">Paid</td><td style="text-align: right;">₹{invoice['amountPaid']}</td></tr>
            <tr style="font-weight: bold;"><td style="padding: 4px 0;">Outstanding</td><td style="text-align: right;">₹{outstanding}</td></tr>
          </table>
          <p style="color: #5E6A7D; margin-top: 16px; font-size: 13px;">
            Please reach out if you have any questions about this invoice.
          </p>
        </div>
    """

    try:
        await send_email(customer['email'], subject, html_body)
    except EmailNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=502, detail='Could not send the email — check SMTP settings and try again.')

    return {'sent': True, 'to': customer['email']}
