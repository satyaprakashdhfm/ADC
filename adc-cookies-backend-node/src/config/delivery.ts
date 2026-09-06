/*
 * How hard we chase a same-day rider, and what to call the result.
 *
 * The limits lived in statusPoller.js, which is the only thing that COUNTS them — but three other
 * places need to know what the counts mean: the admin's Needs-attention query, the admin's delivery
 * board, and the store portal. Importing them from a background job would point the dependency the
 * wrong way round (a serializer reaching into a cron), so they sit here and the job reads them too.
 */

/*
 * The states an order itself can be in — as opposed to the POS and shipment bookkeeping that
 * shares the order_tracking table (SHIPMENT_CANCELLED, POS_MANUAL, AWAITING_COURIER and friends).
 *
 * Used to pick out the last thing a PERSON said about an order. Without the filter the newest row
 * wins, and that is almost always a machine-written line about a courier booking rather than the
 * sentence somebody typed when they marked the order delivered by hand.
 */
export const ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

/** Successful Ship Now sends. Each buys a real ~30 minute Shiprocket rider hunt. */
export const RIDER_RETRY_MAX = Number(process.env.RIDER_RETRY_MAX || 3);
/** Minutes to wait after a REFUSED assign before trying again. A success needs no gap — see the poller. */
export const RIDER_RETRY_GAP_MIN = Number(process.env.RIDER_RETRY_GAP_MIN || 10);
/** Attempts that never became a hunt at all — an empty wallet, a dead booking. Bounded separately. */
export const RIDER_REFUSAL_MAX = Number(process.env.RIDER_REFUSAL_MAX || 8);

export type RiderState =
  | 'none'       // nothing booked with a rider carrier
  | 'searching'  // Shiprocket is actively hunting
  | 'assigned'   // a rider exists; there is a waybill
  | 'retrying'   // the hunt lapsed, automatic Ship Now still has attempts left
  | 'gave_up'    // out of attempts, one way or the other. A person owns it now.
  | 'cancelled'; // the booking was called off

export interface RiderOutcome {
  state: RiderState;
  /** Real hunts sent. */
  hunts: number;
  /** Attempts the carrier refused before a hunt could start. */
  refusals: number;
  /** True when we have stopped trying by ourselves. */
  exhausted: boolean;
  /** Which limit ran out — they mean different things and need different fixes. */
  ranOutOf: 'hunts' | 'refusals' | null;
}

/*
 * What actually happened to this booking, decided in ONE place.
 *
 * This exists because both screens were reading the carrier's mind instead. The admin board printed
 * `shipment_error` verbatim, so Shiprocket's "order is in cancelled state" — their words for their
 * own dead booking object — appeared where OUR order status goes, and a PAID, PACKED order looked
 * cancelled to the person who had to decide about it. The store portal printed the same string,
 * wallet balance and all, on a shop counter tablet.
 *
 * The counts are the other half. `rider_refusal_count` was never serialized, so an order refused
 * eight times reported `Ship Now sent 0×` and read as though nothing had ever been attempted. The
 * two counters stay separate on purpose: "nobody accepted the job" and "the carrier would not even
 * take the request" look identical on screen and need completely different responses.
 */
export function riderOutcome(order: {
  carrier?: string | null;
  shipment_status?: string | null;
  delhivery_waybill?: string | null;
  carrier_order_id?: string | null;
  rider_retry_count?: number | null;
  rider_refusal_count?: number | null;
}): RiderOutcome {
  const hunts = Number(order.rider_retry_count) || 0;
  const refusals = Number(order.rider_refusal_count) || 0;
  const s = (order.shipment_status || '').trim().toUpperCase();

  const ranOutOf = hunts >= RIDER_RETRY_MAX ? 'hunts' : refusals >= RIDER_REFUSAL_MAX ? 'refusals' : null;
  const base = { hunts, refusals, exhausted: ranOutOf !== null, ranOutOf } as const;

  // A rider carrier is the only thing this describes; an outstation parcel has no rider to hunt for.
  if ((order.carrier || '').trim().toUpperCase() !== 'SHIPROCKET' && !order.carrier_order_id) {
    return { ...base, state: 'none', exhausted: false, ranOutOf: null };
  }
  if (/CANCEL/.test(s)) return { ...base, state: 'cancelled' };
  // For Shiprocket a waybill only exists once a real rider accepted, so it is the proof of one.
  if (order.delhivery_waybill) return { ...base, state: 'assigned' };
  if (base.exhausted) return { ...base, state: 'gave_up' };
  // NEW is the trap: it is both "booked a second ago" and "the hunt lapsed and it is idle again".
  // Having got this far the booking is not new, so it is the second.
  if (s === 'NEW') return { ...base, state: 'retrying' };
  if (/SEARCH/.test(s)) return { ...base, state: 'searching' };
  if (!s || s === 'NOT_CREATED') return { ...base, state: 'none' };
  return { ...base, state: 'searching' };
}

/*
 * Did WE deliver this, rather than the courier?
 *
 * No new column, because the two facts already on the row say it plainly: the order reached
 * DELIVERED while the carrier never reported delivering anything. That only happens when a person
 * moved it by hand — the courier could not find a rider, somebody drove the box over, and the
 * admin set the status themselves.
 *
 * Worth deriving rather than storing: a flag would need writing at every place status can change
 * and would be wrong the moment one of them forgot. These two columns cannot disagree with
 * themselves.
 */
export function deliveredByUs(order: { order_status?: string | null; shipment_status?: string | null }): boolean {
  /* trim(): a stray space or newline on a status must not silently reclassify an order. */
  if ((order.order_status || '').trim().toUpperCase() !== 'DELIVERED') return false;
  const s = (order.shipment_status || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  // "out for delivery" contains "deliver" and is not a delivery; RTO/undelivered are not ours either.
  const carrierDelivered = /deliver/.test(s) && !s.includes('out for') && !/un ?deliver|not deliver|rto/.test(s);
  return !carrierDelivered;
}
