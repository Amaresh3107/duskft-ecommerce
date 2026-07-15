/**
 * Api_Payments.gs
 * ------------------------------------------------------------------
 * Every payment is recorded against an invoiceId. This is the ledger
 * admins use to track outstanding balances (Invoices.outstandingBalance
 * reads from the invoice's live amountPaid, which this module keeps
 * in sync on every insert).
 * ------------------------------------------------------------------
 */

const Payments = {

  /** payload = { invoiceId, amount, method, reference } */
  create: function (payload, token) {
    const session = requireRole_(token, ['admin', 'staff']);
    const invoice = DB.getById('Invoices', payload.invoiceId);
    if (!invoice) throw new Error('Invoice not found.');

    const amount = Number(payload.amount);
    if (!amount || amount <= 0) throw new Error('Payment amount must be greater than zero.');

    const outstanding = Number(invoice.totalAmount) - Number(invoice.amountPaid);
    if (amount > outstanding + 0.01) {
      throw new Error('Payment (' + amount + ') exceeds outstanding balance (' + outstanding + ').');
    }

    const payment = DB.insert('Payments', {
      invoiceId: invoice.id,
      orderId: invoice.orderId,
      amount: amount,
      method: payload.method || 'bank_transfer',
      reference: payload.reference || '',
      recordedBy: session.userId
    });

    DB.update('Invoices', invoice.id, { amountPaid: Number(invoice.amountPaid) + amount });
    recalcInvoiceStatus_(invoice.id);

    // Once fully paid, mark the underlying order's paymentStatus too.
    const refreshed = DB.getById('Invoices', invoice.id);
    if (refreshed.status === 'paid') {
      DB.update('Orders', invoice.orderId, { paymentStatus: 'paid' });
    } else if (refreshed.status === 'partial') {
      DB.update('Orders', invoice.orderId, { paymentStatus: 'partial' });
    }

    return payment;
  },

  listByInvoice: function (invoiceId, token) {
    requireSession_(token);
    return DB.query('Payments', function (p) { return p.invoiceId === invoiceId; });
  },

  list: function (filters, token) {
    requireRole_(token, ['admin', 'staff']);
    filters = filters || {};
    return DB.query('Payments', function (p) {
      return (!filters.invoiceId || p.invoiceId === filters.invoiceId) &&
             (!filters.orderId || p.orderId === filters.orderId);
    });
  }
};
