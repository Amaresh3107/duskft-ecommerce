from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from models import BankAccount
from deps import require_roles, get_optional_session

router = APIRouter(prefix='/api/bank-accounts', tags=['bank-accounts'])


@router.get('')
async def list_bank_accounts(includeInactive: bool = False, session: dict = Depends(get_optional_session)):
    query = {}
    if not (includeInactive and session and session['role'] in ('admin', 'staff')):
        query['active'] = True
    docs = await db.bank_accounts.find(query).to_list(1000)
    return [BankAccount.from_mongo(d) for d in docs]


@router.post('')
async def create_bank_account(payload: dict, session: dict = Depends(require_roles('admin'))):
    account = BankAccount(
        accountName=payload['accountName'],
        accountNumber=payload['accountNumber'],
        ifsc=payload.get('ifsc', ''),
        bankName=payload.get('bankName', ''),
        upiId=payload.get('upiId', ''),
        qrImageUrl=payload.get('qrImageUrl', ''),
        active=payload.get('active', True),
    )
    result = await db.bank_accounts.insert_one(account.to_mongo())
    doc = await db.bank_accounts.find_one({'_id': result.inserted_id})
    return BankAccount.from_mongo(doc)


@router.put('/{account_id}')
async def update_bank_account(account_id: str, payload: dict, session: dict = Depends(require_roles('admin'))):
    updates = {k: v for k, v in payload.items() if k not in ('id', '_id')}
    result = await db.bank_accounts.update_one({'_id': ObjectId(account_id)}, {'$set': updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Bank account not found.')
    doc = await db.bank_accounts.find_one({'_id': ObjectId(account_id)})
    return BankAccount.from_mongo(doc)


@router.delete('/{account_id}')
async def delete_bank_account(account_id: str, session: dict = Depends(require_roles('admin'))):
    result = await db.bank_accounts.delete_one({'_id': ObjectId(account_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Bank account not found.')
    return {'success': True}
