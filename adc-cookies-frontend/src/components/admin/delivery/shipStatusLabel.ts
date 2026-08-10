/*
 * Admin-facing shipment status. Delhivery's own wording is misleading at the start of the journey:
 * "CREATED"/"Manifested" only means a waybill exists, which happens automatically on payment while
 * the parcel is still on the counter. Spelling that out as "Awaiting pickup" is what tells the
 * operator there is still something to DO (schedule a pickup for the warehouse).
 */
export function shipStatusLabel(s?: string | null): string {
  const t = (s || '').trim();
  if (!t) return 'Not created';
  const u = t.toUpperCase();
  if (u === 'CREATED' || u === 'MANIFESTED') return 'Awaiting pickup';
  if (u === 'AWAITING_PICKUP') return 'Awaiting pickup';
  if (u === 'NOT_CREATED') return 'Not created';
  return t;
}
