import re
import uuid
from datetime import datetime, timezone
from database import db


def slugify(text: str) -> str:
    text = re.sub(r'[^a-z0-9]+', '-', (text or '').lower().strip())
    return re.sub(r'(^-|-$)', '', text)


def gen_number(prefix: str) -> str:
    stamp = datetime.now(timezone.utc).strftime('%y%m%d-%H%M%S')
    return f'{prefix}-{stamp}-{uuid.uuid4().hex[:4].upper()}'


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


async def calculate_shipping(pincode, subtotal: float) -> float:
    if not pincode:
        return 0
    zones = await db.shipping_zones.find({'active': True}).to_list(1000)
    for z in zones:
        prefixes = z.get('pincodePrefixes') or []
        if any(str(pincode).startswith(str(p)) for p in prefixes):
            threshold = z.get('freeShippingThreshold')
            if threshold and subtotal >= float(threshold):
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
