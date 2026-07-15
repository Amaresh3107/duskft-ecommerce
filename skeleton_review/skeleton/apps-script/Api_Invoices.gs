/**
 * Api_Invoices.gs
 * ------------------------------------------------------------------
 * amountJson breakdown = { subtotal, shippingCost, tax, discount }
 * status is derived, not set by hand: 'unpaid' -> 'partial' -> 'paid'
 * (see recalcStatus_ below, called automatically by Payments.create).
 * ------------------------------------------------------------------
 */

const Invoices = {

  /** Generates an invoice from an existing order. One invoice per order. */
  create: function (payload, token) {
    requireRole_(token, ['admin', 'staff']);
    const order = DB.getById('Orders', payload.orderId);
    if (!order) throw new Error('Order not found.');

    const existing = DB.query('Invoices', function (i) { return i.orderId === order.id; })[0];
    if (existing) return existing; // idempotent — don't double-invoice an order

    return DB.insert('Invoices', {
      invoiceNumber: 'INV-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd-HHmmss'),
      orderId: order.id,
      customerId: order.customerId,
      amountJson: {
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        tax: order.tax,
        discount: order.discount || 0
      },
      totalAmount: order.total,
      amountPaid: 0,
      status: 'unpaid',
      dueDate: payload.dueDate || ''
    });
  },

  list: function (filters, token) {
    filters = filters || {};
    const session = requireSession_(token);

    if (session.role === 'customer') {
      return DB.query('Invoices', function (i) { return i.customerId === session.userId; });
    }
    return DB.query('Invoices', function (i) {
      return !filters.status || i.status === filters.status;
    });
  },

  get: function (id, token) {
    const session = requireSession_(token);
    const invoice = DB.getById('Invoices', id);
    if (!invoice) throw new Error('Invoice not found.');
    if (session.role === 'customer' && invoice.customerId !== session.userId) {
      throw new Error('Not authorized to view this invoice.');
    }
    return invoice;
  },

  outstandingBalance: function (id) {
    const invoice = DB.getById('Invoices', id);
    if (!invoice) throw new Error('Invoice not found.');
    return Number(invoice.totalAmount) - Number(invoice.amountPaid);
  },

  /** Emails a plain HTML summary of the invoice to the customer on file. */
  email: function (id, token) {
    requireRole_(token, ['admin', 'staff']);
    const invoice = DB.getById('Invoices', id);
    if (!invoice) throw new Error('Invoice not found.');
    const customer = DB.getById('Customers', invoice.customerId);
    if (!customer || !customer.email) throw new Error('Customer has no email on file.');

    const storeName = getSetting('storeName') || 'Our Store';
    const symbol = getSetting('currencySymbol') || '';
    const a = invoice.amountJson || {};

    const html =
      '<h2>' + invoice.invoiceNumber + '</h2>' +
      '<p>From: ' + storeName + '</p>' +
      '<table cellpadding="6" style="border-collapse:collapse">' +
      '<tr><td>Subtotal</td><td>' + symbol + a.subtotal + '</td></tr>' +
      '<tr><td>Shipping</td><td>' + symbol + a.shippingCost + '</td></tr>' +
      '<tr><td>Tax</td><td>' + symbol + a.tax + '</td></tr>' +
      '<tr><td>Discount</td><td>-' + symbol + a.discount + '</td></tr>' +
      '<tr><td><b>Total</b></td><td><b>' + symbol + invoice.totalAmount + '</b></td></tr>' +
      '<tr><td>Amount Paid</td><td>' + symbol + invoice.amountPaid + '</td></tr>' +
      '<tr><td><b>Balance Due</b></td><td><b>' + symbol + (invoice.totalAmount - invoice.amountPaid) + '</b></td></tr>' +
      '</table>';

    MailApp.sendEmail({
      to: customer.email,
      subject: invoice.invoiceNumber + ' from ' + storeName,
      htmlBody: html
    });
    return { sent: true, to: customer.email };
  }
};

/** Recomputes an invoice's status from amountPaid vs totalAmount. Called by Payments.create. */
function recalcInvoiceStatus_(invoiceId) {
  const invoice = DB.getById('Invoices', invoiceId);
  if (!invoice) return;
  let status = 'unpaid';
  if (Number(invoice.amountPaid) >= Number(invoice.totalAmount)) status = 'paid';
  else if (Number(invoice.amountPaid) > 0) status = 'partial';
  DB.update('Invoices', invoiceId, { status: status });
}
