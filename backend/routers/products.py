from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import Optional
import csv
import io
from bson import ObjectId
from database import db
from models import Product
from deps import require_roles, get_optional_session
from business import slugify, calculate_price, now_iso

router = APIRouter(prefix='/api/products', tags=['products'])

IMPORT_HEADERS = [
    'sku', 'name', 'categoryName', 'description', 'basePrice', 'moq', 'totalStock', 'stock',
    'colors', 'sizes', 'tierPricing', 'videoUrl', 'images', 'status',
]


@router.get('/import/template')
async def download_import_template(session: dict = Depends(require_roles('admin'))):
    """A downloadable CSV admins can fill in and re-upload via /import.
    Opens fine in Excel/Google Sheets — CSV rather than .xlsx to avoid an
    extra parsing dependency, while staying fully spreadsheet-compatible."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(IMPORT_HEADERS)
    writer.writerow([
        'DRS-002', 'Floral Maxi Dress', 'Dresses & Sets',
        'Lightweight floral print maxi dress, breathable fabric',
        '850', '15', '200', '200',
        'Red,Blue,Green', 'S,M,L,XL',
        '15:850,25:800,50:750',
        '',
        'https://example.com/image1.jpg,https://example.com/image2.jpg',
        'active',
    ])
    writer.writerow([
        '# categoryName must match an existing category name exactly (case-insensitive), or leave blank',
        '', '', '', '', '', '', '', '', '', '', '', '', '',
    ])
    writer.writerow([
        '# tierPricing format: minQty:price pairs separated by commas, e.g. 15:850,25:800 — leave blank for none',
        '', '', '', '', '', '', '', '', '', '', '', '', '',
    ])
    writer.writerow([
        '# colors / sizes / images: comma-separated. images must be full URLs — local upload from a spreadsheet isn\'t supported yet',
        '', '', '', '', '', '', '', '', '', '', '', '', '',
    ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename="product_import_template.csv"'},
    )


@router.post('/import')
async def bulk_import_products(file: UploadFile = File(...), session: dict = Depends(require_roles('admin'))):
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail='Please upload a .csv file (Excel: File > Save As > CSV).')

    raw = await file.read()
    try:
        text = raw.decode('utf-8-sig')  # utf-8-sig strips Excel's BOM if present
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail='Could not read this file as text — please save it as CSV (UTF-8).')

    category_docs = await db.categories.find().to_list(1000)
    category_lookup = {c['name'].strip().lower(): str(c['_id']) for c in category_docs}

    reader = csv.DictReader(io.StringIO(text))
    created = 0
    errors = []
    row_num = 1  # header is row 1

    for row in reader:
        row_num += 1
        name = (row.get('name') or '').strip()
        if not name or name.startswith('#'):
            continue  # skip blank rows and the "# ..." instruction rows from the template

        try:
            sku = (row.get('sku') or '').strip()
            base_price = float(row.get('basePrice') or 0)
            moq = int(row.get('moq') or 1)
            total_stock = int(row.get('totalStock') or 0)
            stock = int(row.get('stock') or total_stock)
            if stock > total_stock:
                raise ValueError('stock cannot exceed totalStock')

            colors = [c.strip() for c in (row.get('colors') or '').split(',') if c.strip()]
            sizes = [s.strip() for s in (row.get('sizes') or '').split(',') if s.strip()]
            images = [u.strip() for u in (row.get('images') or '').split(',') if u.strip()]

            category_name = (row.get('categoryName') or '').strip().lower()
            category_id = category_lookup.get(category_name) if category_name else None
            if category_name and not category_id:
                raise ValueError(f'No category named "{row.get("categoryName")}" — check spelling or leave blank')

            tier_pricing = []
            tier_str = (row.get('tierPricing') or '').strip()
            if tier_str:
                for pair in tier_str.split(','):
                    pair = pair.strip()
                    if not pair:
                        continue
                    if ':' not in pair:
                        raise ValueError(f'Bad tierPricing entry "{pair}" — expected format minQty:price')
                    min_qty_str, price_str = pair.split(':', 1)
                    tier_pricing.append({'minQty': int(min_qty_str), 'price': float(price_str)})

            product = Product(
                sku=sku, name=name, slug=slugify(name), categoryId=category_id,
                description=(row.get('description') or '').strip(),
                images=images, videoUrl=(row.get('videoUrl') or '').strip(),
                colors=colors, sizes=sizes, tierPricing=tier_pricing,
                basePrice=base_price, moq=moq, totalStock=total_stock, stock=stock,
                status=(row.get('status') or 'active').strip().lower() or 'active',
                createdAt=now_iso(),
            )
            await db.products.insert_one(product.to_mongo())
            created += 1
        except Exception as e:
            errors.append({'row': row_num, 'product': name, 'error': str(e)})

    return {'created': created, 'errors': errors}


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
