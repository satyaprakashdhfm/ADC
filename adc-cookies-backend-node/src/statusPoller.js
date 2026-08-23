import { getAll, query, nowIso } from './db.js';
import { trackShiprocket, shiprocketConfigured, assignAwb, getWalletBalance } from './shiprocket.js';
import { trackShipment, delhiveryConfigured } from './delhivery.js';
import { applyCarrierTerminalStatus } from './orderProgress.js';

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
/* Past this an order is not "in flight", it is history. Anything still open after three days needs
   a person, not another poll — and polling it forever would spend the whole budget on the dead. */
const MAX_AGE_DAYS = 3;

/*
 * Automatic "Ship Now" after Shiprocket abandons a rider search.
 *
 * Their hunt runs about an hour; if nobody accepts they drop the ASSIGNMENT and put the order back
 * to NEW. The shipment is untouched - only the rider is gone - which is why this re-assigns against
 * the shipment we already have rather than booking again. Booking again would leave two live
 * bookings for one lot of cookies, and two riders at the store if both eventually found one.
 *
 * Three goes, then it stops and the admin's Needs-attention list owns it: past that it is not a
 * rider-availability problem any more and another identical call will not discover otherwise.
 */
export const RIDER_RETRY_MAX = Number(process.env.RIDER_RETRY_MAX || 3);
/* Minimum gap between attempts. A REFUSED assign (an empty wallet is much the commonest) leaves
   the status sitting at NEW, so without this the whole allowance would be spent inside one
   quarter of an hour on something no retry can fix. */
const RIDER_RETRY_GAP_MIN = Number(process.env.RIDER_RETRY_GAP_MIN || 10);

async function dueOrders() {
  return getAll(
    `SELECT id, order_number, order_status, carrier, carrier_order_id,
            delhivery_shipment_id, delhivery_waybill, shipment_status,
            rider_retry_count, rider_retry_at
       FROM orders
      WHERE payment_status = 'PAID'
        AND order_status NOT IN ('DELIVERED','CANCELLED')
        AND (shipment_status IS NULL OR shipment_status !~* 'cancel|delivered')
        AND (carrier_order_id IS NOT NULL OR delhivery_shipment_id IS NOT NULL OR delhivery_waybill IS NOT NULL)
        AND created_at > now() - make_interval(days => $1::int)
      ORDER BY updated_at ASC NULLS FIRST
      LIMIT $2`,
    [MAX_AGE_DAYS, BATCH],
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
async function retryRiderSearch(o, tracked) {
  if (String(tracked.status || '').trim().toUpperCase() !== 'NEW') return;   // only the lapsed state
  if (tracked.awb || o.delhivery_waybill) return;         // a rider exists; there is nothing to re-search
  if (['DELIVERED', 'CANCELLED'].includes(o.order_status)) return;

  const tries = Number(o.rider_retry_count) || 0;
  if (tries >= RIDER_RETRY_MAX) return;                   // spent - the attention panel owns it now
  const last = o.rider_retry_at ? new Date(o.rider_retry_at).getTime() : 0;
  if (last && Date.now() - last < RIDER_RETRY_GAP_MIN * 60_000) return;

  const attempt = tries + 1;
  const ts = nowIso();
  const assigned = await assignAwb(o.delhivery_shipment_id, { vehicleType: 2 })
    .catch((e) => ({ ok: false, reason: e?.message || 'assign threw' }));

  await query('UPDATE orders SET rider_retry_count=$1, rider_retry_at=$2, updated_at=$2 WHERE id=$3',
    [attempt, ts, o.id]).catch(() => {});

  const note = (status, remarks) =>
    query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [o.id, status, remarks, nowIso()]).catch(() => {});

  if (assigned.ok) {
    await query('UPDATE orders SET shipment_error = NULL WHERE id = $1', [o.id]).catch(() => {});
    /* Customer-facing: this row renders on their own account page, so it says what is true without
       narrating our retry machinery at them.
       The status deliberately avoids the word "rider": OrderProgress.stageOfEvent tests for it as a
       sign the parcel is moving, so "SEARCHING FOR RIDER" would advance the customer's tracker to
       "Order Shipped" at the exact moment we have established that nobody is carrying it. */
    await note('AWAITING_COURIER', 'Still finding a delivery partner — trying again.');
    console.log(`[POLL] ${o.order_number} | ship-now retry ${attempt}/${RIDER_RETRY_MAX} | ✓ searching again`);
    return;
  }

  const reason = String(typeof assigned.reason === 'string' ? assigned.reason : JSON.stringify(assigned.reason ?? 'refused'));
  const balance = await getWalletBalance().catch(() => null);
  const detail = (balance == null ? reason : `${reason} (Shiprocket wallet: ₹${balance})`).slice(0, 500);
  await query('UPDATE orders SET shipment_error=$1, updated_at=$2 WHERE id=$3', [detail, nowIso(), o.id]).catch(() => {});
  console.log(`[POLL] ${o.order_number} | ship-now retry ${attempt}/${RIDER_RETRY_MAX} | ✗ ${detail}`);

  if (attempt >= RIDER_RETRY_MAX) {
    // Same status word, for the same stage-mapping reason; the remark is what differs.
    await note('AWAITING_COURIER', 'We are arranging your delivery — our team is on it.');
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
  } catch (e) {
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
