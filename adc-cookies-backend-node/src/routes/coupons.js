import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getOne, getAll } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { serializeCoupon } from '../serializers.js';

const router = Router();

// Generous enough that a real shopper (who tries a handful of codes at checkout) never hits it,
// tight enough to blunt anonymous brute-force code-guessing. Combined with requireAuth below.
const couponLimiter = rateLimit({
  windowMs: 10 * 60_000, max: 40, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts', message: 'Too many coupon attempts — please try again in a few minutes.' },
});

export async function validateCoupon(code, orderAmount) {
  const coupon = await getOne('SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE', [String(code).toUpperCase()]);
  if (!coupon) throw new ApiError('Invalid or inactive coupon');

  if (coupon.expiry_date && coupon.expiry_date < new Date().toISOString().slice(0, 10)) {
    throw new ApiError('Coupon has expired');
  }
  if (coupon.usage_limit != null) {
    const row = await getOne('SELECT COUNT(*) AS c FROM coupon_usage WHERE coupon_id = $1', [coupon.id]);
    if (Number(row.c) >= coupon.usage_limit) throw new ApiError('Coupon usage limit reached');
  }
  if (coupon.minimum_order_amount != null && Number(orderAmount) < coupon.minimum_order_amount) {
    throw new ApiError('Order amount below minimum for this coupon');
  }
  return coupon;
}

export function calculateDiscount(coupon, subtotal) {
  let discount = coupon.discount_type === 'PERCENTAGE'
    ? (Number(subtotal) * coupon.discount_value) / 100
    : coupon.discount_value;
  if (coupon.maximum_discount != null && discount > coupon.maximum_discount) {
    discount = coupon.maximum_discount;
  }
  return discount;
}

// Auth-gated + rate-limited: only logged-in shoppers can test a code, so anonymous
// brute-force guessing of unadvertised coupons is blocked (and any abuse is traceable).
router.get('/validate', requireAuth, couponLimiter, async (req, res) => {
  const { code, orderAmount } = req.query;
  const coupon = await validateCoupon(String(code || ''), orderAmount ?? 0);
  res.json({ ...serializeCoupon(coupon), valid: true });
});

// Currently-usable coupons — powers the Spin & Win wheel. Returns only the coupons the
// admin has set ACTIVE, that haven't expired and haven't hit their usage limit — so any
// code the wheel hands out actually works at checkout. Auth-gated (like /validate) so the
// codes aren't scraped by bots; the wheel only lets logged-in users spin anyway.
router.get('/active', requireAuth, couponLimiter, async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await getAll('SELECT * FROM coupons WHERE is_active = TRUE ORDER BY discount_value DESC');
  const usable = [];
  for (const c of rows) {
    if (c.expiry_date && c.expiry_date < today) continue;
    if (c.usage_limit != null) {
      const row = await getOne('SELECT COUNT(*) AS n FROM coupon_usage WHERE coupon_id = $1', [c.id]);
      if (Number(row.n) >= c.usage_limit) continue;
    }
    usable.push({
      code: c.code,
      discountType: c.discount_type,
      discountValue: c.discount_value,
      minimumOrderAmount: c.minimum_order_amount,
      label: c.discount_type === 'PERCENTAGE' ? `${Math.round(c.discount_value)}% OFF` : `₹${Math.round(c.discount_value)} OFF`,
    });
  }
  res.json(usable);
});

export default router;
