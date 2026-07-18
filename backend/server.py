from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import db, client
from seed import seed_defaults
from routers import (
    auth, products, categories, banners, shippingzones, bankaccounts, vendors,
    orders, quotes, invoices, payments, customers, returns, printjobs,
    users, settings, export, activitylog, dashboard, chatbot, uploads,
)

app = FastAPI()

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(categories.router)
app.include_router(banners.router)
app.include_router(shippingzones.router)
app.include_router(bankaccounts.router)
app.include_router(vendors.router)
app.include_router(orders.router)
app.include_router(quotes.router)
app.include_router(invoices.router)
app.include_router(payments.router)
app.include_router(customers.router)
app.include_router(returns.router)
app.include_router(printjobs.router)
app.include_router(users.router)
app.include_router(settings.router)
app.include_router(export.router)
app.include_router(activitylog.router)
app.include_router(dashboard.router)
app.include_router(chatbot.router)
app.include_router(uploads.router)

UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount('/uploads', StaticFiles(directory=str(UPLOAD_DIR)), name='uploads')

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=['*'],
    allow_headers=['*'],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.get('/api')
async def root():
    return {'message': 'Wholesale SaaS API'}


@app.on_event('startup')
async def on_startup():
    await seed_defaults()


@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()
