from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from bson import ObjectId
from database import db
from models import Product
from deps import require_roles, get_optional_session
from business import slugify, calculate_price, now_iso

router = APIRouter(prefix='/api/products', tags=['products'])


@router.get('')
async def list_products(categoryId: Optional[str] = None, search: Optional[str] = None,
                         includeInactive: bool = False, session: dict = Depends(get_optional_session)):
    query = {}
    if includeInactive and session and session['role'] in ('admin', 'staff'):
        pass
    else:
        query['status'] = 'active'
    if categoryId:
        query['categoryId'] = categoryId
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'sku': {'$regex': search, '$options': 'i'}},
        ]
    docs = await db.products.find(query).to_list(1000)
    return [Product.from_mongo(d) for d in docs]


@router.get('/{product_id}')
async def get_product(product_id: str):
    doc = await db.products.find_one({'_id': ObjectId(product_id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Product not found.')
    return Product.from_mongo(doc)


@router.post('')
async def create_product(payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    total_stock = int(payload.get('totalStock', payload.get('stock', 0)))
    stock = int(payload.get('stock', payload.get('totalStock', 0)))
    if stock > total_stock:
        raise HTTPException(status_code=400, detail='Current Stock cannot exceed Total Stock.')
    product = Product(
        sku=payload.get('sku', ''),
        name=payload['name'],
        slug=payload.get('slug') or slugify(payload.get('name', '')),
        categoryId=payload.get('categoryId'),
        description=payload.get('description', ''),
        images=payload.get('images', []),
        videoUrl=payload.get('videoUrl', ''),
        colors=payload.get('colors', []),
        sizes=payload.get('sizes', []),
        tierPricing=payload.get('tierPricing', []),
        basePrice=float(payload.get('basePrice', 0)),
        moq=int(payload.get('moq', 1)),
        totalStock=total_stock,
        stock=stock,
        status=payload.get('status', 'active'),
        createdAt=now_iso(),
    )
    result = await db.products.insert_one(product.to_mongo())
    doc = await db.products.find_one({'_id': result.inserted_id})
    return Product.from_mongo(doc)


@router.put('/{product_id}')
async def update_product(product_id: str, payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    existing = await db.products.find_one({'_id': ObjectId(product_id)})
    if not existing:
        raise HTTPException(status_code=404, detail='Product not found.')

    if 'totalStock' in payload or 'stock' in payload:
        effective_total = int(payload.get('totalStock', existing.get('totalStock', 0)))
        effective_stock = int(payload.get('stock', existing.get('stock', 0)))
        if effective_stock > effective_total:
            raise HTTPException(status_code=400, detail='Current Stock cannot exceed Total Stock.')

    updates = {k: v for k, v in payload.items() if k not in ('id', '_id')}
    updates['updatedAt'] = now_iso()
    await db.products.update_one({'_id': ObjectId(product_id)}, {'$set': updates})
    doc = await db.products.find_one({'_id': ObjectId(product_id)})
    return Product.from_mongo(doc)


@router.delete('/{product_id}')
async def delete_product(product_id: str, session: dict = Depends(require_roles('admin'))):
    result = await db.products.delete_one({'_id': ObjectId(product_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Product not found.')
    return {'success': True}


@router.post('/calc-price')
async def calc_price(payload: dict):
    product_id = payload.get('productId')
    quantity = int(payload.get('quantity', 0))
    doc = await db.products.find_one({'_id': ObjectId(product_id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Product not found.')
    result = calculate_price(doc, quantity)
    result['productId'] = product_id
    result['quantity'] = quantity
    return result
