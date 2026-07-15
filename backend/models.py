from typing import Annotated, Any, Optional, List
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from bson import ObjectId


def validate_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str):
        return v
    raise ValueError('Invalid ObjectId')


PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]


class BaseDocument(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, validation_alias='_id')
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    @classmethod
    def from_mongo(cls, data: Optional[dict]):
        if not data:
            return None
        data = dict(data)
        if '_id' in data and data['_id'] is not None:
            data['_id'] = str(data['_id'])
        return cls(**data)

    def to_mongo(self) -> dict:
        data = self.model_dump(exclude_none=True)
        _id = data.pop('id', None)
        if _id:
            data['_id'] = ObjectId(_id)
        return data


class Product(BaseDocument):
    sku: str = ''
    name: str
    slug: str
    categoryId: Optional[str] = None
    description: str = ''
    images: List[str] = []
    videoUrl: str = ''
    colors: List[str] = []
    sizes: List[str] = []
    tierPricing: List[dict] = []
    basePrice: float = 0
    moq: int = 1
    stock: int = 0
    status: str = 'active'
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class Category(BaseDocument):
    name: str
    slug: str
    imageUrl: str = ''
    sortOrder: int = 0
    active: bool = True


class Banner(BaseDocument):
    imageUrl: str
    link: str = ''
    sortOrder: int = 0
    active: bool = True


class Customer(BaseDocument):
    name: str
    email: str
    phone: str = ''
    passwordHash: str
    businessName: str = ''
    gstNumber: str = ''
    status: str = 'active'
    createdAt: Optional[str] = None


class Address(BaseDocument):
    customerId: str
    label: str = 'Home'
    line1: str
    line2: str = ''
    city: str
    state: str
    pincode: str
    isDefault: bool = False


class Wishlist(BaseDocument):
    customerId: str
    productId: str
    createdAt: Optional[str] = None


class Order(BaseDocument):
    orderNumber: str
    customerId: str = ''
    customerName: str
    items: List[dict]
    subtotal: float
    shippingCost: float = 0
    tax: float = 0
    taxBreakdown: dict = {}
    discount: float = 0
    total: float
    paymentMethod: str = 'cod'
    paymentStatus: str = 'pending'
    orderStatus: str = 'pending'
    shippingAddress: dict = {}
    notes: str = ''
    deliveredAt: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class Quote(BaseDocument):
    quoteNumber: str
    customerId: str
    items: List[dict]
    subtotal: float
    status: str = 'draft'
    validUntil: str = ''
    convertedOrderId: str = ''
    shippingAddress: dict = {}
    notes: str = ''
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class Invoice(BaseDocument):
    invoiceNumber: str
    orderId: str
    customerId: str = ''
    amount: dict
    totalAmount: float
    amountPaid: float = 0
    status: str = 'unpaid'
    dueDate: str = ''
    createdAt: Optional[str] = None


class Payment(BaseDocument):
    invoiceId: str
    orderId: str
    amount: float
    method: str = 'bank_transfer'
    reference: str = ''
    recordedBy: str = ''
    createdAt: Optional[str] = None


class Return(BaseDocument):
    orderId: str
    items: List[dict] = []
    reasonCode: str
    reasonNotes: str = ''
    status: str = 'requested'
    refundAmount: float = 0
    returnShippingPaidBy: str = ''
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class PrintJob(BaseDocument):
    orderId: str
    artworkFiles: List[dict] = []
    status: str = 'pending'
    vendorId: str = ''
    vendorCost: float = 0
    notes: str = ''
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class Vendor(BaseDocument):
    name: str
    contact: str = ''
    notes: str = ''


class ShippingZone(BaseDocument):
    name: str
    pincodePrefixes: List[str] = []
    rate: float = 0
    freeShippingThreshold: float = 0
    estimatedDays: int = 0
    active: bool = True


class BankAccount(BaseDocument):
    accountName: str
    accountNumber: str
    ifsc: str = ''
    bankName: str = ''
    upiId: str = ''
    qrImageUrl: str = ''
    active: bool = True


class User(BaseDocument):
    name: str
    email: str
    passwordHash: str
    role: str
    status: str = 'active'
    createdAt: Optional[str] = None


class ChatbotKB(BaseDocument):
    question: str
    answer: str
    category: str = ''
    active: bool = True


class ChatbotLog(BaseDocument):
    question: str
    answer: str
    source: str = 'kb'
    handedOffToWhatsapp: bool = False
    sessionId: str = ''
    createdAt: Optional[str] = None
