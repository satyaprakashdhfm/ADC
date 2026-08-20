import { type Order } from '@/lib/api';

/** Every state an order can be put into, for the per-row status dropdown. */
export const ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

/*
 * The states a live order can be in.
 *
 * CANCELLED is missing on purpose: cancelled and payment-failed orders are listed in their own panel
 * (see OrdersTab), so offering it in the main list's filter would only ever return nothing.
 */
export const LIVE_ORDER_STATUSES = ORDER_STATUSES.filter(s => s !== 'CANCELLED');

/**
 * Is this order dead — cancelled, or paid for by a checkout nobody finished?
 *
 * Both halves land on order_status = 'CANCELLED'. An abandoned checkout is cancelled by
 * /orders/:id/abandon when the payment window closes unpaid, and an admin cancellation sets the same
 * column. Neither is a live order, and counting them among the real ones made the Orders tab
 * disagree with the takings on the Overview tab.
 */
export const isDeadOrder = (o: Order): boolean => o.orderStatus === 'CANCELLED';

/**
 * Why this order is in the dead list, in the words an admin needs.
 *
 * The distinction that matters is whether money changed hands: an unpaid abandoned checkout is
 * housekeeping, whereas a cancelled order that was PAID is a refund somebody still owes.
 */
export function deadOrderReason(o: Order): { text: string; owed: boolean } {
  if (o.paymentStatus === 'PAID') return { text: 'Cancelled after payment — check the refund', owed: true };
  if (o.paymentStatus === 'CANCELLED') return { text: 'Payment not completed — checkout closed before paying', owed: false };
  return { text: 'Cancelled before payment', owed: false };
}

/**
 * Does this order belong in a shipments list?
 *
 * A cancelled order with no booking has nothing to ship and never will — an abandoned checkout that
 * never reached payment sits in the Delivery tab reading "Not created · No shipment" forever, in a
 * panel whose entire job is "which parcels still need something doing". It is noise there, and it is
 * already kept on the Orders tab under Cancelled & failed payments.
 *
 * A cancelled order that DOES have a booking is the opposite, and is the reason this is not simply
 * `!isDeadOrder`: cancelling on our side does not always succeed downstream, so a waybill on a
 * cancelled order may be a rider still coming for a parcel nobody is going to pay for. That has to
 * stay in front of somebody until the booking is cancelled too.
 */
export function belongsInShipments(o: Order): boolean {
  if (!isDeadOrder(o)) return true;
  return !!(o.delhiveryWaybill || o.carrierOrderId);
}
