/*
 * Which WhatsApp messages get the menu, and which go to the assistant.
 *
 * The line that matters: a bare hello, or one of the website's WhatsApp buttons, gets the menu; a
 * real question gets an answer. A greeting that swallowed "hi, where is my order" would hand a
 * customer with a problem a list of options instead of their order.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeFor } from '../dist/services/support/menu.service.js';

test('a bare hello gets the menu, however it is typed', () => {
  for (const t of ['hi', 'Hi', 'hii', 'Hello!', 'hey there', 'Good morning', 'namaste', 'menu', 'Hi 👋', 'hello adc']) {
    assert.equal(routeFor(t), 'menu', t);
  }
});

test('the website buttons are recognised by their opening', () => {
  assert.equal(routeFor('Hi A Dough Cookie!'), 'menu');
  assert.equal(routeFor('Hi A Dough Cookie! I’d like to ask about the Jayanagar store.'), 'menu');
  assert.equal(routeFor('Hi A Dough Cookie! I’m interested in a franchise.'), 'franchise');
  assert.equal(routeFor('Hi A Dough Cookie! I’d like a quote for a bulk / corporate order.'), 'corporate');
  assert.equal(routeFor('Hi A Dough Cookie! I’d like a quote for cookie gift hampers.'), 'corporate');
});

test('a real question goes to the assistant, even when it starts with hi', () => {
  for (const t of ['hi, where is my order?', 'hello my cookies arrived broken', 'Is the Nutella cookie eggless?', 'ADC20260101123456', 'franchise details please', '']) {
    assert.equal(routeFor(t), null, t);
  }
});
