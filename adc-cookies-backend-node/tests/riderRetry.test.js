/*
 * Which identifier we hand Shiprocket when re-searching for a rider.
 *
 * This is the whole of the 2026-08-29 bug. A Quick booking is TWO objects: when nobody accepts,
 * Shiprocket cancels the SHIPMENT and reverts the ORDER to NEW. Re-assigning against the shipment
 * therefore hits a cancelled object and answers "order is in cancelled state" — instantly, every
 * time — while /orders/show reports the order as a perfectly healthy NEW. Three retries, three
 * identical refusals, no second search ever performed.
 *
 * These lock the distinction down, because it is invisible at the call site: both forms are one
 * short object and the wrong one fails in a way that reads like a carrier problem.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignBody } from '../dist/services/shiprocket.client.js';

test('an order target sends order_id, and never shipment_id', () => {
  const { body, label } = assignBody({ orderId: 1548380382 });
  assert.deepEqual(body, { order_id: '1548380382' });
  assert.ok(!('shipment_id' in body), 'shipment_id would target the cancelled object');
  assert.match(label, /order=1548380382/);
});

test('a shipment target still sends shipment_id — the fallback must stay intact', () => {
  const { body } = assignBody({ shipmentId: 1544599947 });
  assert.deepEqual(body, { shipment_id: '1544599947' });
});

test('a bare id keeps meaning shipment_id, so older callers are unchanged', () => {
  // autoCreateShipment and the admin rebook both pass a bare id and must not silently change target.
  assert.deepEqual(assignBody(1544599947).body, { shipment_id: '1544599947' });
  assert.deepEqual(assignBody('1544599947').body, { shipment_id: '1544599947' });
});

test('the two targets are mutually exclusive', () => {
  // Sending both is what their 422 describes as ambiguous; we must never construct it.
  for (const t of [{ orderId: 1 }, { shipmentId: 2 }]) {
    const keys = Object.keys(assignBody(t).body);
    assert.equal(keys.filter((k) => k === 'order_id' || k === 'shipment_id').length, 1);
  }
});

test('options ride along with either target', () => {
  const { body } = assignBody({ orderId: 7 }, { vehicleType: 2, courierId: 9, futurePickupScheduled: '2026-05-09 08:23:12' });
  assert.equal(body.order_id, '7');
  assert.equal(body.vehicle_type, '2');
  assert.equal(body.courier_id, '9');
  assert.equal(body.future_pickup_scheduled, '2026-05-09 08:23:12');
});

test('an absent option is omitted, not sent empty', () => {
  // vehicle_type defaults to 2 on their side; sending "" or "undefined" is not the same as omitting.
  const { body } = assignBody({ orderId: 7 });
  assert.deepEqual(Object.keys(body), ['order_id']);
});
