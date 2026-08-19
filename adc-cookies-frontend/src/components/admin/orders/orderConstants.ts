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
