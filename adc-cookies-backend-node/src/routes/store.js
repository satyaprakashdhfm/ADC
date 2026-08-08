import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getOne, getAll, query, nowIso } from '../db.js';
import { ApiError } from '../middleware.js';
import {
  requireStoreUser, signStoreToken, checkPassword, hashPassword, storeAuthConfigured,
} from '../storeAuth.js';
import { storeRelaysToPos } from '../stores.js';
import { trackShiprocket, getRiderData, shiprocketConfigured } from '../shiprocket.js';
import { trackShipment, delhiveryConfigured } from '../delhivery.js';

/*
 * The store portal — /store/<code> on the frontend, /api/store here.
 *
 * A store runs its order end to end: it accepts it, bakes it, bills it on its own Petpooja terminal
 * (every outlet except Begur, which we relay for) and hands it to the rider. So this API shows a
 * kitchen everything about ITS orders and nothing about anyone else's — no other store's orders, no
 * customers, no products beyond the menu, no takings, no admin actions. Two rules make that hold:
 *
 *   1. Every query is filtered by the store code on the token, never by one from the request.
 *   2. Nothing here can change money, cancel an order, or touch a carrier booking. Those stay in
 *      /admin, because a mis-tap on a shared counter tablet must not be able to call off a rider or
 *      cancel a paid order.
 */

const router = Router();

/* ---------- Login ---------- */

// Brute force here is a real risk: usernames are guessable (they are the store names) and the
// terminal sits in a public shop. 10 attempts per IP per 15 minutes, counting only failures.
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts', message: 'Too many sign-in attempts — try again in 15 minutes.' },
});

router.post('/login', loginLimiter, async (req, res) => {
  if (!storeAuthConfigured()) {
    return res.status(503).json({ error: 'Not configured', message: 'Store logins are not configured on this environment.' });
  }
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) throw new ApiError('Enter your username and password');

  const user = await getOne('SELECT * FROM store_users WHERE lower(username) = $1', [username]);
  // One message for "no such user" and "wrong password" alike — telling them which is wrong hands
  // an attacker a way to enumerate valid store accounts.
  const ok = user && user.is_active && await checkPassword(password, user.password_hash);
  if (!ok) {
    console.log(`[STORE] login | ✗ ${username} | ${!user ? 'no such account' : !user.is_active ? 'deactivated' : 'wrong password'}`);
    return res.status(401).json({ error: 'Unauthorized', message: 'Wrong username or password' });
  }

  await query('UPDATE store_users SET last_login_at = $1, updated_at = $1 WHERE id = $2', [nowIso(), user.id]);
  console.log(`[STORE] login | ✓ ${user.username} → ${user.store_code}`);
  res.json({ token: signStoreToken(user), storeCode: user.store_code, username: user.username, name: user.name });
});

// Everything below is store-authenticated.
router.use(requireStoreUser);

router.get('/me', (req, res) => {
  const { store, ...u } = req.storeUser;
  res.json({
    ...u,
    store: {
      code: store.code, name: store.name, city: store.city, state: store.state,
      pincode: store.pincode, address: store.address_line_1, phone: store.contact,
      // The one thing that changes how staff work: do they bill this order themselves?
      posMode: store.posMode,
      relaysToPos: storeRelaysToPos(store.code),
    },
  });
});

router.post('/password', async (req, res) => {
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  if (next.length < 8) throw new ApiError('Choose a password of at least 8 characters');
  const user = await getOne('SELECT * FROM store_users WHERE id = $1', [req.storeUser.id]);
  if (!await checkPassword(current, user.password_hash)) throw new ApiError('Your current password is wrong');
  const ts = nowIso();
  await query('UPDATE store_users SET password_hash = $1, password_set_at = $2, updated_at = $2 WHERE id = $3',
    [await hashPassword(next), ts, user.id]);
  res.json({ ok: true });
});

/* ---------- Orders ---------- */

/*
 * One order, as a kitchen needs to read it.
 *
 * `pos` is the important field. For Begur it reports whether OUR relay reached Petpooja. Everywhere
 * else `manual: true` says the staff must key this into their own terminal and type the bill number
 * back, and `billNo` is whether they have. Nothing else in the system records that link.
 */
function serializeStoreOrder(order, items, address, posRow, relaysToPos) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    placedAt: order.created_at,
    status: order.order_status,
    paymentStatus: order.payment_status,
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    deliveryFee: order.delivery_fee,
    totalAmount: order.total_amount,
    couponCode: order.coupon_code,
    items: items.map((i) => ({
      id: i.id,
      name: i.product_name,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      totalPrice: i.total_price,
      selectedOptions: i.selected_options,
      specialNotes: i.special_notes,
      // The Petpooja code we hold for this product. It comes from the outlet Petpooja pushes us
      // (Begur), so at another store treat it as a hint for finding the item, not as that
      // terminal's code — search by name and check the price matches.
      posItemId: i.petpooja_item_id ?? null,
      posVariation: i.petpooja_variation_name ?? null,
    })),
    customer: address ? { name: address.full_name, phone: address.phone } : null,
    address: address ? {
      line1: address.address_line1, line2: address.address_line2,
      city: address.city, state: address.state, pincode: address.pincode,
      latitude: address.latitude, longitude: address.longitude,
      label: address.label || 'Home',
    } : null,
    delivery: {
      carrier: order.carrier,
      waybill: order.delhivery_waybill,
      shipmentId: order.delhivery_shipment_id,
      shipmentStatus: order.shipment_status,
      trackingUrl: order.tracking_url,
      // Why no rider was booked, if none was. The store cannot fix it, but it explains why nobody
      // is coming — without it they stand there with a packed bag waiting for a rider that was
      // never called. The admin gets told at the same time through Needs attention.
      shipmentError: order.shipment_error,
      estimatedDelivery: order.estimated_delivery,
    },
    pos: {
      manual: !relaysToPos,
      relayed: !!posRow?.relay_ok,
      petpoojaOrderId: posRow?.petpooja_order_id ?? null,
      lastError: posRow?.last_error ?? null,
      billNo: order.store_pos_bill_no ?? null,
    },
    workflow: {
      acceptedAt: order.store_accepted_at,
      acceptedBy: order.store_accepted_by,
      readyAt: order.store_ready_at,
    },
  };
}

/** Items for a set of orders, each carrying the Petpooja code mapped to its product. */
async function itemsForOrders(orderIds, restId) {
  if (!orderIds.length) return new Map();
  const rows = await getAll(
    `SELECT oi.*, pi.item_id AS petpooja_item_id, pi.variation_name AS petpooja_variation_name
       FROM order_items oi
       LEFT JOIN petpooja_items pi ON pi.product_id = oi.product_id AND pi.rest_id = $2
      WHERE oi.order_id = ANY($1) ORDER BY oi.id`,
    [orderIds, restId]
  );
  const byOrder = new Map();
  for (const r of rows) {
    if (!byOrder.has(r.order_id)) byOrder.set(r.order_id, []);
    byOrder.get(r.order_id).push(r);
  }
  return byOrder;
}

/*
 * GET /api/store/orders — this store's live board.
 *
 * Only PAID orders. An unpaid one is a shopper who did not finish checkout; baking it would give
 * away cookies, and it is precisely the case the admin failure-handling exists to catch.
 *
 * `pendingCount` drives the alert on the tablet, and it is derived from store_accepted_at rather
 * than anything the browser remembers. That matters on a shared terminal: a reload, a second
 * device, or a staff change must not make an unaccepted order stop announcing itself, and an order
 * one person has already accepted must not keep alarming at everyone else.
 */
router.get('/orders', async (req, res) => {
  const { storeCode, store } = req.storeUser;
  const restId = process.env.PETPOOJA_REST_ID || '';
  const relays = storeRelaysToPos(storeCode);

  // Default to the last 7 days — a counter tablet wants today's work, not the year's history.
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
  const since = new Date(Date.now() - days * 864e5).toISOString();

  const orders = await getAll(
    `SELECT * FROM orders
      WHERE store_code = $1 AND payment_status = 'PAID' AND created_at >= $2
      ORDER BY created_at DESC LIMIT 200`,
    [storeCode, since]
  );

  const ids = orders.map((o) => o.id);
  const addrIds = [...new Set(orders.map((o) => o.address_id).filter(Boolean))];
  const [itemsByOrder, addresses, posRows] = await Promise.all([
    itemsForOrders(ids, restId),
    addrIds.length ? getAll('SELECT * FROM addresses WHERE id = ANY($1)', [addrIds]) : [],
    ids.length ? getAll('SELECT order_id, relay_ok, petpooja_order_id, last_error FROM petpooja_orders WHERE order_id = ANY($1)', [ids]) : [],
  ]);
  const addrById = new Map(addresses.map((a) => [a.id, a]));
  const posByOrder = new Map(posRows.map((p) => [p.order_id, p]));

  const serialized = orders.map((o) => serializeStoreOrder(
    o, itemsByOrder.get(o.id) || [], o.address_id ? addrById.get(o.address_id) || null : null,
    posByOrder.get(o.id) || null, relays
  ));

  res.json({
    store: { code: store.code, name: store.name, posMode: store.posMode, relaysToPos: relays },
    orders: serialized,
    pendingCount: serialized.filter((o) => !o.workflow.acceptedAt && o.status !== 'CANCELLED').length,
    serverTime: nowIso(),
  });
});

/** One order in full. Scoped to the signed-in store — another store's id returns 404, not 403,
 *  so this cannot be used to probe which order numbers exist elsewhere. */
async function loadStoreOrder(req) {
  const order = await getOne('SELECT * FROM orders WHERE id = $1 AND store_code = $2',
    [Number(req.params.id), req.storeUser.storeCode]);
  if (!order) throw new ApiError('Order not found', 404);
  return order;
}

router.get('/orders/:id', async (req, res) => {
  const order = await loadStoreOrder(req);
  const restId = process.env.PETPOOJA_REST_ID || '';
  const items = (await itemsForOrders([order.id], restId)).get(order.id) || [];
  const address = order.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null;
  const pos = await getOne('SELECT relay_ok, petpooja_order_id, last_error FROM petpooja_orders WHERE order_id = $1', [order.id]);
  const timeline = await getAll('SELECT status, remarks, created_at FROM order_tracking WHERE order_id = $1 ORDER BY id', [order.id]);
  res.json({
    ...serializeStoreOrder(order, items, address, pos, storeRelaysToPos(req.storeUser.storeCode)),
    timeline,
  });
});

/*
 * Accept — "we have seen this and we are making it".
 *
 * Idempotent: a second tap from another terminal returns the existing acceptance rather than
 * overwriting who took it. Two people accepting the same order is a race worth losing gracefully.
 */
router.post('/orders/:id/accept', async (req, res) => {
  const order = await loadStoreOrder(req);
  if (order.order_status === 'CANCELLED') throw new ApiError('This order was cancelled — do not make it');
  if (order.store_accepted_at) return res.json({ ok: true, alreadyAccepted: true, acceptedAt: order.store_accepted_at });

  const ts = nowIso();
  await query('UPDATE orders SET store_accepted_at = $1, store_accepted_by = $2, updated_at = $1 WHERE id = $3',
    [ts, req.storeUser.id, order.id]);
  // PREPARING is the truthful status here and it is what the customer's order page shows.
  if (order.order_status === 'CONFIRMED' || order.order_status === 'PLACED') {
    await query('UPDATE orders SET order_status = $1 WHERE id = $2', ['PREPARING', order.id]);
  }
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'PREPARING', `Accepted at ${req.storeUser.store.name} by ${req.storeUser.username}`, ts]);
  res.json({ ok: true, acceptedAt: ts });
});

/*
 * Ready — baked, bagged, waiting for the rider.
 *
 * Stops at PACKED and goes no further. A store cannot mark an order delivered: the carrier reports
 * that through the tracking webhook, and letting a counter declare a delivery would let an order be
 * closed while the parcel is still sitting on the shelf.
 */
router.post('/orders/:id/ready', async (req, res) => {
  const order = await loadStoreOrder(req);
  if (order.order_status === 'CANCELLED') throw new ApiError('This order was cancelled');
  if (!order.store_accepted_at) throw new ApiError('Accept the order first');
  const ts = nowIso();
  await query('UPDATE orders SET store_ready_at = $1, order_status = $2, updated_at = $1 WHERE id = $3',
    [ts, 'PACKED', order.id]);
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'PACKED', `Ready for pickup at ${req.storeUser.store.name}`, ts]);
  res.json({ ok: true, readyAt: ts });
});

/*
 * The bill number from the store's own Petpooja terminal.
 *
 * For every outlet except Begur this is the whole point of the manual flow: without it there is no
 * link at all between what Razorpay settled and what the kitchen billed, and the day cannot be
 * reconciled. Recorded on the order and on the timeline so it survives in both places.
 */
router.post('/orders/:id/pos-bill', async (req, res) => {
  const order = await loadStoreOrder(req);
  const billNo = String(req.body?.billNo || '').trim().slice(0, 60);
  if (!billNo) throw new ApiError('Enter the bill number from your Petpooja terminal');
  const ts = nowIso();
  await query('UPDATE orders SET store_pos_bill_no = $1, updated_at = $2 WHERE id = $3', [billNo, ts, order.id]);
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'POS_BILLED_MANUALLY', `Billed on the ${req.storeUser.store.name} Petpooja terminal — bill ${billNo} (entered by ${req.storeUser.username})`, ts]);
  res.json({ ok: true, billNo });
});

/*
 * Live carrier + rider for one order.
 *
 * Read straight from the carrier rather than from our stored status: the store is looking at this
 * because they want to know where the rider is NOW, and our copy only moves when a webhook lands.
 */
router.get('/orders/:id/track', async (req, res) => {
  const order = await loadStoreOrder(req);
  if (!order.carrier) return res.json({ ok: false, reason: 'no_shipment', shipmentError: order.shipment_error });

  if (order.carrier === 'SHIPROCKET') {
    if (!shiprocketConfigured()) return res.json({ ok: false, reason: 'not_configured' });
    const t = await trackShiprocket(order.delhivery_shipment_id);
    if (!t.ok) return res.json({ ok: false, reason: t.reason });
    // The rider only exists once an AWB does — assignment is asynchronous, so "no rider yet" is a
    // normal state on a fresh order, not a fault.
    let rider = null;
    const awb = t.awb || order.delhivery_waybill;
    if (awb) {
      const r = await getRiderData(awb).catch(() => null);
      if (r?.ok && r.rider) {
        rider = { name: r.rider.rider_name || r.rider.name || null, phone: r.rider.rider_contact || r.rider.contact || null };
      }
    }
    return res.json({
      ok: true, carrier: 'SHIPROCKET', status: t.status, awb, courier: t.courierName,
      trackUrl: t.trackUrl, rider, activities: (t.activities || []).slice(0, 20),
    });
  }

  if (!delhiveryConfigured()) return res.json({ ok: false, reason: 'not_configured' });
  const t = await trackShipment(order.delhivery_waybill);
  if (!t.ok) return res.json({ ok: false, reason: t.reason });
  const shipment = t.data?.ShipmentData?.[0]?.Shipment;
  res.json({
    ok: true, carrier: 'DELHIVERY', status: shipment?.Status?.Status || null,
    awb: order.delhivery_waybill, trackUrl: order.tracking_url, rider: null,
    activities: (shipment?.Scans || []).slice(0, 20).map((s) => ({
      date: s.ScanDetail?.ScanDateTime, activity: s.ScanDetail?.Instructions || s.ScanDetail?.Scan,
    })),
  });
});

/*
 * GET /api/store/menu — what this store sells online, with the Petpooja code we hold for each.
 *
 * Staff use this two ways: to answer "do we have that" on the phone, and to find the right item
 * when keying an order into their terminal. Prices here are OUR web prices — the ones the customer
 * actually paid — so a mismatch against the POS price is worth noticing rather than hiding.
 */
router.get('/menu', async (_req, res) => {
  const restId = process.env.PETPOOJA_REST_ID || '';
  const rows = await getAll(
    `SELECT p.id, p.name, p.category, p.price, p.is_available, p.menu_group,
            pi.item_id AS pos_item_id, pi.variation_name AS pos_variation, pi.price AS pos_price, pi.in_stock AS pos_in_stock
       FROM products p
       LEFT JOIN petpooja_items pi ON pi.product_id = p.id AND pi.rest_id = $1
      ORDER BY p.menu_group NULLS LAST, p.name`,
    [restId]
  );
  res.json(rows.map((r) => ({
    id: r.id, name: r.name, category: r.category, menuGroup: r.menu_group,
    price: r.price, available: !!r.is_available,
    posItemId: r.pos_item_id, posVariation: r.pos_variation,
    posPrice: r.pos_price, posInStock: r.pos_in_stock,
  })));
});

export default router;
