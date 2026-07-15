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

## Post-Phase-1 Fixes (user-requested)
- Returns: replaced free-text keyword matching with a fixed reason-code enum (`GET /api/returns/reason-codes`); `quality_not_as_expected` moved into the store-pays bucket alongside `defective`/`wrong_item_shipped` per user's explicit call ("erring toward the customer on ambiguous quality disputes matters more for repeat wholesale relationships").
- Quotes: `convert_to_order` now recalculates shipping + CGST/SGST/IGST tax from the customer's saved default address instead of zeroing both out.

## Phase 2 — Complete (Gemini Chatbot + Knowledge Base)
- Backend: `chatbot_kb` CRUD (admin/staff write, admin delete, public read of active entries), `chatbot_logs` (every Q&A logged with a `lowConfidence` flag for gap analysis), `POST /api/chatbot/ask` — public SSE streaming endpoint grounded in (a) fuzzy-matched KB entries, (b) live product catalog (tier pricing/MOQ/colors/sizes), (c) Settings policy text (shipping/returns/tax) — never invents facts outside that context. No authenticated order-status lookups (per user's v1 scope). Low-confidence answers surface a WhatsApp handoff CTA and are flagged in the logs. 3x retry with backoff to smooth over the `gemini-3.5-flash` preview model's intermittent Google-side 503 "high demand" errors (external, not a code defect).
- Frontend: `ChatWidget.jsx` — a standalone, reusable floating chat component (FAB + glass panel, SSE streaming, WhatsApp CTA) built so it can be dropped directly into the real Storefront in Phase 3 with no rework. Verified on a temporary `/chat-demo` route. `KnowledgeBaseAdmin.jsx` — a temporary standalone admin page at `/admin/knowledge-base` (login gate + KB CRUD table/dialog + conversation-log viewer with confidence badges) to manage the KB before the full Admin Panel shell exists (Phase 5).
- Testing: 95/95 asserted backend+frontend checks passed (1 skip, purely due to a live Gemini 503 during the test window — documented external/transient, not a bug). Fixed on review: KB question/answer now required (400 on empty), `deliveredAt` parsed defensively for tz-naive dates, SSE JSON parsing hardened against malformed chunks, KB admin page now redirects to login on a 401 (expired token), added a11y `DialogDescription` to the KB entry dialog.
- Still stubbed/deferred: conversation logs have no pagination (fine at current volume); product-context matching truncates to 5 without a relevance score (first-5-by-DB-order, not top-5); no distinct "LLM was down" vs "no KB match" log source (both currently surface as low-confidence).
- `/chat-demo` and `/admin/knowledge-base` are temporary preview routes — will be superseded/restyled when Phases 3 and 5 build the real Storefront and Admin Panel shells; the underlying components/endpoints do not need rework.

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
- **All 3 frontends' real UI (Phases 3-5)**: Storefront, Customer Portal, Admin Panel — not built; site root `/` is still the default CRA placeholder. ChatWidget and KB admin exist only on temporary preview routes.
- Invoice email sending — stubbed, no email provider integrated.
- Line-item (partial-order) returns — deferred per user's explicit choice.
- Payment gateway — deferred per user's explicit choice (manual admin confirmation only).

## Prioritized Backlog
- P0: Phase 3 — Storefront UI (catalog, PDP with color/size matrix + tier pricing, cart, checkout) — mount the existing ChatWidget here.
- P1: Phase 4 — Customer Portal UI.
- P1: Phase 5 — Admin Panel UI (Dashboard/Products/Orders first, then Quotes/Invoices/Payments, then Returns/PrintJobs/Settings) — fold the existing KnowledgeBaseAdmin page into the real Admin shell.
- P2: Phase 6 — E2E QA pass against Section 14 checklist (frontend flows).
- P2: Phase 7 — UAT handoff notes.
- Future: real email provider for invoices, payment gateway, line-item returns, chatbot log pagination + relevance-ranked product matching.

## Next Tasks
Await user go-ahead to start Phase 3 (Storefront UI). Design guidelines already generated (`/app/design_guidelines.json`).
