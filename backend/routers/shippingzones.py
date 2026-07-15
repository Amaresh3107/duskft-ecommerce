from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import ShippingZone
from deps import require_roles, get_optional_session
from business import calculate_shipping

router = APIRouter(prefix='/api/shipping-zones', tags=['shipping-zones'])


@router.get('')
async def list_zones(includeInactive: bool = False, session: dict = Depends(get_optional_session)):
    query = {}
    if not (includeInactive and session and session['role'] in ('admin', 'staff')):
        query['active'] = True
    docs = await db.shipping_zones.find(query).to_list(1000)
    return [ShippingZone.from_mongo(d) for d in docs]


@router.post('/calculate')
async def calc_shipping(payload: dict):
    pincode = payload.get('pincode')
    subtotal = float(payload.get('subtotal', 0))
    cost = await calculate_shipping(pincode, subtotal)
    return {'pincode': pincode, 'subtotal': subtotal, 'shippingCost': cost}


@router.post('')
async def create_zone(payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    zone = ShippingZone(
        name=payload['name'],
        pincodePrefixes=payload.get('pincodePrefixes', []),
        rate=float(payload.get('rate', 0)),
        freeShippingThreshold=float(payload.get('freeShippingThreshold', 0)),
        estimatedDays=int(payload.get('estimatedDays', 0)),
        active=payload.get('active', True),
    )
    result = await db.shipping_zones.insert_one(zone.to_mongo())
    doc = await db.shipping_zones.find_one({'_id': result.inserted_id})
    return ShippingZone.from_mongo(doc)


@router.put('/{zone_id}')
async def update_zone(zone_id: str, payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    updates = {k: v for k, v in payload.items() if k not in ('id', '_id')}
    result = await db.shipping_zones.update_one({'_id': ObjectId(zone_id)}, {'$set': updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Shipping zone not found.')
    doc = await db.shipping_zones.find_one({'_id': ObjectId(zone_id)})
    return ShippingZone.from_mongo(doc)


@router.delete('/{zone_id}')
async def delete_zone(zone_id: str, session: dict = Depends(require_roles('admin'))):
    result = await db.shipping_zones.delete_one({'_id': ObjectId(zone_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Shipping zone not found.')
    return {'success': True}
