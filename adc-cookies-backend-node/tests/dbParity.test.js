/*
 * Drizzle must return exactly what raw SQL returns.
 *
 * This is the test that makes porting services to Drizzle safe. The two paths do NOT agree by
 * default, and where they disagree they do it silently, on money:
 *
 *     raw      subtotal + delivery_fee  =  234
 *     drizzle  subtotal + deliveryFee   =  18549      <- "185" + "49", string concatenation
 *
 * because Drizzle's node-postgres session hardcodes identity parsers for TIMESTAMPTZ/DATE and its
 * numeric column maps values back to strings, bypassing the parsers db/index.js registers.
 * src/models/_columns.js closes that gap; this proves it stays closed.
 *
 * Needs a database, so it SKIPS rather than fails when there is none — a unit-test run on a laptop
 * with no Postgres should stay green, but a run that CAN reach a database must actually check.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let db, schema, getOne, reachable = false;

before(async () => {
  try {
    ({ getOne } = await import('../src/db/index.js'));
    ({ db, schema } = await import('../src/db/drizzle.js'));
    await getOne('SELECT 1');
    reachable = true;
  } catch { reachable = false; }
});

test('money comes back as a number, so totals add instead of concatenating', async (t) => {
  if (!reachable) return t.skip('no database reachable');
  const { eq } = await import('drizzle-orm');
  const raw = await getOne('SELECT subtotal, delivery_fee FROM orders ORDER BY id LIMIT 1');
  if (!raw) return t.skip('no orders to compare');
  const [d] = await db.select().from(schema.orders).orderBy(schema.orders.id).limit(1);

  assert.equal(typeof d.subtotal, 'number', 'subtotal must be a number, not a string');
  assert.equal(typeof d.deliveryFee, 'number');
  assert.equal(d.subtotal, raw.subtotal);
  assert.equal(d.subtotal + d.deliveryFee, raw.subtotal + raw.delivery_fee);
});

test('timestamps come back as the same ISO string raw SQL gives', async (t) => {
  if (!reachable) return t.skip('no database reachable');
  const raw = await getOne('SELECT id, created_at FROM orders ORDER BY id LIMIT 1');
  if (!raw) return t.skip('no orders to compare');
  const [d] = await db.select().from(schema.orders).orderBy(schema.orders.id).limit(1);
  assert.equal(d.createdAt, raw.created_at);
  assert.match(d.createdAt, /^\d{4}-\d{2}-\d{2}T.*Z$/, 'must be ISO, not Postgres text');
});

test('a DATE stays a YYYY-MM-DD string, because coupon expiry is compared as one', async (t) => {
  if (!reachable) return t.skip('no database reachable');
  const raw = await getOne('SELECT expiry_date FROM coupons WHERE expiry_date IS NOT NULL LIMIT 1');
  if (!raw) return t.skip('no dated coupons to compare');
  const rows = await db.select({ e: schema.coupons.expiryDate }).from(schema.coupons);
  const d = rows.find((r) => r.e);
  assert.equal(typeof d.e, 'string');
  assert.match(d.e, /^\d{4}-\d{2}-\d{2}$/);
});

test('every model loads and names a real table', async (t) => {
  if (!reachable) return t.skip('no database reachable');
  const { getTableName } = await import('drizzle-orm');
  const names = Object.values(schema)
    .map((v) => { try { return getTableName(v); } catch { return null; } })
    .filter(Boolean);
  assert.ok(names.length >= 30, `expected 30+ tables, got ${names.length}`);
  assert.ok(names.includes('orders') && names.includes('products') && names.includes('payments'));
});
