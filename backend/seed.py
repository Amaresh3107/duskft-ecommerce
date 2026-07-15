from datetime import datetime, timezone
import os
from database import db
from auth_utils import hash_password
from business import now_iso


async def ensure_indexes():
    await db.users.create_index('email', unique=True)
    await db.customers.create_index('email', unique=True)
    await db.products.create_index('slug')
    await db.categories.create_index('slug')
    await db.orders.create_index('orderNumber')
    await db.quotes.create_index('quoteNumber')
    await db.invoices.create_index('orderId')
    await db.invoices.create_index('invoiceNumber')


async def seed_defaults():
    await ensure_indexes()

    admin_email = 'admin@example.com'
    admin_password = 'ChangeMe123!'
    existing_admin = await db.users.find_one({'email': admin_email})
    if not existing_admin:
        await db.users.insert_one({
            'name': 'Admin',
            'email': admin_email,
            'passwordHash': hash_password(admin_password),
            'role': 'admin',
            'status': 'active',
            'createdAt': now_iso(),
        })

    default_settings = {
        'storeName': 'Antigravity Wholesale',
        'currency': 'INR',
        'currencySymbol': '\u20B9',
        'taxPercent': '18',
        'sellerState': 'Maharashtra',
        'gstNumber': '27AAAAA0000A1Z5',
        'sellerAddress': 'Unit 4, Textile Market, Andheri East, Mumbai, Maharashtra 400069',
        'sellerPhone': '+91 98765 43210',
        'sellerEmail': 'orders@antigravitywholesale.com',
        'whatsappNumber': '919876543210',
        'freeShippingThreshold': '15000',
        'shippingPolicyText': 'Orders ship within 2-3 business days. Shipping cost depends on your delivery pincode and is calculated at checkout; orders above the free-shipping threshold ship free.',
        'returnPolicyText': 'Returns are accepted within 7 days of delivery for the full order. Customer pays return shipping unless the reason is a store error, defect, or quality issue, in which case the store covers it.',
        'geminiApiKey': os.environ.get('GEMINI_API_KEY', ''),
        'geminiModel': os.environ.get('GEMINI_MODEL', 'gemini-3.5-flash'),
        'aiSystemPrompt': 'You are a helpful assistant for a wholesale clothing store. Answer questions about products, MOQ, tier pricing, shipping and orders using only the provided context. If unsure, say you are not sure and offer to connect the customer over WhatsApp.',
    }
    for key, value in default_settings.items():
        existing = await db.settings.find_one({'_id': key})
        if not existing:
            await db.settings.update_one({'_id': key}, {'$set': {'value': value}}, upsert=True)

    if not await db.customers.find_one({'email': 'buyer1@example.com'}):
        await db.customers.insert_one({
            'name': 'Boutique Buyer', 'email': 'buyer1@example.com', 'phone': '9998887770',
            'passwordHash': hash_password('buyer123'), 'businessName': 'Buyer Boutique',
            'gstNumber': '', 'status': 'active', 'createdAt': now_iso(),
        })

    if await db.categories.count_documents({}) == 0:
        cats = [
            {'name': 'Kurtas & Sets', 'slug': 'kurtas-sets', 'imageUrl': '', 'sortOrder': 1, 'active': True},
            {'name': 'Dresses', 'slug': 'dresses', 'imageUrl': '', 'sortOrder': 2, 'active': True},
            {'name': 'Formal Shirts', 'slug': 'formal-shirts', 'imageUrl': '', 'sortOrder': 3, 'active': True},
        ]
        result = await db.categories.insert_many(cats)
        cat_ids = result.inserted_ids

        products = [
            {
                'sku': 'KRT-001', 'name': 'Chikankari Cotton Kurta', 'slug': 'chikankari-cotton-kurta',
                'categoryId': str(cat_ids[0]), 'description': 'Hand-embroidered chikankari cotton kurta, breathable summer fabric.',
                'images': ['https://images.unsplash.com/photo-1583391733956-6c78276477e2'], 'videoUrl': '',
                'colors': ['White', 'Sky Blue', 'Mint'], 'sizes': ['S', 'M', 'L', 'XL'],
                'tierPricing': [{'minQty': 1, 'price': 650}, {'minQty': 50, 'price': 550}, {'minQty': 200, 'price': 480}],
                'basePrice': 650, 'moq': 20, 'stock': 500, 'status': 'active', 'createdAt': now_iso(),
            },
            {
                'sku': 'DRS-001', 'name': 'Printed Rayon Wrap Dress', 'slug': 'printed-rayon-wrap-dress',
                'categoryId': str(cat_ids[1]), 'description': 'Flowy rayon wrap dress with all-over floral print.',
                'images': ['https://images.unsplash.com/photo-1595777457583-95e059d581b8'], 'videoUrl': '',
                'colors': ['Maroon', 'Navy', 'Emerald'], 'sizes': ['S', 'M', 'L', 'XL', 'XXL'],
                'tierPricing': [{'minQty': 1, 'price': 890}, {'minQty': 30, 'price': 760}, {'minQty': 100, 'price': 680}],
                'basePrice': 890, 'moq': 15, 'stock': 300, 'status': 'active', 'createdAt': now_iso(),
            },
            {
                'sku': 'SHT-001', 'name': 'Slim Fit Formal Shirt', 'slug': 'slim-fit-formal-shirt',
                'categoryId': str(cat_ids[2]), 'description': 'Wrinkle-resistant cotton-blend formal shirt for retail resale.',
                'images': ['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf'], 'videoUrl': '',
                'colors': ['White', 'Light Blue', 'Black'], 'sizes': ['38', '40', '42', '44'],
                'tierPricing': [{'minQty': 1, 'price': 750}, {'minQty': 40, 'price': 640}, {'minQty': 150, 'price': 570}],
                'basePrice': 750, 'moq': 25, 'stock': 400, 'status': 'active', 'createdAt': now_iso(),
            },
        ]
        await db.products.insert_many(products)

    if await db.shipping_zones.count_documents({}) == 0:
        await db.shipping_zones.insert_many([
            {'name': 'Maharashtra Local', 'pincodePrefixes': ['40', '41'], 'rate': 99, 'freeShippingThreshold': 15000, 'estimatedDays': 3, 'active': True},
            {'name': 'Rest of India', 'pincodePrefixes': ['1', '2', '3', '5', '6', '7', '8', '9'], 'rate': 249, 'freeShippingThreshold': 15000, 'estimatedDays': 6, 'active': True},
        ])

    if await db.bank_accounts.count_documents({}) == 0:
        await db.bank_accounts.insert_many([
            {'accountName': 'Antigravity Wholesale Pvt Ltd', 'accountNumber': '000123456789', 'ifsc': 'HDFC0001234', 'bankName': 'HDFC Bank', 'upiId': 'antigravity@hdfcbank', 'qrImageUrl': '', 'active': True},
        ])
