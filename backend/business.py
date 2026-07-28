import re
import random
import smtplib
import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone
from database import db


EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
PHONE_RE = re.compile(r'^[6-9]\d{9}$')  # Indian 10-digit mobile numbers


def is_valid_email(email: str) -> bool:
    return bool(email) and bool(EMAIL_RE.match(email.strip()))


def is_valid_phone(phone: str) -> bool:
    return bool(phone) and bool(PHONE_RE.match(phone.strip()))


def slugify(text: str) -> str:
    text = re.sub(r'[^a-z0-9]+', '-', (text or '').lower().strip())
    return re.sub(r'(^-|-$)', '', text)


def gen_number(prefix: str) -> str:
    stamp = datetime.now(timezone.utc).strftime('%y%m%d-%H%M%S')
    suffix = f'{random.randint(0, 9999):04d}'
    return f'{prefix}-{stamp}-{suffix}'


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def calculate_price(product: dict, quantity: int) -> dict:
    tiers = sorted(product.get('tierPricing') or [], key=lambda t: t['minQty'])
    unit_price = product.get('basePrice', 0)
    for tier in tiers:
        if quantity >= tier['minQty']:
            unit_price = tier['price']
    moq = int(product.get('moq') or 1)
    return {
        'unitPrice': unit_price,
        'lineTotal': unit_price * quantity,
        'moq': moq,
        'moqMet': quantity >= moq,
    }


async def get_settings_dict() -> dict:
    rows = await db.settings.find().to_list(1000)
    return {r['_id']: r['value'] for r in rows}


async def get_setting(key: str, default=None):
    row = await db.settings.find_one({'_id': key})
    return row['value'] if row else default


async def set_setting(key: str, value):
    await db.settings.update_one({'_id': key}, {'$set': {'value': value}}, upsert=True)


class EmailNotConfigured(Exception):
    pass


def _send_email_sync(host: str, port: int, user: str, password: str, from_email: str, to_email: str, subject: str, html_body: str):
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = from_email or user
    msg['To'] = to_email
    msg.attach(MIMEText(html_body, 'html'))

    with smtplib.SMTP(host, port, timeout=15) as server:
        server.starttls()
        server.login(user, password)
        server.sendmail(from_email or user, [to_email], msg.as_string())


async def send_email(to_email: str, subject: str, html_body: str):
    """Sends an email via SMTP (Gmail/Outlook app-password style). Settings
    keys used: smtpHost, smtpPort, smtpUser, smtpPassword, sellerEmail
    (used as the From address if set, falling back to smtpUser)."""
    settings = await get_settings_dict()
    host = settings.get('smtpHost')
    user = settings.get('smtpUser')
    password = settings.get('smtpPassword')
    port = int(settings.get('smtpPort') or 587)
    from_email = settings.get('sellerEmail') or user

    if not host or not user or not password:
        raise EmailNotConfigured('SMTP is not configured yet — an admin must add SMTP details in Settings.')

    # smtplib is blocking — run it off the event loop so one slow send
    # doesn't stall every other request being handled by this server.
    await asyncio.to_thread(_send_email_sync, host, port, user, password, from_email, to_email, subject, html_body)


async def calculate_shipping(pincode, subtotal: float) -> float:
    if not pincode:
        return 0
    zones = await db.shipping_zones.find({'active': True}).to_list(1000)
    for z in zones:
        prefixes = z.get('pincodePrefixes') or []
        if any(str(pincode).startswith(str(p)) for p in prefixes):
            threshold = z.get('freeShippingThreshold')
            if threshold is not None and subtotal >= float(threshold):
                return 0
            return float(z.get('rate') or 0)
    return 0


async def calculate_tax(subtotal: float, shipping_state: str) -> dict:
    settings = await get_settings_dict()
    tax_percent = float(settings.get('taxPercent', 0) or 0)
    seller_state = str(settings.get('sellerState') or '').strip().lower()
    ship_state = str(shipping_state or '').strip().lower()

    if ship_state and seller_state and ship_state == seller_state:
        cgst = round(subtotal * (tax_percent / 2) / 100, 2)
        sgst = cgst
        igst = 0.0
    else:
        cgst = 0.0
        sgst = 0.0
        igst = round(subtotal * tax_percent / 100, 2)

    return {
        'cgst': cgst,
        'sgst': sgst,
        'igst': igst,
        'taxPercent': tax_percent,
        'total': round(cgst + sgst + igst, 2),
    }


class InsufficientStockError(Exception):
    pass


async def deduct_stock_for_items(items: list):
    from database import db
    from bson import ObjectId
    # Validate every line BEFORE deducting anything — otherwise a multi-item
    # order could partially deduct stock for item 1, then fail on item 2,
    # leaving inconsistent numbers. This also catches the real race: several
    # orders can sit "pending" against the same stock simultaneously (stock
    # only decrements on confirm), so confirming one late shouldn't be able
    # to push stock negative just because it was first in the queue.
    for item in items:
        product = await db.products.find_one({'_id': ObjectId(item['productId'])})
        if not product:
            continue
        needed = int(item.get('quantity', 0))
        available = product.get('stock', 0)
        if needed > available:
            raise InsufficientStockError(
                f'Not enough stock for "{product["name"]}" — {available} available, {needed} needed. '
                'Another order may have used up the remaining stock first.'
            )

    for item in items:
        await db.products.update_one(
            {'_id': ObjectId(item['productId'])},
            {'$inc': {'stock': -int(item.get('quantity', 0))}},
        )


async def restore_stock_for_items(items: list):
    from database import db
    from bson import ObjectId
    for item in items:
        product = await db.products.find_one({'_id': ObjectId(item['productId'])})
        if not product:
            continue
        restored = product.get('stock', 0) + int(item.get('quantity', 0))
        cap = product.get('totalStock', 0) or restored
        await db.products.update_one({'_id': ObjectId(item['productId'])}, {'$set': {'stock': min(restored, cap)}})


async def log_activity(entity_type: str, entity_id: str, action: str, actor_id: str = '', actor_role: str = '', details: dict = None):
    await db.activity_log.insert_one({
        'entityType': entity_type,
        'entityId': str(entity_id),
        'action': action,
        'actorId': actor_id,
        'actorRole': actor_role,
        'details': details or {},
        'createdAt': now_iso(),
    })
