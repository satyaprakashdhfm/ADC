import { Router } from 'express';
import { getOne, getAll, query, withTransaction, nowIso } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { serializeOrder, serializeOrderItem, serializeTracking, serializeAddress, PAYMENT_SELECT } from '../serializers.js';
import { getCartRow } from './cart.js';
import { validateCoupon, calculateDiscount } from './coupons.js';
import { sendOrderEmails } from '../mailer.js';
import { fetchWaybill, createShipment, trackShipment, delhiveryConfigured } from '../delhivery.js';
import { shadowfaxConfigured, createShadowfaxOrder, zoneStores, trackShadowfax, sfxStatusLabel, sfxStatusRank } from '../shadowfax.js';
import { razorpayConfigured, razorpayKeyId, createRazorpayOrder, verifyPaymentSignature } from '../razorpay.js';

const router = Router();
router.use(requireAuth);

// SFX_STORES + nearestStore (intracity pickup routing) live in ../shadowfax.js — shared with the
// checkout /delivery/check so both use the same store-zone logic.

// Auto-create a shipment once an order is PAID. Routes by DESTINATION PINCODE:
//   • pincode in a city where we have a store (Bengaluru 560xxx / Chennai 600xxx) → Shadowfax (intracity)
//   • anywhere else → Delhivery (out-of-city)
// If Shadowfax isn't configured/serviceable or the call fails, it falls back to Delhivery.
// Never throws — returns { ok, reason?, waybill?, carrier? }. Idempotent (skips if a waybill exists).
async function autoCreateShipment(orderId, addressArg) {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) { console.log(`[SHIPMENT] auto | order=${orderId} | skip=order_not_found`); return { ok: false, reason: 'order_not_found' }; }
  if (order.delhivery_waybill) { console.log(`[SHIPMENT] auto | order=${order.order_number} | skip=already_created (waybill=${order.delhivery_waybill})`); return { ok: true, waybill: order.delhivery_waybill }; }

  const address = addressArg || (order.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null);
  if (!address) { console.log(`[SHIPMENT] auto | order=${order.order_number} | skip=no_address`); return { ok: false, reason: 'no_address' }; }

  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
  const destPin = String(address.pincode || '').replace(/\D/g, '');
  const stores = zoneStores(destPin);

  // Routing decision — always logged so it's unambiguous in the terminal whether this order is
  // even eligible for Shadowfax, and if not, exactly why (no store in that pincode zone vs
  // Shadowfax not configured at all).
  console.log(`[SHIPMENT] routing | order=${order.order_number} | dest_pin=${destPin} | zone_stores=${stores.length} | shadowfax_configured=${shadowfaxConfigured()}`);
  if (!stores.length) console.log(`[SHIPMENT] routing | order=${order.order_number} | no ADC store in pincode zone ${destPin.slice(0, 3)}xx → Delhivery only`);
  else if (!shadowfaxConfigured()) console.log(`[SHIPMENT] routing | order=${order.order_number} | SHADOWFAX_URL/SHADOWFAX_API missing → Delhivery only`);

  // ---- Intracity → Shadowfax ----
  // The pickup/return store's pincode must ALSO be serviceable (not just the destination), so we
  // try each in-zone store nearest-first until Shadowfax accepts one. Only if none works do we
  // fall back to Delhivery.
  if (stores.length && shadowfaxConfigured()) {
    console.log(`[SHIPMENT] auto | order=${order.order_number} | intracity dest=${destPin} | trying Shadowfax pickups: ${stores.map(s => `${s.name}(${s.pincode})`).join(', ')}`);
    for (const pk of stores) {
      const r = await createShadowfaxOrder({ order, address, items, pickup: pk });
      if (r.ok) {
        await query(
          `UPDATE orders SET delhivery_waybill=$1, carrier='SHADOWFAX', shipment_status='CREATED', tracking_url=$2, label_generated=FALSE, updated_at=$3 WHERE id=$4`,
          [r.awb, `https://track.shadowfax.in/#/track/${r.awb}`, nowIso(), orderId]
        );
        console.log(`[SHIPMENT] auto | order=${order.order_number} | carrier=SHADOWFAX | pickup=${pk.name} | awb=${r.awb} | ok=true`);
        return { ok: true, waybill: r.awb, carrier: 'SHADOWFAX' };
      }
      console.log(`[SHIPMENT] auto | order=${order.order_number} | shadowfax pickup=${pk.name}(${pk.pincode}) failed=${r.reason}`);
    }
    console.log(`[SHIPMENT] auto | order=${order.order_number} | all Shadowfax pickups failed → Delhivery`);
  }

  // ---- Out-of-city (or Shadowfax unavailable) → Delhivery ----
  if (!delhiveryConfigured()) { console.log(`[SHIPMENT] auto | order=${order.order_number} | skip=delhivery_not_configured`); return { ok: false, reason: 'not_configured' }; }

  const defaultWh = await getOne('SELECT * FROM warehouses WHERE is_active = TRUE ORDER BY is_default DESC, id ASC LIMIT 1');
  if (!defaultWh) { console.log(`[SHIPMENT] auto | order=${order.order_number} | skip=no_active_warehouse`); return { ok: false, reason: 'no_warehouse' }; }

  const waybillRes = await fetchWaybill(1);
  if (!waybillRes.ok || !waybillRes.waybills?.length) {
    console.log(`[SHIPMENT] auto | order=${order.order_number} | waybill_fetch=FAILED | reason=${waybillRes.reason}`);
    return { ok: false, reason: `waybill_fetch:${waybillRes.reason}` };
  }
  const waybill = String(waybillRes.waybills[0]);

  const productsDesc = items.map(i => `${i.product_name} x${i.quantity}`).join(', ') || 'Cookies';
  const quantity = String(items.reduce((s, i) => s + i.quantity, 0) || 1);

  const shipmentData = {
    waybill,
    name: address.full_name || 'Customer',
    add: [address.address_line1, address.address_line2].filter(Boolean).join(', '),
    city: address.city,
    state: address.state || '',
    country: 'India',
    pin: address.pincode,
    phone: address.phone,
    order: order.order_number,
    payment_mode: 'Pre-paid',
    return_pin: defaultWh.return_pincode || defaultWh.pincode,
    return_city: defaultWh.city || '',
    return_phone: defaultWh.phone || '',
    return_name: defaultWh.name || '',
    return_add: [defaultWh.address_line1, defaultWh.address_line2].filter(Boolean).join(', ') || defaultWh.city || '',
    return_state: defaultWh.state || '',
    return_country: 'India',
    products_desc: productsDesc,
    hsn_code: '19053100',
    cod_amount: 0,
    order_date: order.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    total_amount: String(order.total_amount),
    seller_add: [defaultWh.address_line1, defaultWh.city].filter(Boolean).join(', '),
    seller_name: defaultWh.registered_name || defaultWh.name || '',
    seller_inv: order.order_number,
    quantity,
    shipment_width: 20,
    shipment_height: 10,
    weight: 0.5,
    seller_gst_tin: '',
    shipping_mode: 'Express',
    address_type: 'home',
  };

  console.log(`[SHIPMENT] auto | order=${order.order_number} | waybill=${waybill} | wh=${defaultWh.pickup_location} | dest=${address.pincode} | creating…`);
  const result = await createShipment(shipmentData, defaultWh.pickup_location);
  if (!result.ok) {
    console.log(`[SHIPMENT] auto | order=${order.order_number} | create=FAILED | reason=${result.reason} | detail=${JSON.stringify(result.detail || '').slice(0, 200)}`);
    return { ok: false, reason: result.reason };
  }

  await query(
    `UPDATE orders SET delhivery_waybill=$1, carrier='DELHIVERY', shipment_status='Manifested', tracking_url=$2, label_generated=TRUE, updated_at=$3 WHERE id=$4`,
    [result.waybill, `https://www.delhivery.com/track/package/${result.waybill}`, nowIso(), orderId]
  );
  console.log(`[SHIPMENT] auto | order=${order.order_number} | carrier=DELHIVERY | waybill=${result.waybill} | ok=true | label=ready | status=Manifested`);
  return { ok: true, waybill: result.waybill, carrier: 'DELHIVERY' };
}

// Mark a PAID order: record the payment, log tracking, and auto-create the Delhivery shipment.
// Idempotent — safe to call from BOTH the verify route and the webhook (whichever lands first).
export async function finalizePaidOrder(orderId, razorpayPaymentId) {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) return { ok: false, reason: 'order_not_found' };
  if (order.payment_status === 'PAID') return { ok: true, alreadyPaid: true };

  const ts = nowIso();
  await query(`UPDATE orders SET payment_status='PAID', order_status='CONFIRMED', updated_at=$1 WHERE id=$2`, [ts, orderId]);
  await query(
    `INSERT INTO payments (order_id, provider, transaction_id, amount, status, paid_at, created_at)
     VALUES ($1,'RAZORPAY',$2,$3,'PAID',$4,$5)`,
    [orderId, razorpayPaymentId ?? null, order.total_amount, ts, ts]
  );
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [orderId, 'CONFIRMED', 'Payment received via Razorpay', ts]);

  // Record coupon redemption now (on payment) — idempotent via the per-order check, so calling
  // finalizePaidOrder from both the verify route and the webhook can't double-count a use.
  if (order.coupon_code) {
    const already = await getOne('SELECT 1 FROM coupon_usage WHERE order_id = $1', [orderId]);
    if (!already) {
      const coupon = await getOne('SELECT id FROM coupons WHERE UPPER(code) = UPPER($1)', [order.coupon_code]);
      if (coupon) await query('INSERT INTO coupon_usage (coupon_id, user_id, order_id, used_at) VALUES ($1,$2,$3,$4)', [coupon.id, order.user_id, orderId, ts]);
    }
  }

  // Create the Delhivery shipment + label in the BACKGROUND so payment confirmation returns
  // to the shopper immediately (the carrier round-trip used to block the response ~5s).
  // A carrier hiccup can neither fail nor delay payment; the Razorpay webhook is a backstop
  // and the admin can also create the shipment manually from the Delivery tab.
  autoCreateShipment(orderId)
    .then((ship) => {
      if (ship?.ok && ship.waybill) {
        return query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
          [orderId, 'SHIPMENT_CREATED', `Delhivery waybill ${ship.waybill}`, nowIso()]);
      }
    })
    .catch((err) => console.error(`[SHIPMENT] background create failed | order=${orderId} | ${err?.message || err}`));

  return { ok: true };
}

async function userByEmail(email) {
  const user = await getOne('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) throw new ApiError('User not found');
  return user;
}

function pad(n) { return String(n).padStart(2, '0'); }
async function genOrderNumber() {
  const d = new Date();
  const base = 'ADC' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
    + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  let candidate = base, n = 0;
  while (await getOne('SELECT 1 FROM orders WHERE order_number = $1', [candidate])) {
    candidate = base + (++n);
  }
  return candidate;
}

async function fullOrder(orderId) {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [orderId]);
  const address = order.address_id
    ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id])
    : null;
  const payment = await getOne(PAYMENT_SELECT, [orderId]);
  return serializeOrder(order, items, address, payment);
}

router.post('/', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const { addressId, couponCode, items: bodyItems } = req.body || {};
  console.log(`[ORDER] create | user=${user?.id}(${req.user.email}) | addressId=${addressId} | items=${JSON.stringify((bodyItems || []).map(i => ({ p: i.productId, q: i.quantity })))}`);

  let lineItems;
  if (Array.isArray(bodyItems) && bodyItems.length > 0) {
    lineItems = await Promise.all(bodyItems.map(async (it) => {
      const product = await getOne('SELECT * FROM products WHERE id = $1', [it.productId]);
      if (!product) { console.log(`[ORDER] create | ✗ product_not_found=${it.productId}`); throw new ApiError(`Product not found: ${it.productId}`); }
      return { product, productName: product.name, quantity: it.quantity || 1, unitPrice: product.price,
               selectedOptions: it.selectedOptions ? JSON.stringify(it.selectedOptions) : null,
               specialNotes: it.specialNotes ?? null };
    }));
  } else {
    const cart = await getCartRow(req.user.email);
    const cartItems = await getAll('SELECT * FROM cart_items WHERE cart_id = $1', [cart.id]);
    if (cartItems.length === 0) { console.log(`[ORDER] create | ✗ cart_empty (no body items + empty server cart)`); throw new ApiError('Cart is empty'); }
    lineItems = await Promise.all(cartItems.map(async (ci) => {
      const product = await getOne('SELECT * FROM products WHERE id = $1', [ci.product_id]);
      return { product, productName: product ? product.name : 'Item', quantity: ci.quantity,
               unitPrice: ci.unit_price, selectedOptions: ci.selected_options, specialNotes: null };
    }));
  }

  // Scope the address to the caller so an order can never reference another user's address.
  const address = await getOne('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [addressId, user.id]);
  if (!address) { console.log(`[ORDER] create | ✗ address_not_found | addressId=${addressId} user=${user?.id}`); throw new ApiError('Address not found'); }

  const subtotal = lineItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  let discount = 0, coupon = null;
  if (couponCode && String(couponCode).trim()) {
    coupon = await validateCoupon(couponCode, subtotal);
    discount = calculateDiscount(coupon, subtotal);
  }

  const deliveryFee = subtotal > 0 ? 100 : 0;   // flat ₹100 delivery (matches the storefront)
  const total = subtotal - discount + deliveryFee;
  const ts = nowIso();
  const orderNumber = await genOrderNumber();

  const orderId = await withTransaction(async (client) => {
    const { rows: [order] } = await client.query(
      `INSERT INTO orders
         (order_number, user_id, address_id, subtotal, discount_amount, delivery_fee, tax_amount,
          total_amount, coupon_code, payment_status, order_status, shipment_status, label_generated,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING','PLACED','NOT_CREATED',FALSE,$10,$11) RETURNING id`,
      [orderNumber, user.id, address.id, subtotal, discount, deliveryFee, 0, total,
       couponCode ?? null, ts, ts]
    );
    const oid = order.id;
    for (const li of lineItems) {
      await client.query(
        `INSERT INTO order_items
           (order_id, product_id, product_name, quantity, unit_price, total_price, selected_options, special_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [oid, li.product?.id ?? null, li.productName, li.quantity,
         li.unitPrice, li.unitPrice * li.quantity, li.selectedOptions, li.specialNotes]
      );
    }
    await client.query(
      'INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [oid, 'PLACED', 'Order placed successfully', ts]
    );
    // NOTE: coupon redemption is recorded on PAYMENT success (finalizePaidOrder), not here —
    // an abandoned/unpaid order must not burn a coupon use.
    return oid;
  });

  const cart = await getOne('SELECT * FROM cart WHERE user_id = $1', [user.id]);
  if (cart) await query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);

  // Confirmation email to the customer + a copy to the business — fire-and-forget so order
  // placement returns immediately (two SMTP sends used to block the response). Best-effort.
  sendOrderEmails({
    orderNumber, subtotal, discount, deliveryFee, total,
    customerName: user.name, customerEmail: user.email,
    items: lineItems.map((li) => ({ name: li.productName, qty: li.quantity, total: li.unitPrice * li.quantity })),
    address,
  }).catch((err) => console.error(`[ORDER] email send failed | order=${orderNumber} | ${err?.message || err}`));

  // NOTE: the Delhivery shipment is created on payment success (see /:id/payment/verify),
  // not here — we only ship orders that are actually paid.
  res.json(await fullOrder(orderId));
});

router.get('/', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const rows = await getAll(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC, id DESC', [user.id]
  );
  const serialized = await Promise.all(rows.map(async (o) => {
    const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [o.id]);
    const address = o.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [o.address_id]) : null;
    const payment = await getOne(PAYMENT_SELECT, [o.id]);
    return serializeOrder(o, items, address, payment);
  }));
  res.json(serialized);
});

router.get('/:id', async (req, res) => {
  const user = await userByEmail(req.user.email);
  // Scope to the owner so one user can never read another's order.
  const order = await getOne('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!order) throw new ApiError('Order not found');
  res.json(await fullOrder(order.id));
});

router.get('/:id/tracking', async (req, res) => {
  const user = await userByEmail(req.user.email);
  // Only expose tracking for an order the caller owns.
  const order = await getOne('SELECT id FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!order) throw new ApiError('Order not found');
  const rows = await getAll(
    'SELECT * FROM order_tracking WHERE order_id = $1 ORDER BY created_at ASC, id ASC', [order.id]
  );
  res.json(rows.map(serializeTracking));
});

router.get('/:id/delhivery-track', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const order = await getOne('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!order) throw new ApiError('Order not found');
  if (!order.delhivery_waybill) return res.json({ tracked: false, reason: 'no_waybill' });

  // Intracity orders ship via Shadowfax — track them there, NOT Delhivery (the AWB lives in the
  // delhivery_waybill column for both carriers, so branch on `carrier`).
  if (order.carrier === 'SHADOWFAX') {
    // DEV/TEST ONLY: when SHADOWFAX_MOCK_TRACKING is set, don't hit Shadowfax's real API (whose
    // sandbox AWBs stay stuck at "new"). Instead reflect what the webhook has pushed into our DB —
    // shipment_status + the order_tracking timeline — so simulated status updates are visible in
    // Live tracking. Leave this env UNSET in production so real carrier tracking is used.
    if (process.env.SHADOWFAX_MOCK_TRACKING) {
      const rows = await getAll('SELECT status, remarks, created_at FROM order_tracking WHERE order_id = $1 ORDER BY created_at DESC, id DESC', [order.id]);
      const scans = rows.map(r => ({ time: r.created_at, event: r.status }));
      console.log(`[SHADOWFAX] track | MOCK | awb=${order.delhivery_waybill} | status="${order.shipment_status}"`);
      return res.json({ tracked: true, carrier: 'SHADOWFAX', waybill: order.delhivery_waybill, status: sfxStatusLabel(order.shipment_status) || order.shipment_status || null, trackUrl: null, scans });
    }
    if (!shadowfaxConfigured()) return res.json({ tracked: false, reason: 'shadowfax_not_configured' });
    const result = await trackShadowfax(order.delhivery_waybill);
    if (!result.ok) return res.json({ tracked: false, reason: result.reason });
    // Store the human label, and only when it ADVANCES the lifecycle — so a stale poll (e.g. staging
    // returning `new`) can't overwrite a status the webhook already moved forward.
    if (result.status && sfxStatusRank(result.status) > sfxStatusRank(order.shipment_status)) {
      await query('UPDATE orders SET shipment_status=$1, updated_at=$2 WHERE id=$3', [sfxStatusLabel(result.status), nowIso(), order.id]);
    }
    const scans = (result.data?.tracking_details || [])
      .map(t => ({ time: t.created, event: sfxStatusLabel(t.status_id) || t.status || t.remarks }))
      .reverse();
    return res.json({ tracked: true, carrier: 'SHADOWFAX', waybill: order.delhivery_waybill, status: sfxStatusLabel(result.status) || result.status || null, trackUrl: result.trackUrl || null, scans });
  }

  // Pan-India orders ship via Delhivery.
  const result = await trackShipment(order.delhivery_waybill);
  if (!result.ok) return res.json({ tracked: false, reason: result.reason });
  const pkg = Array.isArray(result.data?.ShipmentData) ? result.data.ShipmentData[0]?.Shipment : null;
  const latestStatus = pkg?.Status?.Status || null;
  if (latestStatus) {
    await query('UPDATE orders SET shipment_status=$1, updated_at=$2 WHERE id=$3', [latestStatus, nowIso(), order.id]);
  }
  const scans = (pkg?.Scans || [])
    .map(s => ({ time: s.ScanDetail?.ScanDateTime || '', event: [s.ScanDetail?.Scan, s.ScanDetail?.Instructions].filter(Boolean).join(' — ') }))
    .reverse();
  return res.json({ tracked: true, carrier: 'DELHIVERY', waybill: order.delhivery_waybill, status: latestStatus, scans, data: result.data });
});

// Step 1 of payment: create a Razorpay order for this DB order so Checkout can open.
// Returns the public key id + razorpay order id; the frontend opens the popup with these.
router.post('/:id/payment/razorpay-order', async (req, res) => {
  if (!razorpayConfigured()) { console.log(`[PAYMENT] rzp-order | order=${req.params.id} | ✗ not_configured`); throw new ApiError('Payments are not configured', 503); }
  const user = await userByEmail(req.user.email);
  const order = await getOne('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!order) { console.log(`[PAYMENT] rzp-order | order=${req.params.id} | ✗ order_not_found`); throw new ApiError('Order not found'); }
  if (order.payment_status === 'PAID') { console.log(`[PAYMENT] rzp-order | order=${order.order_number} | ✗ already_paid`); throw new ApiError('Order already paid', 409); }

  const amountPaise = Math.round(Number(order.total_amount) * 100);
  console.log(`[PAYMENT] rzp-order | order=${order.order_number} | amount=₹${order.total_amount} (${amountPaise}p) | creating…`);
  const r = await createRazorpayOrder({
    amountPaise, receipt: order.order_number,
    notes: { orderId: String(order.id), orderNumber: order.order_number },
  });
  if (!r.ok) { console.log(`[PAYMENT] rzp-order | order=${order.order_number} | ✗ ${r.reason}`); return res.status(502).json({ error: r.reason }); }

  await query('UPDATE orders SET razorpay_order_id = $1, updated_at = $2 WHERE id = $3', [r.order.id, nowIso(), order.id]);
  console.log(`[PAYMENT] rzp-order | order=${order.order_number} | ✓ ${r.order.id}`);
  res.json({
    keyId: razorpayKeyId(),
    orderId: r.order.id,
    amount: r.order.amount,
    currency: r.order.currency,
    orderNumber: order.order_number,
  });
});

// Step 2: verify the Checkout result and mark PAID. Razorpay must be configured and
// the signature MUST verify server-side — the frontend's word alone is never trusted.
router.post('/:id/payment/verify', async (req, res) => {
  const user = await userByEmail(req.user.email);
  // Scope to the owner so one user can never mark another's order as paid.
  const order = await getOne('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!order) { console.log(`[PAYMENT] verify | order=${req.params.id} | ✗ order_not_found`); throw new ApiError('Order not found'); }
  if (order.payment_status === 'PAID') { console.log(`[PAYMENT] verify | order=${order.order_number} | already_paid → ok`); return res.json(await fullOrder(order.id)); }

  const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body || {};
  console.log(`[PAYMENT] verify | order=${order.order_number} | payment=${razorpayPaymentId || 'none'} | rzpOrder=${razorpayOrderId || 'none'} | sig=${razorpaySignature ? 'present' : 'MISSING'}`);

  if (!razorpayConfigured()) {
    console.log(`[PAYMENT] verify | order=${order.order_number} | ✗ razorpay_not_configured`);
    throw new ApiError('Payments are temporarily unavailable. Please try again later.', 503);
  }
  if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
    console.log(`[PAYMENT] verify | order=${order.order_number} | ✗ missing_fields`);
    throw new ApiError('Missing payment confirmation fields', 400);
  }
  if (order.razorpay_order_id && order.razorpay_order_id !== razorpayOrderId) {
    console.log(`[PAYMENT] verify | order=${order.order_number} | ✗ order_mismatch | stored=${order.razorpay_order_id} got=${razorpayOrderId}`);
    throw new ApiError('Payment does not match this order', 400);
  }
  if (!verifyPaymentSignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature })) {
    console.log(`[PAYMENT] verify | order=${order.order_number} | ✗ bad_signature`);
    throw new ApiError('Payment signature verification failed', 400);
  }
  console.log(`[PAYMENT] verify | order=${order.order_number} | ✓ signature_ok → marking PAID`);

  await finalizePaidOrder(order.id, razorpayPaymentId);
  res.json(await fullOrder(order.id));
});

export default router;
