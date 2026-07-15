/**
 * Code.gs
 * ------------------------------------------------------------------
 * Web app entry points.
 *
 * doGet  -> serves the front-end HTML shell (?page=store|portal|admin).
 *           Swap in your built React/HTML bundles here later; for now
 *           it serves placeholder pages so the deployment is testable
 *           end-to-end from day one.
 *
 * doPost -> the JSON API. Every request body looks like:
 *             { "action": "products.list", "payload": {...}, "token": "..." }
 *           and every response looks like:
 *             { "success": true, "data": ... }
 *           or:
 *             { "success": false, "error": "message" }
 *
 * ROUTES maps action names to handler functions. Add one line per
 * new endpoint as you build out each module (Invoices, Returns,
 * PrintJobs, ShippingZones, Chatbot, etc.) following the same pattern
 * as Api_Products.gs / Api_Orders.gs / Api_Quotes.gs.
 * ------------------------------------------------------------------
 */

function doGet(e) {
  const page = (e.parameter.page || 'store').toLowerCase();
  const fileMap = { store: 'Storefront', portal: 'Portal', admin: 'Admin' };
  const fileName = fileMap[page] || 'Storefront';

  return HtmlService.createHtmlOutputFromFile(fileName)
    .setTitle('Wholesale Store')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput_({ success: false, error: 'Invalid JSON body.' });
  }

  const action = body.action;
  const handler = ROUTES[action];

  if (!handler) {
    return jsonOutput_({ success: false, error: 'Unknown action: ' + action });
  }

  try {
    const data = handler(body.payload || {}, body.token || null);
    return jsonOutput_({ success: true, data: data });
  } catch (err) {
    return jsonOutput_({ success: false, error: err.message || String(err) });
  }
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Action name -> handler(payload, token). Handlers throw on error;
 * doPost catches and formats the error response automatically.
 */
const ROUTES = {
  // ---- Auth ----
  'auth.login': function (p) { return login(p.email, p.password, p.accountType); },
  'auth.registerCustomer': function (p) { return registerCustomer(p); },
  'auth.logout': function (p, token) { return logout(token); },

  // ---- Products (public read, admin write) ----
  'products.list': function (p) { return Products.list(p); },
  'products.get': function (p) { return Products.get(p.id); },
  'products.create': function (p, token) { return Products.create(p, token); },
  'products.update': function (p, token) { return Products.update(p.id, p, token); },
  'products.delete': function (p, token) { return Products.remove(p.id, token); },
  'products.calcPrice': function (p) { return Products.calculatePrice(p.productId, p.quantity); },

  // ---- Orders ----
  'orders.create': function (p, token) { return Orders.create(p, token); },
  'orders.list': function (p, token) { return Orders.list(p, token); },
  'orders.get': function (p, token) { return Orders.get(p.id, token); },
  'orders.updateStatus': function (p, token) { return Orders.updateStatus(p.id, p.status, token); },

  // ---- Quotes ----
  'quotes.create': function (p, token) { return Quotes.create(p, token); },
  'quotes.list': function (p, token) { return Quotes.list(p, token); },
  'quotes.updateStatus': function (p, token) { return Quotes.updateStatus(p.id, p.status, token); },
  'quotes.convertToOrder': function (p, token) { return Quotes.convertToOrder(p.id, token); },

  // ---- Customers / Portal ----
  'customers.me': function (p, token) { return Customers.me(token); },
  'customers.updateProfile': function (p, token) { return Customers.updateProfile(p, token); },
  'customers.addresses.list': function (p, token) { return Customers.listAddresses(token); },
  'customers.addresses.save': function (p, token) { return Customers.saveAddress(p, token); },
  'customers.wishlist.toggle': function (p, token) { return Customers.toggleWishlist(p.productId, token); },
  'customers.wishlist.list': function (p, token) { return Customers.listWishlist(token); },
  'customers.dashboard': function (p, token) { return Customers.dashboard(token); },

  // ---- Invoices ----
  'invoices.create': function (p, token) { return Invoices.create(p, token); },
  'invoices.list': function (p, token) { return Invoices.list(p, token); },
  'invoices.get': function (p, token) { return Invoices.get(p.id, token); },
  'invoices.email': function (p, token) { return Invoices.email(p.id, token); },

  // ---- Payments ----
  'payments.create': function (p, token) { return Payments.create(p, token); },
  'payments.listByInvoice': function (p, token) { return Payments.listByInvoice(p.invoiceId, token); },
  'payments.list': function (p, token) { return Payments.list(p, token); }

  // Add Returns.*, PrintJobs.*, ShippingZones.*, BankAccounts.*,
  // Settings.*, ChatbotKB.*, and Chatbot.ask following the exact same
  // pattern once each Api_*.gs module is written.
};
