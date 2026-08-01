# Postman — Petpooja

Nine requests covering the whole integration for **A Dough Cookie - Begur**.

## Import

1. Postman → **Import** → drop in **both** files:
   - `Petpooja.postman_collection.json` — the requests
   - `Petpooja-sandbox.postman_environment.json` — credentials *(not in git; see below)*
2. Top-right environment dropdown → select **"Petpooja — Sandbox (A Dough Cookie)"**
3. Open any request → **Send**

If every request returns `Invalid client credentials`, the environment isn't selected — that
dropdown is the usual culprit.

## What's inside

**Folder A — we call Petpooja**

| # | Request | Status |
|---|---|---|
| 1 | Save Order | ❌ blocked on their activation |
| 2 | Update Order Status (cancel) | ✅ |
| 3 | Rider Status Update | ✅ |
| 4 | Fetch Menu | ⚰️ deprecated by Petpooja |

**Folder B — Petpooja calls us.** Sending these from Postman simulates their servers, which is how
all five were verified without waiting on them.

| # | Request | Status |
|---|---|---|
| 5 | Push Menu | ✅ ours works; they have never called it |
| 6 | Order Callback | ✅ |
| 7 | Item / Addon Stock | ✅ |
| 8 | Get Store Status | ✅ |
| 9 | Update Store Status | ✅ |

## Read this before trusting a green tick

**Petpooja returns HTTP 200 even when the call fails.** Success lives in the body, and `success` is
the **string** `"1"`/`"0"` — except `rider_status_update`, which returns `"success"`. Code that
checks only the status code will report every failure as a success.

Each request carries a test that checks the **body**, not the status code, so Postman's pass/fail
means something. Request 1 is deliberately marked as *expected to fail* — it will go green when
Petpooja fixes their side, which is the signal we're waiting for.

## The two requests that matter right now

Run **2** then **1**. Same credentials, same `restID`, one works and one doesn't:

```
2. Update Order Status → {"success":"1","message":"Order status updated successfully.","restID":"bw8dz5o93u"}
1. Save Order          → {"success":"0","message":"Invalid order relay payload "}
```

Request 2 even echoes back `restID: bw8dz5o93u`, proving their system recognises the restaurant on
one endpoint while the other refuses it. That pair is the evidence behind the support request —
worth screenshotting for Petpooja.

## Requests that change real data

- **6 (Callback)** moves order `{{test_order_number}}` to CONFIRMED. Change the variable to point
  somewhere harmless if you'd rather it didn't.
- **7 (Item Stock)** with `"inStock": false` sets `products.is_available = false` for any mapped
  product, which removes it from the storefront. Send `true` to restore.
- **9 (Update Store Status)** with `"store_status": "0"` closes the store.

## Credentials

`Petpooja-sandbox.postman_environment.json` contains the real app key, secret and token, so it is
**gitignored**. It exists on this machine only.

To recreate it elsewhere, make an environment with these six variables — the first three come from
the Petpooja dashboard's **Configuration** tab:

```
app_key       <32 chars>
app_secret    <40 chars>
access_token  <40 chars>
rest_id       bw8dz5o93u
pp_base       https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1
our_base      https://adc-backend-copy-production.up.railway.app/api/petpooja
```

**Never commit that file, and strip the credentials before sharing a screenshot or export.**

## More detail

`Petpooja_integration/PETPOOJA_API_REFERENCE.md` — every field, the required-field tables from their
guides, parsing traps, and the controlled tests that isolated the `save_order` rejection.
