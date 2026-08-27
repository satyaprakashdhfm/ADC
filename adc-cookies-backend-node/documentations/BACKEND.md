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
  `app.shiprocket.in/seller/settings/additional-settings/api-users`. Token lasts 10 days; we refresh
  a day early, because a token expiring mid-checkout would fail an order already paid for.
- **Env** `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_BASE_URL`, `SHIPROCKET_PICKUP_*`, `SHIPROCKET_WEBHOOK_TOKEN`, `SHIPROCKET_CATEGORY`
- **Mode** one LIVE production account, shared by staging and production.

| status | theirs | what it does | ours |
|---|---|---|---|
| **LIVE** | `POST /auth/login` | bearer token, 10 days | internal |
| **LIVE** | `GET /courier/serviceability` | serviceability **and live rate** — the only way to price an intracity leg | `GET /api/delivery/check` |
| **LIVE** | `POST /orders/create/adhoc` | create the order. Returns `shipment_id`. No rider yet | internal |
| **LIVE** | `POST /courier/assign/awb` | **dispatches a real rider and bills the account** | internal |
| **LIVE** | `GET /courier/track/shipment/{id}` | awb, live status, courier, activity trail | internal + admin |
| **LIVE** | `POST /orders/cancel` | cancel the order | admin Cancel & Refund |
| **LIVE** | `GET /settings/company/pickup` | pickup locations — admin readiness screen and the routing guard | `GET /api/admin/delivery/pickups` |
| **LIVE** | `GET /account/details/wallet-balance` | wallet balance; gates whether a rider can still be booked | admin + store tablet |
| **N/A** | inbound | tracking webhook. **Must be pointed at `/api/hyperlocal/webhook`** — their panel rejects `/api/shiprocket` | `POST /api/hyperlocal/webhook` |

**Also offered, unused:** Return orders, pickup scheduling, NDR, label/manifest generation (we use
Delhivery's), channel and inventory management, courier-rate comparison.

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
