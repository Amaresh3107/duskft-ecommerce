from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import Banner
from deps import require_roles, get_optional_session

router = APIRouter(prefix='/api/banners', tags=['banners'])


@router.get('')
async def list_banners(includeInactive: bool = False, session: dict = Depends(get_optional_session)):
    query = {}
    if not (includeInactive and session and session['role'] in ('admin', 'staff')):
        query['active'] = True
    docs = await db.banners.find(query).sort('sortOrder', 1).to_list(1000)
    return [Banner.from_mongo(d) for d in docs]


@router.post('')
async def create_banner(payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    banner = Banner(
        imageUrl=payload['imageUrl'],
        link=payload.get('link', ''),
        sortOrder=int(payload.get('sortOrder', 0)),
        active=payload.get('active', True),
    )
    result = await db.banners.insert_one(banner.to_mongo())
    doc = await db.banners.find_one({'_id': result.inserted_id})
    return Banner.from_mongo(doc)


@router.put('/{banner_id}')
async def update_banner(banner_id: str, payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    updates = {k: v for k, v in payload.items() if k not in ('id', '_id')}
    result = await db.banners.update_one({'_id': ObjectId(banner_id)}, {'$set': updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Banner not found.')
    doc = await db.banners.find_one({'_id': ObjectId(banner_id)})
    return Banner.from_mongo(doc)


@router.delete('/{banner_id}')
async def delete_banner(banner_id: str, session: dict = Depends(require_roles('admin'))):
    result = await db.banners.delete_one({'_id': ObjectId(banner_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Banner not found.')
    return {'success': True}
