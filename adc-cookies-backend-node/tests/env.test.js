/*
 * The boot-time environment check.
 *
 * Tested against the variable sets the three real environments actually have, so a change that
 * would stop production booting fails here rather than on a deploy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEnv } from '../src/config/env.js';

const env = (keys) => Object.fromEntries(keys.map((k) => [k, 'x']));

const PROD = ['DATABASE_URL','DELHIVERY_BASE_URL','DELIVERY_API_TOKEN','PETPOOJA_API','PETPOOJA_API_SECRET',
  'PETPOOJA_API_TOKEN','PETPOOJA_BASE_URL','PETPOOJA_REST_ID','SHIPROCKET_EMAIL','SHIPROCKET_PASSWORD',
  'SHIPROCKET_BASE_URL','CUSTOMER_ID','AUTH_KEY','MC_BASE_URL','SUPABASE_URL'];
const STAGING = ['DATABASE_URL','DELHIVERY_BASE_URL','DELIVERY_API_TOKEN','PETPOOJA_BASE_URL','PETPOOJA_REST_ID',
  'SHIPROCKET_EMAIL','SHIPROCKET_PASSWORD','SHIPROCKET_BASE_URL','CUSTOMER_ID','AUTH_KEY','MC_BASE_URL','SUPABASE_URL'];
const LOCAL = ['DATABASE_URL','DELHIVERY_BASE_URL','DELIVERY_API_TOKEN','SUPABASE_URL'];

test('all three real environments boot', () => {
  for (const [name, keys] of [['production', PROD], ['staging', STAGING], ['local', LOCAL]]) {
    assert.doesNotThrow(() => checkEnv(env(keys)), `${name} must still boot`);
  }
});

test('production without PETPOOJA_BASE_URL is refused', () => {
  // The sandbox default answers success:"1", so this fails silently rather than loudly.
  const keys = PROD.filter((k) => k !== 'PETPOOJA_BASE_URL');
  assert.throws(() => checkEnv(env(keys)), /PETPOOJA_BASE_URL/);
});

test('an environment with a Delhivery token but no host is refused', () => {
  const keys = STAGING.filter((k) => k !== 'DELHIVERY_BASE_URL');
  assert.throws(() => checkEnv(env(keys)), /DELHIVERY_BASE_URL/);
});

test('no credentials means no requirement — a developer is not forced to name hosts', () => {
  assert.doesNotThrow(() => checkEnv({ DATABASE_URL: 'x' }));
});

test('every problem is reported at once, not one per boot', () => {
  const keys = PROD.filter((k) => k !== 'PETPOOJA_BASE_URL' && k !== 'DELHIVERY_BASE_URL');
  assert.throws(() => checkEnv(env(keys)), (e) =>
    /PETPOOJA_BASE_URL/.test(e.message) && /DELHIVERY_BASE_URL/.test(e.message));
});

test('a Shiprocket account with no host named is refused', () => {
  // The default is production — the same wallet staging would be spending.
  assert.throws(() => checkEnv(env(PROD.filter((k) => k !== 'SHIPROCKET_BASE_URL'))), /SHIPROCKET_BASE_URL/);
});

test('Message Central with no host named is refused', () => {
  // The default is production, which sends real OTP SMS to real phones.
  assert.throws(() => checkEnv(env(PROD.filter((k) => k !== 'MC_BASE_URL'))), /MC_BASE_URL/);
});

test('a clean environment produces no warnings at all', () => {
  assert.deepEqual(checkEnv(env(PROD)), []);
});
