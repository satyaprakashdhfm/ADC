import { Router } from 'express';
import { getOne } from '../db.js';
import { ApiError } from '../middleware.js';
import { serializeCoupon } from '../serializers.js';

const router = Router();

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

router.get('/validate', async (req, res) => {
  const { code, orderAmount } = req.query;
  const coupon = await validateCoupon(String(code || ''), orderAmount ?? 0);
  res.json({ ...serializeCoupon(coupon), valid: true });
});

export default router;
