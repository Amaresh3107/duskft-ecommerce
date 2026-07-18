import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from deps import require_roles

router = APIRouter(prefix='/api/uploads', tags=['uploads'])

UPLOAD_DIR = Path(__file__).parent.parent / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
MAX_SIZE = 5 * 1024 * 1024  # 5MB


@router.post('/image')
async def upload_image(file: UploadFile = File(...), session: dict = Depends(require_roles('admin', 'staff'))):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail='Only JPEG, PNG, WEBP, or GIF images are allowed.')
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail='Image must be under 5MB.')

    ext = Path(file.filename or '').suffix or '.jpg'
    filename = f'{uuid.uuid4().hex}{ext}'
    with open(UPLOAD_DIR / filename, 'wb') as f:
        f.write(contents)

    return {'url': f'/uploads/{filename}'}
