from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import Category
from deps import require_roles, get_optional_session
from business import slugify

router = APIRouter(prefix='/api/categories', tags=['categories'])


@router.get('')
async def list_categories(includeInactive: bool = False, session: dict = Depends(get_optional_session)):
    query = {}
    if not (includeInactive and session and session['role'] in ('admin', 'staff')):
        query['active'] = True
    docs = await db.categories.find(query).sort('sortOrder', 1).to_list(1000)
    return [Category.from_mongo(d) for d in docs]


@router.post('')
async def create_category(payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    category = Category(
        name=payload['name'],
        slug=payload.get('slug') or slugify(payload.get('name', '')),
        imageUrl=payload.get('imageUrl', ''),
        sortOrder=int(payload.get('sortOrder', 0)),
        active=payload.get('active', True),
    )
    result = await db.categories.insert_one(category.to_mongo())
    doc = await db.categories.find_one({'_id': result.inserted_id})
    return Category.from_mongo(doc)


@router.put('/{category_id}')
async def update_category(category_id: str, payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    updates = {k: v for k, v in payload.items() if k not in ('id', '_id')}
    result = await db.categories.update_one({'_id': ObjectId(category_id)}, {'$set': updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Category not found.')
    doc = await db.categories.find_one({'_id': ObjectId(category_id)})
    return Category.from_mongo(doc)


@router.delete('/{category_id}')
async def delete_category(category_id: str, session: dict = Depends(require_roles('admin'))):
    result = await db.categories.delete_one({'_id': ObjectId(category_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Category not found.')
    return {'success': True}
