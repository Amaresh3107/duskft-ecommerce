from fastapi import Header, HTTPException, Depends
import jwt as pyjwt
from auth_utils import decode_token


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
    return {'user_id': payload['sub'], 'role': payload['role'], 'email': payload.get('email')}


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
