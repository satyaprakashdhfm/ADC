import { type OrderItem } from './api';

/*
 * Formatting and status logic shared by anything that shows an order — the account page today,
 * the ordering/checkout flow next. Pure functions only: no JSX, no state, no fetching, so both
 * a server and a client component can use them and neither has to own a copy.
 */

export type ParsedOptions = {
  giftPackaging?: boolean;
  giftWrap?: boolean;
  giftMessage?: string;
  message?: string;
  specialNotes?: string;
  addOns?: string[];
  addons?: string[];
  [key: string]: unknown;
};

export function parseOptions(raw?: string | null): ParsedOptions {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ParsedOptions : {};
  } catch {
    return {};
  }
}

export function optionList(options: ParsedOptions) {
  const addOns = Array.isArray(options.addOns) ? options.addOns : Array.isArray(options.addons) ? options.addons : [];
  return addOns.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function hasGift(options: ParsedOptions) {
  return Boolean(options.giftPackaging || options.giftWrap);
}

export function giftMessage(item: OrderItem, options: ParsedOptions) {
  const msg = options.giftMessage || options.message || options.specialNotes || item.specialNotes;
  return typeof msg === 'string' && msg.trim() ? msg.trim() : '';
}

export function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes('deliver')) return { bg: 'var(--status-success-bg)', fg: 'var(--status-success)' };
  if (s.includes('cancel')) return { bg: 'var(--status-error-bg)', fg: 'var(--status-error)' };
  return { bg: 'var(--amber-100)', fg: 'var(--amber-800)' };
}

export function formatMoney(value?: number | null) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
}

export function formatDate(value: string) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function friendlyDate(s?: string | null): string | null {
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(s);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Stored canonically as 91XXXXXXXXXX — show it as "+91 XXXXXXXXXX".
export function formatPhone(value?: string | null) {
  const p = String(value ?? '');
  if (/^91\d{10}$/.test(p)) return `+91 ${p.slice(2)}`;
  if (/^\d{10}$/.test(p)) return `+91 ${p}`;
  return p;
}

export const national10 = (value?: string | null) => {
  const p = String(value ?? '');
  return /^91\d{10}$/.test(p) ? p.slice(2) : p;
};

/*
 * Fixed delivery milestones, and which one a carrier status has reached (0..3).
 *
 * "Shipped" means the parcel is PHYSICALLY WITH THE CARRIER — not that we've booked it. Delhivery
 * reports "Manifested" as soon as a waybill is generated, which happens seconds after payment
 * while the box is still on our counter; counting that as Shipped told customers their order had
 * left when it hadn't. Manifested/packed/pending therefore stay at "Order placed", and only a real
 * handover (picked up, in transit, bagged, at a hub) advances the tracker.
 */
export const SHIP_STAGES = ['Order placed', 'Shipped', 'Out for delivery', 'Delivered'];

export function shipStage(s?: string | null): number {
  const t = (s || '').toLowerCase();
  if (!t) return -1;
  /* Separators normalised before matching, because the two sources spell the same event
     differently: carriers send "OUT FOR DELIVERY", we store "OUT_FOR_DELIVERY". The delivered test
     excluded only the spaced spelling, so our own status skipped the exclusion, matched "deliver",
     and returned 3 — every order that was out for delivery reported itself delivered, and the
     customer was told "we hope you love it" while the rider was still riding. */
  const flat = t.replace(/[_-]+/g, ' ');
  const outForDelivery = flat.includes('out for') || flat === 'ofd' || flat.includes('dispatch');
  if (!outForDelivery && ((flat.includes('deliver') && !flat.includes('attempt') && !flat.includes('undeliver')) || flat.includes('rts d'))) return 3;
  if (outForDelivery) return 2;
  // "Not picked" / "pickup not attempted" contain "picked" but mean the opposite — exclude them
  // before the pickup check, or a failed pickup would read as Shipped.
  const notPickedUp = /not\s*picked|pickup\s*(not|failed|cancel)|awaiting/.test(t);
  if (!notPickedUp && (t.includes('transit') || t.includes('shipped') || t.includes('picked') || t.includes('bag') || t.includes('hub'))) return 1;
  return 0; // placed / confirmed / manifested / packed / awaiting pickup / pending
}

export const isCancelledStatus = (s?: string | null) => /cancel|\brto\b|returned|lost/i.test(s || '');

/* Terminal FROM THE SHIPMENT'S SIDE: the parcel came back or went missing, so no amount of
   rebooking saves this order. A plain cancelled booking is deliberately not in here — that one is
   routine (wrong carrier, missed pickup, rebook on another) and must not brand a live order the
   customer has paid for as cancelled. */
export const isDeadShipment = (s?: string | null) => /\brto\b|returned|lost/i.test(s || '');

export function whenLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const time = d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString()
    ? `Today, ${time}`
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
