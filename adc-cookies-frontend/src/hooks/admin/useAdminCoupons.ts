'use client';
import { useState, useEffect } from 'react';
import {
  adminGetCoupons, adminCreateCoupon, adminUpdateCoupon, adminToggleCoupon, adminDeleteCoupon,
  type AdminCoupon, type CouponInput,
} from '@/lib/api';
import { couponToDraft, type CouponDraft } from '@/components/admin/coupons/couponForm';

/** Coupons and Spin Wheel offers — one list, split by whether spinWeight is set. */
export function useAdminCoupons(enabled: boolean, onError: (s: string) => void) {
  const [coupons, setCoupons] = useState<AdminCoupon[] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [couponForm, setCouponForm] = useState<CouponDraft | null>(null);

  useEffect(() => {
    if (enabled && coupons === null) adminGetCoupons().then(setCoupons).catch(() => setCoupons([]));
  }, [enabled, coupons]);

  const toggleCoupon = async (id: number) => {
    const updated = await adminToggleCoupon(id).catch(() => null);
    if (updated) setCoupons(c => (c || []).map(x => x.id === id ? { ...updated, timesUsed: x.timesUsed } : x));
  };

  const editCoupon = (c: AdminCoupon) => setCouponForm(couponToDraft(c));

  const saveCoupon = async () => {
    if (!couponForm) return;
    const f = couponForm;
    if (!f.code.trim() || !f.discountValue) { onError('A coupon needs a code and a discount value.'); return; }
    if (f.isSpin && !f.spinWeight) { onError('A Spin Wheel offer needs an odds weight (%).'); return; }
    const days = Number(f.validDays);
    const payload: CouponInput = {
      code: f.code.trim().toUpperCase(),
      discountType: f.discountType,
      discountValue: Number(f.discountValue),
      minimumOrderAmount: f.minimumOrderAmount ? Number(f.minimumOrderAmount) : null,
      maximumDiscount: f.maximumDiscount ? Number(f.maximumDiscount) : null,
      // "Valid for N days" → concrete expiry date; blank = never expires.
      expiryDate: days > 0 ? new Date(Date.now() + days * 864e5).toISOString().slice(0, 10) : null,
      usageLimit: f.usageLimit ? Number(f.usageLimit) : null,
      isActive: true,
      spinWeight: f.isSpin ? Number(f.spinWeight) : null,
      spinLabel: f.isSpin ? (f.spinLabel.trim() || null) : null,
      terms: f.isSpin ? (f.terms.trim() || null) : null,
    };
    try {
      if (f.editId != null) {
        const updated = await adminUpdateCoupon(f.editId, payload);
        setCoupons(c => (c || []).map(x => x.id === f.editId ? { ...updated, timesUsed: x.timesUsed } : x));
      } else {
        const created = await adminCreateCoupon(payload);
        setCoupons(c => [...(c || []), { ...created, timesUsed: 0 }]);
      }
      setCouponForm(null); onError('');
    } catch (e) { onError(e instanceof Error ? e.message : 'Could not save coupon'); }
  };

  const removeCoupon = async (id: number) => {
    if (!confirm('Delete this coupon? This cannot be undone.')) return;
    await adminDeleteCoupon(id).catch(() => {});
    setCoupons(c => (c || []).filter(x => x.id !== id));
  };

  return {
    coupons, search, setSearch, statusFilter, setStatusFilter,
    couponForm, setCouponForm, toggleCoupon, editCoupon, saveCoupon, removeCoupon,
  };
}
