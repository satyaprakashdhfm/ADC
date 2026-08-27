# ADC Cookies — Backend

Everything needed to work on this service: how it is put together, every route, every outbound
integration, and the traps that have already cost someone a day. Written to be read start to finish
once, then used as reference.

**Stack** — Node 24 · TypeScript (ESM) · Express 4 · PostgreSQL (Supabase) · Drizzle ORM
**Runs on** — Railway. Two services, one repo: `adc-backend` ← `main`, `adc-backend Copy` ← `final_deploy`.

---

## 1. Run it

```bash
npm install
npm run build        # tsc -> dist/
npm start            # node dist/server.js
npm run dev          # tsc --watch + node --watch dist/
npm test             # builds, then node --test
npm run typecheck    # tsc --noEmit
```

**The source is TypeScript and cannot be run directly.** `node src/server.ts` does not work; there is
no type-stripping in the pipeline. Always build first. `dist/` is generated output — gitignored,
disposable, recreated by `npm run build`.

Imports keep `.js` extensions even though the files are `.ts`. That is `moduleResolution: NodeNext`
working as intended: `./db/index.js` resolves to `db/index.ts` when compiling and to the emitted
`db/index.js` at run time. Do not "correct" them to `.ts`.

---

## 2. Layout

```
src/
├── app.ts            Express app: cors, helmet, body parsers, routes, error handler
├── server.ts         listen + one-time boot work (env check, schema, seed, pollers)
├── config/           env.ts (boot-time validation), supabase.ts
├── db/               index.ts (pool + query helpers), drizzle.ts, initSchema.ts, seed.ts
├── models/           Drizzle pgTable definitions, one file per subject
├── services/         business logic (*.service.ts) and outbound clients (*.client.ts)
├── routes/           HTTP only; webhooks under routes/webhooks/
├── middlewares/      auth.middleware.ts
├── serializers/      row -> API shape
├── jobs/             statusPoller.ts
├── types/            express.d.ts — declares req.user / req.storeUser / req.admin
└── utils/            ApiError, logger, result
```

**`.client.ts` vs `.service.ts` is a rule, not a naming habit: a `.client.ts` never imports `db`.**
A client is the part you can reason about without knowing our schema. Everything touching our own
tables is a service. `petpooja` is split down that line — HTTP in the client, rules in the service.

**Two things that look tidy but are load-bearing:**

- `app.ts` mounts the Razorpay raw body **before** `express.json`. Reversed, signature verification
  fails silently and every webhook is rejected.
- The 12 MB body parser is scoped to `/api/petpooja/pushmenu` **alone**. Widening it makes every
  other endpoint a memory target.

`orderProgress.service.ts` looks like it belongs inside `order.service.ts`. It does not: folding it
in makes `shipment.service` import `order.service`, which already imports `shipment.service`. That
module exists to break the cycle.

---

## 3. The three identities

Express carries no notion of who is asking. Middleware attaches one of three, and they are separate
identities, not roles of one thing — nothing upgrades one into another.

| | attached by | gate | what it is |
|---|---|---|---|
| `req.user` | `parseAuth` (every request) | `requireAuth` | a customer, via Supabase token |
| `req.storeUser` | `requireStoreUser` | same | a store tablet, via our own HS256 token |
| `req.admin` | `requireAdminSession` | same | an allowlisted phone + OTP session |

All three are typed **optional** in `src/types/express.d.ts`, deliberately: `parseAuth` runs on every
request and attaches `req.user` only when a token verified. Reading `req.user.id` without a gate in
front of it is a compile error, which is what you want — it used to be a 500 on an anonymous request.

**The admin gate is `requireAdminSession`, never `users.role`.** That column was retired; `initSchema`
actively sets every row to `CUSTOMER`.

---

## 4. Routes

129 routes. Auth is by prefix: `/api/admin/*` needs an admin session, `/api/store/*` a store login,
and `cart` / `orders` / `addresses` a customer. Webhooks authenticate by shared secret or HMAC and
must never return 500 — a retry storm is worse than dropping one bad payload.

#### `/api/products`

- `GET    /api/products`
- `GET    /api/products/:id`
- `GET    /api/products/announcement`
- `GET    /api/products/hero-banner`
- `GET    /api/products/ordering-status`
- `GET    /api/products/packs`

#### `/api/delivery`

- `GET    /api/delivery/area`
- `GET    /api/delivery/check`
- `GET    /api/delivery/serviceability`
- `GET    /api/delivery/tat`

#### `/api/coupons`

- `GET    /api/coupons/active`
- `GET    /api/coupons/available`
- `POST   /api/coupons/claim-email`
- `POST   /api/coupons/claim-spin`
- `POST   /api/coupons/spin`
- `GET    /api/coupons/spin-cooldown`
- `GET    /api/coupons/spin-status`
- `GET    /api/coupons/validate`

#### `/api/auth`

- `POST   /api/auth/log-location`
- `GET    /api/auth/me`
- `PATCH  /api/auth/me`
- `POST   /api/auth/otp/send`
- `POST   /api/auth/otp/verify`

#### `/api/cart`

- `DELETE /api/cart`
- `GET    /api/cart`
- `POST   /api/cart/items`
- `DELETE /api/cart/items/:itemId`
- `PATCH  /api/cart/items/:itemId`

#### `/api/addresses`

- `GET    /api/addresses`
- `POST   /api/addresses`
- `DELETE /api/addresses/:id`
- `PUT    /api/addresses/:id`

#### `/api/orders`

- `GET    /api/orders`
- `POST   /api/orders`
- `GET    /api/orders/:id`
- `POST   /api/orders/:id/abandon`
- `GET    /api/orders/:id/delhivery-track`
- `POST   /api/orders/:id/payment/razorpay-order`
- `POST   /api/orders/:id/payment/verify`
- `GET    /api/orders/:id/tracking`

#### `/api/payments`

- `POST   /api/payments/webhook`

#### `/api/payment-callback`

- `POST   /api/payment-callback/:orderId`

#### `/api/contact`

- `POST   /api/contact`

#### `/api/geo`

- `GET    /api/geo/forward`
- `GET    /api/geo/reverse`
- `GET    /api/geo/suggest`

#### `/api/store`

- `GET    /api/store/availability`
- `PATCH  /api/store/availability`
- `POST   /api/store/login`
- `GET    /api/store/me`
- `GET    /api/store/menu`
- `PUT    /api/store/menu/:productId/availability`
- `GET    /api/store/orders`
- `GET    /api/store/orders/:id`
- `POST   /api/store/orders/:id/accept`
- `POST   /api/store/orders/:id/pos-bill`
- `POST   /api/store/orders/:id/ready`
- `GET    /api/store/orders/:id/track`
- `POST   /api/store/password`

#### `/api/admin-auth`

- `POST   /api/admin-auth/logout`
- `GET    /api/admin-auth/me`
- `POST   /api/admin-auth/otp/send`
- `POST   /api/admin-auth/otp/verify`

#### `/api/admin`

- `GET    /api/admin/analytics`
- `GET    /api/admin/attention`
- `GET    /api/admin/contact`
- `PATCH  /api/admin/contact/:id/handled`
- `GET    /api/admin/coupons`
- `POST   /api/admin/coupons`
- `DELETE /api/admin/coupons/:id`
- `PUT    /api/admin/coupons/:id`
- `PATCH  /api/admin/coupons/:id/toggle`
- `POST   /api/admin/coupons/reset-spins`
- `GET    /api/admin/dashboard`
- `GET    /api/admin/delivery/label`
- `POST   /api/admin/delivery/pickup-request`
- `GET    /api/admin/delivery/shipping-cost`
- `GET    /api/admin/delivery/stores`
- `GET    /api/admin/delivery/wallet`
- `GET    /api/admin/delivery/warehouses`
- `POST   /api/admin/delivery/warehouses`
- `PUT    /api/admin/delivery/warehouses/:id`
- `PATCH  /api/admin/delivery/warehouses/:id/default`
- `PATCH  /api/admin/delivery/warehouses/:id/toggle`
- `GET    /api/admin/orders`
- `GET    /api/admin/orders/:id`
- `POST   /api/admin/orders/:id/cancel`
- `POST   /api/admin/orders/:id/cancel/request-code`
- `GET    /api/admin/orders/:id/document`
- `POST   /api/admin/orders/:id/rebook`
- `DELETE /api/admin/orders/:id/shipment`
- `POST   /api/admin/orders/:id/shipment`
- `PATCH  /api/admin/orders/:id/status`
- `GET    /api/admin/orders/:id/track`
- `GET    /api/admin/petpooja/mapping`
- `POST   /api/admin/petpooja/mapping`
- `POST   /api/admin/petpooja/mapping/by-product`
- `POST   /api/admin/petpooja/mapping/create-product`
- `GET    /api/admin/petpooja/orders`
- `POST   /api/admin/petpooja/orders/:id/retry`
- `GET    /api/admin/products`
- `POST   /api/admin/products`
- `DELETE /api/admin/products/:id`
- `PUT    /api/admin/products/:id`
- `GET    /api/admin/settings`
- `PUT    /api/admin/settings`
- `POST   /api/admin/settings/hero-banner/reset`
- `GET    /api/admin/store-products/:code`
- `PUT    /api/admin/store-products/:code/:productId`
- `GET    /api/admin/store-status`
- `PATCH  /api/admin/store-status/:code/service-mode`
- `PATCH  /api/admin/store-status/:code/toggle`
- `GET    /api/admin/stores`
- `POST   /api/admin/stores/:code/staff`
- `DELETE /api/admin/stores/staff/:id`
- `POST   /api/admin/stores/staff/:id/password`
- `PATCH  /api/admin/stores/staff/:id/toggle`
- `DELETE /api/admin/uploads`
- `POST   /api/admin/uploads`
- `GET    /api/admin/users`
- `PUT    /api/admin/users/:id`

#### `/api/petpooja`

- `POST   /api/petpooja/callback`
- `POST   /api/petpooja/get-store-status`
- `POST   /api/petpooja/item-stock`
- `POST   /api/petpooja/pushmenu`
- `POST   /api/petpooja/update-store-status`

#### `/api/hyperlocal`

- `GET    /api/hyperlocal/webhook`
- `POST   /api/hyperlocal/webhook`

#### `/`

- `GET    /`
---

## 5. Integrations

Every outbound client returns `{ ok: false, reason }` rather than throwing. That is not a style
choice: they run on the paid-order path, where an exception unwinds into a 500 and leaves a customer
charged with no parcel. A failure has to come back as a value the caller can record.

### Razorpay — payments
`https://api.razorpay.com/v1` · Basic auth, `base64(key_id:key_secret)` · **staging is TEST, production is LIVE**

| what | ours | theirs |
|---|---|---|
| create order | `POST /api/orders/:id/payment/razorpay-order` | `POST /orders` |
| verify signature | `POST /api/orders/:id/payment/verify` | *(local HMAC-SHA256, no call)* |
| confirm server-side | internal, after signature passes | `GET /payments/:id` |
| duplicate-charge check | internal, after finalize | `GET /orders/:id/payments` |
| refund | admin Cancel & Refund | `POST /payments/:id/refund` |
| redirect callback | `POST /api/payment-callback/:orderId` | *(browser form POST — works in in-app browsers)* |
| webhook | `POST /api/payments/webhook` | *(inbound; raw body + `X-Razorpay-Signature`)* |

### Delhivery — outstation parcels
`DELHIVERY_BASE_URL` · `Authorization: Token <token>` — **`Token`, not `Bearer`**

| what | ours | theirs |
|---|---|---|
| serviceability | `GET /api/delivery/serviceability` | `GET /c/api/pin-codes/json/?filter_codes=` |
| transit time | `GET /api/delivery/tat` | `GET /api/dc/expected_tat` |
| reserve waybill | internal | `GET /waybill/api/fetch/json/?count=1` |
| create shipment | internal + admin manual | `POST /api/cmu/create.json` *(form-encoded)* |
| cancel | `DELETE /api/admin/orders/:id/shipment` | `POST /api/p/edit` *(flat body `{waybill, cancellation:'true'}`)* |
| label PDF | `GET /api/admin/delivery/label` | `GET /api/p/packing_slip?wbns=&pdf=true` |
| track | `GET /api/orders/:id/delhivery-track` | `GET /api/v1/packages/json/?waybill=` |
| register warehouse | `POST /api/admin/warehouses` | `POST /api/backend/clientwarehouse/create/` |

Staging and production use **different tokens**. NDR (re-attempt a failed delivery) is not implemented.

### Shiprocket — intracity / same-day
`https://apiv2.shiprocket.in/v1/external` · email + password → 10-day bearer token (not an API key)

`POST /auth/login` → `GET /courier/serviceability` (the only way to price intracity) →
`POST /orders/create/adhoc` → **`POST /courier/assign/awb` dispatches a real rider and bills the
account** → `GET /courier/track/shipment/{id}` · `POST /orders/cancel` · `GET /settings/company/pickup`

Their webhook must be pointed at `POST /api/hyperlocal/webhook`; their panel rejects `/api/shiprocket`.
`SHIPROCKET_DISABLED=true` is the kill switch — intracity stops being offered rather than silently
falling back to a multi-day courier.

### PetPooja — POS / billing
Credentials (`app_key`, `app_secret`, `access_token`) go in **every outbound body, not headers**.

Outbound: `POST /save_order` (relay a paid order so the bill and KOT print) · `POST /update_order_status`
(cancel — the only transition they accept) · `POST /rider_status_update` · `POST /mapped_restaurant_menus`.
Inbound: `POST /api/petpooja/pushmenu` · `/callback` · `/item-stock` · `/get-store-status` · `/update-store-status`.

Their quirks, confirmed against the live sandbox, not assumed:
- business failures still return **HTTP 200** — success lives in the body
- `success` is the **string** `"1"` / `"0"`, never a boolean
- Fetch Menu answers *"unable to fetch Object from s3 bucket"* until the merchant hits Menu Trigger
  once. That is an empty menu, not an auth error.

`PETPOOJA_PROXY_URL` routes these calls through a static IP; the proxy is scoped to this client alone,
so a bad proxy cannot affect anything else.

### Message Central — phone OTP
`https://cpaas.messagecentral.com` · `authToken` header

`POST /verification/v3/send` ← `POST /api/auth/otp/send` · `GET /verification/v3/validateOtp` ←
`POST /api/auth/otp/verify`. **Validate is GET even though their docs say POST** — only GET works.
There is no branded sender ID on this product; the SMS cannot say "A Dough Cookie".

### Supabase — identity + media
Service-role key server-side, anon key to mint sessions. `admin.auth.admin.createUser` /
`updateUserById` / `deleteUser`, then `signInWithPassword` to hand back a real session. Phone logins
mint a synthetic `phone_…@phone.adccookies.app` email. Private `adc-media` bucket for uploads, served
as signed URLs — which is why the storefront asks for them at run time rather than baking them in.

### Resend — email
`POST https://api.resend.com/emails`, Bearer. Order confirmation + business copy are sent from
`finalizePaidOrder`, i.e. **on payment, not on submission** — an abandoned checkout must not email.

### Ola Maps — geocoding
`client_credentials` → bearer, cached to its JWT expiry. Falls back to Nominatim when unconfigured.

---

## 6. Database

Postgres on Supabase, through the **session pooler**, which caps this backend near 15 connections —
hence `max: 10` in `db/index.ts`. **Drizzle shares that pool.** A second pool would double the count
and start refusing connections on the busiest path, which is checkout.

### The type parsers are not optional

`db/index.ts` registers three, and `src/models/_columns.ts` mirrors them for Drizzle. Without them
the two disagree, silently, on money:

```
raw SQL   subtotal + delivery_fee  =  234
Drizzle   subtotal + deliveryFee   =  18549      <- "185" + "49"
```

| type | comes back as | why |
|---|---|---|
| `NUMERIC` (1700) | JS number | a string turns `a + b` into concatenation on order totals |
| `TIMESTAMPTZ` (1184) | ISO string | the API has always emitted strings |
| `DATE` (1082) | raw `YYYY-MM-DD` | coupon expiry is compared against a string; a Date expires coupons a day early |

`tests/dbParity.test.ts` proves Drizzle and raw SQL agree. It skips when no database is reachable.

### Schema, and where it lives

- `src/models/` — what the schema **is**. Generated, not hand-written.
- `drizzle/` — how it **got there**: ordered migrations plus `meta/` snapshots. `drizzle-kit`
  produces the next migration by diffing models against that snapshot, so the folder is its
  reference point, not a duplicate of models.
- `db/initSchema.ts` — still creates tables on boot. Retired once Drizzle owns migrations.

Refreshing models from a live database is two steps, because `drizzle-kit pull` always writes one file:

```bash
npx drizzle-kit pull --config=<config whose out= is a scratch dir>
node scripts/split-models.mjs <that dir>/schema.ts
```

`split-models.mjs` also substitutes the `_columns.ts` types. Skip it and money breaks as above.

---

## 7. Environment

The boot check in `config/env.ts` **refuses to start** when an integration holds credentials but its
host is implicit. The danger was never a missing variable — it is a present default pointing at the
wrong world:

- `DELHIVERY_BASE_URL` defaults to production. Unset on staging, test orders book **real parcels**.
- `PETPOOJA_BASE_URL` defaults to the sandbox. Unset in production, paid orders relay to a sandbox
  that answers `success:"1"` and the kitchen never sees them — worse than a crash, because it looks
  exactly like success.
- `SHIPROCKET_BASE_URL`, `MC_BASE_URL` — same shape, real wallet and real SMS behind them.

Everything wrong is reported in one failure, so fixing four variables takes one deploy.

**Required:** `DATABASE_URL` · `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `ANON_KEY` ·
`JWT_SECRET` · `ALLOWED_ORIGINS` · `RAZORPAY_API_KEY` / `_API_SECRET` / `_WEBHOOK_SECRET` ·
`RESEND_API_KEY` · `BUSINESS_EMAIL`

**Per integration:** `DELIVERY_API_TOKEN` + `DELHIVERY_BASE_URL` · `SHIPROCKET_EMAIL` / `_PASSWORD` /
`_BASE_URL` / `_PICKUP_*` / `_WEBHOOK_TOKEN` · `PETPOOJA_APP_KEY` (or `PETPOOJA_API`) / `_APP_SECRET` /
`_ACCESS_TOKEN` / `_REST_ID` / `_BASE_URL` / `_WEBHOOK_SECRET` / `_PROXY_URL` · `CUSTOMER_ID` +
`AUTH_KEY` + `MC_BASE_URL` · `OLA_CLIENT_ID` / `_SECRET`

**Behaviour:** `SKIP_SEED` · `SHIPROCKET_DISABLED` · `STATUS_POLL_MS` / `_BATCH` ·
`RIDER_RETRY_MAX` / `_GAP_MIN` · `ORIGIN_PINCODE` · `PORT`

---

## 8. The order path

```
create (PENDING) → Razorpay order → customer pays
   → verify  ─┐
   → webhook ─┴─> finalizePaidOrder()   [whichever lands first]
        ├── atomic claim: PAID + CONFIRMED, one winner only
        ├── payment row, coupon redemption, confirmation email
        └── bookShipmentAndRelay()  [background]
              ├── autoCreateShipment  → Shiprocket (intracity) or Delhivery (outstation)
              └── relayOrder          → PetPooja, last and never fatal
```

**The atomic claim is the load-bearing part.** Razorpay sends `payment.captured` and `order.paid`
milliseconds apart; both used to read "not paid" and proceed, and one real order got two of
everything. Making the *transition* the contended thing, not the read before it, means exactly one
caller proceeds.

Shipment and relay run in the background so a ~5s carrier round-trip cannot delay or fail the
customer's response. Relay is chained **after** the shipment so the courier fee on the bill is real,
and is last because by then the money is taken and the parcel booked.

Everything a store can reach is gated by mode: a store must be active, its `service_mode` must allow
the mode, and for intercity there must be an **active Delhivery warehouse at its pincode**. Without
that third condition the capability check and the booking disagree, and the customer meets that
disagreement after paying.

---

## 9. Known traps

- **Staging shares production's Delhivery and Shiprocket accounts.** Same hosts, same credentials,
  same `begur` pickup. A test order that reaches PAID on staging books a **real** parcel and spends
  the real wallet, even though the payment itself was test-mode. Razorpay *is* correctly split.
- **PetPooja is not usable on staging** — no app keys there, so `petpoojaConfigured()` is false and
  relay no-ops.
- **The PetPooja `/callback` 401** is a credential mismatch: the dashboard's "Client Authorization"
  value is not the same as `PETPOOJA_WEBHOOK_SECRET`.
- **Intercity is closed whenever Begur is switched off.** It is the only store whose mode allows
  intercity and the only one with an active warehouse, so its toggle is the intercity switch for the
  whole shop, whatever the products are flagged as.
- **`users.email` is nullable.** Every production account has one only because phone logins mint a
  synthetic address — luck, not a guarantee.
- **`noImplicitAny` is off.** `config`, `db`, `models` and `utils` already pass with it on; tighten
  the rest directory by directory.
- **407 SQL sites are still raw.** Only `siteContent` is on Drizzle. Both styles share a pool and a
  transaction, so porting can go one service at a time.
