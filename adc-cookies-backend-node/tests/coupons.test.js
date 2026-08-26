/*
 * What a coupon takes off the bill.
 *
 * Pure arithmetic, and the only part of coupon logic that needs no database — which is why it is
 * here and validateCoupon is not. Every case below is one somebody could get wrong by a factor of
 * a hundred or by a multiplication, on real money.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDiscount } from '../src/services/coupon.service.js';

const pct = (v, cap = null) => ({ discount_type: 'PERCENTAGE', discount_value: v, maximum_discount: cap });
const flat = (v, cap = null) => ({ discount_type: 'FLAT', discount_value: v, maximum_discount: cap });

test('a percentage is a percentage of the subtotal', () => {
  assert.equal(calculateDiscount(pct(10), 1000, null), 100);
  assert.equal(calculateDiscount(pct(25), 400, null), 100);
});

test('a flat coupon ignores the subtotal', () => {
  assert.equal(calculateDiscount(flat(50), 1000, null), 50);
  assert.equal(calculateDiscount(flat(50), 100, null), 50);
});

test('the cap wins when the percentage would exceed it', () => {
  assert.equal(calculateDiscount(pct(25, 300), 5000, null), 300, '25% of 5000 is 1250, capped at 300');
  assert.equal(calculateDiscount(pct(25, 300), 400, null), 100, 'under the cap, uncapped');
});

test('a gift is worth one unit of the real product price, never the discount_value', () => {
  const coupon = { ...flat(0), maximum_discount: null };
  assert.equal(calculateDiscount(coupon, 2000, { price: 850 }), 850);
});

test('a gift is one unit however many are in the cart', () => {
  // "free tin" means ONE tin free. The subtotal carrying three of them must not treble it.
  const coupon = { ...flat(0) };
  assert.equal(calculateDiscount(coupon, 2550, { price: 850 }), 850);
});

test('a gift is still capped', () => {
  assert.equal(calculateDiscount(flat(0, 500), 2000, { price: 850 }), 500);
});
