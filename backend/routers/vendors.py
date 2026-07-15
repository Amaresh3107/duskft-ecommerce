from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import Vendor
from deps import require_roles

router = APIRouter(prefix='/api/vendors', tags=['vendors'])


@router.get('')
async def list_vendors(session: dict = Depends(require_roles('admin', 'staff'))):
    docs = await db.vendors.find().to_list(1000)
    return [Vendor.from_mongo(d) for d in docs]


@router.post('')
async def create_vendor(payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    vendor = Vendor(name=payload['name'], contact=payload.get('contact', ''), notes=payload.get('notes', ''))
    result = await db.vendors.insert_one(vendor.to_mongo())
    doc = await db.vendors.find_one({'_id': result.inserted_id})
    return Vendor.from_mongo(doc)


@router.put('/{vendor_id}')
async def update_vendor(vendor_id: str, payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    updates = {k: v for k, v in payload.items() if k not in ('id', '_id')}
    result = await db.vendors.update_one({'_id': ObjectId(vendor_id)}, {'$set': updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Vendor not found.')
    doc = await db.vendors.find_one({'_id': ObjectId(vendor_id)})
    return Vendor.from_mongo(doc)


@router.delete('/{vendor_id}')
async def delete_vendor(vendor_id: str, session: dict = Depends(require_roles('admin'))):
    result = await db.vendors.delete_one({'_id': ObjectId(vendor_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Vendor not found.')
    return {'success': True}
