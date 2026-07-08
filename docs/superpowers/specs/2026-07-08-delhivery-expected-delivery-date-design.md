# Delhivery expected-delivery date + status on the order card

**Date:** 2026-07-08
**Status:** Approved (scope locked)

## Problem

Out-of-city orders (any destination with no in-city ADC store — e.g. Hyderabad `500072`)
ship via **Delhivery**. On the order/tracking card these orders show no expected
delivery date, and are often stuck on *"Shipment being prepared…"* with no status.

Root cause, confirmed in code:

- **No code ever writes an expected date for Delhivery orders.** `orders.estimated_delivery`
  is only ever populated by the **Shadowfax webhook** (`src/routes/shadowfax.js`). The
  Delhivery creation calls that run today do **not** return a date:
  - `fetchWaybill(1)` → waybill numbers only (`orders.js:69`)
  - `createShipment(...)` → `{ waybill, sortCode }` only (`orders.js:115`)
- The Delhivery track path (`orders.js:344–354`) reads **status + scans** out of the
  `trackShipment` response but **ignores the expected-delivery-date field** in that same
  payload.
- The frontend (`AccountPage.tsx:249`) reads the date only from `order.estimatedDelivery`,
  which is null for Delhivery — so "Expected by …" never renders.

The **status** side already works for Delhivery on-demand (tap "Track shipment" →
`trackShipment` → stepper + scans + persisted `shipment_status`). The real gap is the date.

## Goal

For Delhivery (out-of-city) orders, show an expected delivery **end date** and the
shipment **Status** on the order card — using Delhivery APIs already integrated, no manual
data entry, no new webhook, no polling job.

## Data source (confirmed)

The date comes from Delhivery, two ways, both already coded in `src/delhivery.js`:

1. **`expectedTat({ originPin, destinationPin })`** → `expected_delivery_date`. **Guaranteed**
   (computed from the two pincodes); already proven in the checkout flow. Reliable source.
2. **`trackShipment(waybill)`** response → `Shipment.ExpectedDeliveryDate`. In the same payload
   already fetched, but Delhivery may leave it **null** early in the shipment's life.

## When the date is written (trigger map)

| When | Trigger | API | Effect on date |
|---|---|---|---|
| Shipment creation (~secs after payment, background) | `POST /orders/:id/payment/verify` or Razorpay webhook → `finalizePaidOrder` → `autoCreateShipment` | **new** `expectedTat` call | First write to `orders.estimated_delivery` — makes the card show a date on first view |
| Customer tracks (on-demand) | Customer taps "Track shipment"/opens card → `GET /orders/:id/delhivery-track` | `trackShipment` | Refreshes date from `ExpectedDeliveryDate` if present; updates status/scans |

No Delhivery webhook exists in the system (only Shadowfax has one). Auto background refresh
without customer action is explicitly **out of scope**.

## Changes

### 1. Backend — `src/routes/orders.js`, `autoCreateShipment` Delhivery branch (~lines 63–126)

- Import `expectedTat` from `../delhivery.js` (add to existing import on line 8).
- After a successful `createShipment` (before/with the `UPDATE orders …` at line 121–124),
  call `expectedTat({ originPin: defaultWh.return_pincode || defaultWh.pincode, destinationPin: address.pincode })`.
- If it returns `{ ok: true, expectedDeliveryDate }`, persist that value into
  `orders.estimated_delivery` in the same UPDATE (or a follow-up UPDATE). Never let a failed/blank
  `expectedTat` block or fail shipment creation — it is best-effort (mirror the "never throws"
  contract of `autoCreateShipment`).

### 2. Backend — `src/routes/orders.js`, Delhivery branch of `/:id/delhivery-track` (lines 343–354)

- From the already-parsed `pkg` (`ShipmentData[0].Shipment`), also read the expected date
  defensively: `pkg.ExpectedDeliveryDate || pkg.PromisedDeliveryDate || pkg.EstimatedDeliveryDate || null`.
  (Exact key confirmed against a real response during implementation; read defensively regardless.)
- If present, persist it to `orders.estimated_delivery` (alongside the existing
  `shipment_status` UPDATE at line 349).
- Add `estimatedDelivery` to the JSON response object (line 354).

### 3. Frontend — `adc-cookies-frontend/src/lib/api.ts`

- Add `estimatedDelivery?: string | null` to the `DelhiveryTrackResult` interface.
- `Order.estimatedDelivery` already exists (line 167) — update its comment to note it is now
  also written for Delhivery, not only Shadowfax.

### 4. Frontend — `adc-cookies-frontend/src/components/account/AccountPage.tsx`

- Line 249: fall back to the freshly-fetched track date so a just-tracked date renders
  immediately: `const expectedDate = (order.estimatedDelivery || trackResult?.estimatedDelivery) ? friendlyDate(order.estimatedDelivery || trackResult!.estimatedDelivery!) : null;`
- No new UI: the milestone stepper's last stage and the "Delivery details" section already
  render "Expected by {date}" once the field is non-null.
- **Verify** `shipStage()` (the status→milestone mapper) handles Delhivery status strings —
  Manifested / In Transit / Dispatched / Delivered / Pending. Existing keyword matching
  (`manifest`, `transit`, `dispatch`, `deliver`) appears to cover them; confirm during
  implementation and extend only if a real status string is missed.

> Note: `adc-cookies-frontend` runs a modified Next.js — read the relevant guide under
> `node_modules/next/dist/docs/` before writing frontend code (per repo `AGENTS.md`).

## Out of scope

- Delhivery webhook / push notifications (none exists on the account).
- Scheduled/background polling of in-transit orders.
- Any change to the Shadowfax (in-city) flow.
- The separate "shipment never got a waybill" failure (admin can retry from Delivery tab) —
  unrelated to showing the date.

## Testing / verification

- Backend: a Delhivery order (out-of-store-zone pincode) gets `estimated_delivery` written at
  creation; `GET /orders/:id/delhivery-track` returns `estimatedDelivery` and refreshes the
  stored value.
- Frontend: an out-of-city order card shows "Expected by {date}" and a live Status/stepper
  after tracking; Shadowfax orders are unaffected.
- Regression: `expectedTat` failure does not break shipment creation.
