from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import User
from deps import require_roles
from auth_utils import hash_password
from business import now_iso, is_valid_email, is_valid_phone

router = APIRouter(prefix='/api/users', tags=['users'])


def safe_user(doc: dict) -> dict:
    out = dict(doc)
    out['id'] = str(out.pop('_id'))
    out.pop('passwordHash', None)
    return out


@router.get('')
async def list_users(session: dict = Depends(require_roles('admin'))):
    docs = await db.users.find().sort('createdAt', -1).to_list(1000)
    return [safe_user(d) for d in docs]


@router.post('')
async def create_user(payload: dict, session: dict = Depends(require_roles('admin'))):
    if not (payload.get('name') or '').strip():
        raise HTTPException(status_code=400, detail='Name is required.')
    if not is_valid_email(payload.get('email', '')):
        raise HTTPException(status_code=400, detail='Please enter a valid email address.')
    if not is_valid_phone(payload.get('phone', '')):
        raise HTTPException(status_code=400, detail='Please enter a valid 10-digit mobile number.')

    existing = await db.users.find_one({'email': payload['email'].lower()})
    if existing:
        raise HTTPException(status_code=409, detail='A user with that email already exists.')
    if payload.get('role') not in ('admin', 'staff'):
        raise HTTPException(status_code=400, detail='Role must be "admin" or "staff".')

    user = User(
        name=payload['name'], email=payload['email'].lower(), phone=payload['phone'],
        passwordHash=hash_password(payload['password']), role=payload['role'],
        status='active', createdAt=now_iso(),
    )
    result = await db.users.insert_one(user.to_mongo())
    doc = await db.users.find_one({'_id': result.inserted_id})
    return safe_user(doc)


@router.put('/{user_id}')
async def update_user(user_id: str, payload: dict, session: dict = Depends(require_roles('admin'))):
    existing = await db.users.find_one({'_id': ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail='User not found.')

    would_lose_admin = (
        existing.get('role') == 'admin'
        and existing.get('status', 'active') == 'active'
        and ('role' in payload and payload['role'] != 'admin' or 'status' in payload and payload['status'] != 'active')
    )
    if would_lose_admin:
        other_active_admins = await db.users.count_documents(
            {'role': 'admin', 'status': 'active', '_id': {'$ne': ObjectId(user_id)}}
        )
        if other_active_admins == 0:
            raise HTTPException(
                status_code=400,
                detail='Cannot deactivate or demote the last active admin — this would lock everyone out. Promote another account to admin first.',
            )

    updates = {}
    if 'role' in payload and payload['role'] in ('admin', 'staff'):
        updates['role'] = payload['role']
    if 'status' in payload:
        updates['status'] = payload['status']
    if 'name' in payload:
        if not payload['name'].strip():
            raise HTTPException(status_code=400, detail='Name is required.')
        updates['name'] = payload['name']
    if 'phone' in payload:
        if not is_valid_phone(payload['phone']):
            raise HTTPException(status_code=400, detail='Please enter a valid 10-digit mobile number.')
        updates['phone'] = payload['phone']
    if payload.get('password'):
        updates['passwordHash'] = hash_password(payload['password'])

    await db.users.update_one({'_id': ObjectId(user_id)}, {'$set': updates})
    doc = await db.users.find_one({'_id': ObjectId(user_id)})
    return safe_user(doc)


@router.delete('/{user_id}')
async def delete_user(user_id: str, session: dict = Depends(require_roles('admin'))):
    existing = await db.users.find_one({'_id': ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail='User not found.')

    if existing.get('role') == 'admin' and existing.get('status', 'active') == 'active':
        other_active_admins = await db.users.count_documents(
            {'role': 'admin', 'status': 'active', '_id': {'$ne': ObjectId(user_id)}}
        )
        if other_active_admins == 0:
            raise HTTPException(
                status_code=400,
                detail='Cannot delete the last active admin — this would lock everyone out. Promote another account to admin first.',
            )

    await db.users.delete_one({'_id': ObjectId(user_id)})
    return {'success': True}
