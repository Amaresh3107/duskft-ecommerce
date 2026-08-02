import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta

JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_DAYS = 7


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_token(user_id: str, role: str, email: str, token_version: int = 0) -> str:
    payload = {
        'sub': user_id,
        'role': role,
        'email': email,
        'tv': token_version,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, os.environ['JWT_SECRET'], algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, os.environ['JWT_SECRET'], algorithms=[JWT_ALGORITHM])
