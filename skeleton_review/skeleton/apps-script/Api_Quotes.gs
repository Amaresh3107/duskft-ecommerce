/**
 * Api_Quotes.gs
 * ------------------------------------------------------------------
 * Pipeline: draft -> open -> approved -> converted (or -> lost at any
 * point before converted). Only admin/staff manage quotes in this
 * skeleton; wire up customer-facing "request a quote" by calling
 * Quotes.create from the storefront with the customer's session token.
 * ------------------------------------------------------------------
 */

const Quotes = {

  create: function (payload, token) {
    const session = requireSession_(token);
    let subtotal = 0;
    const items = (payload.items || []).map(function (item) {
      const lineTotal = Number(item.unitPrice) * Number(item.quantity);
      subtotal += lineTotal;
      return {
        productId: item.productId,
        color: item.color,
        size: item.size,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        lineTotal: lineTotal
      };
    });

    return DB.insert('Quotes', {
      quoteNumber: 'QT-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd-HHmmss'),
      customerId: payload.customerId || session.userId,
      itemsJson: items,
      subtotal: subtotal,
      status: 'draft',
      validUntil: payload.validUntil || '',
      convertedOrderId: '',
      notes: payload.notes || ''
    });
  },

  list: function (filters, token) {
    filters = filters || {};
    const session = requireSession_(token);

    if (session.role === 'customer') {
      return DB.query('Quotes', function (q) { return q.customerId === session.userId; });
    }
    return DB.query('Quotes', function (q) {
      return !filters.status || q.status === filters.status;
    });
  },

  updateStatus: function (id, status, token) {
    requireRole_(token, ['admin', 'staff']);
    const validStatuses = ['draft', 'open', 'approved', 'converted', 'lost'];
    if (validStatuses.indexOf(status) === -1) throw new Error('Invalid quote status: ' + status);
    const updated = DB.update('Quotes', id, { status: status });
    if (!updated) throw new Error('Quote not found.');
    return updated;
  },

  /** Converts an approved quote directly into an Order, and marks the quote converted. */
  convertToOrder: function (id, token) {
    requireRole_(token, ['admin', 'staff']);
    const quote = DB.getById('Quotes', id);
    if (!quote) throw new Error('Quote not found.');
    if (quote.status !== 'approved') throw new Error('Only approved quotes can be converted to an order.');

    const customer = DB.getById('Customers', quote.customerId);
    const order = DB.insert('Orders', {
      orderNumber: generateOrderNumber_(),
      customerId: quote.customerId,
      customerName: customer ? customer.name : 'Customer',
      itemsJson: quote.itemsJson,
      subtotal: quote.subtotal,
      shippingCost: 0,
      tax: 0,
      discount: 0,
      total: quote.subtotal,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending',
      orderStatus: 'confirmed',
      shippingAddressJson: {},
      notes: 'Converted from quote ' + quote.quoteNumber
    });

    DB.update('Quotes', id, { status: 'converted', convertedOrderId: order.id });
    return order;
  }
};
