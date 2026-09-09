/*
 * The two things standing between a media URL and the rest of the filesystem.
 *
 * Serving files from disk by a path that arrived in a URL is the classic directory-traversal
 * shape, and it used to be Supabase's problem rather than ours. Now it is ours, so the containment
 * check and the signature check are both pinned here — they are four lines each, and four lines is
 * exactly the size of thing that gets "simplified" by somebody who cannot see what it was for.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-media-signing';
process.env.MEDIA_DIR = path.join(process.cwd(), '.media-test');

let resolveMediaPath, mediaSignature, verifyMediaSignature, isMediaRef, refToPath, pathToRef;
before(async () => {
  ({ resolveMediaPath, mediaSignature, verifyMediaSignature, isMediaRef, refToPath, pathToRef } =
    await import('../dist/services/storage.client.js'));
});

test('ordinary paths resolve inside the media directory', () => {
  const root = path.resolve(process.env.MEDIA_DIR);
  for (const p of ['products/1-cookie.jpg', 'banner/hero.webp', 'misc/a.png']) {
    const full = resolveMediaPath(p);
    assert.ok(full, `${p} should resolve`);
    assert.ok(full.startsWith(root + path.sep), `${p} escaped to ${full}`);
  }
});

test('traversal that would escape the root is refused', () => {
  // Each of these has defeated a naive check somewhere. The implementation resolves first and then
  // asks whether the result is inside the root, which is why the spelling does not matter.
  for (const p of [
    '../secrets.env',
    '../../etc/passwd',
    'products/../../../etc/passwd',
    'products/../../adc-backend/.env',
    './../../x',
  ]) {
    assert.equal(resolveMediaPath(p), null, `should have refused ${p}`);
  }
});

test('an absolute path is pulled INTO the root rather than followed', () => {
  /* '/etc/passwd' does not return null, and that is correct: the leading slash is stripped, so it
     resolves to <media-root>/etc/passwd and 404s. The distinction matters — the guarantee is
     containment, not rejection, and asserting "returns null" here would be testing a stricter
     behaviour than the code promises and would break the moment someone read the code properly. */
  const root = path.resolve(process.env.MEDIA_DIR);
  for (const p of ['/etc/passwd', '//etc/passwd', '/products/a.jpg']) {
    const full = resolveMediaPath(p);
    assert.ok(full && full.startsWith(root + path.sep), `${p} escaped to ${full}`);
  }
});

test('empty and junk paths resolve to nothing', () => {
  for (const p of ['', '/', '///', null, undefined]) {
    assert.equal(resolveMediaPath(p), null);
  }
});

test('a signature is good only for its own path and expiry', () => {
  const exp = Date.now() + 60_000;
  const sig = mediaSignature('products/a.jpg', exp);

  assert.equal(verifyMediaSignature('products/a.jpg', exp, sig), true);
  // A signature lifted from one image must not open another.
  assert.equal(verifyMediaSignature('products/b.jpg', exp, sig), false);
  // Nor may the expiry be pushed out while keeping the signature.
  assert.equal(verifyMediaSignature('products/a.jpg', exp + 60_000, sig), false);
});

test('an expired signature is refused even though it is genuine', () => {
  const past = Date.now() - 1000;
  assert.equal(verifyMediaSignature('products/a.jpg', past, mediaSignature('products/a.jpg', past)), false);
});

test('missing, malformed and wrong-length signatures fail closed', () => {
  const exp = Date.now() + 60_000;
  // The length guard matters: timingSafeEqual THROWS on a length mismatch rather than returning
  // false, so without it a short signature would be a 500 instead of a 404.
  for (const bad of ['', 'x', 'deadbeef', null, undefined, '0'.repeat(64)]) {
    assert.equal(verifyMediaSignature('products/a.jpg', exp, bad), false);
  }
});

test('references round-trip, and the legacy scheme is still read', () => {
  assert.equal(pathToRef('products/a.jpg'), 'media://products/a.jpg');
  assert.equal(refToPath('media://products/a.jpg'), 'products/a.jpg');

  // Rows written before the move off Supabase Storage must still render, not show as literal text.
  assert.equal(isMediaRef('supabase://products/a.jpg'), true);
  assert.equal(refToPath('supabase://products/a.jpg'), 'products/a.jpg');

  // A static asset is not a media reference and passes through untouched.
  assert.equal(isMediaRef('/assets/cookie.png'), false);
});
