from fastapi import APIRouter, Depends
from deps import require_roles
from business import get_settings_dict, set_setting

router = APIRouter(prefix='/api/settings', tags=['settings'])

PUBLIC_KEYS = [
    'storeName', 'currency', 'currencySymbol', 'taxPercent', 'freeShippingThreshold',
    'sellerAddress', 'sellerPhone', 'sellerEmail', 'whatsappNumber', 'gstNumber',
    'quotationsEnabled', 'quotationMinQty', 'quotationMinPrice', 'quotationRequireBoth',
]


@router.get('/public')
async def public_settings():
    settings = await get_settings_dict()
    return {k: settings.get(k) for k in PUBLIC_KEYS}


@router.get('')
async def admin_settings(session: dict = Depends(require_roles('admin'))):
    return await get_settings_dict()


@router.put('')
async def update_settings(payload: dict, session: dict = Depends(require_roles('admin'))):
    for key, value in payload.items():
        await set_setting(key, value)
    return await get_settings_dict()
