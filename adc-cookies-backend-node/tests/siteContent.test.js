/*
 * Whether the hero banner is live right now.
 *
 * Every condition here has a way of being wrong that shows the WRONG THING TO CUSTOMERS rather
 * than erroring: a banner with no image renders an empty slab, and an off-by-one on the window
 * either runs a promotion early or keeps a finished one up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bannerIsLive } from '../src/services/siteContent.service.js';

const at = (s) => new Date(s);
const base = { enabled: true, desktopRef: 'media/hero.jpg' };

test('a disabled banner is never live', () => {
  assert.equal(bannerIsLive({ ...base, enabled: false }), false);
  assert.equal(bannerIsLive({ desktopRef: 'x' }), false);
  assert.equal(bannerIsLive(null), false);
});

test('a banner with no image at all is not live', () => {
  assert.equal(bannerIsLive({ enabled: true }), false);
});

test('either image alone is enough — the hero is art-directed, not paired', () => {
  assert.equal(bannerIsLive({ enabled: true, desktopRef: 'a' }), true);
  assert.equal(bannerIsLive({ enabled: true, mobileRef: 'b' }), true);
});

test('with no window set it is simply live', () => {
  assert.equal(bannerIsLive(base), true);
});

test('the window is inclusive at the start and exclusive at the end', () => {
  const b = { ...base, startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-08-31T00:00:00Z' };
  assert.equal(bannerIsLive(b, at('2026-07-31T23:59:59Z')), false, 'a second before the start');
  assert.equal(bannerIsLive(b, at('2026-08-01T00:00:00Z')), true,  'exactly at the start: live');
  assert.equal(bannerIsLive(b, at('2026-08-15T12:00:00Z')), true,  'mid-window');
  assert.equal(bannerIsLive(b, at('2026-08-30T23:59:59Z')), true,  'a second before the end');
  assert.equal(bannerIsLive(b, at('2026-08-31T00:00:00Z')), false, 'exactly at the end: over');
});

test('a start with no end runs forever, and an end with no start runs until then', () => {
  assert.equal(bannerIsLive({ ...base, startsAt: '2026-08-01T00:00:00Z' }, at('2030-01-01T00:00:00Z')), true);
  assert.equal(bannerIsLive({ ...base, endsAt: '2026-08-31T00:00:00Z' }, at('2020-01-01T00:00:00Z')), true);
});
