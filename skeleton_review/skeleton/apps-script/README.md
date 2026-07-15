# Wholesale Store — Backend Skeleton (Phase 1 + 2)

## What's in this phase
- **Setup.gs** — schema for all 18 tables + one-click `setupDatabase()`
- **Database.gs** — generic CRUD engine (`DB.getAll/getById/query/insert/update/remove`)
- **Auth.gs** — password hashing, login/logout, session tokens, role checks
- **Code.gs** — `doGet` (serves HTML) / `doPost` (JSON API router)
- **Api_Products.gs** — catalog CRUD + tier pricing + MOQ calculation
- **Api_Orders.gs** — checkout with server-side price/MOQ re-validation, shipping calc, status pipeline
- **Api_Quotes.gs** — draft → open → approved → converted/lost, and quote→order conversion
- **Api_Customers.gs** — profile, addresses, wishlist, portal dashboard stats
- **Api_Invoices.gs** — generate an invoice from an order, email it, track outstanding balance
- **Api_Payments.gs** — ledger of payments against an invoice; keeps `amountPaid`/`status` in sync automatically
- **Storefront.html / Portal.html / Admin.html** — placeholder pages so the deployment works end-to-end today

## Invoices + Payments flow (new)
1. Admin creates an order (or a customer checks out) → `orders.create`
2. Admin generates the invoice → `invoices.create` with `{ orderId }` (idempotent — calling it twice on the same order just returns the existing invoice)
3. Admin emails it → `invoices.email` with `{ id }` — sends an HTML summary via `MailApp` to the customer's address on file
4. Admin records payments as they come in → `payments.create` with `{ invoiceId, amount, method, reference }`
   - Rejects payments that would exceed the outstanding balance
   - Automatically flips invoice `status` between `unpaid → partial → paid` and mirrors that onto the order's `paymentStatus`
5. Anyone with a valid session can check `invoices.get` / `payments.listByInvoice` to see the running balance

## Setup (10 minutes)
1. Create a new Google Sheet.
2. Extensions → Apps Script. Delete the default `Code.gs` content.
3. Create each file listed above (File → New → Script file, or HTML file for the three `.html` ones) and paste in the matching content.
4. Also create **appsscript.json** — click the gear icon → check "Show appsscript.json manifest file", then paste in the manifest content.
5. In the Apps Script editor, select the `setupDatabase` function from the dropdown next to "Run" and click Run. Authorize the requested permissions.
6. Check your Sheet — all 18 tabs should now exist with headers, plus seeded Settings and one admin user (`admin@example.com` / `ChangeMe123!` — **change this password immediately**, see note below).
7. Deploy → New deployment → type "Web app" → Execute as "Me" → Who has access "Anyone" → Deploy. Copy the web app URL.
8. Test it: visit `<url>?page=store` in a browser (should show the placeholder), and test a POST call from the browser console as shown in Storefront.html.

> ⚠️ The default admin password is a placeholder. After first login, either add a `changePassword` action, or manually update the `passwordHash` value in the `Users` sheet using `hashPassword_('YourNewPassword')` run once from the script editor and logged via `Logger.log`.

## How to add the remaining modules
Every module follows the exact same three-step pattern used by Products/Orders/Quotes/Customers:

1. **Sheet already exists** — schema is already defined in `SCHEMAS` (Setup.gs) for: `Invoices`, `Payments`, `Returns`, `PrintJobs`, `Vendors`, `ShippingZones`, `BankAccounts`, `Categories`, `Banners`, `ChatbotKB`.
2. **Write `Api_<Module>.gs`** — an object (e.g. `Invoices`) with methods that call `DB.insert/update/query/...`, wrapped in `requireRole_(token, [...])` where appropriate.
3. **Register routes** — add one line per action to the `ROUTES` map in `Code.gs`, e.g.:
   ```js
   'invoices.create': function (p, token) { return Invoices.create(p, token); },
   'invoices.list':   function (p, token) { return Invoices.list(p, token); },
   ```

### Suggested next build order
1. ~~Invoices + Payments~~ ✅ done (Api_Invoices.gs, Api_Payments.gs)
2. **Categories/Banners/ShippingZones/BankAccounts** — simple CRUD, same pattern as Products but no pricing logic.
3. **Returns/RMA** — status pipeline similar to Orders (`requested → approved → received → refunded → rejected`).
4. **PrintJobs** — status pipeline (`pending → proof_sent → approved → printing → completed`), artwork files as an array of Drive URLs in `artworkFilesJson`.
5. **ChatbotKB + Gemini integration** — a `Chatbot.ask(question)` function that:
   - Fetches all active rows from `ChatbotKB` as few-shot context
   - Calls the Gemini API via `UrlFetchApp.fetch()` using the `geminiApiKey` / `geminiModel` from Settings
   - Returns the model's answer
   (Needs `https://www.googleapis.com/auth/script.external_request` scope, already in `appsscript.json`.)
6. **Frontend** — Storefront (catalog/cart/checkout), Portal (dashboard/orders/wishlist/addresses), Admin (all modules) as SWR-powered SPAs, each calling the JSON API via `fetch(scriptUrl, {method:'POST', body: JSON.stringify({action, payload, token})})`.

## Design notes / things to revisit before production
- Password hashing uses a single hardcoded "pepper" — fine for a skeleton, but add a per-user random salt column before going live.
- `Sessions` sheet grows forever — add a scheduled trigger to prune expired rows periodically.
- All money fields are plain numbers (assumed INR, 2 implied decimals handled at display time) — add currency formatting in the frontend using the `currencySymbol` setting.
- Apps Script has execution quotas (6 min/execution, ~30 concurrent requests) — fine for a small-to-mid wholesale store, but note this as a ceiling if order volume grows large.
