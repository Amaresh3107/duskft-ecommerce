/**
 * Setup.gs
 * ------------------------------------------------------------------
 * Single source of truth for the database schema. Every sheet tab,
 * its columns, and which columns hold JSON-encoded data live here.
 *
 * Run `setupDatabase()` once (Run > setupDatabase in the Apps Script
 * editor) against a fresh Google Sheet. It creates every tab, writes
 * the header row, freezes it, and seeds default Settings + a default
 * admin user so you can log in on day one.
 * ------------------------------------------------------------------
 */

// Map of sheetName -> ordered column headers.
// "id" is always column A and is auto-generated as a UUID on insert.
const SCHEMAS = {
  Products: ['id', 'sku', 'name', 'slug', 'categoryId', 'description',
    'imagesJson', 'videoUrl', 'colorsJson', 'sizesJson', 'tierPricingJson',
    'basePrice', 'moq', 'stock', 'status', 'createdAt', 'updatedAt'],

  Categories: ['id', 'name', 'slug', 'imageUrl', 'sortOrder', 'active'],

  Banners: ['id', 'imageUrl', 'link', 'sortOrder', 'active'],

  Customers: ['id', 'name', 'email', 'phone', 'passwordHash', 'businessName',
    'gstNumber', 'status', 'createdAt'],

  Addresses: ['id', 'customerId', 'label', 'line1', 'line2', 'city', 'state',
    'pincode', 'isDefault'],

  Wishlist: ['id', 'customerId', 'productId', 'createdAt'],

  Orders: ['id', 'orderNumber', 'customerId', 'customerName', 'itemsJson',
    'subtotal', 'shippingCost', 'tax', 'discount', 'total', 'paymentMethod',
    'paymentStatus', 'orderStatus', 'shippingAddressJson', 'notes',
    'createdAt', 'updatedAt'],

  Quotes: ['id', 'quoteNumber', 'customerId', 'itemsJson', 'subtotal',
    'status', 'validUntil', 'convertedOrderId', 'notes', 'createdAt', 'updatedAt'],

  Invoices: ['id', 'invoiceNumber', 'orderId', 'customerId', 'amountJson',
    'totalAmount', 'amountPaid', 'status', 'dueDate', 'createdAt'],

  Payments: ['id', 'invoiceId', 'orderId', 'amount', 'method', 'reference',
    'recordedBy', 'createdAt'],

  Returns: ['id', 'orderId', 'itemsJson', 'reason', 'status', 'refundAmount',
    'createdAt'],

  PrintJobs: ['id', 'orderId', 'artworkFilesJson', 'status', 'vendorId',
    'vendorCost', 'notes', 'createdAt', 'updatedAt'],

  Vendors: ['id', 'name', 'contact', 'notes'],

  ShippingZones: ['id', 'name', 'pincodePrefixesJson', 'rate',
    'freeShippingThreshold', 'estimatedDays', 'active'],

  BankAccounts: ['id', 'accountName', 'accountNumber', 'ifsc', 'bankName',
    'upiId', 'qrImageUrl', 'active'],

  Users: ['id', 'name', 'email', 'passwordHash', 'role', 'status', 'createdAt'],

  Sessions: ['token', 'userId', 'role', 'createdAt', 'expiresAt'],

  Settings: ['key', 'value'],

  ChatbotKB: ['id', 'question', 'answer', 'category', 'active']
};

// Columns that must be JSON.stringify'd on write and JSON.parse'd on read.
const JSON_FIELDS = {
  Products: ['imagesJson', 'colorsJson', 'sizesJson', 'tierPricingJson'],
  Orders: ['itemsJson', 'shippingAddressJson'],
  Quotes: ['itemsJson'],
  Invoices: ['amountJson'],
  Returns: ['itemsJson'],
  PrintJobs: ['artworkFilesJson'],
  ShippingZones: ['pincodePrefixesJson']
};

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(SCHEMAS).forEach(function (sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);

    const headers = SCHEMAS[sheetName];
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f1f3f4');
  });

  // Remove the default "Sheet1" if it's still hanging around and unused.
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);

  seedDefaults_();
  Logger.log('Database setup complete. Sheets created: ' + Object.keys(SCHEMAS).join(', '));
}

function seedDefaults_() {
  // Default settings
  const defaultSettings = {
    storeName: 'My Wholesale Store',
    currency: 'INR',
    currencySymbol: '\u20B9',
    taxPercent: '18',
    gstNumber: '',
    sellerAddress: '',
    sellerPhone: '',
    sellerEmail: '',
    freeShippingThreshold: '10000',
    geminiApiKey: '',
    geminiModel: 'gemini-2.0-flash',
    aiSystemPrompt: 'You are a helpful assistant for a wholesale clothing store. Answer questions about products, MOQ, shipping and orders.'
  };
  Object.keys(defaultSettings).forEach(function (key) {
    DB.insert('Settings', { key: key, value: defaultSettings[key] }, { noId: true });
  });

  // Default admin — CHANGE THIS PASSWORD after first login.
  DB.insert('Users', {
    name: 'Admin',
    email: 'admin@example.com',
    passwordHash: hashPassword_('ChangeMe123!'),
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString()
  });

  Logger.log('Seeded default settings and admin user (admin@example.com / ChangeMe123!)');
}
