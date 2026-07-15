# Wholesale Clothing B2B SaaS — PRD & Build Log

## Original Problem Statement
B2B wholesale clothing platform: public Storefront + Customer Portal ("Antigravity") + Admin Panel + Gemini AI chatbot. Replaces WhatsApp/Excel order-taking with a structured pipeline: inquiry → quote → order → invoice → payment → fulfillment → (optional) return. Full PRD supplied by user (15 sections) plus an authoritative Google Apps Script + Google Sheets backend skeleton implementing Products/Orders/Quotes/Customers/Invoices/Payments — treated as the schema/business-logic contract of record. Non-negotiables: all pricing/MOQ/totals recalculated server-side on every order (never trust client); all role-restricted actions enforced backend-side; invoice status always derived from payments, never manually set.

## User-Confirmed Decisions (Section 11 answers)
1. **API style**: REST endpoints (not action-based). Chatbot: Gemini, user's own API key (stored in Settings, admin-editable), model `gemini-3.5-flash`.
2. **Tax**: CGST/SGST (intra-state, shipping state == seller state) vs IGST (inter-state) split; tier prices are tax-exclusive.
3. **Returns**: 7-day window from delivery, full-order-only (line-item returns deferred), customer pays return shipping unless reason mentions defect/wrong/error (then store pays).
4. **Payments**: Manual admin-confirmed only (no gateway yet), partial payments allowed, uniform pricing for all customers (no per-customer negotiated tiers).
5. **Roles/Print Jobs/Chatbot defaults accepted**: single Staff role (blocked from Settings/User Mgmt); artwork uploaded by admin/staff, customer sees proof status + approve/reject only; vendor costs never customer-visible; chatbot general Q&A only in v1, logs unanswered questions + WhatsApp handoff; one login per customer account.

## Tech Stack (confirmed, satisfies Section 8 NFRs)
FastAPI (async) + MongoDB (Motor) + React — Emergent's environment stack, since Google Apps Script cannot run here. The GAS skeleton's schema/field names/business rules were ported 1:1. JWT Bearer-token auth (7-day expiry) replaces the Sessions-sheet; bcrypt password hashing; role checks enforced via FastAPI dependencies on every write route; ActivityLog collection for auditability; CSV export endpoints; dedicated print CSS planned for Phase 5 (A4 invoice).

## Architecture
- `backend/models.py` — PyObjectId + BaseDocument pattern (Mongo `_id` never leaks; `to_mongo()`/`from_mongo()`).
- `backend/business.py` — `calculate_price` (tier pricing), `calculate_shipping` (pincode-prefix zones), `calculate_tax` (CGST/SGST vs IGST), `gen_number`, `log_activity`.
- `backend/deps.py` — `get_session`, `get_optional_session`, `require_roles(*roles)`.
- `backend/routers/*` — one router per module (auth, products, categories, banners, shippingzones, bankaccounts, vendors, orders, quotes, invoices, payments, customers, returns, printjobs, users, settings, export, activitylog, dashboard).
- `backend/seed.py` — seeds admin, settings, 3 categories, 3 products (tiered pricing/MOQ), 2 shipping zones, 1 bank account, customer `buyer1@example.com`.

## What's Been Implemented (Phase 1 — complete, as of this session)
- All 18 backend modules from the GAS schema, reimplemented in FastAPI/Mongo, full CRUD + role gating.
- Server-side tier pricing + MOQ enforcement on every order (verified: boundary quantities, MOQ rejection with clear message).
- Shipping cost by pincode-prefix zone + free-shipping threshold.
- CGST/SGST vs IGST tax split based on shipping-state vs seller-state.
- Guest + logged-in checkout; orders scoped so customers only see their own.
- Quotes: draft→open→approved→converted(or lost); atomic convert-to-order; customer-submitted quote prices are server-recomputed (staff-submitted prices are trusted — negotiation authority), closing a pricing-spoof gap present in the original GAS reference.
- Invoices: idempotent generation from order; email is a **STUBBED** endpoint (`{sent:true, stubbed:true}`, no real provider wired yet).
- Payments: overpay rejection, exact/partial payment → derived invoice/order status transitions.
- Returns: 7-day window, delivered-only, ownership check, defect-based shipping-payer rule, RMA pipeline (requested→approved→received→refunded/rejected).
- Print Jobs: vendor cost/vendor id hidden from customer responses; customer can only approve/reject from `proof_sent`.
- Users/Settings: admin-only (staff blocked, FR-8 verified).
- Admin dashboard, CSV export (orders/customers), activity log.
- 67/67 backend tests passed (testing agent); 2 minor issues found and fixed (payments/by-invoice ownership check, buyer1 seed credential mismatch).

## Still Stubbed / Not Built Yet
- **Chatbot (Phase 2)**: Gemini integration + Knowledge Base admin UI — not started. Gemini API key already stored in Settings.
- **All 3 frontends (Phases 3-5)**: Storefront, Customer Portal, Admin Panel — not built; frontend is still the default CRA placeholder.
- Invoice email sending — stubbed, no email provider integrated.
- Line-item (partial-order) returns — deferred per user's explicit choice.
- Payment gateway — deferred per user's explicit choice (manual admin confirmation only).

## Prioritized Backlog
- P0: Phase 2 — Gemini chatbot + Knowledge Base admin UI.
- P0: Phase 3 — Storefront UI (catalog, PDP with color/size matrix + tier pricing, cart, checkout).
- P1: Phase 4 — Customer Portal UI.
- P1: Phase 5 — Admin Panel UI (Dashboard/Products/Orders first, then Quotes/Invoices/Payments, then Returns/PrintJobs/Settings).
- P2: Phase 6 — E2E QA pass against Section 14 checklist (frontend flows).
- P2: Phase 7 — UAT handoff notes.
- Future: real email provider for invoices, payment gateway, line-item returns, chatbot conversation analytics.

## Next Tasks
Await user go-ahead to start Phase 2 (Gemini chatbot). Design guidelines already generated (`/app/design_guidelines.json`, Luxury Swiss Hybrid archetype) for the frontend phases.
