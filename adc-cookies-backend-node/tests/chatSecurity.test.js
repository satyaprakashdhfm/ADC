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

test('the anonymous prompt refuses to trust a transcript that names a customer', () => {
  /* The browser controls the transcript it posts, so a stale (or forged) thread can describe a
     signed-in customer to a session that is not. It cannot make the model FETCH anything — the
     anonymous agent has no account tools — but it could make it repeat a name back as fact. */
  const out = systemPrompt({ signedIn: false });
  assert.match(out, /IGNORE ANY EARLIER TURN/i);
  assert.match(out, /Nobody is signed in NOW/i);
});

/*
 * The ticket carries what was actually asked.
 *
 * The transcript is supplied by the ROUTE, not by the model — it would otherwise be summarising the
 * conversation into an argument describing that same conversation. These lock down the extraction,
 * because the column, the admin panel section and the email block that display it are all dead
 * weight if it silently arrives empty, which is exactly how it shipped the first time.
 */
test('the conversation is reduced to plain customer/assistant turns', async () => {
  const { plainTurns } = await import('../dist/routes/chat.routes.js');
  const turns = plainTurns([
    { role: 'user', parts: [{ type: 'text', text: 'Cancel my order' }] },
    { role: 'assistant', parts: [
      { type: 'tool-call', toolName: 'getMyOrders' },   // how the answer was found, not the answer
      { type: 'text', text: 'I cannot cancel it myself' },
    ] },
  ]);
  assert.deepEqual(turns, [
    { role: 'user', text: 'Cancel my order' },
    { role: 'assistant', text: 'I cannot cancel it myself' },
  ]);
});

test('turns with no text at all are dropped, and long ones are truncated', async () => {
  const { plainTurns } = await import('../dist/routes/chat.routes.js');
  // A turn that is only a tool call has nothing a human needs to read.
  assert.deepEqual(plainTurns([{ role: 'assistant', parts: [{ type: 'tool-call', toolName: 'x' }] }]), []);
  // This ends up in an email and a JSONB column; one pasted essay must not be why either falls over.
  const [long] = plainTurns([{ role: 'user', parts: [{ type: 'text', text: 'x'.repeat(5000) }] }]);
  assert.equal(long.text.length, 1000);
});

test('the ticket tool carries the transcript it was built with', () => {
  // Absent this, the tool files every ticket with an empty conversation and nobody notices.
  assert.ok(typeof buildTicketTool(7, [{ role: 'user', text: 'hi' }]).raiseSupportTicket.execute === 'function');
  assert.ok(typeof buildTicketTool(7).raiseSupportTicket.execute === 'function'); // still optional
});

/*
 * Capturing what the customer actually said.
 *
 * A customer whose DELIVERY OTP never arrived — the courier's code, at her door — had her ticket
 * filed as a sign-in problem. Both OTPs are real, only one is ours, and the row carried nothing but
 * the model's reading, so there was no way to tell it had guessed wrong. These cover the three
 * things that make that recoverable: a closed category list with somewhere honest to put a
 * misfit, a verbatim field, and a prompt that makes the assistant ask which OTP before filing.
 */
test('the category list is closed, and OTHER is a real destination', async () => {
  const { TICKET_CATEGORIES, normaliseCategory } = await import('../dist/services/ticket.service.js');
  assert.ok(TICKET_CATEGORIES.includes('OTHER'));
  // The two OTP situations must be separately filable, or one word does double duty again.
  assert.ok(TICKET_CATEGORIES.includes('DELIVERY_HANDOVER'));
  assert.ok(TICKET_CATEGORIES.includes('LOGIN_ACCESS'));
  // Anything invented lands in OTHER rather than being written to the row unchecked.
  assert.equal(normaliseCategory('GENERAL'), 'OTHER');
  assert.equal(normaliseCategory('nonsense'), 'OTHER');
  assert.equal(normaliseCategory(undefined), 'OTHER');
  assert.equal(normaliseCategory('delivery handover'), 'DELIVERY_HANDOVER');
  assert.equal(normaliseCategory(' refund '), 'REFUND');
});

test('the ticket tool demands the customer\'s own words, and constrains the category', async () => {
  const { buildTicketTool, TICKET_CATEGORIES } = await import('../dist/services/ticket.service.js');
  const shape = buildTicketTool(7).raiseSupportTicket.inputSchema.shape;
  // Required, not optional: a summary alone is what failed.
  assert.ok(shape.customerWords, 'customerWords must exist');
  assert.equal(shape.customerWords.isOptional?.() ?? false, false);
  // A free-text category is how "OTP" became a login ticket.
  const opts = shape.category?._def?.innerType?.options ?? shape.category?.options ?? [];
  assert.deepEqual([...opts].sort(), [...TICKET_CATEGORIES].sort());
});

test('the prompt makes the assistant separate the three OTPs before filing', async () => {
  const { systemPrompt } = await import('../dist/services/chat.service.js');
  const p = systemPrompt({ signedIn: true, customerName: 'Priya' });
  assert.match(p, /SIGN-IN OTP/i);
  assert.match(p, /DELIVERY OTP/i);
  assert.match(p, /PAYMENT OTP/i);
  // The delivery one is the courier's and follows the phone number ON THE ORDER — the fact that
  // explains the whole incident.
  assert.match(p, /comes from the\s+courier/i);
  assert.match(p, /phone number on the order/i);
  // And it must ask rather than guess.
  assert.match(p, /ask which/i);
  assert.match(p, /customerWords/);
  assert.match(p, /choose OTHER/i);
});
