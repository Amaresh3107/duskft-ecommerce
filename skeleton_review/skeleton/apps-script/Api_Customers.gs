/**
 * Api_Customers.gs
 * ------------------------------------------------------------------
 * Powers the customer-facing portal: profile, saved addresses,
 * wishlist, and the dashboard summary (active orders, total spent,
 * pieces ordered).
 * ------------------------------------------------------------------
 */

const Customers = {

  me: function (token) {
    const session = requireSession_(token);
    if (session.role !== 'customer') throw new Error('Not a customer session.');
    const customer = DB.getById('Customers', session.userId);
    delete customer.passwordHash;
    return customer;
  },

  updateProfile: function (payload, token) {
    const session = requireSession_(token);
    if (session.role !== 'customer') throw new Error('Not a customer session.');
    const updates = {};
    ['name', 'phone', 'businessName', 'gstNumber'].forEach(function (f) {
      if (payload[f] !== undefined) updates[f] = payload[f];
    });
    const updated = DB.update('Customers', session.userId, updates);
    delete updated.passwordHash;
    return updated;
  },

  listAddresses: function (token) {
    const session = requireSession_(token);
    return DB.query('Addresses', function (a) { return a.customerId === session.userId; });
  },

  saveAddress: function (payload, token) {
    const session = requireSession_(token);
    const record = {
      customerId: session.userId,
      label: payload.label || 'Home',
      line1: payload.line1,
      line2: payload.line2 || '',
      city: payload.city,
      state: payload.state,
      pincode: payload.pincode,
      isDefault: !!payload.isDefault
    };
    if (payload.id) {
      return DB.update('Addresses', payload.id, record);
    }
    return DB.insert('Addresses', record);
  },

  toggleWishlist: function (productId, token) {
    const session = requireSession_(token);
    const existing = DB.query('Wishlist', function (w) {
      return w.customerId === session.userId && w.productId === productId;
    })[0];

    if (existing) {
      DB.remove('Wishlist', existing.id);
      return { added: false };
    }
    DB.insert('Wishlist', { customerId: session.userId, productId: productId });
    return { added: true };
  },

  listWishlist: function (token) {
    const session = requireSession_(token);
    const entries = DB.query('Wishlist', function (w) { return w.customerId === session.userId; });
    return entries.map(function (entry) {
      const product = DB.getById('Products', entry.productId);
      return Object.assign({ wishlistId: entry.id }, product);
    });
  },

  dashboard: function (token) {
    const session = requireSession_(token);
    if (session.role !== 'customer') throw new Error('Not a customer session.');

    const orders = DB.query('Orders', function (o) { return o.customerId === session.userId; });
    const activeOrders = orders.filter(function (o) {
      return ['pending', 'confirmed', 'processing', 'shipped'].indexOf(o.orderStatus) !== -1;
    });
    const totalSpent = orders.reduce(function (sum, o) { return sum + Number(o.total || 0); }, 0);
    const totalPieces = orders.reduce(function (sum, o) {
      return sum + (o.itemsJson || []).reduce(function (s, item) { return s + Number(item.quantity || 0); }, 0);
    }, 0);

    return {
      activeOrderCount: activeOrders.length,
      totalOrders: orders.length,
      totalSpent: totalSpent,
      totalPieces: totalPieces,
      recentOrders: orders.slice(-5).reverse()
    };
  }
};
