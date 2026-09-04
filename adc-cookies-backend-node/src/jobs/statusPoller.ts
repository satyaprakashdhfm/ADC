import { getAll, getOne, query, nowIso } from '../db/index.js';
import { trackShiprocket, shiprocketConfigured, assignAwb, getWalletBalance } from '../services/shiprocket.client.js';
import type { ClientResult } from '../utils/result.js';
import { trackShipment, delhiveryConfigured } from '../services/delhivery.client.js';
import { applyCarrierTerminalStatus, notifyOrderMilestone } from '../services/orderProgress.service.js';

/*
 * Keep carrier status fresh without anybody having to look.
 *
 * Until now every screen showed whatever a carrier last happened to say while a human was watching.
 * The store tablet polls, so it stayed current; the admin list and the customer's account render
 * the stored value, so they went stale the moment nobody was on the portal. An order cancelled in
 * Shiprocket's panel at midnight still read "SEARCHING FOR RIDER" in admin the next morning —
 * accurate as of the last time someone happened to press something.
 *
 * The webhook was supposed to be this. It has not delivered once across every test we have run, so
 * treating it as the mechanism and polling as the fallback has it backwards. This is the mechanism;
 * the webhook is a bonus that makes it faster when it works.
 *
 * Deliberately small and dull: a handful of orders every few minutes, only ones that are actually
 * in flight, and every write goes through the same guards the request paths use.
 */

const POLL_MS = Number(process.env.STATUS_POLL_MS || 5 * 60_000);
const BATCH = Number(process.env.STATUS_POLL_BATCH || 20);
/*
 * How long an order stays worth asking about — PER CARRIER, because three days meant two different
 * things and only one of them was true.
 *
 * Three days is right for Shiprocket: that is a same-day hyperlocal rider, so an order still open
 * after three days is not in flight, it is a problem for a person. It is badly wrong for Delhivery.
 * ADC20260830105240 went Bangalore → New Delhi, and the numbers tell the whole story: created
 * 30 Aug 10:52, last polled 2 Sept 06:48, aged out of this window 2 Sept 10:52 — and DELIVERED on
 * 3 Sept 10:55, a full day after we stopped looking. It sat at CONFIRMED / "In Transit" on the
 * customer's own order page while Delhivery's panel had said Delivered for a day.
 *
 * And it could never recover: the same window that dropped it also excluded it from every later
 * sweep, so the order was stuck until somebody edited it by hand. A cutoff shorter than the transit
 * it is tracking does not save budget, it just guarantees the last update is the one we miss —
 * Delhivery quotes 3 days TAT on outstation routes, so this was below even their own estimate.
 *
 * Delhivery has NO webhook, so this poller is the only thing that will ever move an outstation
 * order. It has to outlast the parcel. Twenty-one days covers a slow cross-country delivery and an
 * RTO coming back afterwards; the cap is kept finite so a genuinely lost parcel eventually stops
 * consuming a slot, and `ORDER BY updated_at ASC` already means nothing starves while it is in
 * there.
 */
const MAX_AGE_DAYS_DELHIVERY = Number(process.env.STATUS_POLL_MAX_AGE_DAYS_DELHIVERY || 21);
const MAX_AGE_DAYS_DEFAULT = Number(process.env.STATUS_POLL_MAX_AGE_DAYS || 3);

/*
 * Automatic "Ship Now" after Shiprocket abandons a rider search.
 *
 * Their hunt runs about half an hour; if nobody accepts, Shiprocket CANCELS THE SHIPMENT and puts
 * the ORDER back to NEW.
 *
 * That distinction is the whole fix. We used to re-assign against the shipment, on the belief that
 * only the assignment had been dropped - so every retry hit a cancelled object and came back
 * "order is in cancelled state", instantly, three times, while /orders/show reported the order as
 * a healthy NEW. Verified on ADC20260829055951 (2026-08-29): eighteen minutes at NEW, two retries
 * refused 300ms apart, then a human clicked Ship Now in their panel and it worked on the same ids.
 *
 * So we assign against the ORDER and let them attach a fresh shipment - which is what their panel
 * does, and what their docs allow (assignment takes shipment_id OR order_id). Re-CREATING the order
 * would be the wrong fix: that is what risks two live bookings and two riders at the store.
 *
 * Three goes, each buying a real ~30 minute search, then the admin's Needs-attention list owns it.
 */
export const RIDER_RETRY_MAX = Number(process.env.RIDER_RETRY_MAX || 3);
/*
 * The gap now applies ONLY after a refusal, and this is the whole reason it still exists.
 *
 * A successful assign moves the order off NEW for the length of Shiprocket's own hunt — about half
 * an hour — and our gate only fires on NEW. Their hunt IS the spacing, so a timer on top of a
 * success does nothing. A REFUSED assign is the opposite: nothing was booked, the status sits at
 * NEW, and the five-minute sweep would fire again immediately.
 */
const RIDER_RETRY_GAP_MIN = Number(process.env.RIDER_RETRY_GAP_MIN || 10);
/* Refusals are bounded separately, only so an unfixable order stops polling for three days. It is
   deliberately generous: a wallet topped up an hour later should still get its three real hunts. */
const RIDER_REFUSAL_MAX = Number(process.env.RIDER_REFUSAL_MAX || 8);

async function dueOrders() {
  return getAll(
    `SELECT id, order_number, order_status, carrier, carrier_order_id,
            delhivery_shipment_id, delhivery_waybill, shipment_status,
            rider_retry_count, rider_retry_at, rider_refusal_count
       FROM orders
      WHERE payment_status = 'PAID'
        AND order_status NOT IN ('DELIVERED','CANCELLED')
        AND (shipment_status IS NULL OR shipment_status !~* 'cancel|delivered')
        AND (carrier_order_id IS NOT NULL OR delhivery_shipment_id IS NOT NULL OR delhivery_waybill IS NOT NULL)
        AND created_at > now() - make_interval(days => CASE
              WHEN upper(coalesce(carrier, '')) = 'DELHIVERY' THEN $1::int
              ELSE $2::int END)
      ORDER BY updated_at ASC NULLS FIRST
      LIMIT $3`,
    [MAX_AGE_DAYS_DELHIVERY, MAX_AGE_DAYS_DEFAULT, BATCH],
  );
}

async function refreshOne(o) {
  const carrier = (o.carrier || '').toUpperCase();

  if (carrier === 'SHIPROCKET') {
    if (!shiprocketConfigured() || !o.delhivery_shipment_id) return;
    // Order id as the fallback: before an AWB exists, shipment tracking has nothing to say and only
    // the order endpoint knows the booking was cancelled.
    const r = await trackShiprocket(o.delhivery_shipment_id, o.carrier_order_id);
    if (!r.ok || !r.status) return;
    /* The unchanged-status early return used to live here, above everything. An abandoned search
       parks the order at NEW and it STAYS at NEW, so every sweep after the first one returned here
       and nothing downstream ever ran again - which is exactly the state that needs acting on. */
    if (r.status !== o.shipment_status) {
      await query(
        `UPDATE orders SET shipment_status=$1,
                delhivery_waybill = COALESCE(delhivery_waybill, $2),
                updated_at=$3
          WHERE id=$4 AND (shipment_status IS NULL OR shipment_status !~* 'cancel')`,
        [r.status, r.awb || null, nowIso(), o.id],
      );
      await applyCarrierTerminalStatus(o, r.status, 'SHIPROCKET');
      await notifyOrderMilestone(o, r.status);
      console.log(`[POLL] ${o.order_number} | ${o.shipment_status || '-'} → ${r.status}`);
    }
    await retryRiderSearch(o, r);
    return;
  }

  // Delhivery has no webhook at all, so this is the only thing that ever moves an outstation order.
  if (!delhiveryConfigured() || !o.delhivery_waybill) return;
  const r = await trackShipment(o.delhivery_waybill);
  if (!r.ok || !r.data) return;
  const pkg = Array.isArray(r.data?.ShipmentData) ? r.data.ShipmentData[0]?.Shipment : null;
  const status = [pkg?.Status?.Status, pkg?.Status?.Instructions].filter(Boolean).join(' — ') || null;
  if (!status || status === o.shipment_status) return;
  await query(
    `UPDATE orders SET shipment_status=$1, updated_at=$2
      WHERE id=$3 AND (shipment_status IS NULL OR shipment_status !~* 'cancel')`,
    [status, nowIso(), o.id],
  );
  await applyCarrierTerminalStatus(o, status, 'DELHIVERY');
  await notifyOrderMilestone(o, status);
  console.log(`[POLL] ${o.order_number} | ${o.shipment_status || '-'} → ${status}`);
}

/*
 * One "Ship Now" against a booking whose rider search has lapsed. Never throws.
 *
 * Every ATTEMPT is counted, not every success. A refusal is still one of the three: an empty
 * wallet is not going to answer differently on the next pass, and burning the allowance is what
 * gets the order in front of a person, with the balance written next to it so they top up rather
 * than cancel.
 */
/*
 * The one customer-facing line for an order we have stopped searching for.
 *
 * It belongs here rather than on a failed attempt, because hunts are only counted when the assign
 * SUCCEEDED - so the third search ends by lapsing back to NEW, silently, with no error to hang a
 * message off. Written once: the sweep keeps seeing this order until it is delivered or cancelled,
 * and a tracking page repeating the same line every five minutes reads as a system in a loop.
 */
const EXHAUSTED_REMARK = 'We are arranging your delivery — our team is on it.';

async function noteExhausted(o) {
  const already = await getOne(
    `SELECT 1 AS x FROM order_tracking WHERE order_id = $1 AND remarks = $2 LIMIT 1`,
    [o.id, EXHAUSTED_REMARK],
  ).catch(() => ({ x: 1 }));   // on a read failure, say nothing rather than risk repeating it
  if (already) return;
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [o.id, 'AWAITING_COURIER', EXHAUSTED_REMARK, nowIso()]).catch(() => {});
  console.log(`[POLL] ${o.order_number} | ship-now exhausted ${RIDER_RETRY_MAX}/${RIDER_RETRY_MAX} — needs a person`);
}

async function retryRiderSearch(o, tracked) {
  if (String(tracked.status || '').trim().toUpperCase() !== 'NEW') return;   // only the lapsed state
  if (tracked.awb || o.delhivery_waybill) return;         // a rider exists; there is nothing to re-search
  if (['DELIVERED', 'CANCELLED'].includes(o.order_status)) return;

  const hunts = Number(o.rider_retry_count) || 0;
  if (hunts >= RIDER_RETRY_MAX) { await noteExhausted(o); return; }  // spent - attention panel owns it
  const refusals = Number(o.rider_refusal_count) || 0;
  if (refusals >= RIDER_REFUSAL_MAX) return;              // not a rider problem; stop asking

  /* The debounce applies to REFUSALS only. After a successful assign the order is not at NEW at
     all - Shiprocket is hunting - so we could not get here anyway, and waiting would only delay the
     next real search. See RIDER_RETRY_GAP_MIN. */
  const last = o.rider_retry_at ? new Date(o.rider_retry_at).getTime() : 0;
  if (refusals > 0 && last && Date.now() - last < RIDER_RETRY_GAP_MIN * 60_000) return;

  const attempt = hunts + 1;
  const ts = nowIso();

  /*
   * By ORDER id. The shipment we hold was cancelled when their hunt lapsed; the order is the thing
   * still alive at NEW. Falling back to the shipment keeps this no worse than the old behaviour if
   * they ever reject an order-keyed assign, and logs which one actually worked.
   */
  const srOrderId = o.carrier_order_id;
  let assigned: ClientResult = srOrderId
    ? await assignAwb({ orderId: srOrderId }, { vehicleType: 2 }).catch((e): ClientResult => ({ ok: false, reason: e?.message || 'assign threw' }))
    : { ok: false, reason: 'no carrier_order_id on this order' };
  let via = 'order';

  if (!assigned.ok && o.delhivery_shipment_id) {
    console.log(`[POLL] ${o.order_number} | assign by order refused (${String(assigned.reason).slice(0, 80)}) — trying shipment`);
    assigned = await assignAwb({ shipmentId: o.delhivery_shipment_id }, { vehicleType: 2 })
      .catch((e): ClientResult => ({ ok: false, reason: e?.message || 'assign threw' }));
    via = 'shipment';
  }

  const note = (status, remarks) =>
    query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [o.id, status, remarks, nowIso()]).catch(() => {});

  if (assigned.ok) {
    /* Assigning by order can attach a NEW shipment. Store it, or trackShiprocket spends the rest of
       this order's life asking about the cancelled one and getting silence back. */
    const fresh = assigned.shipmentId && String(assigned.shipmentId) !== String(o.delhivery_shipment_id)
      ? String(assigned.shipmentId)
      : null;
    await query(
      `UPDATE orders SET rider_retry_count=$1, rider_retry_at=$2, updated_at=$2, shipment_error=NULL,
              delhivery_shipment_id = COALESCE($3, delhivery_shipment_id)
        WHERE id=$4`,
      [attempt, ts, fresh, o.id],
    ).catch(() => {});
    /* Customer-facing: this row renders on their own account page, so it says what is true without
       narrating our retry machinery at them.
       The status deliberately avoids the word "rider": OrderProgress.stageOfEvent tests for it as a
       sign the parcel is moving, so "SEARCHING FOR RIDER" would advance the customer's tracker to
       "Order Shipped" at the exact moment we have established that nobody is carrying it. */
    await note('AWAITING_COURIER', 'Still finding a delivery partner — trying again.');
    console.log(`[POLL] ${o.order_number} | ship-now retry ${attempt}/${RIDER_RETRY_MAX} via ${via} | ✓ searching again${fresh ? ` | new shipment=${fresh}` : ''}`);
    return;
  }

  /*
   * Refused. This never became a search, so it must not spend one of the three - an empty wallet
   * topped up ten minutes later should still get every hunt it was owed.
   */
  const reason = String(typeof assigned.reason === 'string' ? assigned.reason : JSON.stringify(assigned.reason ?? 'refused'));
  const balance = await getWalletBalance().catch(() => null);
  const detail = (balance == null ? reason : `${reason} (Shiprocket wallet: ₹${balance})`).slice(0, 500);
  await query('UPDATE orders SET rider_refusal_count=$1, rider_retry_at=$2, shipment_error=$3, updated_at=$2 WHERE id=$4',
    [refusals + 1, ts, detail, o.id]).catch(() => {});
  console.log(`[POLL] ${o.order_number} | ship-now refused ${refusals + 1}/${RIDER_REFUSAL_MAX} (hunts still ${hunts}/${RIDER_RETRY_MAX}) | ✗ ${detail}`);

  if (refusals + 1 >= RIDER_REFUSAL_MAX) {
    // Same status word, for the same stage-mapping reason; the remark is what differs.
    await note('AWAITING_COURIER', EXHAUSTED_REMARK);
  }
}

async function sweep() {
  try {
    const orders = await dueOrders();
    if (!orders.length) return;
    // Sequential on purpose. Both carriers rate-limit, and this is background work with no one
    // waiting on it — there is nothing to gain from doing twenty at once and a 429 to lose.
    for (const o of orders) {
      await refreshOne(o).catch((e) => console.log(`[POLL] ${o.order_number} | ✗ ${e?.message || e}`));
    }
  } catch (e: any) {
    // Never let a sweep failure take the process down; the next one is five minutes away.
    console.log(`[POLL] sweep failed: ${e?.message || e}`);
  }
}

export function startStatusPoller() {
  if (POLL_MS <= 0) { console.log('[POLL] disabled (STATUS_POLL_MS=0)'); return; }
  console.log(`[POLL] carrier status refresh every ${Math.round(POLL_MS / 1000)}s, up to ${BATCH} orders a sweep`);
  // A first sweep shortly after boot, so a restart catches up rather than waiting a full interval.
  setTimeout(() => void sweep(), 20_000).unref?.();
  setInterval(() => void sweep(), POLL_MS).unref?.();
}
