/*
 * What the assistant is allowed to do.
 *
 * These assert the STRUCTURAL guarantees, not the model's manners. A system prompt is advice a
 * determined visitor can argue with; the tool set is the set of operations that exist at all, and
 * that is what these lock down. If one of these fails, a prompt-injection attempt stops being a
 * rude answer and starts being somebody else's data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTools, ACCOUNT_TOOL_NAMES } from '../dist/services/chatTools.service.js';
import { buildTicketTool } from '../dist/services/ticket.service.js';
import { systemPrompt } from '../dist/services/chat.service.js';

test('a signed-out visitor gets no tool that can reach an account', () => {
  const names = Object.keys(buildTools({ userId: null }));
  for (const account of ACCOUNT_TOOL_NAMES) {
    assert.ok(!names.includes(account), `${account} must not exist for a signed-out visitor`);
  }
  // It still gets the public ones, or it would be a bot that can answer nothing.
  assert.ok(names.includes('findProducts'));
  assert.ok(names.includes('checkDeliveryArea'));
});

test('a signed-in customer gets the account tools', () => {
  const names = Object.keys(buildTools({ userId: 7 }));
  for (const account of ACCOUNT_TOOL_NAMES) assert.ok(names.includes(account), `${account} missing`);
});

test('NO tool can alter an order — cancellation is a person\'s job', () => {
  const names = [...Object.keys(buildTools({ userId: 7 })), ...Object.keys(buildTicketTool(7))];
  /* The point is not that a cancel tool refuses. It is that there is nothing to call, so however
     convincing the argument, the model has no way to act on it. */
  for (const forbidden of ['cancel', 'refund', 'delete', 'update', 'reschedule', 'setStatus']) {
    const match = names.find((n) => n.toLowerCase().includes(forbidden));
    assert.equal(match, undefined, `a tool named ${match} would give the assistant authority it must not have`);
  }
});

test('no tool accepts a user id — the session decides whose data is reachable', () => {
  const tools = { ...buildTools({ userId: 7 }), ...buildTicketTool(7) };
  for (const [name, t] of Object.entries(tools)) {
    const shape = t?.inputSchema?.shape ?? {};
    for (const key of Object.keys(shape)) {
      assert.ok(
        !/^(user|customer|account)_?id$/i.test(key),
        `${name} exposes "${key}" — a caller-supplied identity is exactly what must never exist here`,
      );
    }
  }
});

test('the ticket tool is absent for a signed-out visitor', () => {
  // Nothing to file against, and asking for details we cannot attach to an account is theatre.
  assert.deepEqual(Object.keys(buildTools({ userId: null })).filter((n) => n === 'raiseSupportTicket'), []);
});

test('the system prompt tells a signed-out visitor it cannot see orders', () => {
  const out = systemPrompt({ signedIn: false });
  assert.match(out, /NO access|sign in/i);
  const inn = systemPrompt({ signedIn: true, customerName: 'Priya' });
  assert.match(inn, /Priya/);
});

test('the prompt forbids acting on cancellations and refuses off-topic questions', () => {
  const p = systemPrompt({ signedIn: true });
  assert.match(p, /cannot cancel/i);
  assert.match(p, /raiseSupportTicket/);
  assert.match(p, /5 to 7 working days/i);   // matches the live refund wording, not 3-4
});
