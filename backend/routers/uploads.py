import os
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from deps import require_roles

router = APIRouter(prefix='/api/uploads', tags=['uploads'])

UPLOAD_DIR = Path(__file__).parent.parent / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
MAX_SIZE = 5 * 1024 * 1024  # 5MB

# The one-word switch: set STORAGE_BACKEND=s3 in .env to move uploads to S3.
# Everything downstream (resolveImageUrl on the frontend, every <img> in the
# app) already handles absolute URLs correctly, so no frontend changes are
# needed either way — only this file's storage logic changes.
STORAGE_BACKEND = os.environ.get('STORAGE_BACKEND', 'local').strip().lower()


def _save_local(contents: bytes, filename: str) -> str:
    with open(UPLOAD_DIR / filename, 'wb') as f:
        f.write(contents)
    return f'/uploads/{filename}'


def _save_s3(contents: bytes, filename: str, content_type: str) -> str:
    import boto3  # imported lazily so a local-only setup never needs boto3 configured

    bucket = os.environ.get('AWS_S3_BUCKET')
    region = os.environ.get('AWS_S3_REGION') or os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')
    if not bucket:
        raise HTTPException(status_code=500, detail='STORAGE_BACKEND is "s3" but AWS_S3_BUCKET is not set in .env.')

    s3 = boto3.client(
        's3', region_name=region,
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
    )
    key = f'uploads/{filename}'
    try:
        # Deliberately NOT passing ACL='public-read' here: AWS now disables
        # ACLs by default on new buckets, and setting one would just error
        # out ("AccessControlListNotSupported"). Public read access should
        # instead come from a bucket policy you set once in the AWS console
        # (Permissions tab -> Bucket Policy -> allow s3:GetObject on
        # arn:aws:s3:::YOUR_BUCKET/uploads/*).
        s3.put_object(Bucket=bucket, Key=key, Body=contents, ContentType=content_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f'Could not upload to S3: {e}')

    return f'https://{bucket}.s3.{region}.amazonaws.com/{key}'


@router.post('/image')
async def upload_image(file: UploadFile = File(...), session: dict = Depends(require_roles('admin', 'staff'))):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail='Only JPEG, PNG, WEBP, or GIF images are allowed.')
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail='Image must be under 5MB.')

    ext = Path(file.filename or '').suffix or '.jpg'
    filename = f'{uuid.uuid4().hex}{ext}'

    if STORAGE_BACKEND == 's3':
        url = _save_s3(contents, filename, file.content_type)
    else:
        url = _save_local(contents, filename)

    return {'url': url}
