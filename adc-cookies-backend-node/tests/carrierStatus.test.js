/*
 * How a carrier's own words become our order status.
 *
 * This is the highest-consequence pure function in the codebase and had never been tested. What
 * makes it dangerous is not the mapping itself but what applyCarrierTerminalStatus does with the
 * answer: DELIVERED is TERMINAL, and once an order reaches a terminal state that function refuses
 * every later update. A status mapped to DELIVERED by mistake is therefore not a temporary display
 * glitch — it is permanent, and the real DELIVERED that arrives later cannot correct it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiprocketStatusToOrderStatus as map } from '../src/services/shiprocket.client.js';

test('a delivered parcel is DELIVERED', () => {
  assert.equal(map('DELIVERED'), 'DELIVERED');
  assert.equal(map('delivered'), 'DELIVERED');
});

test('UNDELIVERED is not delivered', () => {
  // Contains the substring "DELIVERED". A failed delivery attempt is not terminal — the courier
  // will try again — so the honest answer is to leave the order where it is.
  assert.notEqual(map('UNDELIVERED'), 'DELIVERED');
  assert.notEqual(map('NOT DELIVERED'), 'DELIVERED');
});

test('RTO DELIVERED means it came back to us, not that the customer got it', () => {
  assert.equal(map('RTO DELIVERED'), 'CANCELLED');
  assert.equal(map('RTO INITIATED'), 'CANCELLED');
});

test('cancellations, both spellings', () => {
  assert.equal(map('CANCELED'), 'CANCELLED');
  assert.equal(map('CANCELLED'), 'CANCELLED');
});

test('in-flight states', () => {
  assert.equal(map('OUT FOR DELIVERY'), 'OUT_FOR_DELIVERY');
  assert.equal(map('IN TRANSIT'), 'OUT_FOR_DELIVERY');
  assert.equal(map('PICKED UP'), 'OUT_FOR_DELIVERY');
  assert.equal(map('PICKUP SCHEDULED'), 'PACKED');
  assert.equal(map('AWB ASSIGNED'), 'PACKED');
});

test('anything unrecognised leaves the order alone', () => {
  for (const s of ['LOST', 'DAMAGED', 'WEIRD NEW STATUS', '', null, undefined]) {
    assert.equal(map(s), null, `expected null for ${JSON.stringify(s)}`);
  }
});
