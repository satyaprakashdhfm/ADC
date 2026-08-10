/*
 * Shiprocket Hyperlocal tracking statuses and what each one does to the order. Mirrors
 * shiprocketStatusToOrderStatus() in adc-cookies-backend-node/src/shiprocket.js — if that mapping
 * changes, change this too, since this table is what an operator trusts when reading a status.
 */
export const SR_ORDER_STATES = [
  { id: 'RIDER ASSIGNED', status: 'PACKED', description: 'A rider has been allocated. Nothing has left the store yet.' },
  { id: 'PICKUP SCHEDULED', status: 'PACKED', description: 'Collection is booked; the rider is on the way to the store.' },
  { id: 'AWB ASSIGNED', status: 'PACKED', description: 'The tracking number exists. Assignment is asynchronous, so this can lag the order by a minute or two.' },
  { id: 'PICKED UP', status: 'OUT_FOR_DELIVERY', description: 'The rider has collected the order from the store.' },
  { id: 'IN TRANSIT', status: 'OUT_FOR_DELIVERY', description: 'On the way to the customer.' },
  { id: 'OUT FOR DELIVERY', status: 'OUT_FOR_DELIVERY', description: 'On the final leg to the drop address.' },
  { id: 'RIDER REACHED DROP', status: '(no change)', description: 'The rider is at the door. Deliberately not marked delivered — at the door is not delivered.' },
  { id: 'DELIVERED', status: 'DELIVERED', description: 'Handed to the customer. Terminal state.' },
  { id: 'CANCELLED / RTO', status: 'CANCELLED', description: 'Cancelled, or returned to origin.' },
];
