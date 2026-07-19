from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from database import db
from models import Customer
from auth_utils import hash_password, verify_password, create_token
from deps import get_session
from business import now_iso, is_valid_phone

router = APIRouter(prefix='/api/auth', tags=['auth'])


class LoginPayload(BaseModel):
    email: EmailStr
    password: str
    accountType: str = 'customer'


class RegisterPayload(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str
    businessName: str = ''
    gstNumber: str = ''


def safe_user(doc: dict) -> dict:
    out = dict(doc)
    out['id'] = str(out.pop('_id'))
    out.pop('passwordHash', None)
    return out


@router.post('/login')
async def login(payload: LoginPayload):
    collection = db.customers if payload.accountType == 'customer' else db.users
    account = await collection.find_one({'email': payload.email.lower()})
    if not account:
        raise HTTPException(status_code=401, detail='No account found with that email.')
    if account.get('status') and account['status'] != 'active':
        raise HTTPException(status_code=403, detail='This account is not active.')
    if not verify_password(payload.password, account['passwordHash']):
        raise HTTPException(status_code=401, detail='Incorrect password.')

    role = 'customer' if payload.accountType == 'customer' else account['role']
    token = create_token(str(account['_id']), role, account['email'])
    return {'token': token, 'user': safe_user(account)}


@router.post('/register')
async def register(payload: RegisterPayload):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail='Name is required.')
    if not is_valid_phone(payload.phone):
        raise HTTPException(status_code=400, detail='Please enter a valid 10-digit mobile number.')

    existing = await db.customers.find_one({'email': payload.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail='An account with that email already exists.')

    customer = Customer(
        name=payload.name,
        email=payload.email.lower(),
        phone=payload.phone,
        passwordHash=hash_password(payload.password),
        businessName=payload.businessName,
        gstNumber=payload.gstNumber,
        status='active',
        createdAt=now_iso(),
    )
    result = await db.customers.insert_one(customer.to_mongo())
    account = await db.customers.find_one({'_id': result.inserted_id})
    token = create_token(str(account['_id']), 'customer', account['email'])
    return {'token': token, 'user': safe_user(account)}


@router.post('/logout')
async def logout(session: dict = Depends(get_session)):
    return {'success': True}


@router.get('/me')
async def me(session: dict = Depends(get_session)):
    collection = db.customers if session['role'] == 'customer' else db.users
    from bson import ObjectId
    account = await collection.find_one({'_id': ObjectId(session['user_id'])})
    if not account:
        raise HTTPException(status_code=404, detail='Account not found.')
    return {'role': session['role'], **safe_user(account)}
