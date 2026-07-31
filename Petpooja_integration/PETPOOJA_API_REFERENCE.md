# Petpooja API Reference — A Dough Cookie

Every endpoint, with the exact JSON we send and receive. Written from Petpooja's own guides
(`API Guide for Placing Orders on Petpooja POS.pdf`, `Petpooja Sandbox Guide for Integration
Testing.pdf`, the Apiary reference) and corrected against what the live sandbox actually does —
the two disagree in several places, and where they do, **observed behaviour wins and is marked so**.

Last verified: **2026-07-29**

---

## 1. Identity — four ids for one restaurant

Mixing these up is the single easiest way to lose a day, so they are listed first.

| Id | Value | What it is | Used for |
|---|---|---|---|
| **Menu-sharing code** | `bw8dz5o93u` | The mapping code Petpooja gave us | **`restID` in every order relay**, and the key we file the menu under |
| Restaurant id | `449010` | The real outlet, "A Dough Cookie – Begur" | Their onboarding/support references |
| Sandbox row id | `5312` | The staging restaurant, shown as `5312 - Dough Cookie DEMO [449010]` | Dashboard URLs only |
| Client id | `5147` | Account-level id | Their support references |

Petpooja's Save Order guide is explicit: *"You are required to provide the Menu sharing code
received from the menu payload as a `restID`."*

A menu payload carries **two** of these — `restaurants[0].restaurantid` (internal row id) and
`restaurants[0].details.menusharingcode`. **Key the catalogue on the menu-sharing code**, because
that is what orders are relayed with. Filing it under `restaurantid` means every mapping lookup
silently returns nothing.

## 2. Credentials

From the dashboard's **Configuration** tab. Lengths are a useful sanity check.

| Field | Length | Where it goes |
|---|---|---|
| `app_key` | 32 | request **body** (snake_case) *and* `app-key` **header** (hyphenated) |
| `app_secret` | 40 | same |
| `access_token` | 40 | same |

Their docs use the body form for Save Order and the header form for Fetch Menu. We send **both on
every call** — each endpoint reads whichever it wants and ignores the other. Verified to be harmless.

Env vars (`adc-cookies-backend-node/.env`), either spelling accepted:

```
PETPOOJA_API / PETPOOJA_APP_KEY
PETPOOJA_API_SECRET / PETPOOJA_APP_SECRET
PETPOOJA_API_TOKEN / PETPOOJA_ACCESS_TOKEN
PETPOOJA_REST_ID          = bw8dz5o93u
PETPOOJA_BASE_URL         (optional override)
PETPOOJA_WEBHOOK_SECRET   (optional; gates our inbound endpoints)
```

## 3. Hosts

**Theirs (staging):** `https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1`
Confirmed by the dashboard's own "Staging Endpoints" panel *and* the Save Order PDF. The Apiary
reference lists `47pfzh5sf2` for save_order; both answer identically, which is why the base URL is
an env var rather than a constant.

**Ours:** `https://adc-backend-copy-production.up.railway.app/api/petpooja`

> `private-efeab2-onlineorderingapisv210.apiary-mock.com` is Apiary's **mock** server. It returns
> canned sample data regardless of credentials and is connected to nothing. Never test against it.

---

# PART A — Endpoints we call on Petpooja

## A1. Save Order — `POST /save_order`

Relays a paid order so the bill and KOT print at the store.

**Status: ❌ rejects every request.** See §6.

### Request

```json
{
  "app_key": "<32 chars>",
  "app_secret": "<40 chars>",
  "access_token": "<40 chars>",
  "restID": "bw8dz5o93u",
  "device_type": "Web",
  "udid": "",
  "res_name": "A Dough Cookie - Begur",
  "address": "167/3 First floor, Chickbegur Village, Begur, Bengaluru 560114",
  "contact_information": "9381502998",
  "OrderInfo": {
    "Customer": {
      "name": "Customer Name",
      "address": "Full delivery address",
      "phone": "9876543210",
      "email": "customer@example.com",
      "latitude": "12.8845",
      "longitude": "77.6270"
    },
    "Order": {
      "orderID": "ADC1042",
      "preorder_date": "2026-07-29",
      "preorder_time": "14:30:00",
      "advanced_order": "N",
      "order_type": "H",
      "payment_type": "ONLINE",
      "total": "80.00",
      "tax_total": "3.80",
      "discount_total": "0",
      "discount_type": "F",
      "delivery_charges": "0",
      "packing_charges": "0",
      "service_charge": "0",
      "enable_delivery": 0,
      "dc_tax_percentage": "0",
      "pc_tax_percentage": "0",
      "min_prep_time": 20,
      "description": "",
      "created_on": "2026-07-29 14:30:00",
      "callback_url": "https://adc-backend-copy-production.up.railway.app/api/petpooja/callback"
    },
    "OrderItem": [
      {
        "id": "9658",
        "name": "Plain Dahi",
        "gst_liability": "restaurant",
        "tax_inclusive": true,
        "price": "80.00",
        "final_price": "80.00",
        "quantity": "1",
        "item_discount": "0",
        "description": "",
        "variation_name": "",
        "variation_id": "",
        "item_tax": [
          { "id": "11213", "name": "CGST", "tax_percentage": "2.5", "amount": "1.90" },
          { "id": "20375", "name": "SGST", "tax_percentage": "2.5", "amount": "1.90" }
        ],
        "AddonItem": { "details": [] }
      }
    ],
    "Tax": [
      { "id": "11213", "title": "CGST", "type": "P", "price": "2.5", "tax": "1.90", "restaurant_liable_amt": "0.00" },
      { "id": "20375", "title": "SGST", "type": "P", "price": "2.5", "tax": "1.90", "restaurant_liable_amt": "0.00" }
    ],
    "Discount": []
  }
}
```

### Required fields (from their PDF — ✅ means mandatory)

| Object | Field | Notes |
|---|---|---|
| root | `app_key`, `app_secret`, `access_token`, `restID` | ✅ |
| root | `device_type` | ✅ `"Web"` — their docs call it case-sensitive |
| Customer | `name`, `address` | ✅ — `phone`, `email`, lat/long optional |
| Order | `orderID` | ✅ our order_number; echoed back on the callback |
| Order | `preorder_date` `YYYY-MM-DD`, `preorder_time` `HH:MM:SS` | ✅ |
| Order | `advanced_order` | ✅ `"Y"` / `"N"` |
| Order | `order_type` | ✅ `H` Home Delivery · `P` Parcel · `D` Dine-in |
| Order | `payment_type` | ✅ `COD` / `CARD` / `ONLINE` |
| Order | `total` | ✅ includes GST when liability is the restaurant's |
| Order | `tax_total` | ✅ |
| Order | `created_on` | ✅ `yyyy-mm-dd H:i:s` |
| Order | `dc_tax_percentage`, `pc_tax_percentage` | ✅ tax % on delivery / packing — `0` for us |
| Order | `enable_delivery` | ✅ **`0` third-party rider**, `1` restaurant's own |
| Order | `callback_url` | ✅ per-order — there is **no dashboard field** for it |
| OrderItem | `id` | ✅ **Petpooja's** item id, from the menu payload |
| OrderItem | `name`, `price`, `final_price`, `quantity` | ✅ `price` = unit price **plus add-ons** |
| OrderItem | `gst_liability` | ✅ `restaurant` / `vendor` — who **remits**, not who bears the cost |
| OrderItem | `item_tax` | ✅ array of `{id,name,tax_percentage,amount}` |
| OrderItem | `tax_inclusive` | ✅ `true` when the price already contains the tax |
| OrderItem | `variation_id`, `variation_name` | optional; required for variation items |
| Tax | `id`, `title`, `type`, `price`, `tax`, `restaurant_liable_amt` | ✅ `type` `P`=percent `F`=fixed |

**Discounts:** their guide says explicitly *"avoid the `discount` object from the order payload"* —
use `discount_total` + `discount_type` on the **Order** object instead.

### Response

```json
{ "success": "1", "message": "Order placed successfully", "restID": "bw8dz5o93u", "orderID": "<their id>", "clientOrderID": "ADC1042" }
```

Failure (**what we currently always get**):

```json
{ "success": "0", "message": "Invalid order relay payload " }
```

---

## A2. Update Order Status — `POST /update_order_status`

**Status: ✅ WORKS — verified live.** Also our fastest liveness/credential probe: ~400 ms warm.

> **It does NOT validate `restID`.** A bogus code (`ZZZZZZZZZZ`) and an empty string both return
> `success:"1"` with the value echoed straight back. Never use this to check a mapping code.
> It *does* validate credentials — bad ones give `{"success":"0","message":"Invalid client
> credentials.","errorCode":"GN_105"}`.
>
> There is no endpoint for asking Petpooja whether a store is open. Store status flows POS → us
> (§B4/B5); we are never the ones asking.

Cancel only. `status` is always `-1`; their API accepts no other transition.

```json
{
  "app_key": "...", "app_secret": "...", "access_token": "...",
  "restID": "bw8dz5o93u",
  "orderID": "",
  "clientorderID": "ADC1042",
  "cancelReason": "Cancelled by customer",
  "status": "-1"
}
```

Real response:

```json
{ "success": "1", "message": "Order status updated successfully.", "restID": "bw8dz5o93u", "clientOrderID": "ADC1042" }
```

> Note the casing trap: **`clientorderID`** in the request, **`clientOrderID`** in the response.

---

## A3. Rider Status Update — `POST /rider_status_update`

**Status: ✅ WORKS — verified live.**

Tells the POS the parcel moved, so the merchant sees progress without polling. Maps onto Delhivery
scan events.

```json
{
  "app_key": "...", "app_secret": "...", "access_token": "...",
  "status": "pickedup",
  "order_id": "ADC1042",
  "external_order_id": "",
  "rider_data": { "name": "Delhivery", "contact": "", "waybill": "1234567890" }
}
```

`status`: `rider-assigned` · `rider-arrived` · `pickedup` · `delivered`

Real response (their typos preserved):

```json
{ "success": "success", "message": "Your reuqest received succesfully", "code": 200 }
```

> `success` here is the string `"success"`, **not** `"1"` as on every other endpoint.

---

## A4. Fetch Menu — `POST /mapped_restaurant_menus`

**Status: ⚰️ DEPRECATED.** Confirmed by Shivam Tiwari (Petpooja) by email, 2026-07-29:
*"the menu fetch method is deprecated. The only way to receive the menu now is through a menu push."*

```json
{ "restID": "bw8dz5o93u" }
```

Always returns:

```json
{ "success": "0", "message": "unable to fetch Object from s3 bucket", "validation_errors": "" }
```

Credentials make no difference (tested with and without headers and body forms). The message names
S3 because the endpoint served a **pre-generated file**, written by the menu trigger — not a live
database read. No trigger, no file.

**Consequence:** there is no longer any way to pull a menu on demand. Push is the only route, which
makes it a single point of failure for the whole integration.

---

# PART B — Endpoints Petpooja calls on us

Base URL configured in their dashboard:
`https://adc-backend-copy-production.up.railway.app/api/petpooja`

All are public by necessity — their servers have no user login. `PETPOOJA_WEBHOOK_SECRET` gates them
against the `Authorization` header when set; leave the dashboard's "Client Authorization" blank
unless that env var is also set.

**None of them ever return 5xx.** A webhook that errors gets retried, so a bad payload is recorded
and acknowledged rather than triggering a retry storm.

## B1. Menu Push — `POST /pushmenu`

**Status: ✅ our side works** (249-item, 288 KB payload ingested in 3.2 s).
**❌ Petpooja has never actually called it.**

They send the entire catalogue. Structure, abbreviated:

```json
{
  "success": "1",
  "restaurants": [
    { "restaurantid": "4922", "active": "1",
      "details": { "menusharingcode": "m9nw6rhvxi", "restaurantname": "...",
                   "deliverycharge": "0", "packaging_charge": "",
                   "calculatetaxondelivery": 0, "dc_taxes_id": "", "pc_taxes_id": "" } }
  ],
  "ordertypes":  [ { "ordertypeid": 1, "ordertype": "Delivery" } ],
  "categories":  [ { "categoryid": "87910", "categoryname": "...", "active": "1" } ],
  "items": [
    {
      "itemid": "10589495",
      "itemname": "Raita Biryani",
      "price": "0",
      "item_categoryid": "81286",
      "item_tax": "3196,3197",
      "tax_inclusive": false,
      "gst_type": "services",
      "in_stock": "2",
      "itemallowvariation": "1",
      "variation": [
        { "id": "10589514", "variationid": "12489", "name": "Half", "groupname": "Size", "price": "150.00" },
        { "id": "10589515", "variationid": "12490", "name": "Full", "groupname": "Size", "price": "300.00" }
      ],
      "addon": [ { "addon_group_id": "13039", "addon_item_selection_min": "0", "addon_item_selection_max": "1" } ]
    }
  ],
  "addongroups": [
    { "addongroupid": "13039", "addongroup_name": "Customization", "active": "1",
      "addongroupitems": [ { "addonitemid": "72290", "addonitem_name": "Coke", "addonitem_price": "40", "active": "1" } ] }
  ],
  "taxes":     [ { "taxid": "3196", "taxname": "CGST", "tax": "2.5", "taxtype": "1", "active": "1" } ],
  "discounts": [],
  "attributes":[ { "attributeid": "1", "attribute": "veg" } ]
}
```

Our response:

```json
{ "success": "1", "message": "Menu saved (253 items, 3 addons)" }
```

**Parsing notes, learned the hard way:**

- `in_stock: "2"` means **AVAILABLE**. Their own sample carries `"2"` on every item alongside
  `active:"1"`. Reading `2` as out-of-stock marks the entire catalogue unavailable — and because the
  stock webhook mirrors onto `products.is_available`, it takes the storefront down too. Only an
  explicit `0`/`false`/`no` disables an item.
- An item's `variation[]` child supersedes the deprecated top-level `variations` object. One row per
  variation, since an order line needs item id **and** variation id together.
- A variation carries both `id` (e.g. `10589514`) and `variationid` (`12489`). The order payload
  wants **`variationid`**; the other is kept in `raw` in case that reading is wrong.
- `item_tax` is a **comma-separated string** of tax ids in the menu, but an **array of objects** in
  an order. Different shapes, same concept.
- Items are tax-**exclusive** (`tax_inclusive: false`) — see §5.

## B2. Order Callback — `POST /callback`

Fires when the merchant accepts, rejects or progresses an order. `callback_url` is sent per-order.

```json
{ "restID": "bw8dz5o93u", "orderID": "ADC1042", "status": "1", "cancel_reason": "", "minimum_prep_time": 20 }
```

`orderID` here is **our** order number, echoed back.

| status | Meaning | We set |
|---|---|---|
| `-1` | Cancelled | `CANCELLED` |
| `1` `2` `3` | Accepted | `CONFIRMED` |
| `4` | Dispatched | `OUT_FOR_DELIVERY` |
| `5` | Food ready | `PREPARING` — still ours to hand over |
| `10` | Delivered | `DELIVERED` |

```json
{ "success": "1", "message": "received" }
```

A `DELIVERED`/`CANCELLED` order is never walked backwards by a late or duplicate callback. An
unknown order id answers **HTTP 200** with `success:"0"` — a retry cannot fix a bad id.

## B3. Item / Add-on Stock — `POST /item-stock`

**One endpoint for both on and off**, as their docs advise. Configure it as both "Item Off API
Endpoint" and "Item On API Endpoint".

```json
{ "restID": "bw8dz5o93u", "type": "item", "inStock": true, "itemID": ["9658", "9659"], "autoTurnOnTime": "" }
```

`type` is `item` or `addon`. Response (their required shape):

```json
{ "code": "200", "status": "success", "message": "Stock status updated successfully" }
```

Also mirrors onto `products.is_available`, so an item marked sold-out at the POS stops being
orderable on our storefront.

## B4. Get Store Status — `POST /get-store-status`

```json
{ "restID": "bw8dz5o93u" }
```
```json
{ "restID": "bw8dz5o93u", "status": "success", "store_status": "1", "http_code": "200", "message": "Store is open" }
```

`1` = open, `0` = closed. An unknown store defaults to **open**, so a missing row can never silently
block sales.

## B5. Update Store Status — `POST /update-store-status`

```json
{ "restID": "bw8dz5o93u", "store_status": "0", "turn_on_time": "2026-07-30 09:00:00", "reason": "Kitchen closed" }
```
```json
{ "restID": "bw8dz5o93u", "status": "success", "store_status": "0", "message": "Store turned off" }
```

---

# 4. Quirks — all confirmed live

1. **Business failures return HTTP 200.** Success lives in the body. Checking the status code alone
   will report every failure as a success.
2. **`success` is the STRING `"1"`/`"0"`,** never a boolean — except `rider_status_update`, which
   returns `"success"`.
3. **The dashboard only ever says "Menu trigger failed."** It never reports the status or body we
   returned, so unrelated faults are indistinguishable. Three separate causes hid behind that one
   message during this integration (a 413, a timeout, and a silent reject) — all ours, all fixed.
4. **A menu is ~250-300 KB.** Body limits and per-row database writes both need to accommodate it;
   see §7.
5. **Trailing space** in `"Invalid order relay payload "` — match loosely if you ever match on it.

# 5. Tax convention — needs confirming before go-live

| | Petpooja's menu | Ours |
|---|---|---|
| Convention | `tax_inclusive: false` — 5% added **on top** | tax-**inclusive**, 5% already **inside** |

We relay our own price with `tax_inclusive: true`, because that is what Razorpay actually charged, so
the bill reconciles with the settlement. **This is a genuine difference in convention** and decides
whether the POS bill shows the same total the customer paid. Worth confirming with Petpooja.

# 6. Current blockers (2026-07-29)

### `save_order` rejects everything

Every call returns `{"success":"0","message":"Invalid order relay payload "}`. Each variable was
eliminated by controlled test — all produce the **identical** response:

| Varied | Values tried | Result |
|---|---|---|
| Credentials | valid / deliberately invalid | identical → rejection precedes auth |
| Payload shape | 6 structures (OrderInfo object / JSON string, nested creds, `device_type` variants) | identical |
| Naming | `OrderItem`/`Tax` vs `order_items`/`tax_details` | identical |
| Tax objects | fully populated per PDF / empty | identical |
| Item id | real `9658` from our own menu / fabricated `99999999` | identical → ids never read |
| restID | `bw8dz5o93u` / `5312` / `449010` | identical |
| Content-Type | JSON / form-encoded | **415** — the only difference |

The 415 proves the endpoint does inspect and discriminate between requests, so the message is a
deliberate rejection rather than a parse failure. The same credentials succeed on
`update_order_status` and `rider_status_update`.

**The decisive comparison.** `update_order_status` sent with deliberately bad credentials returns:

```json
{ "success": "0", "message": "Invalid client credentials.", "errorCode": "GN_105", "validation_errors": "" }
```

`save_order` sent with those same bad credentials returns `"Invalid order relay payload "` — **not**
`GN_105`. Their API therefore has a proper credential-validation layer that returns a specific coded
error, `update_order_status` reaches it, and `save_order` never does. The request is being rejected
*above* credential checking, which is not a payload fault at all — it is consistent with the request
never being routed into the order-relay service.

**Most likely cause:** order relay never activated for this outlet. An onboarding email states:
*"Rest id: 449010, Rest name: A Dough Cookie - Begur. For this outlet customer took POS + Growth
Plan, in that API service he took. Kindly process it further to activate the service."* An
incomplete activation would explain the menu push and save_order failing together while the generic
endpoints work.

### Menu push never fires

Their trigger returns `{"lable":"Dough Cookie API Menu trigger failed.","code":0,"request":[],"response":[]}`
— **both `request` and `response` empty**, i.e. their own log of the outbound call shows it was never
made. Our endpoint is verified reachable externally and stores any body before validating; zero
requests have ever arrived.

# 7. Bugs we found and fixed

| Bug | Symptom | Fix |
|---|---|---|
| `express.json` capped at 64 KB | 413 before our route ran; dashboard said only "Menu trigger failed" | 12 MB limit scoped to `/api/petpooja` alone |
| One INSERT per item (~60 ms each) | 10 items 1.2 s → 150 items 9.1 s, linear; a real menu exceeded their push timeout | Chunked multi-row upserts — 800 items in 0.96 s |
| `rest_id` resolved before storing | An unrecognised payload vanished without trace | Snapshot written first, keyed `unknown` if needed; every inbound call logged |
| Keyed on `restaurantid` | Rows filed under `4922` while lookups used `bw8dz5o93u` — `mappedItem()` returned null forever | Key on `menusharingcode` |
| `in_stock:"2"` read as out-of-stock | Would have marked all 253 items unavailable **and emptied our storefront** | Only explicit `0`/`false`/`no` disables |

# 8. Our item ids (sandbox), without any API

The dashboard's menu grid exposes them in its markup — `show_details('9658')`, `data-id="name_9658"`.
A fallback if the push is never fixed.

| Item | id | Price |
|---|---|---|
| Plain Dahi | 9658 | 80 |
| Boondi Raita | 9659 | 90 |
| Mix Veg Raita | 9660 | 100 |
| Pineapple Raita | 9661 | 110 |
| Fruit Raita | 9662 | 120 |
| Plain Papad | 9663 | 50 |
| Masala Papad | 9664 | 80 |

Category ids `88864`–`88882`. Restaurant area: "Dough Cookie API".

> The sandbox menu is generic restaurant food, not ADC cookies. Any mapping built against it is
> throwaway — production needs the real ADC menu created inside Petpooja and re-mapped.

# 9. Code

| File | Contains |
|---|---|
| `adc-cookies-backend-node/src/petpooja.js` | Outbound client, menu parser, mapping helpers |
| `adc-cookies-backend-node/src/routes/petpooja.js` | The five inbound endpoints |
| `adc-cookies-backend-node/src/db.js` | `petpooja_menu_snapshots`, `_items`, `_taxes`, `_addons`, `_stores`, `_orders` |

Contacts: shivam.tiwari@petpooja.com · malvi.vaghela@petpooja.com · rohan.sakhrani@petpooja.com
