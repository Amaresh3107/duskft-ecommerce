from fastapi import Header, HTTPException, Depends
import jwt as pyjwt
from bson import ObjectId
from auth_utils import decode_token
from database import db


async def get_session(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Not authenticated.')
    token = authorization[7:]
    try:
        payload = decode_token(token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Session expired, please log in again.')
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid session.')

    role = payload['role']
    user_id = payload['sub']
    # Re-check the account's current status on every request, not just at
    # login — a JWT is otherwise valid until it expires regardless of what
    # happens to the account afterward, so deactivating/suspending someone
    # wouldn't take effect until their token naturally expired.
    try:
        collection = db.customers if role == 'customer' else db.users
        account = await collection.find_one({'_id': ObjectId(user_id)})
    except Exception:
        account = None
    if not account or account.get('status', 'active') != 'active':
        raise HTTPException(status_code=401, detail='This account is no longer active.')

    return {'user_id': user_id, 'role': role, 'email': payload.get('email')}


async def get_optional_session(authorization: str = Header(None)) -> dict | None:
    if not authorization or not authorization.startswith('Bearer '):
        return None
    try:
        return await get_session(authorization)
    except HTTPException:
        return None


def require_roles(*roles):
    async def checker(session: dict = Depends(get_session)) -> dict:
        if session['role'] not in roles:
            raise HTTPException(status_code=403, detail='Not authorized for this action.')
        return session
    return checker
