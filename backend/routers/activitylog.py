from fastapi import APIRouter, Depends
from database import db
from deps import require_roles

router = APIRouter(prefix='/api/activity-log', tags=['activity-log'])


@router.get('')
async def list_activity(entityType: str | None = None, entityId: str | None = None, session: dict = Depends(require_roles('admin', 'staff'))):
    query = {}
    if entityType:
        query['entityType'] = entityType
    if entityId:
        query['entityId'] = entityId
    docs = await db.activity_log.find(query).sort('createdAt', -1).to_list(500)
    for d in docs:
        d['id'] = str(d.pop('_id'))
    return docs
