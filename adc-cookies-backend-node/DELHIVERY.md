# Delhivery B2C integration — quick reference

Living map of every Delhivery API we touch: what it's for, the endpoint, where it lives in
our code, and gotchas. Keep this next to the code so any error can be checked fast.

- **Docs portal:** https://one.delhivery.com/developer-portal/document/b2c/detail/over_view
- **Base URL (STAGING — what we use now):** `https://staging-express.delhivery.com`
  - Production (later): `https://track.delhivery.com`
- **Auth:** header `Authorization: Token <DELIVERY_API_TOKEN>` (token in backend `.env`).
- **Client module:** `src/delhivery.js` (all calls go through here).

> ⚠️ **IMPORTANT — Token/env mismatch:**
> Our current `DELIVERY_API_TOKEN` is a **production** token — it works on `track.delhivery.com`
> but is rejected by staging (401 "Login or API Key Required").
> **To test on staging:** get a staging token from One Panel and put it in `.env` with
> `DELHIVERY_BASE_URL=https://staging-express.delhivery.com`.
> **To go live:** set `DELHIVERY_BASE_URL=https://track.delhivery.com` (keep the prod token).

| # | API | Purpose | Method + path | Used in | Status |
|---|-----|---------|---------------|---------|--------|
| 1 | API token | Auth for every call | header `Authorization: Token …` | `delhivery.js` | ✅ |
| 2 | Fetch Waybill | Pre-assign a waybill | `GET /waybill/api/fetch/json/?count=1` | `fetchWaybill()` | ✅ coded |
| 3 | Pincode Serviceability | Can we deliver to this PIN? | `GET /c/api/pin-codes/json/?filter_codes=<pin>` | **checkout** (`/check` route) | ✅ live |
| 4 | TAT | Est. days origin→dest | `GET /api/dc/expected_tat` | **checkout** (`/check` route) | ✅ coded |
| 5a | Warehouse Create | Register pickup location | `POST /api/backend/clientwarehouse/create/` | **admin** Delivery tab | ✅ coded |
| 5b | Warehouse Update | Edit pickup location | `POST /api/backend/clientwarehouse/edit/` | **admin** Delivery tab | ✅ coded |
| 6 | Shipping Cost | Est. charges (admin only; customer = flat ₹100) | `GET /api/kinko/v1/invoice/charges/.json` | **admin** Delivery tab | ✅ coded |
| 7 | Shipment Create | Create the shipment | `POST /api/cmu/create.json` (form-encoded) | **admin** per-order action | ✅ coded |
| 8a | Shipment Cancel | Cancel before dispatch | `POST /api/p/edit` (cancellation:true) | **admin** per-order action | ✅ coded |
| 8b | Pickup Request (PUR) | Ask Delhivery to pick up | `POST /fm/request/new/` | **admin** Delivery tab | ✅ coded |
| 9 | Shipping Label | Packing slip / label PDF | `GET /api/p/packing_slip?wbns=<wbn>` | **admin** per-order action | ✅ coded |
| 10 | Track | Shipment status | `GET /api/v1/packages/json/?waybill=<wbn>` | **admin** + **user** | ✅ coded |

## Where things live

### Backend
- `src/delhivery.js` — all Delhivery API calls; single BASE_URL/TOKEN config
- `src/routes/delivery.js` — user routes: `/serviceability`, `/tat`, `/check` (combined)
- `src/routes/admin.js` — admin routes: `/delivery/warehouses`, `/orders/:id/shipment`, `/delivery/label`, etc.
- `src/db.js` — `warehouses` table; `orders` table has `delhivery_waybill`, `shipment_status`, `label_generated`, etc.

### Frontend
- `src/lib/api.ts` — `checkDeliveryPin()` for checkout; all `admin*` delivery functions
- `src/components/ordering/OrderingApp.tsx` — real serviceability + TAT at checkout (replaces fake calculation)
- `src/components/admin/AdminDashboard.tsx` — "Delivery" tab: warehouses, cost calc, pickup request, per-order shipment actions

## Admin Delivery tab features
1. **Warehouses** — create (registers with Delhivery + saves locally), edit, set default, toggle active
2. **Shipping cost calculator** — for admin reference; customer always pays flat ₹100
3. **Pickup request** — create a PUR for the default warehouse
4. **Order shipments** — per-order: Create shipment, Download label, Cancel shipment, Track

## Pricing
Customer delivery fee = **always ₹100** regardless of cost API.

## Key gotchas (confirmed)
- **Tokens are environment-specific.** Production token ≠ staging token.
- Auth is `Authorization: Token <token>` (NOT Bearer).
- Serviceability live response uses **`remarks`** (plural), not `remark` — code handles both.
- Shipment creation POSTs `format=json&data=<json>` form-encoded (not raw JSON).
- Cancel = `/api/p/edit` with `cancellation:"true"` in the shipment object.
- TAT auth failure = **403** `{"detail":"Invalid token"}` (not 401).
- `success:false` on TAT = business result (non-serviceable route), don't retry.
- Default warehouse pincode is used as `origin_pin` for TAT; fall back to `ORIGIN_PINCODE` env.
