/*
 * Parcel weights. Delhivery reads grams and Shiprocket kilograms; a hard-coded 0.5 meant half a
 * gram to Delhivery, which then billed a weight mismatch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parcelGrams, parcelKg, unitGrams } from '../dist/services/parcel.service.js';

test('a cookie is 55 g and a tin 450 g, by category or by name', () => {
  assert.equal(unitGrams({ category: 'COOKIES', product_name: 'Nutella Filled', quantity: 1 }), 55);
  assert.equal(unitGrams({ category: 'TINS', product_name: 'Biscoff Tin', quantity: 1 }), 450);
  assert.equal(unitGrams({ category: null, product_name: 'Nutella Tin', quantity: 1 }), 450);
});

test('the parcel adds up its lines plus 100 g of packing', () => {
  assert.equal(parcelGrams([{ category: 'COOKIES', quantity: 6 }]), 6 * 55 + 100);
  assert.equal(parcelGrams([{ category: 'COOKIES', quantity: 4 }, { category: 'TINS', quantity: 2 }]), 4 * 55 + 900 + 100);
  assert.equal(parcelGrams([]), 55 + 100);
});

test('kilograms are the same parcel divided by 1000', () => {
  assert.equal(parcelKg([{ category: 'TINS', quantity: 1 }]), 0.55);
});
