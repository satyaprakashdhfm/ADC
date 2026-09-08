/*
 * The open-redirect guard on Google sign-in.
 *
 * `next` decides where the browser lands after authenticating, and it comes from the query string.
 * If an absolute URL were ever honoured, /api/auth/google/start would become a phishing primitive:
 * a link that really does start on adoughcookie.com, really does sign the customer in, and then
 * delivers them to somebody else's page — with our domain in the address bar for the whole first
 * half. That is far more convincing than an ordinary phishing link.
 *
 * Every case below is a way of expressing "somewhere that is not us" that has fooled a naive
 * startsWith('/') check in some real codebase. They are cheap to assert and the failure mode is
 * severe, so they are worth pinning even though the implementation is four lines.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNextPath } from '../dist/services/googleAuth.service.js';

test('ordinary in-app paths survive untouched', () => {
  for (const p of ['/', '/account', '/order/ADC123', '/store/besant?tab=menu']) {
    assert.equal(safeNextPath(p), p);
  }
});

test('absolute URLs are refused, not followed', () => {
  for (const p of [
    'https://evil.example/steal',
    'http://evil.example',
    'HTTPS://evil.example',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
  ]) {
    assert.equal(safeNextPath(p), '/', `should have rejected ${p}`);
  }
});

test('protocol-relative and backslash forms cannot change origin', () => {
  // '//evil.example' is a valid URL meaning "same scheme, different host" — it passes
  // startsWith('/') and is the single most common way this check gets bypassed. Browsers have
  // also historically treated '/\' like '//', so both are refused.
  assert.equal(safeNextPath('//evil.example'), '/');
  assert.equal(safeNextPath('//evil.example/path'), '/');
  assert.equal(safeNextPath('/\\evil.example'), '/');
});

test('CRLF cannot be smuggled into the redirect header', () => {
  assert.equal(safeNextPath('/account\r\nSet-Cookie: a=b'), '/');
  assert.equal(safeNextPath('/account\nLocation: https://evil.example'), '/');
});

test('missing, empty and non-string values fall back to the home page', () => {
  for (const p of [undefined, null, '', '   ', 42, {}, []]) {
    assert.equal(safeNextPath(p), '/');
  }
});
