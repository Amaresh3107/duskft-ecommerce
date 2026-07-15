"""
Comprehensive backend test suite for Wholesale SaaS (Phase 1 - Backend Only).

Covers:
 - Auth (register/login/me, staff vs customer, invalid creds)
 - Products (public/inactive gating, role gating, calc-price boundaries)
 - Categories & Banners CRUD + role gating
 - Shipping Zones (calculate + CRUD gating)
 - Bank Accounts (admin-only writes) & Vendors (admin/staff)
 - Orders (guest, customer, MOQ, tax breakdown CGST/SGST vs IGST, server recalc,
           cross-customer 403, status transitions & cancel-after-shipped guard)
 - Quotes (customer price recompute, staff trust, convert flow, double-convert)
 - Invoices (idempotent, customer-scoped, email stub)
 - Payments (overpay, exact-pay flips to paid, partial, role gating)
 - Customers portal (me, dashboard, addresses, wishlist)
 - Returns (window/ownership/reason-defect, transitions)
 - Print jobs (vendorCost hiding from customer, customer status transitions)
 - Users (admin-only, staff blocked)
 - Settings (public whitelist, admin-only write/read, staff blocked)
 - Dashboard/Export/Activity Log (admin/staff)
 - Cross-cutting: customer never gets 200 on privileged writes
"""

import os
import io
import csv
import pytest
import requests
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://wholesale-threads-20.preview.emergentagent.com').rstrip('/')
API = f'{BASE_URL}/api'

ADMIN_EMAIL = 'admin@example.com'
ADMIN_PASSWORD = 'ChangeMe123!'


# ---------------- Session fixtures ----------------

@pytest.fixture(scope='session')
def http():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    return s


def _login(http, email, password, account_type):
    r = http.post(f'{API}/auth/login', json={'email': email, 'password': password, 'accountType': account_type})
    return r


@pytest.fixture(scope='session')
def admin_token(http):
    r = _login(http, ADMIN_EMAIL, ADMIN_PASSWORD, 'staff')
    assert r.status_code == 200, f'Admin login failed: {r.status_code} {r.text}'
    return r.json()['token']


@pytest.fixture(scope='session')
def admin_headers(admin_token):
    return {'Authorization': f'Bearer {admin_token}', 'Content-Type': 'application/json'}


@pytest.fixture(scope='session')
def staff_user(http, admin_headers):
    """Create a dedicated staff user (or reuse if exists)."""
    email = 'TEST_staff_isolated@example.com'
    password = 'staff-pass-123'
    r = http.post(f'{API}/users', headers=admin_headers,
                  json={'name': 'TEST Staff', 'email': email, 'password': password, 'role': 'staff'})
    # 409 if already created in earlier run
    assert r.status_code in (200, 201, 409), r.text
    return {'email': email, 'password': password}


@pytest.fixture(scope='session')
def staff_token(http, staff_user):
    r = _login(http, staff_user['email'], staff_user['password'], 'staff')
    assert r.status_code == 200, r.text
    return r.json()['token']


@pytest.fixture(scope='session')
def staff_headers(staff_token):
    return {'Authorization': f'Bearer {staff_token}', 'Content-Type': 'application/json'}


@pytest.fixture(scope='session')
def customer_a(http):
    """Register or login a test customer."""
    email = f'test_buyera@example.com'
    password = 'buyerA123'
    r = http.post(f'{API}/auth/register',
                  json={'name': 'TEST Buyer A', 'email': email, 'password': password, 'phone': '9990000001'})
    if r.status_code == 409:
        r = _login(http, email, password, 'customer')
    assert r.status_code in (200, 201), r.text
    data = r.json()
    return {'email': email, 'password': password, 'token': data['token'], 'id': data['user']['id']}


@pytest.fixture(scope='session')
def customer_b(http):
    email = f'test_buyerb@example.com'
    password = 'buyerB123'
    r = http.post(f'{API}/auth/register',
                  json={'name': 'TEST Buyer B', 'email': email, 'password': password, 'phone': '9990000002'})
    if r.status_code == 409:
        r = _login(http, email, password, 'customer')
    assert r.status_code in (200, 201), r.text
    data = r.json()
    return {'email': email, 'password': password, 'token': data['token'], 'id': data['user']['id']}


def hdr(token):
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


@pytest.fixture(scope='session')
def seeded_products(http):
    r = http.get(f'{API}/products')
    assert r.status_code == 200
    products = r.json()
    assert len(products) >= 3, f'Expected seeded products, got {len(products)}'
    by_sku = {p['sku']: p for p in products}
    return by_sku


# ==================================================================
# AUTH
# ==================================================================
class TestAuth:
    def test_admin_login_staff_accounttype(self, http):
        r = _login(http, ADMIN_EMAIL, ADMIN_PASSWORD, 'staff')
        assert r.status_code == 200
        j = r.json()
        assert 'token' in j and 'user' in j
        assert j['user']['email'] == ADMIN_EMAIL

    def test_login_wrong_password(self, http):
        r = _login(http, ADMIN_EMAIL, 'not-the-real-pw', 'staff')
        assert r.status_code == 401

    def test_login_nonexistent_email(self, http):
        r = _login(http, 'nobody-nonexistent-xyz@example.com', 'x', 'customer')
        assert r.status_code == 401

    def test_customer_register_and_login(self, http, customer_a):
        r = _login(http, customer_a['email'], customer_a['password'], 'customer')
        assert r.status_code == 200
        assert r.json()['user']['email'] == customer_a['email']

    def test_me_returns_role(self, http, admin_headers, customer_a):
        ra = http.get(f'{API}/auth/me', headers=admin_headers)
        assert ra.status_code == 200
        assert ra.json()['role'] == 'admin'
        rc = http.get(f'{API}/auth/me', headers=hdr(customer_a['token']))
        assert rc.status_code == 200
        assert rc.json()['role'] == 'customer'


# ==================================================================
# PRODUCTS
# ==================================================================
class TestProducts:
    def test_public_only_active(self, http, seeded_products):
        r = http.get(f'{API}/products')
        assert r.status_code == 200
        for p in r.json():
            assert p['status'] == 'active'

    def test_admin_include_inactive(self, http, admin_headers, seeded_products):
        # create an inactive product
        payload = {'sku': f'TEST-INACTIVE-{uuid.uuid4().hex[:6]}', 'name': 'TEST Inactive Prod',
                   'basePrice': 100, 'moq': 1, 'status': 'inactive', 'tierPricing': [{'minQty': 1, 'price': 100}]}
        c = http.post(f'{API}/products', headers=admin_headers, json=payload)
        assert c.status_code == 200, c.text
        pid = c.json()['id']

        # public list should not have inactive
        pub = http.get(f'{API}/products')
        assert not any(p['id'] == pid for p in pub.json())

        # admin with includeInactive=true should see it
        adm = http.get(f'{API}/products?includeInactive=true', headers=admin_headers)
        assert any(p['id'] == pid for p in adm.json())

        http.delete(f'{API}/products/{pid}', headers=admin_headers)

    def test_customer_cannot_create_product(self, http, customer_a):
        r = http.post(f'{API}/products', headers=hdr(customer_a['token']),
                      json={'name': 'HackedProduct', 'basePrice': 1, 'moq': 1})
        assert r.status_code == 403

    def test_unauthenticated_cannot_create_product(self, http):
        r = http.post(f'{API}/products', json={'name': 'HackedProduct', 'basePrice': 1, 'moq': 1})
        assert r.status_code == 401

    def test_staff_can_create_and_update_but_not_delete(self, http, staff_headers, admin_headers):
        p = http.post(f'{API}/products', headers=staff_headers,
                      json={'sku': f'TEST-STAFF-{uuid.uuid4().hex[:6]}', 'name': 'TEST Staff Product',
                            'basePrice': 200, 'moq': 5, 'tierPricing': [{'minQty': 1, 'price': 200}]})
        assert p.status_code == 200, p.text
        pid = p.json()['id']
        u = http.put(f'{API}/products/{pid}', headers=staff_headers, json={'basePrice': 250})
        assert u.status_code == 200
        # Staff should NOT be able to delete
        d = http.delete(f'{API}/products/{pid}', headers=staff_headers)
        assert d.status_code == 403
        # Admin can delete
        d2 = http.delete(f'{API}/products/{pid}', headers=admin_headers)
        assert d2.status_code == 200

    def test_calc_price_boundaries(self, http, seeded_products):
        # KRT-001 tiers: 1@650, 50@550, 200@480, MOQ 20
        krt = seeded_products['KRT-001']
        r49 = http.post(f'{API}/products/calc-price', json={'productId': krt['id'], 'quantity': 49}).json()
        r50 = http.post(f'{API}/products/calc-price', json={'productId': krt['id'], 'quantity': 50}).json()
        r199 = http.post(f'{API}/products/calc-price', json={'productId': krt['id'], 'quantity': 199}).json()
        r200 = http.post(f'{API}/products/calc-price', json={'productId': krt['id'], 'quantity': 200}).json()
        assert r49['unitPrice'] == 650
        assert r50['unitPrice'] == 550
        assert r199['unitPrice'] == 550
        assert r200['unitPrice'] == 480
        # MOQ 20 - qty 10 should have moqMet False
        r10 = http.post(f'{API}/products/calc-price', json={'productId': krt['id'], 'quantity': 10}).json()
        assert r10['moqMet'] is False
        assert r10['moq'] == 20


# ==================================================================
# CATEGORIES & BANNERS
# ==================================================================
class TestCategoriesAndBanners:
    def test_categories_public_only_active(self, http):
        r = http.get(f'{API}/categories')
        assert r.status_code == 200
        for c in r.json():
            assert c['active'] is True

    def test_category_crud_and_role_gating(self, http, admin_headers, staff_headers, customer_a):
        # customer cannot create
        cust = http.post(f'{API}/categories', headers=hdr(customer_a['token']), json={'name': 'HackCat'})
        assert cust.status_code == 403
        # staff can create
        s = http.post(f'{API}/categories', headers=staff_headers,
                      json={'name': f'TEST Cat {uuid.uuid4().hex[:5]}', 'active': False})
        assert s.status_code == 200
        cid = s.json()['id']
        # public should not see it (inactive)
        assert not any(c['id'] == cid for c in http.get(f'{API}/categories').json())
        # admin includeInactive sees it
        assert any(c['id'] == cid for c in http.get(f'{API}/categories?includeInactive=true', headers=admin_headers).json())
        # staff cannot delete
        assert http.delete(f'{API}/categories/{cid}', headers=staff_headers).status_code == 403
        # admin can
        assert http.delete(f'{API}/categories/{cid}', headers=admin_headers).status_code == 200

    def test_banner_role_gating(self, http, customer_a, admin_headers):
        assert http.post(f'{API}/banners', headers=hdr(customer_a['token']),
                         json={'imageUrl': 'http://x/img.jpg'}).status_code == 403
        b = http.post(f'{API}/banners', headers=admin_headers, json={'imageUrl': 'http://x/img.jpg', 'active': True})
        assert b.status_code == 200
        bid = b.json()['id']
        assert http.delete(f'{API}/banners/{bid}', headers=admin_headers).status_code == 200


# ==================================================================
# SHIPPING ZONES
# ==================================================================
class TestShipping:
    def test_calculate_maharashtra_prefix(self, http):
        r = http.post(f'{API}/shipping-zones/calculate', json={'pincode': '400001', 'subtotal': 1000})
        assert r.status_code == 200
        assert r.json()['shippingCost'] == 99

    def test_calculate_free_shipping_above_threshold(self, http):
        r = http.post(f'{API}/shipping-zones/calculate', json={'pincode': '400001', 'subtotal': 20000})
        assert r.json()['shippingCost'] == 0

    def test_calculate_no_zone_match(self, http):
        r = http.post(f'{API}/shipping-zones/calculate', json={'pincode': '000000', 'subtotal': 1000})
        assert r.json()['shippingCost'] == 0

    def test_zone_write_role_gating(self, http, customer_a, staff_headers, admin_headers):
        assert http.post(f'{API}/shipping-zones', headers=hdr(customer_a['token']),
                         json={'name': 'X', 'rate': 10}).status_code == 403
        z = http.post(f'{API}/shipping-zones', headers=staff_headers,
                      json={'name': f'TEST Zone {uuid.uuid4().hex[:5]}', 'pincodePrefixes': ['99'], 'rate': 500,
                            'freeShippingThreshold': 10000, 'estimatedDays': 7})
        assert z.status_code == 200
        zid = z.json()['id']
        # staff cannot delete
        assert http.delete(f'{API}/shipping-zones/{zid}', headers=staff_headers).status_code == 403
        # admin can
        assert http.delete(f'{API}/shipping-zones/{zid}', headers=admin_headers).status_code == 200


# ==================================================================
# BANK ACCOUNTS & VENDORS
# ==================================================================
class TestBanksAndVendors:
    def test_bank_account_admin_only(self, http, customer_a, staff_headers, admin_headers):
        assert http.post(f'{API}/bank-accounts', headers=hdr(customer_a['token']),
                         json={'accountName': 'x', 'accountNumber': '1'}).status_code == 403
        # staff should NOT be able to create bank accounts (admin only)
        assert http.post(f'{API}/bank-accounts', headers=staff_headers,
                         json={'accountName': 'x', 'accountNumber': '1'}).status_code == 403
        r = http.post(f'{API}/bank-accounts', headers=admin_headers,
                      json={'accountName': f'TEST Bank {uuid.uuid4().hex[:5]}', 'accountNumber': '999', 'active': True})
        assert r.status_code == 200
        bid = r.json()['id']
        http.delete(f'{API}/bank-accounts/{bid}', headers=admin_headers)

    def test_vendor_role_gating(self, http, customer_a, staff_headers, admin_headers):
        assert http.post(f'{API}/vendors', headers=hdr(customer_a['token']),
                         json={'name': 'v'}).status_code == 403
        r = http.post(f'{API}/vendors', headers=staff_headers, json={'name': f'TEST Vendor {uuid.uuid4().hex[:5]}'})
        assert r.status_code == 200
        vid = r.json()['id']
        # staff delete forbidden
        assert http.delete(f'{API}/vendors/{vid}', headers=staff_headers).status_code == 403
        assert http.delete(f'{API}/vendors/{vid}', headers=admin_headers).status_code == 200


# ==================================================================
# ORDERS
# ==================================================================
class TestOrders:
    def test_guest_order_success(self, http, seeded_products):
        krt = seeded_products['KRT-001']  # MOQ 20, tier 50 -> 550
        payload = {
            'items': [{'productId': krt['id'], 'quantity': 50}],
            'guestName': 'TEST Guest',
            'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra',
                                 'line1': '1 Test St', 'city': 'Mumbai'},
            'total': 999999,  # try to spoof
            # try to spoof line price
        }
        payload['items'][0]['unitPrice'] = 1  # server should ignore
        r = http.post(f'{API}/orders', json=payload)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order['customerId'] == ''
        assert order['customerName'] == 'TEST Guest'
        # server recalculated: 50 * 550 = 27500 subtotal, above 15000 -> free shipping
        assert order['subtotal'] == 50 * 550
        assert order['shippingCost'] == 0
        # Maharashtra -> CGST + SGST, no IGST
        tb = order['taxBreakdown']
        assert tb['igst'] == 0
        assert tb['cgst'] > 0 and tb['sgst'] > 0
        assert abs(tb['cgst'] - tb['sgst']) < 0.01
        expected_tax = round(27500 * 0.18, 2)
        assert abs(tb['total'] - expected_tax) < 0.05
        assert order['total'] == order['subtotal'] + order['shippingCost'] + order['tax']
        # server IGNORED spoofed unitPrice
        assert order['items'][0]['unitPrice'] == 550

    def test_moq_rejection(self, http, seeded_products):
        krt = seeded_products['KRT-001']  # MOQ 20
        payload = {'items': [{'productId': krt['id'], 'quantity': 5}],
                   'guestName': 'x', 'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra'}}
        r = http.post(f'{API}/orders', json=payload)
        assert r.status_code == 400
        assert 'MOQ' in r.text and '20' in r.text
        assert 'Chikankari' in r.text or krt['name'] in r.text

    def test_igst_split_when_state_differs(self, http, seeded_products):
        drs = seeded_products['DRS-001']  # MOQ 15
        payload = {'items': [{'productId': drs['id'], 'quantity': 30}],
                   'guestName': 'TEST', 'shippingAddress': {'pincode': '110001', 'state': 'Delhi'}}
        r = http.post(f'{API}/orders', json=payload)
        assert r.status_code == 200
        tb = r.json()['taxBreakdown']
        assert tb['cgst'] == 0 and tb['sgst'] == 0
        assert tb['igst'] > 0

    def test_customer_order_attaches_customer_id(self, http, customer_a, seeded_products):
        krt = seeded_products['KRT-001']
        r = http.post(f'{API}/orders', headers=hdr(customer_a['token']),
                      json={'items': [{'productId': krt['id'], 'quantity': 25}],
                            'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra'}})
        assert r.status_code == 200, r.text
        assert r.json()['customerId'] == customer_a['id']

    def test_customer_cannot_see_other_customer_order(self, http, customer_a, customer_b, seeded_products):
        krt = seeded_products['KRT-001']
        r = http.post(f'{API}/orders', headers=hdr(customer_a['token']),
                      json={'items': [{'productId': krt['id'], 'quantity': 25}],
                            'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra'}})
        order_id = r.json()['id']
        blocked = http.get(f'{API}/orders/{order_id}', headers=hdr(customer_b['token']))
        assert blocked.status_code == 403

    def test_customer_list_shows_only_own(self, http, customer_a, customer_b, seeded_products):
        r = http.get(f'{API}/orders', headers=hdr(customer_a['token']))
        assert r.status_code == 200
        for o in r.json():
            assert o['customerId'] == customer_a['id']

    def test_admin_list_shows_all(self, http, admin_headers):
        r = http.get(f'{API}/orders', headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_status_transitions_and_cancel_after_shipped(self, http, admin_headers, seeded_products):
        krt = seeded_products['KRT-001']
        r = http.post(f'{API}/orders', json={'items': [{'productId': krt['id'], 'quantity': 25}],
                                              'guestName': 'x',
                                              'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra'}})
        oid = r.json()['id']
        # Invalid status
        assert http.put(f'{API}/orders/{oid}/status', headers=admin_headers,
                        json={'status': 'nonsense'}).status_code == 400
        # move to shipped
        http.put(f'{API}/orders/{oid}/status', headers=admin_headers, json={'status': 'confirmed'})
        http.put(f'{API}/orders/{oid}/status', headers=admin_headers, json={'status': 'shipped'})
        # cannot cancel a shipped order
        bad = http.put(f'{API}/orders/{oid}/status', headers=admin_headers, json={'status': 'cancelled'})
        assert bad.status_code == 400
        # move to delivered
        d = http.put(f'{API}/orders/{oid}/status', headers=admin_headers, json={'status': 'delivered'})
        assert d.status_code == 200
        assert d.json().get('deliveredAt')

    def test_customer_cannot_change_status(self, http, customer_a, admin_headers, seeded_products):
        krt = seeded_products['KRT-001']
        r = http.post(f'{API}/orders', headers=hdr(customer_a['token']),
                      json={'items': [{'productId': krt['id'], 'quantity': 25}],
                            'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra'}})
        oid = r.json()['id']
        blocked = http.put(f'{API}/orders/{oid}/status', headers=hdr(customer_a['token']),
                           json={'status': 'confirmed'})
        assert blocked.status_code == 403


# ==================================================================
# QUOTES
# ==================================================================
class TestQuotes:
    def test_customer_price_recompute(self, http, customer_a, seeded_products):
        krt = seeded_products['KRT-001']
        # customer tries to spoof unitPrice=1
        r = http.post(f'{API}/quotes', headers=hdr(customer_a['token']),
                      json={'items': [{'productId': krt['id'], 'quantity': 60, 'unitPrice': 1}]})
        assert r.status_code == 200
        item = r.json()['items'][0]
        assert item['unitPrice'] == 550  # tier at 50
        assert item['lineTotal'] == 550 * 60

    def test_staff_price_trusted(self, http, staff_headers, customer_a, seeded_products):
        krt = seeded_products['KRT-001']
        r = http.post(f'{API}/quotes', headers=staff_headers,
                      json={'customerId': customer_a['id'],
                            'items': [{'productId': krt['id'], 'quantity': 60, 'unitPrice': 111}]})
        assert r.status_code == 200
        assert r.json()['items'][0]['unitPrice'] == 111

    def test_convert_flow(self, http, admin_headers, customer_a, seeded_products):
        krt = seeded_products['KRT-001']
        q = http.post(f'{API}/quotes', headers=admin_headers,
                      json={'customerId': customer_a['id'],
                            'items': [{'productId': krt['id'], 'quantity': 30, 'unitPrice': 500}]}).json()
        qid = q['id']
        # Cannot set status directly to converted
        bad = http.put(f'{API}/quotes/{qid}/status', headers=admin_headers, json={'status': 'converted'})
        assert bad.status_code == 400

        # Draft -> convert should fail
        bad_conv = http.post(f'{API}/quotes/{qid}/convert', headers=admin_headers)
        assert bad_conv.status_code == 400

        # Move to open, then approved
        http.put(f'{API}/quotes/{qid}/status', headers=admin_headers, json={'status': 'open'})
        http.put(f'{API}/quotes/{qid}/status', headers=admin_headers, json={'status': 'approved'})

        # Now convert should succeed
        conv = http.post(f'{API}/quotes/{qid}/convert', headers=admin_headers)
        assert conv.status_code == 200
        order_id = conv.json()['id']

        # Quote status should be converted with convertedOrderId
        got = http.get(f'{API}/quotes', headers=admin_headers).json()
        q_updated = next(x for x in got if x['id'] == qid)
        assert q_updated['status'] == 'converted'
        assert q_updated['convertedOrderId'] == order_id

        # Convert twice -> fail
        again = http.post(f'{API}/quotes/{qid}/convert', headers=admin_headers)
        assert again.status_code == 400


# ==================================================================
# INVOICES & PAYMENTS
# ==================================================================
@pytest.fixture(scope='class')
def _invoice_setup(http, admin_headers, customer_a, seeded_products):
    """Create order + invoice for payment tests."""
    krt = seeded_products['KRT-001']
    r = http.post(f'{API}/orders', headers=hdr(customer_a['token']),
                  json={'items': [{'productId': krt['id'], 'quantity': 25}],
                        'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra'}})
    oid = r.json()['id']
    inv = http.post(f'{API}/invoices', headers=admin_headers, json={'orderId': oid}).json()
    return {'orderId': oid, 'invoiceId': inv['id'], 'total': inv['totalAmount']}


class TestInvoices:
    def test_invoice_idempotent(self, http, admin_headers, _invoice_setup):
        oid = _invoice_setup['orderId']
        first_id = _invoice_setup['invoiceId']
        again = http.post(f'{API}/invoices', headers=admin_headers, json={'orderId': oid}).json()
        assert again['id'] == first_id

    def test_customer_only_sees_own_invoices(self, http, customer_a, customer_b):
        ra = http.get(f'{API}/invoices', headers=hdr(customer_a['token']))
        assert ra.status_code == 200
        for inv in ra.json():
            assert inv['customerId'] == customer_a['id']
        rb = http.get(f'{API}/invoices', headers=hdr(customer_b['token'])).json()
        for inv in rb:
            assert inv['customerId'] == customer_b['id']

    def test_email_stub(self, http, admin_headers, _invoice_setup):
        r = http.post(f'{API}/invoices/{_invoice_setup["invoiceId"]}/email', headers=admin_headers)
        assert r.status_code == 200
        j = r.json()
        assert j.get('sent') is True and j.get('stubbed') is True


class TestPayments:
    def test_rejects_zero_or_negative(self, http, admin_headers, _invoice_setup):
        r = http.post(f'{API}/payments', headers=admin_headers,
                      json={'invoiceId': _invoice_setup['invoiceId'], 'amount': 0})
        assert r.status_code == 400
        r2 = http.post(f'{API}/payments', headers=admin_headers,
                       json={'invoiceId': _invoice_setup['invoiceId'], 'amount': -100})
        assert r2.status_code == 400

    def test_rejects_overpay(self, http, admin_headers, _invoice_setup):
        r = http.post(f'{API}/payments', headers=admin_headers,
                      json={'invoiceId': _invoice_setup['invoiceId'],
                            'amount': _invoice_setup['total'] + 1000})
        assert r.status_code == 400

    def test_partial_then_full_flow(self, http, admin_headers, customer_a, seeded_products):
        # separate order/invoice for isolation
        krt = seeded_products['KRT-001']
        o = http.post(f'{API}/orders', headers=hdr(customer_a['token']),
                      json={'items': [{'productId': krt['id'], 'quantity': 25}],
                            'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra'}}).json()
        inv = http.post(f'{API}/invoices', headers=admin_headers, json={'orderId': o['id']}).json()
        total = inv['totalAmount']
        # partial
        half = round(total / 2, 2)
        p1 = http.post(f'{API}/payments', headers=admin_headers,
                       json={'invoiceId': inv['id'], 'amount': half})
        assert p1.status_code == 200
        inv2 = http.get(f'{API}/invoices/{inv["id"]}', headers=admin_headers).json()
        assert inv2['status'] == 'partial'
        order2 = http.get(f'{API}/orders/{o["id"]}', headers=admin_headers).json()
        assert order2['paymentStatus'] == 'partial'
        # remaining balance
        remaining = total - inv2['amountPaid']
        p2 = http.post(f'{API}/payments', headers=admin_headers,
                       json={'invoiceId': inv['id'], 'amount': remaining})
        assert p2.status_code == 200
        inv3 = http.get(f'{API}/invoices/{inv["id"]}', headers=admin_headers).json()
        assert inv3['status'] == 'paid'
        order3 = http.get(f'{API}/orders/{o["id"]}', headers=admin_headers).json()
        assert order3['paymentStatus'] == 'paid'

    def test_customer_cannot_create_payment(self, http, customer_a, _invoice_setup):
        r = http.post(f'{API}/payments', headers=hdr(customer_a['token']),
                      json={'invoiceId': _invoice_setup['invoiceId'], 'amount': 100})
        assert r.status_code == 403

    def test_list_payments_admin_only(self, http, admin_headers, customer_a):
        assert http.get(f'{API}/payments', headers=admin_headers).status_code == 200
        assert http.get(f'{API}/payments', headers=hdr(customer_a['token'])).status_code == 403


# ==================================================================
# CUSTOMERS PORTAL
# ==================================================================
class TestCustomerPortal:
    def test_me(self, http, customer_a):
        r = http.get(f'{API}/customers/me', headers=hdr(customer_a['token']))
        assert r.status_code == 200
        assert r.json()['email'] == customer_a['email']

    def test_update_profile(self, http, customer_a):
        r = http.put(f'{API}/customers/me', headers=hdr(customer_a['token']),
                     json={'businessName': 'Test Biz Ltd'})
        assert r.status_code == 200
        assert r.json()['businessName'] == 'Test Biz Ltd'

    def test_address_crud(self, http, customer_a):
        r = http.post(f'{API}/customers/addresses', headers=hdr(customer_a['token']),
                      json={'label': 'Warehouse', 'line1': 'Test 1', 'city': 'Mumbai',
                            'state': 'Maharashtra', 'pincode': '400001'})
        assert r.status_code == 200
        aid = r.json()['id']
        listing = http.get(f'{API}/customers/addresses', headers=hdr(customer_a['token'])).json()
        assert any(a['id'] == aid for a in listing)
        d = http.delete(f'{API}/customers/addresses/{aid}', headers=hdr(customer_a['token']))
        assert d.status_code == 200

    def test_wishlist_toggle(self, http, customer_a, seeded_products):
        pid = seeded_products['KRT-001']['id']
        r1 = http.post(f'{API}/customers/wishlist/toggle', headers=hdr(customer_a['token']),
                       json={'productId': pid}).json()
        r2 = http.post(f'{API}/customers/wishlist/toggle', headers=hdr(customer_a['token']),
                       json={'productId': pid}).json()
        assert r1['added'] != r2['added']

    def test_dashboard(self, http, customer_a):
        r = http.get(f'{API}/customers/dashboard', headers=hdr(customer_a['token']))
        assert r.status_code == 200
        for k in ('activeOrderCount', 'totalOrders', 'totalSpent', 'totalPieces', 'recentOrders'):
            assert k in r.json()


# ==================================================================
# RETURNS
# ==================================================================
class TestReturns:
    def _fresh_delivered_order(self, http, admin_headers, customer_a, seeded_products):
        krt = seeded_products['KRT-001']
        r = http.post(f'{API}/orders', headers=hdr(customer_a['token']),
                      json={'items': [{'productId': krt['id'], 'quantity': 25}],
                            'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra'}})
        oid = r.json()['id']
        for s in ('confirmed', 'processing', 'shipped', 'delivered'):
            http.put(f'{API}/orders/{oid}/status', headers=admin_headers, json={'status': s})
        return oid

    def test_return_before_delivery_rejected(self, http, customer_a, seeded_products):
        krt = seeded_products['KRT-001']
        o = http.post(f'{API}/orders', headers=hdr(customer_a['token']),
                      json={'items': [{'productId': krt['id'], 'quantity': 25}],
                            'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra'}}).json()
        r = http.post(f'{API}/returns', headers=hdr(customer_a['token']),
                      json={'orderId': o['id'], 'reason': 'change of mind'})
        assert r.status_code == 400

    def test_return_ownership_check(self, http, admin_headers, customer_a, customer_b, seeded_products):
        oid = self._fresh_delivered_order(http, admin_headers, customer_a, seeded_products)
        blocked = http.post(f'{API}/returns', headers=hdr(customer_b['token']),
                            json={'orderId': oid, 'reason': 'not mine'})
        assert blocked.status_code == 403

    def test_return_reason_defect_store_pays(self, http, admin_headers, customer_a, seeded_products):
        oid = self._fresh_delivered_order(http, admin_headers, customer_a, seeded_products)
        r = http.post(f'{API}/returns', headers=hdr(customer_a['token']),
                      json={'orderId': oid, 'reason': 'received a defective piece'})
        assert r.status_code == 200
        assert r.json()['returnShippingPaidBy'] == 'store'

    def test_return_reason_normal_customer_pays(self, http, admin_headers, customer_a, seeded_products):
        oid = self._fresh_delivered_order(http, admin_headers, customer_a, seeded_products)
        r = http.post(f'{API}/returns', headers=hdr(customer_a['token']),
                      json={'orderId': oid, 'reason': 'size issue'})
        assert r.json()['returnShippingPaidBy'] == 'customer'

    def test_return_status_transitions(self, http, admin_headers, customer_a, seeded_products):
        oid = self._fresh_delivered_order(http, admin_headers, customer_a, seeded_products)
        ret = http.post(f'{API}/returns', headers=hdr(customer_a['token']),
                        json={'orderId': oid, 'reason': 'defect'}).json()
        rid = ret['id']
        # Invalid: requested -> refunded
        bad = http.put(f'{API}/returns/{rid}/status', headers=admin_headers, json={'status': 'refunded'})
        assert bad.status_code == 400
        # requested -> approved
        assert http.put(f'{API}/returns/{rid}/status', headers=admin_headers,
                        json={'status': 'approved'}).status_code == 200
        # approved -> received
        assert http.put(f'{API}/returns/{rid}/status', headers=admin_headers,
                        json={'status': 'received'}).status_code == 200
        # received -> refunded
        assert http.put(f'{API}/returns/{rid}/status', headers=admin_headers,
                        json={'status': 'refunded', 'refundAmount': 100}).status_code == 200


# ==================================================================
# PRINT JOBS
# ==================================================================
class TestPrintJobs:
    def test_customer_cannot_create(self, http, customer_a, seeded_products):
        # need a real order to reference; create one guest
        krt = seeded_products['KRT-001']
        o = http.post(f'{API}/orders', headers=hdr(customer_a['token']),
                      json={'items': [{'productId': krt['id'], 'quantity': 25}],
                            'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra'}}).json()
        r = http.post(f'{API}/print-jobs', headers=hdr(customer_a['token']),
                      json={'orderId': o['id']})
        assert r.status_code == 403

    def test_customer_response_hides_vendor(self, http, admin_headers, customer_a, seeded_products):
        krt = seeded_products['KRT-001']
        o = http.post(f'{API}/orders', headers=hdr(customer_a['token']),
                      json={'items': [{'productId': krt['id'], 'quantity': 25}],
                            'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra'}}).json()
        job = http.post(f'{API}/print-jobs', headers=admin_headers,
                        json={'orderId': o['id'], 'vendorId': 'v-secret', 'vendorCost': 5000,
                              'status': 'pending'}).json()
        jid = job['id']
        # customer GET listing must strip
        listing = http.get(f'{API}/print-jobs', headers=hdr(customer_a['token'])).json()
        c_job = next((x for x in listing if x['id'] == jid), None)
        assert c_job is not None
        assert 'vendorCost' not in c_job
        assert 'vendorId' not in c_job
        # customer GET single also stripped
        single = http.get(f'{API}/print-jobs/{jid}', headers=hdr(customer_a['token'])).json()
        assert 'vendorCost' not in single and 'vendorId' not in single
        # admin sees them
        admin_single = http.get(f'{API}/print-jobs/{jid}', headers=admin_headers).json()
        assert admin_single.get('vendorCost') == 5000
        assert admin_single.get('vendorId') == 'v-secret'

    def test_customer_can_approve_only_from_proof_sent(self, http, admin_headers, customer_a, seeded_products):
        krt = seeded_products['KRT-001']
        o = http.post(f'{API}/orders', headers=hdr(customer_a['token']),
                      json={'items': [{'productId': krt['id'], 'quantity': 25}],
                            'shippingAddress': {'pincode': '400001', 'state': 'Maharashtra'}}).json()
        job = http.post(f'{API}/print-jobs', headers=admin_headers,
                        json={'orderId': o['id'], 'status': 'pending'}).json()
        jid = job['id']
        # customer trying to approve from 'pending' -> blocked
        bad = http.put(f'{API}/print-jobs/{jid}/status', headers=hdr(customer_a['token']),
                       json={'status': 'customer_approved'})
        assert bad.status_code == 403
        # admin moves to proof_sent
        http.put(f'{API}/print-jobs/{jid}/status', headers=admin_headers, json={'status': 'proof_sent'})
        # customer can approve
        good = http.put(f'{API}/print-jobs/{jid}/status', headers=hdr(customer_a['token']),
                        json={'status': 'customer_approved'})
        assert good.status_code == 200
        # customer trying to move to in_production -> blocked
        bad2 = http.put(f'{API}/print-jobs/{jid}/status', headers=hdr(customer_a['token']),
                        json={'status': 'in_production'})
        assert bad2.status_code == 403


# ==================================================================
# USERS (admin-only)
# ==================================================================
class TestUsersRoleGating:
    def test_staff_cannot_list_users(self, http, staff_headers):
        assert http.get(f'{API}/users', headers=staff_headers).status_code == 403

    def test_staff_cannot_create_user(self, http, staff_headers):
        assert http.post(f'{API}/users', headers=staff_headers,
                         json={'name': 'x', 'email': 'x@x.com', 'password': 'p', 'role': 'staff'}).status_code == 403

    def test_customer_cannot_list_users(self, http, customer_a):
        assert http.get(f'{API}/users', headers=hdr(customer_a['token'])).status_code == 403

    def test_admin_can_list_users(self, http, admin_headers):
        r = http.get(f'{API}/users', headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ==================================================================
# SETTINGS
# ==================================================================
class TestSettings:
    def test_public_settings_no_gemini_key(self, http):
        r = http.get(f'{API}/settings/public')
        assert r.status_code == 200
        j = r.json()
        assert 'geminiApiKey' not in j
        assert 'storeName' in j

    def test_full_settings_admin_only(self, http, admin_headers, staff_headers, customer_a):
        assert http.get(f'{API}/settings', headers=admin_headers).status_code == 200
        assert http.get(f'{API}/settings', headers=staff_headers).status_code == 403
        assert http.get(f'{API}/settings', headers=hdr(customer_a['token'])).status_code == 403

    def test_update_settings_admin_only(self, http, admin_headers, staff_headers):
        assert http.put(f'{API}/settings', headers=staff_headers, json={'x': 'y'}).status_code == 403
        r = http.put(f'{API}/settings', headers=admin_headers, json={'freeShippingThreshold': '15000'})
        assert r.status_code == 200


# ==================================================================
# DASHBOARD, EXPORT, ACTIVITY LOG
# ==================================================================
class TestDashboardExportActivity:
    def test_admin_dashboard(self, http, admin_headers, customer_a):
        assert http.get(f'{API}/dashboard/admin', headers=admin_headers).status_code == 200
        assert http.get(f'{API}/dashboard/admin', headers=hdr(customer_a['token'])).status_code == 403
        j = http.get(f'{API}/dashboard/admin', headers=admin_headers).json()
        for k in ('totalSales', 'openOrders', 'averageOrderValue', 'lowStockProducts'):
            assert k in j

    def test_export_orders_csv(self, http, admin_headers, customer_a):
        r = http.get(f'{API}/export/orders.csv', headers=admin_headers)
        assert r.status_code == 200
        assert 'text/csv' in r.headers.get('content-type', '')
        reader = csv.reader(io.StringIO(r.text))
        rows = list(reader)
        assert rows[0][0] == 'Order Number'
        # customer forbidden
        assert http.get(f'{API}/export/orders.csv', headers=hdr(customer_a['token'])).status_code == 403

    def test_export_customers_csv(self, http, admin_headers):
        r = http.get(f'{API}/export/customers.csv', headers=admin_headers)
        assert r.status_code == 200
        rows = list(csv.reader(io.StringIO(r.text)))
        assert rows[0][0] == 'Name'

    def test_activity_log_has_entries(self, http, admin_headers):
        r = http.get(f'{API}/activity-log', headers=admin_headers)
        assert r.status_code == 200
        entries = r.json()
        assert isinstance(entries, list)
        # We've been creating orders, quotes, returns in prior tests
        types_seen = {e['entityType'] for e in entries}
        assert 'order' in types_seen

    def test_activity_log_customer_forbidden(self, http, customer_a):
        assert http.get(f'{API}/activity-log', headers=hdr(customer_a['token'])).status_code == 403


# ==================================================================
# CROSS-CUTTING ROLE SECURITY
# ==================================================================
class TestCrossCuttingRoleSecurity:
    def test_customer_blocked_from_privileged_writes(self, http, customer_a):
        h = hdr(customer_a['token'])
        cases = [
            ('POST', f'{API}/products', {'name': 'x', 'basePrice': 1, 'moq': 1}),
            ('DELETE', f'{API}/products/507f1f77bcf86cd799439011', None),
            ('POST', f'{API}/categories', {'name': 'x'}),
            ('POST', f'{API}/banners', {'imageUrl': 'x'}),
            ('POST', f'{API}/shipping-zones', {'name': 'x', 'rate': 1}),
            ('DELETE', f'{API}/shipping-zones/507f1f77bcf86cd799439011', None),
            ('POST', f'{API}/bank-accounts', {'accountName': 'x', 'accountNumber': '1'}),
            ('POST', f'{API}/vendors', {'name': 'x'}),
            ('GET', f'{API}/users', None),
            ('POST', f'{API}/users', {'name': 'x', 'email': 'y@z.com', 'password': 'p', 'role': 'staff'}),
            ('GET', f'{API}/settings', None),
            ('PUT', f'{API}/settings', {'x': 'y'}),
            ('GET', f'{API}/dashboard/admin', None),
            ('GET', f'{API}/export/orders.csv', None),
            ('GET', f'{API}/activity-log', None),
        ]
        failures = []
        for method, url, body in cases:
            r = http.request(method, url, headers=h, json=body)
            if r.status_code == 200:
                failures.append(f'{method} {url} -> 200 (SHOULD be 403)')
            elif r.status_code not in (401, 403):
                # 400/404 acceptable for endpoints hit with bogus data, but never 200
                pass
        assert not failures, 'Customer got 200 on privileged endpoint(s): ' + '; '.join(failures)

    def test_unauthenticated_blocked_from_privileged_writes(self, http):
        cases = [
            ('POST', f'{API}/products', {'name': 'x'}),
            ('POST', f'{API}/categories', {'name': 'x'}),
            ('GET', f'{API}/settings', None),
            ('GET', f'{API}/users', None),
            ('GET', f'{API}/dashboard/admin', None),
        ]
        for method, url, body in cases:
            r = http.request(method, url, json=body)
            assert r.status_code == 401, f'{method} {url} expected 401, got {r.status_code}'
