/*
 * Telling our session tokens apart from Supabase's JWTs.
 *
 * Both arrive in the same `Authorization: Bearer` header, so this one predicate decides which
 * verifier runs. Getting it wrong is not a cosmetic bug: a session token sent to the JWT verifier
 * is rejected and the customer appears signed out, and a JWT sent to the session lookup misses and
 * does the same. Worth pinning down, because the reasoning behind it is a fact about base64url
 * rather than anything visible in the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { looksLikeJwt } from '../dist/services/userAuth.service.js';

test('a three-segment JWT is recognised', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
  assert.equal(looksLikeJwt(jwt), true);
});

test('tokens we mint are never mistaken for JWTs, across many samples', () => {
  /* The whole discriminator rests on base64url having no '.' in its alphabet, so a token from
     randomBytes().toString('base64url') cannot contain one. Asserted over a few hundred samples
     rather than one, since a single draw would not exercise the alphabet. */
  for (let i = 0; i < 500; i++) {
    const token = crypto.randomBytes(32).toString('base64url');
    assert.ok(!token.includes('.'), `base64url produced a dot: ${token}`);
    assert.equal(looksLikeJwt(token), false);
  }
});

test('malformed values fall to the session lookup, which fails closed', () => {
  // Not JWT-shaped, so they take the session path — where an unknown token resolves to nothing
  // and the request simply continues anonymous. Failing towards a lookup miss is the safe side.
  for (const bad of ['', 'not-a-token', 'one.two', 'a.b.c.d', '...', 'a.b.c.d.e']) {
    assert.equal(looksLikeJwt(bad), bad.split('.').length === 3);
  }
});

test('exactly two dots, not merely containing one', () => {
  // 'a.b' would be routed to the JWT verifier by a `includes('.')` check and rejected there,
  // instead of reaching the session lookup. The count is what matters.
  assert.equal(looksLikeJwt('a.b'), false);
  assert.equal(looksLikeJwt('a.b.c'), true);
});
