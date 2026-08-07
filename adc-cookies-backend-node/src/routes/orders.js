import { Router } from 'express';
import { getOne, getAll, query, withTransaction, nowIso } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { serializeOrder, serializeOrderItem, serializeTracking, serializeAddress, PAYMENT_SELECT } from '../serializers.js';
import { getCartRow } from './cart.js';
import { validateCoupon, calculateDiscount, getCouponByCode, resolveGiftProduct } from './coupons.js';
import { sendOrderEmails } from '../mailer.js';
import { fetchWaybill, createShipment, trackShipment, delhiveryConfigured } from '../delhivery.js';
import { zoneStores, nearestStoreToCoords, orderStoresByProximity } from '../stores.js';
import { shiprocketConfigured, createHyperlocalOrder, assignAwb, trackShiprocket, pickServiceableStore } from '../shiprocket.js';
import { razorpayConfigured, razorpayKeyId, createRazorpayOrder, verifyPaymentSignature, fetchPayment, fetchOrderPayments } from '../razorpay.js';
import { relayOrder, cancelOrder as petpoojaCancelOrder } from '../petpooja.js';

const router = Router();
router.use(requireAuth);

// The store list + nearestStore (intracity pickup routing) live in ../stores.js — shared with the
// checkout /delivery/check so both use the same store-zone logic.

// Kill switch: flip this and intracity stops being offered (it is never sent to a slower courier).
const SHIPROCKET_DISABLED = process.env.SHIPROCKET_DISABLED === 'true';

// Auto-create a shipment once an order is PAID. Routes by DESTINATION PINCODE:
//   • pincode in a city where we have a store (Bengaluru 560xxx / Chennai 600xxx) → Shadowfax (intracity)
//   • anywhere else → Delhivery (out-of-city)
// If Shadowfax isn't configured/serviceable or the call fails, it falls back to Delhivery.
// Never throws — returns { ok, reason?, waybill?, carrier? }. Idempotent (skips if a waybill exists).
//
// Every failure is PERSISTED (orders.shipment_error + a SHIPMENT_FAILED tracking row), not just
// logged. The money is already taken by the time this runs, so "paid but never shipped" has to be
// visible in the admin dashboard rather than buried in a Railway log line nobody reads.
export async function autoCreateShipment(orderId, addressArg) {
  const r = await attemptShipment(orderId, addressArg);
  if (r.ok) {
    // Clear any error left from an earlier failed attempt — this one succeeded.
    await query('UPDATE orders SET shipment_error = NULL WHERE id = $1', [orderId]).catch(() => {});
  } else if (r.reason !== 'order_not_found') {
    await query('UPDATE orders SET shipment_error = $1, updated_at = $2 WHERE id = $3',
      [String(r.reason).slice(0, 500), nowIso(), orderId]).catch(() => {});
    await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [orderId, 'SHIPMENT_FAILED', `Could not book a courier: ${String(r.reason).slice(0, 400)}`, nowIso()]).catch(() => {});
  }
  return r;
}

async function attemptShipment(orderId, addressArg) {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) { console.log(`[SHIPMENT] auto | order=${orderId} | skip=order_not_found`); return { ok: false, reason: 'order_not_found' }; }
  if (order.delhivery_waybill) { console.log(`[SHIPMENT] auto | order=${order.order_number} | skip=already_created (waybill=${order.delhivery_waybill})`); return { ok: true, waybill: order.delhivery_waybill }; }

  const address = addressArg || (order.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null);
  if (!address) { console.log(`[SHIPMENT] auto | order=${order.order_number} | skip=no_address`); return { ok: false, reason: 'no_address' }; }

  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
  const destPin = String(address.pincode || '').replace(/\D/g, '');
  const stores = zoneStores(destPin);

  // Routing decision — always logged so it is unambiguous in the terminal whether this order is
  // even eligible for intracity, and if not, exactly why (no store in that pincode zone, versus
  // Shiprocket not configured at all).
  console.log(`[SHIPMENT] routing | order=${order.order_number} | dest_pin=${destPin} | zone_stores=${stores.length} | shiprocket_configured=${shiprocketConfigured()} | shiprocket_disabled=${SHIPROCKET_DISABLED}`);
  if (!stores.length) console.log(`[SHIPMENT] routing | order=${order.order_number} | no ADC store in pincode zone ${destPin.slice(0, 3)}xx → Delhivery only`);
  else if (!shiprocketConfigured()) console.log(`[SHIPMENT] routing | order=${order.order_number} | SHIPROCKET_EMAIL/PASSWORD missing → Delhivery only`);

  /* ---- Intracity → Shiprocket Hyperlocal ----
   *
   * Replaces Shadowfax, which never assigned a rider in any live test. Proven end to end on
   * 2026-08-01: Green Field Layout -> Kadugodi, 10.61 km, Rapido rider, delivered in ~73 min.
   *
   * Three steps, all needed: create the order, assign the AWB, then read the AWB back. Assignment
   * is ASYNCHRONOUS — it returns "We are processing your request" with no AWB while they search for
   * a rider — so the AWB is recovered by polling rather than from the assign response.
   *
   * Hyperlocal needs coordinates on the delivery address. Without them we fall through to Delhivery
   * instead of failing: a slower shipment beats no shipment on an order already paid for.
   */
  if (stores.length && shiprocketConfigured() && !SHIPROCKET_DISABLED) {
    if (address.latitude == null || address.longitude == null) {
      // NEVER Delhivery. This order was sold as same-day, ~1 hour, from a nearby store. Handing it
      // to a multi-day courier would silently turn the promise the customer paid for into something
      // else entirely — worse than not booking at all. Leave it unbooked and let the admin
      // "Needs attention" list surface it so a person decides what to do.
      return { ok: false, reason: 'intracity_no_coordinates: address has no lat/long, so the same-day carrier cannot be quoted. Add coordinates to the address, then re-book.' };
    } else {
      /*
       * Nearest store the carrier can ACTUALLY serve.
       *
       * Sorting by distance to the customer is right — the rider's journey is what the delivery
       * costs — but nearest is not the same as serviceable. Measured live: a Kadugodi drop is
       * serviceable from Begur at 18.69 km yet not from S.G. Palya at 17.59 km. So we quote each in
       * order and take the first that answers, rather than picking one and hoping.
       */
      const ordered = orderStoresByProximity(stores, address.latitude, address.longitude);
      const chosen = await pickServiceableStore(ordered, { pin: destPin, lat: address.latitude, lng: address.longitude });
      if (!chosen) {
        // Same rule as above: no Delhivery for an order sold as same-day. Fails visibly instead.
        console.log(`[SHIPMENT] auto | order=${order.order_number} | ✗ no verified ADC store can serve ${destPin} — NOT falling back to Delhivery`);
        return { ok: false, reason: `intracity_unserviceable: no verified store can reach ${destPin} on the same-day carrier. Verify a nearer pickup location in the Shiprocket panel, then re-book.` };
      } else {
      const pickup = chosen.store;
      console.log(`[SHIPMENT] auto | order=${order.order_number} | intracity dest=${destPin} | store=${pickup.name} | ₹${chosen.rate} | ${chosen.distance} km`);
      const created = await createHyperlocalOrder({
        order, items,
        customer: { name: address.full_name, phone: address.phone, email: null },
        address,
        // Falls back to the configured default when this store has no registered pickup nickname —
        // Shiprocket collects from the nickname, so an unregistered store cannot be a pickup point.
        pickupLocation: pickup.pickupName || undefined,
      });
      if (created.ok) {
        const assigned = await assignAwb(created.shipmentId, { vehicleType: 2 });
        // A pending assignment is a success, not a failure — the rider search is under way.
        const track = assigned.ok ? await trackShiprocket(created.shipmentId) : null;
        const awb = assigned.awb || track?.awb || null;
        await query(
          `UPDATE orders SET delhivery_waybill=$1, delhivery_shipment_id=$2, carrier='SHIPROCKET',
                  carrier_order_id=$3, shipment_status=$4, tracking_url=$5, label_generated=FALSE,
                  updated_at=$6 WHERE id=$7`,
          // carrier_order_id is Shiprocket's own order id — their cancel API keys off it, not the
          // shipment id, so it has to be kept or the order can never be cancelled with them.
          [awb, String(created.shipmentId), created.srOrderId != null ? String(created.srOrderId) : null,
           track?.status || 'CREATED', awb ? `https://shiprocket.co/tracking/${awb}` : null, nowIso(), orderId]
        );
        console.log(`[SHIPMENT] auto | order=${order.order_number} | carrier=SHIPROCKET | shipment=${created.shipmentId} | sr_order=${created.srOrderId || '?'} | awb=${awb || 'pending'}`);
        return { ok: true, waybill: awb, shipmentId: created.shipmentId, carrier: 'SHIPROCKET' };
      }
      console.log(`[SHIPMENT] auto | order=${order.order_number} | ✗ shiprocket refused=${JSON.stringify(created.reason).slice(0, 120)} — NOT falling back to Delhivery`);
      return { ok: false, reason: `intracity_booking_refused: ${JSON.stringify(created.reason).slice(0, 300)}` };
      }
    }
  }

  /*
   * Reaching here means the destination is NOT in a store zone, or the same-day carrier is switched
   * off entirely. Delhivery is the right answer for out-of-town, and it is the only path that can
   * get here — every intracity branch above returns rather than falling through, so a same-day order
   * can never quietly become a multi-day parcel.
   */
  if (stores.length && SHIPROCKET_DISABLED) {
    return { ok: false, reason: 'intracity_disabled: SHIPROCKET_DISABLED is set, so same-day cannot be booked. This order must not ship by multi-day courier — cancel and refund, or clear the flag and re-book.' };
  }
  if (stores.length && !shiprocketConfigured()) {
    return { ok: false, reason: 'intracity_not_configured: the same-day carrier has no credentials on this environment, so this order cannot be booked as sold.' };
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
    `UPDATE orders SET delhivery_waybill=$1, carrier='DELHIVERY', shipment_status='CREATED', tracking_url=$2, label_generated=TRUE, updated_at=$3 WHERE id=$4`,
    [result.waybill, `https://www.delhivery.com/track/package/${result.waybill}`, nowIso(), orderId]
  );
  console.log(`[SHIPMENT] auto | order=${order.order_number} | carrier=DELHIVERY | waybill=${result.waybill} | ok=true | label=ready`);
  return { ok: true, waybill: result.waybill, carrier: 'DELHIVERY' };
}

// Mark a PAID order: record the payment, log tracking, and auto-create the Delhivery shipment.
// Idempotent — safe to call from BOTH the verify route and the webhook (whichever lands first).
// `paymentEntity` is Razorpay's payment object (from fetchPayment or the webhook payload) —
// optional, but when present we pull the platform fee/tax/method/instrument details out of it
// so that data isn't only visible in the Razorpay dashboard.
export async function finalizePaidOrder(orderId, razorpayPaymentId, paymentEntity) {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) return { ok: false, reason: 'order_not_found' };
  if (order.payment_status === 'PAID') return { ok: true, alreadyPaid: true };

  const ts = nowIso();
  const p = paymentEntity || {};
  const razorpayFee = p.fee != null ? p.fee / 100 : null;
  const razorpayTax = p.tax != null ? p.tax / 100 : null;
  const method = p.method ?? null;
  const cardNetwork = p.card?.network ?? null;
  const cardLast4 = p.card?.last4 ?? null;
  const vpa = p.vpa ?? null;
  const bank = p.bank ?? null;

  await query(`UPDATE orders SET payment_status='PAID', order_status='CONFIRMED', updated_at=$1 WHERE id=$2`, [ts, orderId]);
  await query(
    `INSERT INTO payments (order_id, provider, transaction_id, amount, status, paid_at, created_at, razorpay_fee, razorpay_tax, method, card_network, card_last4, vpa, bank)
     VALUES ($1,'RAZORPAY',$2,$3,'PAID',$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [orderId, razorpayPaymentId ?? null, order.total_amount, ts, ts, razorpayFee, razorpayTax, method, cardNetwork, cardLast4, vpa, bank]
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
          [orderId, 'SHIPMENT_CREATED', `${ship.carrier || 'Carrier'} waybill ${ship.waybill}`, nowIso()]);
      }
    })
    .catch((err) => console.error(`[SHIPMENT] background create failed | order=${orderId} | ${err?.message || err}`))
    // Relay to the POS only AFTER the shipment attempt, so the courier fee on the bill is the real
    // one. Deliberately chained rather than run in parallel, and deliberately last: the money is
    // taken and the parcel is booked by this point, so a POS problem must never fail either. It
    // records itself in petpooja_orders for the admin to retry.
    .finally(() => relayOrder(orderId).catch(() => {}));

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
    const rawCoupon = await getCouponByCode(couponCode);
    const giftProduct = rawCoupon ? await resolveGiftProduct(rawCoupon, user.id) : null;
    coupon = await validateCoupon(couponCode, subtotal, giftProduct ? Number(giftProduct.price) : 0, user.id);
    // A "free item" reward only makes sense if that item is actually in the order — the
    // frontend auto-adds it the moment the coupon is applied, so this only fires if it was
    // removed afterwards (or the request was tampered with).
    if (giftProduct && !lineItems.some(li => li.product?.id === giftProduct.id && li.quantity >= 1)) {
      throw new ApiError(`Add "${giftProduct.name}" to your cart to use this reward.`);
    }
    discount = calculateDiscount(coupon, subtotal, giftProduct);
  }

  // Intra-city orders (a pincode inside one of our store zones → same-day Shadowfax) ship FREE;
  // everywhere else is the flat courier fee. Mirrors the storefront bill. Both amounts are
  // env-overridable (DELIVERY_FEE_INTRACITY / DELIVERY_FEE_OUTSTATION) so a test environment can
  // set them to ₹1 for cheap live testing; production keeps the real defaults (0 / 100).
  const feeIntracity = Number(process.env.DELIVERY_FEE_INTRACITY ?? 0);
  const feeOutstation = Number(process.env.DELIVERY_FEE_OUTSTATION ?? 100);
  const intracity = zoneStores(String(address.pincode || '').replace(/\D/g, '')).length > 0;
  // Intracity is OPEN again — Shiprocket Hyperlocal replaced Shadowfax and is proven end to end
  // (real Rapido rider, delivered in ~73 min). The old Shadowfax block that rejected these orders
  // is gone; SHIPROCKET_DISABLED remains as the kill switch if that carrier ever needs pausing.
  if (intracity && SHIPROCKET_DISABLED) {
    throw new ApiError('Same-day delivery is temporarily unavailable. Please try again shortly.', 503);
  }
  const deliveryFee = subtotal > 0 ? (intracity ? feeIntracity : feeOutstation) : 0;
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

  // Pan-India orders ship via Delhivery.
  const result = await trackShipment(order.delhivery_waybill);
  if (!result.ok) return res.json({ tracked: false, reason: result.reason });
  const pkg = Array.isArray(result.data?.ShipmentData) ? result.data.ShipmentData[0]?.Shipment : null;
  // Status.Status alone is a terse word ("Manifested"); Status.Instructions is Delhivery's own
  // human-readable detail for the same event ("Pickup not attempted") — join them like the Scans
  // list below already does, so the customer sees more than a bare status word when one exists.
  const latestStatus = [pkg?.Status?.Status, pkg?.Status?.Instructions].filter(Boolean).join(' — ') || null;
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
  console.log(`[PAYMENT] verify | order=${order.order_number} | ✓ signature_ok`);

  // Razorpay's Third Party Validation best practice: don't just trust the signature — confirm
  // the payment's actual status and amount server-side via a direct API call before providing
  // services. The signature only proves the fields weren't tampered with in transit; this
  // proves the payment is genuinely `captured` (not `authorized`/`failed`) for the right amount.
  const pf = await fetchPayment(razorpayPaymentId);
  if (!pf.ok) {
    console.log(`[PAYMENT] verify | order=${order.order_number} | ✗ could not confirm status with Razorpay: ${pf.reason}`);
    throw new ApiError('Could not confirm your payment status with Razorpay. Please contact us with your order number.', 502);
  }
  if (pf.payment.status !== 'captured') {
    console.log(`[PAYMENT] verify | order=${order.order_number} | ✗ status=${pf.payment.status} (not captured)`);
    throw new ApiError(`Payment is not yet captured (status: ${pf.payment.status}). Please contact us if money was deducted.`, 402);
  }
  const expectedPaise = Math.round(Number(order.total_amount) * 100);
  if (pf.payment.order_id !== razorpayOrderId || Number(pf.payment.amount) !== expectedPaise) {
    console.log(`[PAYMENT] verify | order=${order.order_number} | ✗ amount/order mismatch | expected order=${razorpayOrderId} amount=${expectedPaise} | got order=${pf.payment.order_id} amount=${pf.payment.amount}`);
    throw new ApiError('Payment details do not match this order. Please contact us.', 400);
  }
  console.log(`[PAYMENT] verify | order=${order.order_number} | ✓ status_confirmed_captured → marking PAID`);

  await finalizePaidOrder(order.id, razorpayPaymentId, pf.payment);
  await checkForDuplicateCharge(order, razorpayOrderId);
  res.json(await fullOrder(order.id));
});

// Fetch every payment attempt against the Razorpay order and flag it for admin review if more
// than one actually got CAPTURED (a rare double-charge from a race condition/retry). Never
// blocks or reverses anything automatically — just makes it visible instead of invisible.
async function checkForDuplicateCharge(order, razorpayOrderId) {
  const op = await fetchOrderPayments(razorpayOrderId);
  if (!op.ok) return;
  const capturedCount = op.items.filter((p) => p.status === 'captured').length;
  if (capturedCount > 1) {
    console.log(`[PAYMENT] verify | order=${order.order_number} | ⚠ DUPLICATE CHARGE — ${capturedCount} captured payments against this Razorpay order`);
    await query(
      'INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [order.id, 'DUPLICATE_CHARGE_WARNING', `⚠ ${capturedCount} captured payments found against this order — possible duplicate charge, review in Razorpay dashboard`, nowIso()]
    );
  }
}

// Public — Razorpay's redirect callback for browsers that can't run the iframe/popup Checkout
// flow (Instagram/Facebook Messenger in-app browser, Opera Mini, UC Browser). Checkout submits
// razorpay_payment_id/order_id/signature as a browser FORM POST (not a server-to-server call,
// so this works in local dev too — it's the customer's own browser navigating here, same as
// clicking a link). Mounted directly on `app` in server.js (NOT this router) so it bypasses
// `requireAuth` — Razorpay's redirect carries no Bearer token.
function isAllowedReturnOrigin(url) {
  try {
    const u = new URL(url);
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    return allowed.includes(u.origin) || /^https?:\/\/localhost(:\d+)?$/.test(u.origin);
  } catch { return false; }
}

export async function paymentCallback(req, res) {
  const orderId = req.params.orderId;
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};
  const returnParam = String(req.query.return || '');
  const returnBase = isAllowedReturnOrigin(returnParam) ? returnParam.replace(/\/$/, '') : '';

  const fail = (reason) => {
    console.log(`[PAYMENT] callback | order=${orderId} | ✗ ${reason}`);
    res.redirect(303, `${returnBase}/checkout?payment=failed`);
  };

  const order = await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) return fail('order_not_found');
  if (order.payment_status === 'PAID') {
    return res.redirect(303, `${returnBase}/account?payment=success&order=${encodeURIComponent(order.order_number)}`);
  }
  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) return fail('missing_fields');
  if (order.razorpay_order_id && order.razorpay_order_id !== razorpay_order_id) return fail('order_mismatch');
  if (!verifyPaymentSignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature })) return fail('bad_signature');

  const pf = await fetchPayment(razorpay_payment_id);
  if (!pf.ok || pf.payment.status !== 'captured') return fail(`not_captured (${pf.ok ? pf.payment.status : pf.reason})`);
  const expectedPaise = Math.round(Number(order.total_amount) * 100);
  if (pf.payment.order_id !== razorpay_order_id || Number(pf.payment.amount) !== expectedPaise) return fail('amount_mismatch');

  await finalizePaidOrder(order.id, razorpay_payment_id, pf.payment);
  await checkForDuplicateCharge(order, razorpay_order_id);
  console.log(`[PAYMENT] callback | order=${order.order_number} | ✓ marked PAID via redirect callback`);
  res.redirect(303, `${returnBase}/account?payment=success&order=${encodeURIComponent(order.order_number)}`);
}

export default router;
