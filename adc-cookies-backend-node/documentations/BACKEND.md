# ADC Cookies — Integrations Reference

Every third-party service this backend talks to: **all** the endpoints each one offers, which of
them we call, which have been exercised against the live service, and which are still available to
us but unused.

**Status legend**

| | meaning |
|---|---|
| **LIVE** | we call it, and it has been run against the real service |
| **WIRED** | we call it, but it has never been exercised end to end |
| **UNUSED** | the service offers it; we do not call it today |
| **N/A** | not an endpoint — local computation, or they call us |

`ours` is the route on **our** API that triggers the call, or the route that receives their webhook.
`internal` means no HTTP route of ours maps to it directly; it happens inside a flow.

---

## Razorpay — payments

- **Base** `https://api.razorpay.com/v1`
- **Auth** HTTP Basic, `base64(key_id:key_secret)`
- **Mode** staging uses a `rzp_test_…` key; **production is LIVE** and moves real money
- **Env** `RAZORPAY_API_KEY`, `RAZORPAY_API_SECRET`, `RAZORPAY_WEBHOOK_SECRET`

| status | theirs | what it does | ours |
|---|---|---|---|
| **LIVE** | `POST /orders` | create the order Checkout attaches the payment to | `POST /api/orders/:id/payment/razorpay-order` |
| **LIVE** | `GET /payments/:id` | server-side truth for status and amount, read straight after the signature passes | internal |
| **LIVE** | `GET /orders/:id/payments` | every payment against one order — this is what catches a duplicate charge | internal |
| **LIVE** | `POST /payments/:id/refund` | refund a captured payment | admin Cancel & Refund |
| **N/A** | — | signature check is local HMAC-SHA256: `HMAC(order_id\|payment_id, secret)` must equal `razorpay_signature` | `POST /api/orders/:id/payment/verify` |
| **N/A** | inbound | webhook, server-to-server. Raw body + `X-Razorpay-Signature`. Configured in Dashboard → Settings → Webhooks | `POST /api/payments/webhook` |
| **N/A** | inbound | redirect callback — a browser form POST from their hosted Checkout, so it works in in-app browsers that cannot run the popup | `POST /api/payment-callback/:orderId` |
| **LIVE** | inbound event | `payment.dispute.created` — chargeback notice, handled inside the webhook | `POST /api/payments/webhook` |

**Also offered, unused:** Settlements, Payment Links, Subscriptions, Smart Collect, Route (split
payments), Invoices, QR codes.

---

## Delhivery — outstation parcels

- **Base** `DELHIVERY_BASE_URL` — staging `https://staging-express.delhivery.com`, production `https://track.delhivery.com`
- **Auth** `Authorization: Token <token>` — **`Token`, not `Bearer`**
- **Env** `DELIVERY_API_TOKEN` (or `DELHIVERY_API_TOKEN`), `DELHIVERY_BASE_URL`
- Staging and production take **different tokens**. Ours is production.

| status | theirs | what it does | ours |
|---|---|---|---|
| **LIVE** | `GET /c/api/pin-codes/json/?filter_codes=<pin>` | is the destination serviceable; COD/prepaid flags | `GET /api/delivery/serviceability` |
| **LIVE** | `GET /api/dc/expected_tat` | transit time between two pincodes | `GET /api/delivery/tat` |
| **LIVE** | `GET /waybill/api/fetch/json/?count=1` | reserve a waybill before creating the shipment | internal |
| **LIVE** | `POST /api/cmu/create.json` | create the shipment. Form-encoded: `format=json&data=<json>` | internal + admin manual |
| **LIVE** | `POST /api/p/edit` | cancel. **Flat** body `{waybill, cancellation:'true'}` — not wrapped in `shipments:[…]` | `DELETE /api/admin/orders/:id/shipment` |
| **LIVE** | `GET /api/p/packing_slip?wbns=…&pdf=true` | printable label PDF (pre-signed URL) | `GET /api/admin/delivery/label` |
| **LIVE** | `GET /api/v1/packages/json/?waybill=` | live tracking / current status | `GET /api/orders/:id/delhivery-track` |
| **LIVE** | `POST /api/backend/clientwarehouse/create/` | register a pickup warehouse. Name must match `pickup_location` exactly. Edit: `/edit/` | `POST /api/admin/warehouses` |
| **LIVE** | `GET /api/kinko/v1/invoice/charges/.json` | shipping cost estimate for a weight/route | `GET /api/admin/delivery/shipping-cost` |
| **LIVE** | `POST /fm/request/new/` | book a courier pickup at a warehouse | admin pickup panel |
| **LIVE** | `GET /api/rest/fetch/pkg/document/` | proof of delivery — `SIGNATURE_URL`, `EPOD`, `RVP_QC_IMAGE`, `SELLER_RETURN_IMAGE` | `GET /api/admin/orders/:id/document` |
| **UNUSED** | `POST /api/p/update` | **NDR** — re-attempt a failed delivery. Async: returns a UPL id, poll NDR Status for the result. No route exists for this | — |

**Also offered, unused:** Reverse pickup (RVP), bulk waybill fetch, warehouse list, rate calculator
by zone, LTL/B2B endpoints.

---

## Shiprocket — intracity / same-day

- **Base** `https://apiv2.shiprocket.in/v1/external`
- **Auth** an External API *user* — email + password, **not** an API key. Create at
  Settings → API → Add New API User. The email must differ from the main Shiprocket login. Two
  settings on that form matter to us: **Modules to Access** (must include Orders, Couriers and
  Tracking) and **Buyer's Details Access** — set to *Not Allowed*, tracking responses come back
  without the customer block. Token lasts 10 days; we refresh a day early, because a token expiring
  mid-checkout would fail an order already paid for.
- **Env** `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_BASE_URL`, `SHIPROCKET_PICKUP_*`, `SHIPROCKET_WEBHOOK_TOKEN`, `SHIPROCKET_CATEGORY`
- **Mode** one LIVE production account, shared by staging and production.
- **Support** `integration@shiprocket.com` for API questions, `support@shiprocket.com` otherwise.

### Four different ids, and they are easy to confuse

One booking carries four identifiers. We store three of them, and the column names do not match
Shiprocket's vocabulary — a leftover from Delhivery being the first carrier wired up.

| theirs | what it is | our column |
|---|---|---|
| `order_id` (request) | **our** reference — we send `orders.order_number` | `orders.order_number` |
| `order_id` (response) / `sr_order_id` | **their** order id | `orders.carrier_order_id` |
| `shipment_id` | the shipment inside that order — what AWB assignment takes | `orders.delhivery_shipment_id` |
| `awb` / `awb_code` | exists only once a rider is actually assigned | `orders.delhivery_waybill` |

Their docs are explicit that every endpoint takes **their** order id, not ours, unless it says
otherwise. Sending `order_number` where `sr_order_id` belongs is a silent 404.

| status | theirs | what it does | ours |
|---|---|---|---|
| **LIVE** | `POST /auth/login` | bearer token, 10 days | internal |
| **LIVE** | `GET /courier/serviceability` | serviceability **and live rate** — the only way to price an intracity leg | `GET /api/delivery/check` |
| **LIVE** | `POST /orders/create/adhoc` | create the order. Returns `shipment_id` + `order_id`. No rider yet | internal |
| **LIVE** | `POST /courier/assign/awb` | **dispatches a real rider and bills the account** | internal |
| **LIVE** | `GET /courier/track/shipment/{shipment_id}` | awb, live status, courier, activity trail | internal + admin |
| **LIVE** | `GET /courier/track/awb/{awb}` | same, but keyed on the awb — richer once a rider exists | internal |
| **LIVE** | `GET /orders/show/{sr_order_id}` | order-level status. **The only endpoint that answers before an awb exists** — see the quirks below | internal |
| **LIVE** | `POST /orders/cancel` | cancel the order (body: `{ ids: [sr_order_id] }`) | admin Cancel & Refund |
| **LIVE** | `GET /settings/company/pickup` | pickup locations — admin readiness screen and the routing guard | `GET /api/admin/delivery/pickups` |
| **LIVE** | `GET /account/details/wallet-balance` | wallet balance; gates whether a rider can still be booked | admin + store tablet |
| **N/A** | inbound | tracking webhook | `POST /api/hyperlocal/webhook` |

### Webhook

- **Method** `POST`, `Content-Type: application/json`, must answer **200 and nothing else**.
- **Set up at** Settings → API → Webhooks. Security token arrives as `x-api-key`
  (`SHIPROCKET_WEBHOOK_TOKEN`).
- **The URL may not contain `shiprocket`, `kartrocket`, `sr`, or `kr`.** This is a documented
  restriction, and it is why our endpoint is `/api/hyperlocal/webhook` rather than
  `/api/shiprocket` — their panel silently rejects the latter. Do not "tidy" that path.
- Body carries `awb`, `current_status`, `sr_order_id`, `order_id` (ours), `scans[]`, `is_return`.

### Quirks that have already cost us a day

**Shipment tracking is silent until a rider exists.** `GET /courier/track/shipment/{id}` answers
about an *awb*, and an awb only appears once a rider accepts. Before that it returns
`current_status: null` with no activities, and it stays that way forever if the order is cancelled
before any rider is found. `GET /orders/show/{sr_order_id}` is the only endpoint that answers in
that window, which is why `trackShiprocket` falls back to it. Verified live 2026-08-14 on three
orders cancelled in their own panel.

**`assign/awb` and `orders/show` can flatly contradict each other.** Observed on
`ADC20260829055951` (2026-08-29): after Shiprocket abandoned a ~30 minute rider hunt, `orders/show`
reported `NEW` continuously for 18 minutes, while `POST /courier/assign/awb` rejected the same
order twice with `"order is in cancelled state."` — 300 ms apart. No status endpoint ever said
cancelled. A human clicking **Ship Now** in their panel then revived it on the *same*
`sr_order_id` and *same* `shipment_id`, so nothing had actually been cancelled and no re-create was
needed. Conclusion: `/courier/assign/awb` keyed on `shipment_id` is not what their panel's Ship Now does
for a lapsed Quick order, and its state check reads something stale.

**The lead, from their own validation-error documentation.** Assignment accepts **either**
identifier — the 422 they document for a missing payload reads:

```
"shipment_id": ["The shipment ID field is required when Order ID is not present."]
"order_id":    ["The Order ID field is required when Shipment ID is not present."]
```

We had only ever sent `shipment_id`. Assigning by `order_id` (their `sr_order_id`, our
`carrier_order_id`) is a different lookup and plausibly the path their panel takes — which would
explain how a human revived the exact order our call had just refused.

**Implemented 2026-08-29, unproven.** `retryRiderSearch` and the admin Rebook button both assign by
`order_id` and fall back to `shipment_id`, logging `via order` or `via shipment` so the next lapsed
order settles it. If the response carries a different `shipment_id`, it is stored — an order-keyed
assign can attach a fresh shipment, and without that every later track call would follow the
cancelled one.

Retry accounting changed with it. `rider_retry_count` now counts only **hunts we actually bought**
(an assign that succeeded and still found nobody), capped at `RIDER_RETRY_MAX`. Refusals go to
`rider_refusal_count`, capped separately at `RIDER_REFUSAL_MAX`, because an empty wallet never
became a search and must not consume one. `RIDER_RETRY_GAP_MIN` now applies **only after a
refusal** — a successful assign leaves the order off `NEW` for the length of their own ~30 minute
hunt, and that is the spacing.

**We hunt for a rider while the cookies are still in the oven.** `autoCreateShipment` runs when the
store *accepts* the order, not when it is packed. On ADC20260829055951 the store accepted at
08:41:48, the hunt began at 08:41:53, gave up at 09:11:55 — and the order was only PACKED at
09:12:56. **The rider search expired 61 seconds before the food was ready**, and had it succeeded,
a rider would have been standing at the counter for half an hour.

This is the real cause of that day's failure; the retry only looked broken because it was cleaning
up after a hunt that ran at the wrong time. Two ways out: send `search_rider_for` with roughly the
prep time so the hunt starts when the order is nearly ready, or move booking from store-accept to
PACKED. The first is one field; the second is a flow change.

**Rate limit** is a real `429`. The poller is deliberately sequential for this reason.

### Hyperlocal (Quick) — the parameters that make it hyperlocal

There is no separate hyperlocal API. It is the ordinary endpoints plus a handful of fields, and
omitting any of them silently produces a normal courier booking instead of a Quick one. All of the
following are **verified present in our client** as of 2026-08-29.

| where | field | value we send |
|---|---|---|
| `GET /courier/serviceability` | `is_new_hyperlocal` | `1` — **mandatory**, without it Quick never appears |
| | `lat_from`, `long_from`, `lat_to`, `long_to` | all four, **mandatory** for Quick; we refuse the call if any is missing |
| | `mode_of_transport` | omitted (2-wheeler default); `3`/`4` for larger vehicles |
| `POST /orders/create/adhoc` | `shipping_method` | `"HL"` — **mandatory**, this is what marks it hyperlocal |
| | `latitude`, `longitude` | the **drop** coordinates, mandatory |
| | `payment_method` | `Prepaid`. HL supports Prepaid and COD only; COD is capped at ₹2000 |
| `POST /courier/assign/awb` | `vehicle_type` | `2` (their default anyway) |

Serviceability also returns `distance` alongside `rates`, which is where our km figure comes from.

**Hyperlocal fields we do NOT send, and could:**

| field | what it does | worth it? |
|---|---|---|
| `search_rider_for` | **a delay before the hunt starts**, in seconds, max 1800 — *not* a cap on how long it runs. Unset = start immediately, confirmed by ADC20260829055951 searching 1s after creation | **yes — see the timing note below** |
| `pickup_otp`, `drop_otp`, `rto_otp` | 4-digit codes the rider must enter in their app at each handover | plausible anti-mix-up measure for multi-order pickups |
| `future_pickup_scheduled` | schedule the assignment up to 48h ahead | would let us take genuine pre-orders |
| `quick_drop_addresses[]` | **SPMD — Single Pickup, Multiple Drops.** One rider, several orders from one store. Serviceability takes comma-separated `lat_to`/`long_to` for this | **the interesting one.** Two Bengaluru orders from the same store in the same window are two riders and two fees today |
| `pickup_address` (object) | pass a full pickup address inline instead of a registered `pickup_location` nickname | avoids pre-registering a store |
| `is_insurance_opt` | shipment insurance | no — cookies |
| `surge_type` / `surge_fees` | declare a rain/festive surcharge | only if we ever pass surge on to the customer |
| `expected_edd` | expected delivery days | informational |
| `collect_shipping_fees` | collect freight from the buyer on delivery | no — they already paid us |

**`POST /settings/company/addpickup`** registers a pickup location, and needs `is_hyperlocal: 1`
plus `lat`/`long` for Quick. We only ever *read* pickup locations; every store was added by hand in
their panel. Worth knowing when store number six opens.

### Their full API surface

Their docs are organised into the sections below. We touch four of them. Paths are given only where
verified — the rest are recorded so nobody has to rediscover that the capability exists.

| section | what is in it | us |
|---|---|---|
| Authentication | `POST /auth/login` | **LIVE** |
| Create Or Update Order | `POST /orders/create/adhoc`, channel-specific create, bulk update, and a "Quick Order Creation" all-in-one that creates + ships + adds a pickup location + generates label and manifest in one call | partly LIVE |
| Couriers | `POST /courier/assign/awb`, `GET /courier/serviceability`, `POST /courier/generate/pickup` | partly LIVE |
| Orders | `GET /orders` (paginated), `GET /orders/show/{id}`, `POST /orders/cancel`, update pickup location | partly LIVE |
| **Hyperlocal** | the Quick / same-day section. Not separate endpoints — the *same* paths as above plus hyperlocal-only parameters. See the subsection below | **LIVE**, parameters verified |
| Tracking | by awb, by multiple awbs, by shipment id, by our order id | partly LIVE |
| Shipments | list shipments, fetch one | UNUSED |
| Return & Exchange Orders | create/update return orders | UNUSED |
| Labels / Manifests / Invoice | generate + print label, manifest, invoice | UNUSED — we use Delhivery's |
| NDR | `POST /ndr/reattempt` — retry a failed delivery | UNUSED |
| Pickup Addresses | list and add pickup locations | read-only LIVE |
| Wrapper API | combined convenience calls | UNUSED |
| International | cross-border shipping | UNUSED — not applicable |
| Account | `GET /account/details/wallet-balance` | **LIVE** |
| Products / Listings / Channels / Inventory | catalogue and sales-channel sync | UNUSED — our catalogue is ours |
| Countries / Statement Details / Discrepancy Details / File Imports | reference data, billing statements, weight-discrepancy disputes, bulk import | UNUSED — *Discrepancy Details* is worth knowing about if they ever bill us for a weight we dispute |

**Sense** is a separate paid product (RTO-risk scoring, address validation) at
`console.shiprocket.in`. Not part of this account.

**Shiprocket also ships an MCP server** (`github.com/bfrs/shiprocket-mcp`, Node 22.x, seller email +
password in env) exposing `shipping_rate_calculator`, `estimated_date_of_delivery`, `order_create`,
`order_list`, `order_track`, `order_ship`, `order_pickup_schedule`, `generate_shipment_label`,
`order_cancel`, `list_pickup_addresses`. Useful for ad-hoc operator questions from an AI client —
**not** something to put in the request path of a checkout. Note `order_ship` is their name for
assign-courier-and-generate-shipping, which is the operation failing above.

### Response codes

`200`/`202` fine · `400` bad request · `401` token or credentials · `404` unknown URI or resource ·
`405` wrong method · `422` syntax or unfulfillable · `429` rate limited · `5xx` theirs. Note that
some of their endpoints answer `200` with an error message in the body, so a status check alone is
not enough — `srRequest` inspects the body too.

---

## PetPooja — POS / billing

- **Base** `PETPOOJA_BASE_URL` — sandbox `https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1`, production `https://pponlineordercb.petpooja.com`
- **Auth** `app_key` (32 chars) + `app_secret` (40) + `access_token` (40) go in **every outbound body, not headers**
- **Env** `PETPOOJA_APP_KEY`/`PETPOOJA_API`, `_APP_SECRET`, `_ACCESS_TOKEN`, `_REST_ID`, `_BASE_URL`, `_WEBHOOK_SECRET`, `_PROXY_URL`
- **Not usable on staging** — no app keys there, so `petpoojaConfigured()` is false and relay no-ops.

### They call us (inbound)

| status | ours | what it is |
|---|---|---|
| **LIVE** | `POST /api/petpooja/pushmenu` | the whole catalogue, pushed after every menu change. The only supported way to get the menu |
| **WIRED** | `POST /api/petpooja/callback` | merchant accepted / rejected / progressed the order. **Currently 401s** — see below |
| **LIVE** | `POST /api/petpooja/item-stock` | item / add-on stock toggle. One endpoint for both on and off, as their docs advise |
| **LIVE** | `POST /api/petpooja/get-store-status` | is the store open |
| **LIVE** | `POST /api/petpooja/update-store-status` | set the store open/closed |

### We call them (outbound)

| status | theirs | what it does | ours |
|---|---|---|---|
| **WIRED** | `POST /save_order` | relay a paid order so the bill and KOT print at the store | `relayOrder()`, chained after the shipment |
| **WIRED** | `POST /update_order_status` | cancel at the POS. **Cancel is the only transition they accept** | admin Cancel & Refund |
| **WIRED** | `POST /rider_status_update` | tell the POS the parcel moved | shipment flow |
| **UNUSED** | `POST /mapped_restaurant_menus` | Fetch Menu — **deprecated by PetPooja**. Push Menu replaces it | `fetchMenu()` |

**Quirks, confirmed against the live sandbox rather than assumed:**
- business failures still return **HTTP 200** — success lives in the body
- `success` is the **string** `"1"` / `"0"`, never a boolean
- Fetch Menu answers *"unable to fetch Object from s3 bucket"* until the merchant hits Menu Trigger
  once. That is an empty menu, not an auth error.
- Outbound calls go through `PETPOOJA_PROXY_URL` for a static IP. The proxy is scoped to this client
  alone, so a wrong or unreachable proxy cannot affect any other integration.

**Open blocker:** `/callback` returns 401. The dashboard's "Client Authorization" value is not the
same string as `PETPOOJA_WEBHOOK_SECRET`.

---

## Message Central — phone OTP

- **Base** `https://cpaas.messagecentral.com` (`MC_BASE_URL`)
- **Auth** `authToken` header — a static dashboard token (`AUTH_KEY`), or generated from `CUSTOMER_ID` + `MC_PASSWORD`
- **Product** VerifyNow

| status | theirs | what it does | ours |
|---|---|---|---|
| **LIVE** | `GET /auth/v1/authentication/token` | mint a token — only used when `AUTH_KEY` is unset | internal |
| **LIVE** | `POST /verification/v3/send?flowType=SMS&otpLength=4` | send the OTP SMS | `POST /api/auth/otp/send` |
| **LIVE** | `GET /verification/v3/validateOtp` | validate the typed code. **GET, despite their docs saying POST** — only GET works | `POST /api/auth/otp/verify` |
| **UNUSED** | `flowType=WHATSAPP` / `EMAIL` | same send endpoint, different delivery channel | — |
| **UNUSED** | voice OTP | a call instead of an SMS | — |
| **UNUSED** | branded sender ID / custom template | **not available on this product** — the SMS cannot say "A Dough Cookie" | — |

---

## Supabase — identity, storage

- **Auth** service-role key server-side; anon key to mint sessions
- **Env** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANON_KEY`

| status | theirs (SDK → REST) | what it does | ours |
|---|---|---|---|
| **LIVE** | `admin.createUser` → `POST /auth/v1/admin/users` | new phone-OTP signup | `POST /api/auth/otp/verify` |
| **LIVE** | `admin.updateUserById` → `PUT /auth/v1/admin/users/:id` | reset the one-time password each OTP; sync name/phone | `POST /api/auth/otp/verify`, `PATCH /api/auth/me` |
| **LIVE** | `admin.deleteUser` → `DELETE /auth/v1/admin/users/:id` | cleanup after merging a duplicate phone account | internal |
| **LIVE** | `signInWithPassword` → `POST /auth/v1/token?grant_type=password` | exchange credentials for a real session | `POST /api/auth/otp/verify` |
| **LIVE** | `signInWithOAuth({provider:'google'})` | Google sign-in — entirely client-side, no backend route | frontend only |
| **LIVE** | raw SQL on `auth.users` | read `raw_user_meta_data->>'full_name'` — not via the SDK | internal |
| **LIVE** | Storage | private `adc-media` bucket; images served as signed URLs, which is why they are resolved at run time and never baked into a build | `POST /api/admin/uploads` |
| **UNUSED** | `listUsers`, `generateLink`, MFA admin | — | — |

Phone logins mint a synthetic `phone_…@phone.adccookies.app` email. `users.email` is nullable in the
schema; every production account has one only because of that synthetic address.

---

## Resend — email

- **Base** `https://api.resend.com` · `Authorization: Bearer <RESEND_API_KEY>`
- Replaced Zoho SMTP.

| status | theirs | what it does | ours |
|---|---|---|---|
| **LIVE** | `POST /emails` | contact-form notification, order confirmation, business copy | `POST /api/contact`, and `finalizePaidOrder()` |

Order mail is sent from `finalizePaidOrder` — **on payment, not on submission**. An abandoned
checkout must not email a confirmation.

**Also offered, unused:** batch send, audiences/contacts, domains API, scheduled send, webhooks for
delivery/bounce/complaint events.

---

## Ola Maps — geocoding

- **Base** `https://api.olamaps.io` · `client_credentials` → bearer, cached to its JWT expiry
- **Env** `OLA_CLIENT_ID`, `OLA_CLIENT_SECRET`

| status | theirs | what it does | ours |
|---|---|---|---|
| **LIVE** | autocomplete / suggest | address suggestions while typing | `GET /api/geo/suggest` |
| **LIVE** | forward geocode | address → coordinates | `GET /api/geo/forward` |
| **LIVE** | reverse geocode | coordinates → address | `GET /api/geo/reverse` |

Falls back to **Nominatim** when unconfigured — visible in the response's `provider` field, which is
how you can tell which one answered. Mappls was removed.

---

## ipapi.co — login location

| status | theirs | what it does | ours |
|---|---|---|---|
| **LIVE** | `GET https://ipapi.co/<ip>/json/` | best-effort city/region for a login. Free tier, no key | `POST /api/auth/log-location` |

Best-effort by design: it must never block or fail a login.

---

## What we cannot do through any API

- **Delhivery NDR re-attempt** — the endpoint exists (`POST /api/p/update`); nothing in our code
  calls it. Failed deliveries are handled in their panel.
- **PetPooja menu pull** — Fetch Menu is deprecated. The menu only arrives when the merchant
  triggers a push.
- **Branded OTP sender** — not offered on Message Central's VerifyNow.
- **Shiprocket rate comparison across couriers** — we take the serviceability quote as given.
- **Re-ship a lapsed Shiprocket Quick order** — *attempted automatically since 2026-08-29, not yet
  confirmed working.* The poller and the admin Rebook button now assign by `order_id` and fall back
  to `shipment_id`. Whether the order-keyed call actually recovers a lapsed Quick order is unproven
  — their docs show it is *accepted*, not that it revives. The `via order` / `via shipment` marker
  in the `[POLL]` line says which one worked; until a real lapsed order proves it, a human clicking
  Ship Now remains the fallback.

---

## Two things to know before testing

**Staging shares production's Delhivery and Shiprocket accounts** — same hosts, same credentials,
same `begur` pickup. A staging order that reaches PAID books a **real** parcel and spends the real
wallet, even though the payment itself was test-mode. Razorpay *is* correctly split; the carriers
are not.

**An implicit host is a live hazard.** `config/env.ts` refuses to boot when an integration holds
credentials but its base URL is unset, because the defaults point at the wrong world:
`DELHIVERY_BASE_URL` defaults to production, `PETPOOJA_BASE_URL` defaults to the sandbox — and a
production order relayed to the sandbox gets `success:"1"` back while the kitchen never sees it.
