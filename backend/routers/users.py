from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import User
from deps import require_roles
from auth_utils import hash_password
from business import now_iso

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
    existing = await db.users.find_one({'email': payload['email'].lower()})
    if existing:
        raise HTTPException(status_code=409, detail='A user with that email already exists.')
    if payload.get('role') not in ('admin', 'staff'):
        raise HTTPException(status_code=400, detail='Role must be "admin" or "staff".')

    user = User(
        name=payload['name'], email=payload['email'].lower(),
        passwordHash=hash_password(payload['password']), role=payload['role'],
        status='active', createdAt=now_iso(),
    )
    result = await db.users.insert_one(user.to_mongo())
    doc = await db.users.find_one({'_id': result.inserted_id})
    return safe_user(doc)


@router.put('/{user_id}')
async def update_user(user_id: str, payload: dict, session: dict = Depends(require_roles('admin'))):
    updates = {}
    if 'role' in payload and payload['role'] in ('admin', 'staff'):
        updates['role'] = payload['role']
    if 'status' in payload:
        updates['status'] = payload['status']
    if 'name' in payload:
        updates['name'] = payload['name']
    if payload.get('password'):
        updates['passwordHash'] = hash_password(payload['password'])

    result = await db.users.update_one({'_id': ObjectId(user_id)}, {'$set': updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='User not found.')
    doc = await db.users.find_one({'_id': ObjectId(user_id)})
    return safe_user(doc)
