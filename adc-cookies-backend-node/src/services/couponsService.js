import { prisma } from '../config/prisma.js';
import { ApiError } from '../middleware.js';

export async function validateCoupon(code, orderAmount) {
  const coupon = await prisma.coupon.findFirst({
    where: { code: String(code).toUpperCase(), isActive: true },
  });
  if (!coupon) throw new ApiError('Invalid or inactive coupon');

  if (coupon.expiryDate && coupon.expiryDate < new Date().toISOString().slice(0, 10)) {
    throw new ApiError('Coupon has expired');
  }
  if (coupon.usageLimit != null) {
    const usageCount = await prisma.couponUsage.count({ where: { couponId: coupon.id } });
    if (usageCount >= coupon.usageLimit) throw new ApiError('Coupon usage limit reached');
  }
  if (coupon.minimumOrderAmount != null && Number(orderAmount) < coupon.minimumOrderAmount) {
    throw new ApiError('Order amount below minimum for this coupon');
  }
  return coupon;
}

export function calculateDiscount(coupon, subtotal) {
  let discount = coupon.discountType === 'PERCENTAGE'
    ? (Number(subtotal) * coupon.discountValue) / 100
    : coupon.discountValue;
  if (coupon.maximumDiscount != null && discount > coupon.maximumDiscount) {
    discount = coupon.maximumDiscount;
  }
  return discount;
}

export async function validateCouponForResponse(code, orderAmount) {
  const coupon = await validateCoupon(code, orderAmount);
  return { ...coupon, valid: true };
}
