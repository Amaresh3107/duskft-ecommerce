import csv
import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from database import db
from deps import require_roles

router = APIRouter(prefix='/api/export', tags=['export'])


@router.get('/orders.csv')
async def export_orders(session: dict = Depends(require_roles('admin', 'staff'))):
    docs = await db.orders.find().sort('createdAt', -1).to_list(10000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(['Order Number', 'Customer', 'Subtotal', 'Shipping', 'Tax', 'Discount', 'Total', 'Payment Status', 'Order Status', 'Created At'])
    for o in docs:
        writer.writerow([o.get('orderNumber'), o.get('customerName'), o.get('subtotal'), o.get('shippingCost'),
                          o.get('tax'), o.get('discount'), o.get('total'), o.get('paymentStatus'), o.get('orderStatus'), o.get('createdAt')])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type='text/csv',
                              headers={'Content-Disposition': 'attachment; filename=orders.csv'})


@router.get('/customers.csv')
async def export_customers(session: dict = Depends(require_roles('admin', 'staff'))):
    docs = await db.customers.find().to_list(10000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(['Name', 'Email', 'Phone', 'Business Name', 'GST Number', 'Status', 'Created At'])
    for c in docs:
        writer.writerow([c.get('name'), c.get('email'), c.get('phone'), c.get('businessName'), c.get('gstNumber'), c.get('status'), c.get('createdAt')])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type='text/csv',
                              headers={'Content-Disposition': 'attachment; filename=customers.csv'})
