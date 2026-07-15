/**
 * Api_Orders.gs
 * ------------------------------------------------------------------
 * Order pipeline: pending -> confirmed -> processing -> shipped ->
 * delivered  (or cancelled at any point before shipped).
 *
 * Critically, prices and MOQ are recalculated server-side from
 * Products.calculatePrice on every order creation — never trust the
 * cart totals sent by the client.
 * ------------------------------------------------------------------
 */

const Orders = {

  /**
   * payload.items = [{ productId, color, size, quantity }, ...]
   * payload.shippingAddress = { line1, line2, city, state, pincode }
   * payload.customerId is optional (guest checkout) — if absent,
   * payload.guestName / guestEmail / guestPhone should be supplied
   * and stored as the customerName with customerId left blank.
   */
  create: function (payload, token) {
    if (!payload.items || !payload.items.length) throw new Error('Cart is empty.');

    // Group items by productId to check MOQ across colors/sizes of the same product.
    const byProduct = {};
    payload.items.forEach(function (item) {
      byProduct[item.productId] = (byProduct[item.productId] || 0) + Number(item.quantity);
    });

    let subtotal = 0;
    const priced = payload.items.map(function (item) {
      const totalQtyForProduct = byProduct[item.productId];
      const priceInfo = Products.calculatePrice(item.productId, totalQtyForProduct);
      if (!priceInfo.moqMet) {
        const product = Products.get(item.productId);
        throw new Error('MOQ not met for "' + product.name + '" — minimum ' + priceInfo.moq + ' units required.');
      }
      const lineTotal = priceInfo.unitPrice * Number(item.quantity);
      subtotal += lineTotal;
      return {
        productId: item.productId,
        color: item.color,
        size: item.size,
        quantity: Number(item.quantity),
        unitPrice: priceInfo.unitPrice,
        lineTotal: lineTotal
      };
    });

    const shippingCost = calculateShipping_(payload.shippingAddress ? payload.shippingAddress.pincode : null, subtotal);
    const taxPercent = Number(getSetting('taxPercent') || 0);
    const tax = Math.round(subtotal * taxPercent) / 100;
    const total = subtotal + shippingCost + tax;

    let customerId = '';
    let customerName = payload.guestName || 'Guest';
    if (token) {
      try {
        const session = requireSession_(token);
        if (session.role === 'customer') {
          customerId = session.userId;
          customerName = DB.getById('Customers', customerId).name;
        }
      } catch (e) { /* invalid token on a guest checkout is fine — fall through as guest */ }
    }

    const order = DB.insert('Orders', {
      orderNumber: generateOrderNumber_(),
      customerId: customerId,
      customerName: customerName,
      itemsJson: priced,
      subtotal: subtotal,
      shippingCost: shippingCost,
      tax: tax,
      discount: 0,
      total: total,
      paymentMethod: payload.paymentMethod || 'cod',
      paymentStatus: payload.paymentMethod === 'cod' ? 'pending' : 'pending',
      orderStatus: 'pending',
      shippingAddressJson: payload.shippingAddress || {},
      notes: payload.notes || ''
    });

    return order;
  },

  list: function (filters, token) {
    filters = filters || {};
    const session = requireSession_(token);

    if (session.role === 'customer') {
      return DB.query('Orders', function (o) { return o.customerId === session.userId; });
    }
    // admin/staff can see everything, optionally filtered by status
    return DB.query('Orders', function (o) {
      return !filters.status || o.orderStatus === filters.status;
    });
  },

  get: function (id, token) {
    const session = requireSession_(token);
    const order = DB.getById('Orders', id);
    if (!order) throw new Error('Order not found.');
    if (session.role === 'customer' && order.customerId !== session.userId) {
      throw new Error('Not authorized to view this order.');
    }
    return order;
  },

  updateStatus: function (id, status, token) {
    requireRole_(token, ['admin', 'staff']);
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (validStatuses.indexOf(status) === -1) throw new Error('Invalid order status: ' + status);
    const updated = DB.update('Orders', id, { orderStatus: status });
    if (!updated) throw new Error('Order not found.');
    return updated;
  }
};

function generateOrderNumber_() {
  const now = new Date();
  const stamp = Utilities.formatDate(now, 'Asia/Kolkata', 'yyMMdd-HHmmss');
  return 'ORD-' + stamp;
}

/** Looks up ShippingZones by pincode prefix and returns the rate, honoring free-shipping thresholds. */
function calculateShipping_(pincode, subtotal) {
  if (!pincode) return 0;
  const zones = DB.query('ShippingZones', function (z) { return z.active; });

  const match = zones.find(function (z) {
    return (z.pincodePrefixesJson || []).some(function (prefix) {
      return String(pincode).indexOf(String(prefix)) === 0;
    });
  });
  if (!match) return 0;
  if (match.freeShippingThreshold && subtotal >= Number(match.freeShippingThreshold)) return 0;
  return Number(match.rate) || 0;
}
