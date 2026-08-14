import { getAll, query, nowIso } from './db.js';
import { trackShiprocket, shiprocketConfigured } from './shiprocket.js';
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

async function dueOrders() {
  return getAll(
    `SELECT id, order_number, order_status, carrier, carrier_order_id,
            delhivery_shipment_id, delhivery_waybill, shipment_status
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
    if (r.status === o.shipment_status) return;
    await query(
      `UPDATE orders SET shipment_status=$1,
              delhivery_waybill = COALESCE(delhivery_waybill, $2),
              updated_at=$3
        WHERE id=$4 AND (shipment_status IS NULL OR shipment_status !~* 'cancel')`,
      [r.status, r.awb || null, nowIso(), o.id],
    );
    await applyCarrierTerminalStatus(o, r.status, 'SHIPROCKET');
    console.log(`[POLL] ${o.order_number} | ${o.shipment_status || '-'} → ${r.status}`);
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
