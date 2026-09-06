import { type Order } from '@/lib/api';
import { shipStatusLabel } from '../delivery/shipStatusLabel';

/*
 * The one answer to "what does this order's shipment say", for every admin screen.
 *
 * Four places rendered this badge from `o.shipmentStatus` directly — the orders list, the order
 * detail modal, and both delivery tables — and each had drifted into its own idea of when to colour
 * it green. That was survivable while the badge only ever repeated the carrier. It stopped being
 * survivable once an order could be delivered by US: the courier's last word on a hand-delivered
 * order is "NEW", or "CANCELLED" from the booking we called off, and every one of those screens
 * would have gone on announcing it long after the customer had the cookies in their hands.
 *
 * So the rule lives here once. deliveredByUs is decided server-side (config/delivery.ts) from the
 * order itself, not from a flag anybody has to remember to set.
 */
export function shipmentBadge(o: Order): { text: string; ok: boolean } {
  if (o.deliveredByUs) return { text: 'DELIVERED BY US', ok: true };

  const s = (o.shipmentStatus || '').trim();
  /* Green means "arrived", plus CREATED for a booked outstation parcel — the two states where
     nothing is owed. "Out for delivery" contains the word and has not arrived. */
  const u = s.toUpperCase();
  const arrived = /DELIVER/.test(u) && !u.includes('OUT FOR') && !/UN ?DELIVER|NOT DELIVER|RTO/.test(u);
  return { text: shipStatusLabel(s), ok: arrived || u === 'CREATED' };
}
