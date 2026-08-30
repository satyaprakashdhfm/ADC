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
| **LIVE** | `GET /api/p/packing_slip?wbns=…&pdf=true&pdf_size=4R` | printable label PDF (pre-signed URL). **`pdf_size` is not optional in practice** — see below | `GET /api/admin/delivery/label` |
| **LIVE** | `GET /api/v1/packages/json/?waybill=` | live tracking / current status | `GET /api/orders/:id/delhivery-track` |
| **LIVE** | `POST /api/backend/clientwarehouse/create/` | register a pickup warehouse. Name must match `pickup_location` exactly. Edit: `/edit/` | `POST /api/admin/warehouses` |
| **LIVE** | `GET /api/kinko/v1/invoice/charges/.json` | shipping cost estimate for a weight/route | `GET /api/admin/delivery/shipping-cost` |
| **LIVE** | `POST /fm/request/new/` | book a courier pickup at a warehouse | admin pickup panel |
| **LIVE** | `GET /api/rest/fetch/pkg/document/` | proof of delivery — `SIGNATURE_URL`, `EPOD`, `RVP_QC_IMAGE`, `SELLER_RETURN_IMAGE` | `GET /api/admin/orders/:id/document` |
| **UNUSED** | `POST /api/p/update` | **NDR** — re-attempt a failed delivery. Async: returns a UPL id, poll NDR Status for the result. No route exists for this | — |

**Also offered, unused:** Reverse pickup (RVP), bulk waybill fetch, warehouse list, rate calculator
by zone, LTL/B2B endpoints.

### The label printed in the corner of the page — `pdf_size`, verified 2026-08-30

The store's thermal printer was producing a 4x6 label block stranded in the corner of a large sheet.
The cause is one absent query parameter, and their Generate Shipping Label reference states it
outright:

> If the `pdf_size` parameter is not provided, the label will default to **A4** size.

We sent `?wbns=…&pdf=true` and nothing else, so every label we have ever fetched came back on an
8x11 page. `shippingLabelUrl()` now sends `pdf_size` and defaults it to `4R`.

**That did not fix it, and the parameter is not the whole story.** Measured on the real label for
`57064410000206` after the change shipped — the log confirms the request went out as `size=4R`:

```
[ADMIN-LABEL] wbns=57064410000206 | size=4R | ✓ via link | 159291b
```

and the PDF still came back **595 x 842 pt — A4, exactly**. Their `pdf=true` path ignores
`pdf_size`. Worse, the PDF it returns is mis-composed, which is visible in the page's entire
content stream:

```
q 0 J 1 w 0 j 0 G 0 g q 0.9470 0 0 1.0131 -230.0000 217.0000 cm /GOFPDITPL0 Do Q Q
```

One form XObject, whose `/BBox` is `[0 0 792 612]` — **US Letter, landscape** — stamped onto an A4
**portrait** page. Three separate faults in that one line:

- **non-uniform scale**, 0.9470 across against 1.0131 down: the label is squashed ~6.5% horizontally
  relative to vertically, so the barcodes are drawn stretched
- **negative x offset**, −230 pt: the form's left edge is translated off the page and clipped
- **Letter-landscape content on an A4-portrait page**, which is why it strands in a corner however
  the printer is set

So `pdf_size` is sent because it is the documented parameter and costs nothing if they fix their
side — but it is **not** a working fix today, and the panel's Shipping Label Config does not reach
this either. Do not conclude from the code that the label is correct; measure the PDF.

**The documented way out is `pdf=false`**, which returns JSON instead of a PDF for us to render as
HTML with code-128 barcodes. Their own guide offers it precisely for layout control. That means
owning the label design, and it is the only route that gives a true 4x6 without depending on them
fixing the composition above.

**The One panel's Shipping Label Config does not govern this.** That screen configures labels
downloaded from the panel; an API-manifested label takes the parameter on the call, and with no
parameter it takes their A4 default no matter what the panel says. Setting the panel to Thermal 4x6
changes nothing for us — which is why the panel preview looked correct while the print did not.

| `pdf_size` | page | for |
|---|---|---|
| `4R` | **A4 anyway** — ignored on the `pdf=true` path, measured 2026-08-30 | thermal roll — our default |
| `A4` | 8x11 | desktop printer — `GET /api/admin/delivery/label?size=A4` |
| *(omitted)* | 8x11 | their documented default |

`DELHIVERY_LABEL_SIZE` moves the default without a deploy. An unrecognised value falls back to `4R`
rather than being passed through, because an invalid size silently becomes A4 again at their end.

`pdf=false` is the other half of that endpoint and we do not use it: it returns JSON instead of a
PDF, to be rendered as HTML with **code-128** encoding for a fully custom label layout. Worth
knowing if the label ever needs our own design rather than theirs.

**Their published limits for this endpoint:** average latency 210 ms, **p99 61.78 s**, rate limit
3000 requests / 5 min / IP. The p99 is the number to respect — the admin label route calls `fetch`
directly rather than through `dhRequest`, so it has no timeout of its own and a slow label can hold
the request open for a minute.

### Download Document API — verified against their reference 2026-08-30

`GET /api/rest/fetch/pkg/document/?doc_type=<type>&waybill=<wbn>`, for documents **not archived** in
Delhivery. Both parameters mandatory. Exactly four `doc_type` values are allowed, and
`DELHIVERY_DOC_TYPES` matches them: `SIGNATURE_URL`, `RVP_QC_IMAGE`, `EPOD`, `SELLER_RETURN_IMAGE`.
Auth is the usual `Authorization: Token <token>`. Checked field by field against
`fetchDocument()` — no discrepancy.

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
- **Env** `PETPOOJA_APP_KEY`/`PETPOOJA_API`, `_APP_SECRET`, `_ACCESS_TOKEN`, `_REST_ID`, `_BASE_URL`, `_WEBHOOK_SECRET`, `_PROXY_URL`, `_CALLBACK_BASE`
- `PETPOOJA_WEBHOOK_SECRET` does double duty: the Client Authorization header on the four
  dashboard-configured endpoints, and the HMAC key behind the callback's `?k=` token.
- **Not usable on staging** — no app keys there, so `petpoojaConfigured()` is false and relay no-ops.

### They call us (inbound)

| status | ours | what it is |
|---|---|---|
| **LIVE** | `POST /api/petpooja/pushmenu` | the whole catalogue, pushed after every menu change. The only supported way to get the menu |
| **WIRED** | `POST /api/petpooja/callback` | merchant accepted / rejected / progressed the order. Authenticates on `?k=` in the URL we send, **not** the header — see the root cause below |
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

### The `/callback` 401 — root cause, verified 2026-08-30

**The earlier diagnosis in this file was wrong.** It said the dashboard's "Client Authorization"
value was not the same string as `PETPOOJA_WEBHOOK_SECRET`. It is. The secret is pasted correctly
and it works. The callback fails for a different reason, and no amount of re-pasting will fix it.

Petpooja reaches us from **one IP with two different clients**, and only one of them carries the
header. Both rows below are from the Railway HTTP log for `adc-backend` production on 2026-08-30:

| their call | client | our status |
|---|---|---|
| `POST /api/petpooja/get-store-status` (×3) | `axios/1.18.1` | **200** |
| `POST /api/petpooja/callback` | `axios/**1.7.9**` | **401** |

Same `srcIp` 35.154.180.221, different axios build, opposite outcomes. The four
**dashboard-configured** endpoints (pushmenu, item-stock, get-store-status, update-store-status)
are called by a service that sends the configured Client Authorization header, and they
authenticate cleanly. `/callback` is called by a **separate, older service** that sends no
credential of any kind.

That is not a misconfiguration, it is the design. Per their Save Order guide, **`callback_url` is a
required field in the `save_order` request body** — we hand them the URL per order, they POST
results back to whatever we sent. There is no dashboard field for it and **the guide documents no
authentication mechanism for the callback at all**: no header, no token, no signature. So a
fail-closed check on `Authorization`/`x-api-key` can never pass, no matter what is configured
where.

**Confirmed never to have worked.** `petpooja_orders.petpooja_status` is written by the callback as
a raw digit (`-1`/`1`/`5`/`10`). Across the whole production history exactly one row is non-null,
order 76, and its value is the literal string `CANCELLED` — written by our own admin Cancel &
Refund (`cancelRefund.routes.ts`), not by them. No callback has ever been processed.

**The fix is NOT `PETPOOJA_WEBHOOK_ALLOW_UNAUTH=true.`** That flag is global: it opens all five
inbound endpoints, and they are not read-only — `update-store-status` closes the shop,
`item-stock` delists products, `callback` moves any order to DELIVERED or CANCELLED by an order
number that is a guessable timestamp. It would also throw away authentication on the four
endpoints that are *already working*, to fix the one that is not.

**Fixed 2026-08-30, unproven against a live callback.** `/callback` now authenticates on **the one
channel we control**: the `callback_url` we send them. `callbackToken()` derives
`?k=<HMAC-SHA256(order_number, PETPOOJA_WEBHOOK_SECRET)>` truncated to 32 hex, and
`callbackAuthed()` recomputes it from the `orderID` they echo back, comparing in constant time. Per
order rather than one static token because the URL is recorded in full by every HTTP access log in
the path — a leaked URL authenticates replays of one already-relayed order and nothing else.

Still fail closed: no secret means no token to compare and the call is refused. A correct
Client Authorization header is *also* accepted, so if their order service ever starts sending one
this does not begin failing. The other four endpoints are untouched and keep the header check that
is already working. `PETPOOJA_WEBHOOK_ALLOW_UNAUTH` remains the only escape hatch and remains
global — it is not the fix for this, and it is not needed for it.

The next real callback settles it. Watch for `[PETPOOJA] callback | order=…` following the `<-`
line; a `✗ callback rejected: bad ?k=` line means they are not echoing the query string back.

### The POS order number is not obtainable today

Their portal shows a POS order number ("Order No. 2" for `ADC20260830105240`). We do not have it,
and fixing the 401 alone will **not** get it:

- `save_order` answers `"orderID": ""` — empty on every relay we have ever made. `relayOrder()`
  stores `r.data?.orderID || null`, so `petpooja_orders.petpooja_order_id` is null on every row.
  The number appears to be assigned when the merchant accepts and prints, not when the order saves.
- The callback body does not contain it. The full key set, captured by the pre-auth request logger
  on 2026-08-30, is: `restID, orderID, status, cancel_reason, is_modified, autoaccept,
  minimum_delivery_time, minimum_prep_time`. `orderID` there is **ours**, echoed back.
- Their Save Order guide documents no pull endpoint for order state, and Fetch Menu is deprecated.

`orders.store_pos_bill_no` is written only by `POST /api/store/orders/:id/pos-bill` — staff typing
the number off the store's own terminal. Begur is `posMode: 'AUTO'` and never passes through that
screen, so **every warehouse order has a null bill number by construction**, and the day cannot be
reconciled for them the way it can for the manual outlets.

Getting it needs Petpooja to change something. Two specific asks for
`malvi.vaghela@petpooja.com` / `rohan.sakhrani@petpooja.com`: populate `orderID` in the
`save_order` response, or include the POS order/bill number in the callback body. Worth storing the
raw callback body regardless — we currently keep only `orderID` and `status` and discard the rest,
so if they ever start sending it we would not notice.

### What their portal holds, and what we can actually reach

Read off the Order Details screen for `ADC20260830105240` on 2026-08-30. This is the full picture
of what Petpooja knows about one of our orders, and how much of it an API can give us.

| their field | value | can we reach it? |
|---|---|---|
| Order No. | `2 [A Dough Cookie Begur-ADC20260830105240]` | **No.** Not in the `save_order` response, not in any callback key |
| items, qty, unit price | Chocolate Chip ×2 @60, Double Choco ×2 @65 | **Yes** — ours, echoed back exactly |
| customer name / phone / address | matches `addresses` row | **Yes** — ours |
| Order Type | `Delivery` | **Yes** — our `order_type: 'H'` |
| Order Status | `Printed` · Printed: Yes · 30 Aug 16:30:29 IST | **Doubt** — no numeric callback status is documented as "Printed"; our map has 1/2/3 = Accepted |
| Billing User | `biller` | **No** — POS-local |
| Server IP | `192.168.0.101` | **No** — the in-store terminal's LAN address |
| Settlement Amount / Settled By / Counter | `₹0.00` / `-` / `-` | **No** |
| Paid | `Yes` | **No** — not echoed anywhere we can read |

The useful discovery is the bracket: **`[A Dough Cookie Begur-ADC20260830105240]`**. Their POS stores
our `order_number` alongside its own counter, so their order number is already keyed to ours. If
they ever expose it, mapping it back is trivial — the join column exists on their side today.
"Order No. 2" is a per-outlet running count, not a global id.

### Four things on that bill that do not match what we charged

**1. The bill is ₹13 higher than the customer paid. INTENDED — confirmed 2026-08-30, do not "fix" it.**

| | ours | their bill |
|---|---|---|
| items | 250.00 | 250.00 |
| delivery | 100.00 | 100.00 |
| GST | 0.00 (inclusive) | CGST 6.25 + SGST 6.25 = **12.50** |
| round off | — | 0.50 |
| **total** | **350.00** | **363.00** |

Razorpay settled ₹350.00. We send every line `tax_inclusive: true` with an empty `item_tax`, and an
order-level `Tax` object carrying `price: '2.5'` and the extracted amount. **They ignore
`tax_inclusive` and the amount, and apply the 2.5% + 2.5% additively to the item total** —
2.5% of 250 = 6.25 twice. Note our own extraction would have been 11.90 (250 − 250/1.05), so it is
not simply that they recomputed ours; they treated a tax-inclusive price as exclusive.

**This is deliberate and was signed off on 2026-08-30.** The POS bill carries GST on top; the
storefront price is inclusive. The difference is the GST the restaurant accounts for, and the
divergence is expected rather than a defect.

Recorded because it looks exactly like a bug from the data: the amount Razorpay settled and the
amount the POS bill totals will never agree, and anyone reconciling the two — or reading this file
after spotting the gap — needs to know it was a decision. Do not "correct" the payload to make the
totals match without asking first.

**2. `Payment Type` reads `A Dough Cookie Begur`**, the outlet name, not `ONLINE` — which is what
`buildOrderPayload` sends. `Sub Order Type` shows the same string. Looks like their sub-order-type
mapping is overwriting the payment type on the display.

**3. `Settlement Amount: ₹0.00` although `Paid: Yes`.** Nothing in the guide says how a prepaid
aggregator order settles, and we send no settlement field. Left as is; it means POS-side settlement
reports will not reconcile against Razorpay.

**4. `Coupon Code:` is blank** even when one was used. We put it in `description` because their
guide documents no coupon field. Cosmetic, but worth knowing before anyone reads a POS discount
report and believes it.

### Save Order API — the payload contract

From *API Guide for Placing Orders on Petpooja*, cross-checked against `buildOrderPayload()`.
Required means required by them; ✅/❌ is their column, and the last column is what we actually send.

**Authentication** — `app_key` (32), `app_secret` (40), `access_token` (40), all three required,
all three in the **body**, from the sandbox account's Configuration section.

**Restaurant** — `restID` ✅ required (the menu-sharing code from the menu payload, or the
alphanumeric code they give you); `res_name`, `address`, `contact_information` all ❌ optional.

**Customer** — `name` ✅ and `address` ✅ required; `phone`, `email`, `latitude`, `longitude`
optional. We prefer the delivery address's recipient over the account holder, which is who the
rider actually calls.

| Order field | required | note / what we send |
|---|---|---|
| `orderID` | ✅ | our `order_number` |
| `preorder_date` / `preorder_time` | ✅ | `YYYY-MM-DD` / `HH:MM:SS` |
| `advanced_order` | ✅ | `"N"` |
| `order_type` | ✅ | `H` = Home Delivery, `P` = Parcel, `D` = Dine-in. We send `H` |
| `total` | ✅ | **restaurant's due only** — item final price − order discount + GST if the restaurant is liable + packing |
| `tax_total` | ✅ | |
| `created_on` | ✅ | `yyyy-mm-dd H:i:s` |
| `dc_tax_percentage` | ✅ | tax % on delivery charges — we send `0`, flat untaxed pass-through |
| `pc_tax_percentage` | ✅ | tax % on packing charge — `0` |
| `payment_type` | ✅ | `COD` / `CARD` / `ONLINE`. We send `ONLINE` |
| `enable_delivery` | ✅ | `0` = third-party rider, `1` = restaurant rider. We send `0` |
| `callback_url` | ✅ | **per order, no dashboard field** — see the root cause above |
| `discount_total` / `discount_type` | ❌ | `F` fixed or `P` percent |
| `delivery_charges`, `packing_charges`, `service_charge` | ❌ | |
| `urgent_order` / `urgent_time` | ❌ | prep time in minutes if urgent |
| `description` | ❌ | special instructions; we put the coupon code here |
| `OTP for Pickup` | ❌ | pickup verification code |

**Discounts:** omit the `Discount` object entirely. Their guide is explicit — use `discount_total`
and `discount_type` on the `Order` object instead. Our payload already has no `Discount`.

**Order items** — required per line: item `id` (from the Menu Push payload), `name`, `price`
(unit price **including add-ons**), `final_price` (price − item-level discount), `quantity`,
`gst_liability` (`vendor` / `restaurant`), `item_tax`, `tax_inclusive`, `tax_percentage`.
Optional: `AddonItem`, `variation_id`, `variation_name`. Because our lines are `tax_inclusive`
with empty `item_tax`, the GST reaches the bill through the order-level `Tax` object instead.

**Tax object** — every field required: `id`, `title` (CGST/SGST), `type` (`P`/`F`), `price` (the
percentage), `tax` (the amount), `restaurant_liable_amt`. We send the full amount as
restaurant-liable because we remit it.

**Support:** `malvi.vaghela@petpooja.com`, `rohan.sakhrani@petpooja.com`.

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
- **PetPooja POS order number** — `save_order` returns it empty, the callback does not carry it,
  and there is no endpoint to pull it. Every Begur/AUTO order therefore has a null
  `store_pos_bill_no`. Needs a change on their side; see the PetPooja section.
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
