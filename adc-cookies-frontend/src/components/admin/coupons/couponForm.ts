import { type AdminCoupon } from '@/lib/api';
import { todayStr } from '../shared/format';

// Coupon create/edit form uses string fields (easy inputs); converted to CouponInput on save.
// `editId` is set when editing an existing coupon (PUT) instead of creating a new one (POST).
export type CouponDraft = {
  editId?: number; code: string; discountType: 'PERCENTAGE' | 'FIXED'; discountValue: string;
  minimumOrderAmount: string; maximumDiscount: string; validDays: string; usageLimit: string;
  isSpin: boolean; spinWeight: string; spinLabel: string; terms: string;
};
export const EMPTY_COUPON: CouponDraft = { code: '', discountType: 'PERCENTAGE', discountValue: '', minimumOrderAmount: '', maximumDiscount: '', validDays: '', usageLimit: '', isSpin: false, spinWeight: '', spinLabel: '', terms: '' };
/* EMPTY_SPIN_COUPON is gone with the Spin Wheel panel's own "New offer" button. A wheel offer
   starts life as a normal coupon draft and becomes one by ticking isSpin in the editor, which is
   also the only way an existing one can be changed — one path in, one path out. */
// Prefill the form from an existing coupon, for editing.
export function couponToDraft(c: AdminCoupon): CouponDraft {
  const days = c.expiryDate ? Math.max(1, Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / 864e5)) : null;
  return {
    editId: c.id, code: c.code, discountType: c.discountType as 'PERCENTAGE' | 'FIXED',
    discountValue: String(c.discountValue), minimumOrderAmount: c.minimumOrderAmount != null ? String(c.minimumOrderAmount) : '',
    maximumDiscount: c.maximumDiscount != null ? String(c.maximumDiscount) : '', validDays: days != null ? String(days) : '',
    usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
    isSpin: c.spinWeight != null, spinWeight: c.spinWeight != null ? String(c.spinWeight) : '',
    spinLabel: c.spinLabel || '', terms: c.terms || '',
  };
}

// Live coupon status derived at read-time — no cron needed to "deactivate" a coupon.
export function couponStatus(c: AdminCoupon): { text: string; ok: boolean } {
  if (!c.isActive) return { text: 'Disabled', ok: false };
  // todayStr() is the IST day; a bare toISOString() said yesterday until 05:30 IST, so a coupon
  // that had in fact expired went on reading as live through the small hours.
  if (c.expiryDate && c.expiryDate < todayStr()) return { text: 'Expired', ok: false };
  if (c.usageLimit != null && (c.timesUsed ?? 0) >= c.usageLimit) return { text: 'Limit reached', ok: false };
  return { text: 'Active', ok: true };
}
