/*
 * Which products are customisable packs, and how a customer's picks are described.
 *
 * The pack definitions match on PREDICATES rather than product ids, because the 8-pack has a
 * different id in each database. Tests here use hand-built product rows for that reason: an id
 * list would pass locally and mean nothing about production.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packFor, isPackProduct, packSize, describePicks, summarisePicks } from '../dist/services/pack.service.js';

const eightPack = { id: 39, name: '8 Pack Cookies', category: 'COMBOS' };

test('the 8-pack is recognised by name and category, not by id', () => {
  assert.ok(isPackProduct(eightPack));
  assert.ok(isPackProduct({ id: 1, name: '8 pack cookies', category: 'combos' }));
  assert.ok(isPackProduct({ id: 999, name: 'Cookie 8 Pack', category: 'COMBOS' }));
});

test('an 8-pack that is not a combo is not a pack', () => {
  assert.equal(isPackProduct({ id: 39, name: '8 Pack Cookies', category: 'COOKIES' }), false);
});

test('ordinary products are not packs', () => {
  for (const p of [{ name: 'Red Velvet', category: 'COOKIES' },
                   { name: 'Cookie Tin', category: 'TINS' },
                   { name: '6 Pack Cookies', category: 'COMBOS' }]) {
    assert.equal(isPackProduct(p), false, `${p.name} should not be a pack`);
  }
});

test('nothing is not a pack', () => {
  for (const p of [null, undefined, {}]) assert.equal(isPackProduct(p), false);
});

test('the 8-pack holds exactly 8, split 3 filled and 5 plain', () => {
  const def = packFor(eightPack);
  assert.equal(packSize(def), 8);
  assert.deepEqual(def.slots.map((s) => s.count), [3, 5]);
});

test('picks are described for the kitchen and the customer', () => {
  const picks = [{ name: 'Red Velvet Filled', quantity: 3 }, { name: 'Choco Chunk', quantity: 5 }];
  assert.deepEqual(describePicks(picks), ['3× Red Velvet Filled', '5× Choco Chunk']);
  assert.equal(summarisePicks(picks), '3× Red Velvet Filled, 5× Choco Chunk');
});

test('no picks summarises to nothing, not to a crash', () => {
  assert.deepEqual(describePicks(null), []);
  assert.equal(summarisePicks(undefined), '');
});
