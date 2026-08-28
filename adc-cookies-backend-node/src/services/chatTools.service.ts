/*
 * The only things the assistant can actually do.
 *
 * THIS FILE IS THE SECURITY BOUNDARY, not the system prompt. A prompt is advice to a model that a
 * determined visitor can argue with; this is the set of operations that exist at all. Two rules
 * make that work, and both are structural:
 *
 *   1. NO TOOL TAKES A USER ID. Every one closes over `userId` from the verified session, and the
 *      model has no argument with which to name anybody else. "Show me order ADC…232" for a
 *      stranger's order returns nothing, because the query is always `WHERE user_id = $session`.
 *      That is why leaking another customer's data is impossible here rather than merely unlikely.
 *
 *   2. NOTHING MUTATES AN ORDER. There is no cancel tool, no refund tool, no reschedule tool. A
 *      visitor can be as persuasive as they like; the function they are asking for does not exist.
 *      Cancellations are a person's job, and the most the assistant can do is raise a ticket.
 *
 * A signed-out visitor gets NONE of these — see buildTools' `userId` being null. They can ask about
 * cookies and delivery areas; they cannot reach a single row belonging to an account.
 */
import { z } from 'zod';
import { tool } from 'ai';
import { getAll, getOne } from '../db/index.js';
import { zoneStores } from './store.service.js';

/** Only ever the signed-in customer's own orders, newest first. */
async function myOrders(userId: number, limit = 5) {
  return getAll(
    `SELECT id, order_number, order_status, payment_status, shipment_status, carrier,
            delhivery_waybill, total_amount, created_at, estimated_delivery
       FROM orders WHERE user_id = $1 ORDER BY id DESC LIMIT $2`,
    [userId, limit],
  );
}

/** One order, but only if it belongs to this customer. Matching is by order NUMBER, never by id. */
async function myOrder(userId: number, orderNumber: string) {
  return getOne(
    `SELECT id, order_number, order_status, payment_status, shipment_status, carrier,
            delhivery_waybill, total_amount, created_at, estimated_delivery, store_code
       FROM orders WHERE user_id = $1 AND upper(order_number) = upper($2)`,
    [userId, String(orderNumber || '').trim()],
  );
}

/**
 * Build the tool set for one request.
 *
 * `userId` null means nobody is signed in, and the order tools are simply absent from the object —
 * not disabled, not guarded, absent. A model cannot call a tool it was never given.
 */
export function buildTools({ userId }: { userId: number | null }) {
  const publicTools = {
    findProducts: tool({
      description:
        'Search the ADC cookie menu. Use for questions about what we sell, flavours, prices, '
        + 'what is in stock, or what to recommend.',
      /* `.default('')` rather than `.optional()`: an optional field makes the AI SDK's tool
         overload fail to resolve against zod 4 (verified — the same schema with .optional()
         does not compile, with .default('') it does). An empty string means "no filter". */
      inputSchema: z.object({
        query: z.string().default('').describe('Words to match against the name or category; empty for everything'),
      }),
      execute: async ({ query }) => {
        const rows = await getAll(
          `SELECT name, category, price, menu_group, tag, is_available, description
             FROM products
            WHERE is_available = TRUE
              AND ($1::text IS NULL OR name ILIKE '%'||$1||'%' OR category ILIKE '%'||$1||'%'
                   OR coalesce(menu_group,'') ILIKE '%'||$1||'%')
            ORDER BY featured DESC NULLS LAST, name LIMIT 25`,
          [query?.trim() || null],
        );
        return { count: rows.length, products: rows };
      },
    }),

    checkDeliveryArea: tool({
      description:
        'Whether ADC delivers to a 6-digit Indian pincode, and whether that would be same-day '
        + '(intracity) or a multi-day courier (intercity). Use when asked "do you deliver to X".',
      inputSchema: z.object({ pincode: z.string().describe('6-digit Indian pincode') }),
      execute: async ({ pincode }) => {
        const pin = String(pincode || '').replace(/\D/g, '');
        if (!/^\d{6}$/.test(pin)) return { ok: false, reason: 'That does not look like a 6-digit pincode.' };
        const stores = zoneStores(pin);
        return {
          ok: true,
          pincode: pin,
          mode: stores.length ? 'intracity' : 'intercity',
          servesSameDay: stores.length > 0,
        };
      },
    }),
  };

  // Signed out: the public tools and nothing else. No account data is reachable from here.
  if (!userId) return publicTools;

  return {
    ...publicTools,

    getMyOrders: tool({
      description:
        "List THIS customer's recent orders with their current status. Use whenever they ask about "
        + '"my order", "my orders", where something is, or which orders they have placed.',
      inputSchema: z.object({}),
      execute: async () => {
        const orders = await myOrders(userId);
        return { count: orders.length, orders };
      },
    }),

    getOrderStatus: tool({
      description:
        'The full current state of ONE of this customer\'s orders, by its order number '
        + '(for example ADC20260821072232), including carrier and waybill.',
      inputSchema: z.object({ orderNumber: z.string().describe('The ADC order number') }),
      execute: async ({ orderNumber }) => {
        const order = await myOrder(userId, orderNumber);
        /* Deliberately the same answer for "does not exist" and "belongs to somebody else". Saying
           which would turn this into a way to discover whether an order number is real. */
        if (!order) return { found: false, reason: 'No order with that number on this account.' };
        const pay = await getOne(
          'SELECT status, amount, amount_refunded FROM payments WHERE order_id = $1 ORDER BY id DESC LIMIT 1',
          [order.id],
        );
        return {
          found: true,
          order: { ...order, id: undefined },
          refund: {
            amountRefunded: Number(pay?.amount_refunded) || 0,
            refunded: (Number(pay?.amount_refunded) || 0) > 0,
            paymentStatus: pay?.status ?? null,
          },
        };
      },
    }),

    getOrderTimeline: tool({
      description:
        "The tracking history for ONE of this customer's orders — every status the order has passed "
        + 'through, oldest first. Use to explain where a parcel is or what has happened to it.',
      inputSchema: z.object({ orderNumber: z.string() }),
      execute: async ({ orderNumber }) => {
        const order = await myOrder(userId, orderNumber);
        if (!order) return { found: false, reason: 'No order with that number on this account.' };
        const events = await getAll(
          `SELECT status, remarks, created_at FROM order_tracking
            WHERE order_id = $1 ORDER BY id LIMIT 40`,
          [order.id],
        );
        return { found: true, orderNumber: order.order_number, carrier: order.carrier, events };
      },
    }),
  };
}

/** Names of every tool that reads account data — used to prove the signed-out set excludes them. */
export const ACCOUNT_TOOL_NAMES = ['getMyOrders', 'getOrderStatus', 'getOrderTimeline'] as const;
