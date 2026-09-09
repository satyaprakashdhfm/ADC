'use client';
import { useState, useEffect, useRef } from 'react';
import { validateCoupon, getAvailableCoupons, getSpinStatus, firstImage, type AvailableCoupon, type SpinClaim } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

/**
 * Coupons at checkout: the public offers list, this shopper's own spin reward, and applying a code.
 *
 * Reads cart and auth from their contexts rather than taking them as props — applying a coupon
 * genuinely mutates the cart (a "free item" reward adds the product itself), so the cart is a real
 * dependency of this behaviour, not something the component should have to thread through.
 */
export function useCheckoutCoupons() {
  const { cart, total, setQty, coupon, applied, setApplied, setDiscount, setGiftLineId } = useCart();
  const { user } = useAuth();
  const [couponErr, setCouponErr] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [mySpinReward, setMySpinReward] = useState<SpinClaim | null>(null);

  // General, anyone-can-use coupons for the "Available offers" list — public, so it can render
  // before login (applying one still requires being logged in, same as typing a code manually).
  useEffect(() => {
    getAvailableCoupons().then(setAvailableCoupons).catch(() => setAvailableCoupons([]));
  }, []);

  // This shopper's own won-and-claimed spin reward (if any and still unexpired) — shown as a
  // tappable offer too, so they don't have to go dig the code back out of the spin popup. It's
  // already account-bound server-side (validateCoupon requires a matching spin_claims row), so
  // this is purely a convenience surface, not a new way to redeem someone else's code.
  useEffect(() => {
    if (!user) { setMySpinReward(null); return; }
    getSpinStatus().then(r => setMySpinReward(r.active)).catch(() => setMySpinReward(null));
  }, [user]);

  /* A rejection is about the basket as it was, so editing the basket retires it.
   *
   * "Order amount below minimum for this coupon" sat there after the shopper did exactly what it
   * asked and added more — the message outlived the condition it described, so a cart that now
   * qualifies still looked rejected. Clearing on total means the only error on screen is one that
   * is still true.
   *
   * Safe against the apply path: a failed apply never changes the cart, so it cannot clear its own
   * message. A successful one may (a free-item reward adds the product), and by then there is no
   * error to lose. */
  /*
   * A discount belongs to the basket it was calculated for. When the basket changes, it retires.
   *
   * This used to clear only the ERROR, so a discount survived the cart it was priced against:
   * apply a coupon to a 1,000 rupee basket, take 100 off, remove items down to 200, and the bill
   * still promised -100. Nobody was overcharged -- the server recalculates at order time -- but
   * the screen showed a discount that would not be honoured, which is how "why did I pay more
   * than it said" begins.
   *
   * Clearing on every total change is the obvious fix and it is WRONG, which is worth writing
   * down because it looks right. A free-item reward calls setQty to add the prize at its real
   * price, so applying one CHANGES the total by itself -- and an unconditional clear would wipe
   * the coupon in the same breath as granting it.
   *
   * So the total the discount was priced against is remembered, and only a move away from THAT
   * retires it. The first total seen while applied is the reference, which is exactly the basket
   * after any free item has landed.
   */
  const pricedAtTotal = useRef<number | null>(null);
  useEffect(() => {
    setCouponErr('');
    if (!applied) { pricedAtTotal.current = null; return; }
    if (pricedAtTotal.current === null) { pricedAtTotal.current = total; return; }
    if (total !== pricedAtTotal.current) {
      setApplied(false);
      setDiscount(0);
      pricedAtTotal.current = null;
    }
  }, [total, applied, setApplied, setDiscount]);

  const applyCoupon = async (overrideCode?: string) => {
    const code = (overrideCode ?? coupon).trim().toUpperCase();
    if (!code) return;
    if (!user) { setCouponErr('Please log in to apply a coupon.'); setApplied(false); setDiscount(0); return; }
    try {
      const result = await validateCoupon(code, total);
      if (result.valid) {
        if (result.giftProduct) {
          // A "free item" reward: the item itself is the prize (capped at maximumDiscount), not
          // a generic amount off — add it to the cart if they don't already have one.
          const gp = result.giftProduct;
          setDiscount(Math.min(gp.price, result.maximumDiscount ?? gp.price));
          const gid = String(gp.id);
          if (!cart[gid]) {
            setQty(gid, 1, gp.name, gp.price, firstImage(gp.images));
            setGiftLineId(gid);
          } else {
            setGiftLineId(null); // already in their cart on its own merit — don't remove it later
          }
        } else {
          const d = result.discountType === 'PERCENTAGE' ? Math.round(total * result.discountValue / 100) : result.discountValue;
          setDiscount(Math.min(d, result.maximumDiscount || d));
          setGiftLineId(null);
        }
        setApplied(true); setCouponErr('');
      } else { setCouponErr(result.message || 'This code isn’t valid.'); setApplied(false); setDiscount(0); }
    } catch (e) {
      setCouponErr(e instanceof Error ? e.message : 'This code isn’t valid. Please check and try again.');
      setApplied(false); setDiscount(0);
    }
  };

  return { couponErr, setCouponErr, availableCoupons, mySpinReward, applyCoupon };
}
