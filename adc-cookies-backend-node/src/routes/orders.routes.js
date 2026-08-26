import { Router } from 'express';
import { getOne, getAll, query, withTransaction, nowIso } from '../db/index.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeOrder, serializeOrderItem, serializeTracking, serializeAddress, PAYMENT_SELECT } from '../serializers/index.js';
import { getCartRow } from '../services/cart.service.js';
import { validateCoupon, calculateDiscount, getCouponByCode, resolveGiftProduct } from '../services/coupon.service.js';
import { sendOrderEmails } from '../services/mailer.client.js';
import { fetchWaybill, createShipment, trackShipment, delhiveryConfigured } from '../services/delhivery.client.js';
import { zoneStores, activeZoneStores, orderStoresByProximity, storeForAddress, intercityStoreForAddress, storeByCode, deliveryEligible, isStoreActive, intercityOpen, storeBlockedProductIds } from '../services/store.service.js';
import { shiprocketConfigured, createHyperlocalOrder, assignAwb, trackShiprocket, pickServiceableStore, getWalletBalance } from '../services/shiprocket.client.js';
import { razorpayConfigured, razorpayKeyId, createRazorpayOrder, verifyPaymentSignature, fetchPayment, fetchOrderPayments } from '../services/razorpay.client.js';
import { relayOrder, cancelOrder as petpoojaCancelOrder } from '../services/petpooja.service.js';
import { applyCarrierTerminalStatus, bookingNote } from '../services/orderProgress.service.js';
import { isPackProduct, validatePackPicks } from '../services/pack.service.js';
import { userByEmail } from '../services/user.service.js';

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
      // NEVER Delhivery. This order was sold as same-day, from a nearby store. Handing it
      // to a multi-day courier would silently turn the promise the customer paid for into something
      // else entirely — worse than not booking at all. Leave it unbooked and let the admin
      // "Needs attention" list surface it so a person decides what to do.
      return { ok: false, reason: 'intracity_no_coordinates: address has no lat/long, so the same-day carrier cannot be quoted. Add coordinates to the address, then re-book.' };
    } else {
      /*
       * Book from the store ALREADY ON THE ORDER — never a different one.
       *
       * store_code is decided ONCE, at order creation (storeForAddress), and stays fixed from then
       * on: for a MANUAL store this is the kitchen that has (or is about to) physically bake the
       * order, so the rider has to collect from THERE, not from whichever zone store merely turns
       * out to be Shiprocket-serviceable for this address.
       *
       * This used to try every zone store nearest-first and silently move store_code to whichever
       * one answered (a Kadugodi drop was serviceable from Begur at 18.69 km but not from S.G. Palya
       * at 17.59 km, for instance). That was tolerable while booking always ran within seconds of
       * payment, before any human had seen the order — but it became actively dangerous once a
       * MANUAL store's booking moved to Accept time: by then staff have already committed to making
       * it, and moving the pickup point after that sends a rider to a kitchen holding nothing while
       * the real food sits uncollected. So this store is not swapped: it either works or it fails
       * visibly, and a human (admin, or the store re-registering their Shiprocket pickup) fixes it.
       */
      const assignedStore = storeByCode(order.store_code);
      if (!assignedStore) {
        console.log(`[SHIPMENT] auto | order=${order.order_number} | ✗ store_code "${order.store_code}" is not a known store`);
        return { ok: false, reason: `intracity_store_missing: order.store_code (${order.store_code}) is not a known store.` };
      }
      const chosen = await pickServiceableStore([assignedStore], { pin: destPin, lat: address.latitude, lng: address.longitude });
      if (!chosen) {
        // Same rule as above: no Delhivery for an order sold as same-day. Fails visibly instead.
        console.log(`[SHIPMENT] auto | order=${order.order_number} | ✗ ${assignedStore.name} cannot serve ${destPin} — NOT rerouting to a different store, NOT falling back to Delhivery`);
        return { ok: false, reason: `intracity_unserviceable: ${assignedStore.name} — the store already holding this order — cannot reach ${destPin} on the same-day carrier. Check its Shiprocket pickup registration, or contact the customer; it will not be silently moved to a different store.` };
      } else {
      const pickup = chosen.store; // always === assignedStore
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
        const track = assigned.ok ? await trackShiprocket(created.shipmentId, created.srOrderId) : null;
        const awb = assigned.awb || track?.awb || null;
        /* A REFUSED assignment is not the same thing, and used to be stored as though it were.
         *
         * Both landed on shipment_status 'CREATED' with shipment_error left null, so an order
         * Shiprocket had declined — an empty wallet is the common one — was indistinguishable from
         * one where the rider search was genuinely under way. The shop was told "searching for a
         * rider" about an order nobody was ever coming for, and the only place the truth existed
         * was the Shiprocket panel showing an unpaid "Ship Now".
         *
         * The reason is recorded now. The store portal and the admin's Needs-attention list both
         * already read this column; neither had anything to read. */
        /* On refusal, say what the wallet held at that moment.
         *
         * Assigning a rider draws on the Shiprocket wallet, and an empty one is by far the most
         * common reason for a refusal — but the carrier's own message rarely says so plainly. Whoever
         * reads this later needs to know whether to top up or to investigate, and that difference is
         * one number. Looked up only on the failure path, so the happy path costs nothing. */
        let assignError = null;
        if (!assigned.ok) {
          const reason = String(typeof assigned.reason === 'string' ? assigned.reason : JSON.stringify(assigned.reason ?? 'Carrier refused the booking'));
          const balance = await getWalletBalance().catch(() => null);
          assignError = (balance == null ? reason : `${reason} (Shiprocket wallet: ₹${balance})`).slice(0, 300);
        }
        await query(
          `UPDATE orders SET delhivery_waybill=$1, delhivery_shipment_id=$2, carrier='SHIPROCKET',
                  carrier_order_id=$3, shipment_status=$4, tracking_url=$5, label_generated=FALSE,
                  shipment_error=$6, updated_at=$7 WHERE id=$8`,
          // carrier_order_id is Shiprocket's own order id — their cancel API keys off it, not the
          // shipment id, so it has to be kept or the order can never be cancelled with them.
          [awb, String(created.shipmentId), created.srOrderId != null ? String(created.srOrderId) : null,
           track?.status || 'CREATED', awb ? `https://shiprocket.co/tracking/${awb}` : null,
           assignError, nowIso(), orderId]
        );
        if (assignError) {
          console.log(`[SHIPMENT] auto | order=${order.order_number} | ✗ awb_assign_refused | ${assignError}`);
        }
        console.log(`[SHIPMENT] auto | order=${order.order_number} | carrier=SHIPROCKET | shipment=${created.shipmentId} | sr_order=${created.srOrderId || '?'} | awb=${awb || (assignError ? 'REFUSED' : 'pending')}`);
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

  /*
   * Claim the order atomically — the row decides who won, not the read above.
   *
   * The `payment_status === 'PAID'` check at the top of this function is a cheap short-circuit, not
   * a lock: it READS the status and this UPDATE WRITES it, and Razorpay sends `payment.captured`
   * and `order.paid` milliseconds apart. Both read "not paid", both proceeded, and the order got
   * two of everything — two CONFIRMED rows, two AWAITING_STORE_ACCEPT rows, two shipment attempts.
   * Seen on a real order: the webhook logged "marked PAID + shipment" twice, one second apart.
   *
   * Making the TRANSITION the contended thing rather than the read before it means exactly one
   * caller gets a row back; everyone else stops here having changed nothing.
   */
  const claim = await query(
    `UPDATE orders SET payment_status='PAID', order_status='CONFIRMED', updated_at=$1
      WHERE id=$2 AND payment_status IS DISTINCT FROM 'PAID' RETURNING id`,
    [ts, orderId]
  );
  if (claim.rowCount === 0) {
    console.log(`[PAYMENT] finalize | order=${order.order_number} | already_paid (lost the race, nothing written)`);
    return { ok: true, alreadyPaid: true };
  }

  /* A payment can land on an order we had already given up on — a shopper who closed the window and
     paid on a second device, a webhook arriving after an abandon, a retry that raced us. Money
     arriving outranks our assumption that none would, so the order comes back. Said out loud in the
     history, because "cancelled: payment not completed" followed by "confirmed" reads like a
     contradiction otherwise, and this is the line that explains it. */
  if (order.order_status === 'CANCELLED' || order.payment_status === 'CANCELLED') {
    await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [orderId, 'PAYMENT_RECEIVED_AFTER_CANCEL', 'Payment arrived after this order was closed as unpaid — reinstating it.', ts]).catch(() => {});
    console.log(`[PAYMENT] finalize | order=${order.order_number} | ⚠ was CANCELLED, reinstating on a real payment`);
  }
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

  /*
   * Booking the courier is gated on WHO fulfils the order, decided at creation (store_code, set by
   * storeForAddress — zone/proximity only, no carrier call, so it's known immediately):
   *
   *   AUTO (Begur)   — the one outlet we relay to Petpooja ourselves and the only one with no manual
   *                    accept step. Book the same-day rider right away, exactly as before.
   *   MANUAL (every  — staff key the order into their OWN Petpooja terminal and hand it to whichever
   *   other store)     rider Shiprocket sends round; nothing here calls their kitchen a customer. A
   *                    same-day order booked before a human at that shop has even seen it is a rider
   *                    promise nobody there agreed to yet. So for these we leave the shipment
   *                    unbooked — order_tracking gets a row saying so, and the customer's "what's
   *                    next" copy reads it via order.store.acceptedAt — and POST /store/orders/:id/
   *                    accept books it the moment a real person there taps Accept.
   */
  /* The confirmation, now that there is something to confirm. Fire-and-forget: the money is taken
     and the row is already PAID, so a mail failure must not surface as a failed payment. Only the
     caller that won the claim above reaches this line, so it cannot be sent twice. */
  (async () => {
    const buyer = await getOne('SELECT name, email FROM users WHERE id = $1', [order.user_id]);
    if (!buyer?.email) return;
    const [mailItems, mailAddress] = await Promise.all([
      getAll('SELECT product_name, quantity, total_price FROM order_items WHERE order_id = $1 ORDER BY id', [orderId]),
      order.address_id ? getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null,
    ]);
    await sendOrderEmails({
      orderNumber: order.order_number,
      subtotal: Number(order.subtotal) || 0,
      discount: Number(order.discount_amount) || 0,
      deliveryFee: Number(order.delivery_fee) || 0,
      total: Number(order.total_amount) || 0,
      customerName: buyer.name, customerEmail: buyer.email,
      items: mailItems.map((i) => ({ name: i.product_name, qty: i.quantity, total: Number(i.total_price) || 0 })),
      address: mailAddress,
    });
  })().catch((err) => console.error(`[ORDER] email send failed | order=${order.order_number} | ${err?.message || err}`));

  const assignedStore = storeByCode(order.store_code);
  if (assignedStore && assignedStore.posMode === 'MANUAL') {
    await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [orderId, 'AWAITING_STORE_ACCEPT', `Waiting for ${assignedStore.name} to accept the order`, ts]);
  } else {
    bookShipmentAndRelay(orderId);
  }

  return { ok: true };
}

// Create the courier shipment + label, then relay to the POS, both in the BACKGROUND — the caller
// (payment confirmation, or a store's Accept tap) returns immediately rather than blocking on a
// carrier round-trip (~5s). A carrier hiccup can neither fail nor delay that response; the Razorpay
// webhook and the admin's manual "create shipment" are the backstops for the former, and staff
// retyping the bill number covers the latter.
export function bookShipmentAndRelay(orderId) {
  autoCreateShipment(orderId)
    .then((ship) => {
      if (ship?.ok && ship.waybill) {
        return query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
          [orderId, 'SHIPMENT_CREATED', bookingNote(ship.carrier, ship.waybill), nowIso()]);
      }
    })
    .catch((err) => console.error(`[SHIPMENT] background create failed | order=${orderId} | ${err?.message || err}`))
    // Relay to the POS only AFTER the shipment attempt, so the courier fee on the bill is the real
    // one. Deliberately chained rather than run in parallel, and deliberately last: the money is
    // taken and the parcel is booked by this point, so a POS problem must never fail either. It
    // records itself in petpooja_orders for the admin to retry. (No-ops for a MANUAL store — see
    // storeRelaysToPos — so calling this from the Accept handler for one is harmless.)
    .finally(() => relayOrder(orderId).catch(() => {}));
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

/* Ordering paused — enforced here, not just hidden in the UI.
 *
 * A pause that only lives in the frontend is a suggestion: a stale tab, a cached bundle or anyone
 * with the API can walk straight past it, and with live payment keys that means real money taken
 * for an order nobody is going to bake. This is the single door every order comes through. */
async function assertOrderingOpen() {
  const row = await getOne("SELECT value FROM site_settings WHERE key = 'ordering_paused'");
  if (row?.value) {
    console.log('[ORDER] create | ✗ ordering is paused');
    throw new ApiError(row.value, 503);
  }
}

router.post('/', async (req, res) => {
  await assertOrderingOpen();
  const user = await userByEmail(req.user.email);
  const { addressId, couponCode, items: bodyItems } = req.body || {};
  console.log(`[ORDER] create | user=${user?.id}(${req.user.email}) | addressId=${addressId} | items=${JSON.stringify((bodyItems || []).map(i => ({ p: i.productId, q: i.quantity })))}`);

  let lineItems;
  if (Array.isArray(bodyItems) && bodyItems.length > 0) {
    lineItems = await Promise.all(bodyItems.map(async (it) => {
      const product = await getOne('SELECT * FROM products WHERE id = $1', [it.productId]);
      if (!product) { console.log(`[ORDER] create | ✗ product_not_found=${it.productId}`); throw new ApiError(`Product not found: ${it.productId}`); }

      let selectedOptions = it.selectedOptions ?? null;
      /*
       * A pack's contents are re-checked here, against the catalogue, every time.
       *
       * The picker already enforces the slot counts — but it runs on the customer's machine, and
       * the price is fixed whatever goes in. Without this, eight Biscoff at the price of a mixed
       * box is one edited request away, and the resulting order would look completely ordinary
       * for the rest of its life. validatePackPicks also rewrites the human-readable lines from
       * what the catalogue says the cookies are called, so a renamed product cannot leave a stale
       * name printed on the kitchen's copy.
       */
      if (isPackProduct(product)) {
        const checked = await validatePackPicks(product, selectedOptions?.packPicks);
        selectedOptions = { ...(selectedOptions || {}), packPicks: checked.picks, addOns: checked.addOns };
        console.log(`[ORDER] create | pack=${product.name} | ${checked.summary}`);
      }

      return { product, productName: product.name, quantity: it.quantity || 1, unitPrice: product.price,
               selectedOptions: selectedOptions ? JSON.stringify(selectedOptions) : null,
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
  const destPin = String(address.pincode || '').replace(/\D/g, '');

  /*
   * A product with either delivery mode switched off (structurally, like Red Velvet's 24h shelf
   * life, or just an operational pause) can never ride the OTHER mode to reach an address it does
   * not cover. This is the ONE place that guarantee actually holds: rejected here, before payment,
   * an order can never exist in a state where money is taken for something that cannot honestly be
   * delivered. Checked with the exact same routine booking later uses (deliveryEligible ->
   * zoneStores), so "accepted here" and "bookable later" cannot disagree.
   *
   * The storefront already disables a product the customer's known location can't reach, so this
   * only fires on the rare path where someone added it, then switched to a bad address before
   * paying — the admin-supplied reason is shown when there is one; a plain fallback otherwise.
   */
  const failing = lineItems.filter((li) => li.product && !deliveryEligible(destPin, li.product));
  if (failing.length) {
    const reasonFor = (p) => (zoneStores(destPin).length ? p.intracity_unavailable_reason : p.intercity_unavailable_reason)
      || 'not available for delivery to this address';
    const lines = [...new Map(failing.map((li) => [li.productName, reasonFor(li.product)])).entries()]
      .map(([name, reason]) => `${name} — ${reason}`);
    console.log(`[ORDER] create | ✗ delivery_ineligible | pin=${destPin} | ${lines.join(' | ')}`);
    throw new ApiError(`${lines.join('. ')}. Remove ${failing.length === 1 ? 'it' : 'them'} to continue, or choose a different address.`);
  }

  const subtotal = lineItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  let discount = 0, coupon = null;
  if (couponCode && String(couponCode).trim()) {
    const rawCoupon = await getCouponByCode(couponCode);
    const giftProduct = rawCoupon ? await resolveGiftProduct(rawCoupon, user.id) : null;
    coupon = await validateCoupon(couponCode, subtotal, user.id);
    // A "free item" reward only makes sense if that item is actually in the order — the
    // frontend auto-adds it the moment the coupon is applied, so this only fires if it was
    // removed afterwards (or the request was tampered with).
    if (giftProduct && !lineItems.some(li => li.product?.id === giftProduct.id && li.quantity >= 1)) {
      throw new ApiError(`Add "${giftProduct.name}" to your cart to use this reward.`);
    }
    discount = calculateDiscount(coupon, subtotal, giftProduct);
  }

  /*
   * Outstation, and the warehouse has to be both open AND willing to do it.
   *
   * Checked BEFORE the store is assigned, because for an out-of-town address the assignment failing
   * produces "none of our stores near this address are taking orders" — which is true of every
   * outstation address on the best day of the year, and says nothing about what actually went wrong.
   *
   * The same routine the checkout quote uses, so a basket cannot be quoted and then refused here.
   */
  if (!zoneStores(destPin).length && !(await intercityOpen())) {
    console.log(`[ORDER] create | ✗ intercity_closed | pin=${destPin}`);
    throw new ApiError('We are not shipping outside our delivery cities at the moment. Please check back soon.', 503);
  }

  // Which kitchen this belongs to, from the address alone. Assigned now rather than at booking so
  // the store owns the order from the moment it is paid for — a courier that cannot be booked must
  // not also mean no kitchen ever sees it. attemptShipment corrects this if the carrier ends up
  // serving the drop from a different store.
  /* Outstation orders go to a store that can actually dispatch one — switched on, set to allow
     intercity, and with a Delhivery warehouse registered at its pincode. storeForAddress sends
     every out-of-town address to the warehouse by default, which was right while Begur was the only
     candidate and silently wrong the moment a second store could be. Intracity is unchanged: the
     zone decides, as before. */
  let fulfillingStore = zoneStores(destPin).length
    ? storeForAddress(address)
    : await intercityStoreForAddress();
  if (fulfillingStore && !(await isStoreActive(fulfillingStore.code))) {
    /* The nearest store is shut — hand the order to the nearest one that is open rather than
       refusing it. Refusing was right when every store traded and one being off meant a genuine
       local outage; with a single store trading it rejected orders the open shop was minutes from,
       because "nearest" is decided before anyone asks who is working. */
    const open = orderStoresByProximity(await activeZoneStores(destPin), address?.latitude, address?.longitude);
    if (!open.length) {
      console.log(`[ORDER] create | ✗ no_open_store | zone=${destPin}`);
      throw new ApiError('None of our stores near this address are taking orders right now. Please try again later, or choose a different address.', 503);
    }
    console.log(`[ORDER] create | ${fulfillingStore.code} is closed → ${open[0].code}`);
    fulfillingStore = open[0];
  }

  /*
   * The store that will bake this has to actually have it.
   *
   * A per-store "we have run out of that" switch has existed for a while, and until now it changed
   * what the admin panel and the store portal displayed and nothing else — no customer path read it.
   * So an item a kitchen had turned off could still be ordered, paid for, and land on that kitchen's
   * board. Now that a store can flip that switch itself, that gap is the difference between the
   * feature working and the feature being decorative.
   *
   * Tried the same way a closed store is: hand the order to the nearest open store in the zone that
   * DOES carry everything, before refusing it. Refusing outright would turn one shop running out of
   * one cookie into a rejected order for a city with another shop a mile away that has it. Outstation
   * has no zone stores to fall back to, so there the first answer is the only answer, which is right —
   * the warehouse either has it or nobody does.
   */
  if (fulfillingStore) {
    const productIds = lineItems.map((li) => li.product?.id).filter(Boolean);
    let blocked = await storeBlockedProductIds(fulfillingStore.code, productIds);
    if (blocked.size) {
      const candidates = orderStoresByProximity(await activeZoneStores(destPin), address?.latitude, address?.longitude);
      for (const candidate of candidates) {
        if (candidate.code === fulfillingStore.code) continue;
        const theirs = await storeBlockedProductIds(candidate.code, productIds);
        if (!theirs.size) {
          console.log(`[ORDER] create | ${fulfillingStore.code} is out of an item → ${candidate.code}`);
          fulfillingStore = candidate;
          blocked = theirs;
          break;
        }
      }
    }
    if (blocked.size) {
      const names = [...new Set(lineItems.filter((li) => blocked.has(li.product?.id)).map((li) => li.productName))];
      console.log(`[ORDER] create | ✗ store_out_of_stock | store=${fulfillingStore.code} | ${names.join(', ')}`);
      throw new ApiError(
        `${names.join(' and ')} ${names.length === 1 ? 'has' : 'have'} sold out at the store that would make this order. `
        + `Remove ${names.length === 1 ? 'it' : 'them'} to continue, or try again later.`
      );
    }
  }

  const intracity = zoneStores(destPin).length > 0;
  // Intracity is OPEN again — Shiprocket Hyperlocal replaced Shadowfax and is proven end to end
  // (real Rapido rider, delivered in ~73 min). The old Shadowfax block that rejected these orders
  // is gone; SHIPROCKET_DISABLED remains as the kill switch if that carrier ever needs pausing.
  if (intracity && SHIPROCKET_DISABLED) {
    throw new ApiError('Same-day delivery is temporarily unavailable. Please try again shortly.', 503);
  }
  // Charge exactly what the customer will actually cost us: Shiprocket's own real-time quote for
  // this address, from the SAME store attemptShipment will later try to book from (never a
  // different, cheaper-looking one — matches the "store_code is fixed once decided" rule). Outstation
  // stays a flat, admin-set number (site_settings) rather than a per-parcel Delhivery quote.
  let deliveryFee = 0;
  if (subtotal > 0) {
    if (intracity) {
      if (address.latitude == null || address.longitude == null) {
        throw new ApiError('We need this address’s location to confirm same-day pricing — please edit and re-save it.');
      }
      const quote = await pickServiceableStore([fulfillingStore], { pin: destPin, lat: address.latitude, lng: address.longitude });
      if (!quote) {
        console.log(`[ORDER] create | ✗ intracity_quote_failed | store=${fulfillingStore?.code} | pin=${destPin}`);
        throw new ApiError('Same-day delivery to this address could not be confirmed just now. Please try again in a moment.', 503);
      }
      deliveryFee = quote.rate;
    } else {
      const row = await getOne("SELECT value FROM site_settings WHERE key = 'delivery_fee_outstation'");
      deliveryFee = row?.value != null ? Number(row.value) : 100;
    }
  }
  const total = subtotal - discount + deliveryFee;
  const ts = nowIso();
  const orderNumber = await genOrderNumber();

  const orderId = await withTransaction(async (client) => {
    const { rows: [order] } = await client.query(
      `INSERT INTO orders
         (order_number, user_id, address_id, subtotal, discount_amount, delivery_fee, tax_amount,
          total_amount, coupon_code, payment_status, order_status, shipment_status, label_generated,
          store_code, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING','PLACED','NOT_CREATED',FALSE,$10,$11,$12) RETURNING id`,
      [orderNumber, user.id, address.id, subtotal, discount, deliveryFee, 0, total,
       couponCode ?? null, fulfillingStore?.code ?? null, ts, ts]
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

  /* No confirmation email here.
   *
   * This row is created BEFORE Razorpay opens, so reaching this line means a basket was submitted,
   * not that anyone paid. Mailing "Order confirmed" from here told every shopper who closed the
   * payment window that an order they had not paid for was on its way — and nothing ever followed,
   * because no cancellation mail is sent for an abandoned checkout either.
   *
   * It is sent from finalizePaidOrder instead, on the same atomic PAID claim that guards the
   * courier booking and the coupon redemption — which is also what stops the verify route and the
   * webhook sending it twice when they land together.
   */

  // NOTE: the Delhivery shipment is created on payment success (see /:id/payment/verify),
  // not here — we only ship orders that are actually paid.
  res.json(await fullOrder(orderId));
});

/*
 * The customer's own order history: orders they paid for, and nothing else.
 *
 * An order row is created BEFORE Razorpay opens, because Razorpay needs our order number as its
 * receipt and the row is what a payment later gets reconciled against. That is unavoidable. What it
 * used to mean, though, is that closing the payment popup left a PENDING row behind, and this list
 * returned it — so abandoning a payment produced an "order" in the customer's account that nobody
 * had paid for and nothing would ever ship.
 *
 * PENDING is not a state an order rests in. It lasts only as long as the payment window is open,
 * and resolves to PAID or CANCELLED either way (see /abandon below). Filtering on PAID rather than
 * "not PENDING" is what makes that true from the customer's side: whatever went wrong, an order
 * they were never charged for is not something to show them as an order.
 *
 * The admin list is a separate query and still sees every row, which is where an abandoned attempt
 * genuinely needs to be visible.
 */
router.get('/', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const rows = await getAll(
    `SELECT * FROM orders WHERE user_id = $1 AND payment_status = 'PAID'
      ORDER BY created_at DESC, id DESC`, [user.id]
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

  /* Same-day intracity is Shiprocket's, and this route used to send its waybills to DELHIVERY —
     the branch simply did not exist here, though the admin's copy of it has had one for a while.
     So a customer opening tracking on an intracity order asked one carrier about another carrier's
     parcel, got nothing back, and fell through to whatever status was last written to the row.
     This is also the only path that can carry the rider, so without the branch the live position
     could not reach the customer at all. */
  if (order.carrier === 'SHIPROCKET') {
    const t = await trackShiprocket(order.delhivery_shipment_id, order.carrier_order_id, order.delhivery_waybill);
    if (!t.ok) return res.json({ tracked: false, reason: t.reason });
    if (t.status) {
      await query(
        `UPDATE orders SET shipment_status=$1, updated_at=$2
          WHERE id=$3 AND (shipment_status IS NULL OR shipment_status !~* 'cancel')`,
        [t.status, nowIso(), order.id]);
      await applyCarrierTerminalStatus(order, t.status, 'SHIPROCKET');
    }
    const scans = (t.activities || [])
      .map(s => ({ time: s.date || '', event: s['sr-status-label'] || s.activity || s.status || '' }))
      .filter(s => s.event)
      .reverse();
    return res.json({
      tracked: true, carrier: 'SHIPROCKET', waybill: order.delhivery_waybill,
      status: t.status, courierName: t.courierName || null, trackUrl: t.trackUrl || null,
      rider: t.rider || null, scans,
    });
  }

  // Pan-India orders ship via Delhivery.
  const result = await trackShipment(order.delhivery_waybill);
  if (!result.ok) return res.json({ tracked: false, reason: result.reason });
  const pkg = Array.isArray(result.data?.ShipmentData) ? result.data.ShipmentData[0]?.Shipment : null;
  // Status.Status alone is a terse word ("Manifested"); Status.Instructions is Delhivery's own
  // human-readable detail for the same event ("Pickup not attempted") — join them like the Scans
  // list below already does, so the customer sees more than a bare status word when one exists.
  const latestStatus = [pkg?.Status?.Status, pkg?.Status?.Instructions].filter(Boolean).join(' — ') || null;
  if (latestStatus) {
    /* Never over the top of a cancelled booking. Delhivery keeps answering for a waybill long after
       it is cancelled — and answers "Not Picked", which is literally true and completely misleading:
       it revived a cancelled order as in-transit the moment the customer opened tracking. A cancel
       is ours to undo (a rebook writes CREATED here), not the carrier's.

       Matched on the word, not on our own spelling of it. This was `IS DISTINCT FROM 'CANCELLED'`,
       which protected the value WE write and not the one Shiprocket does — they spell it
       "Canceled", one L — so the carrier's own cancellation was left unguarded against the
       carrier's own next poll. */
    await query(
      `UPDATE orders SET shipment_status=$1, updated_at=$2
        WHERE id=$3 AND (shipment_status IS NULL OR shipment_status !~* 'cancel')`,
      [latestStatus, nowIso(), order.id]);
    // Same rule as the admin's poll and the hyperlocal webhook: a carrier saying delivered or
    // cancelled moves the order, whoever happened to ask. The customer opening their own tracking
    // is often the first person to ask at all.
    await applyCarrierTerminalStatus(order, latestStatus, 'DELHIVERY');
  }
  const scans = (pkg?.Scans || [])
    .map(s => ({ time: s.ScanDetail?.ScanDateTime || '', event: [s.ScanDetail?.Scan, s.ScanDetail?.Instructions].filter(Boolean).join(' — ') }))
    .reverse();
  return res.json({ tracked: true, carrier: 'DELHIVERY', waybill: order.delhivery_waybill, status: latestStatus, scans, data: result.data });
});

/*
 * The shopper closed the payment window, or the payment failed outright.
 *
 * Called by the frontend the moment either happens, so an order nobody paid for is closed off there
 * and then rather than left as a PENDING row of unknown age. Without it the only thing separating
 * "gave up two minutes ago" from "gave up last month" is a timestamp nobody reads.
 *
 * Both statuses move, not just the order status. PENDING means "a payment window is open right
 * now"; once it closes without paying, that is no longer true and the payment is CANCELLED. An
 * order is therefore only ever waiting, paid, or cancelled — there is no fourth state where a row
 * sits unpaid forever with nothing deciding what it is.
 *
 * Deliberately narrow: it only ever touches a PENDING order belonging to the caller. A PAID order
 * cannot be cancelled through here — if this could void a paid order, a stale retry firing after a
 * successful payment would do exactly that. Cancelling a paid order is a refund, and refunds are an
 * admin action, not something a browser gets to trigger.
 *
 * Answers with ok either way. The shopper has already walked away from the payment; a failure to
 * tidy up behind them is ours to notice in the logs, not theirs to be told about.
 */
router.post('/:id/abandon', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const order = await getOne(
    "SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND payment_status = 'PENDING'",
    [req.params.id, user.id]
  );
  if (!order) return res.json({ ok: true, cancelled: false });

  const ts = nowIso();
  await query(
    `UPDATE orders SET payment_status = 'CANCELLED', order_status = 'CANCELLED', updated_at = $1
      WHERE id = $2 AND payment_status = 'PENDING'`,
    [ts, order.id]
  );
  await query(
    'INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'CANCELLED', 'Payment not completed — checkout was closed before paying.', ts]
  );
  console.log(`[PAYMENT] abandon | order=${order.order_number} | cancelled unpaid order`);
  res.json({ ok: true, cancelled: true });
});

// Step 1 of payment: create a Razorpay order for this DB order so Checkout can open.
// Returns the public key id + razorpay order id; the frontend opens the popup with these.
router.post('/:id/payment/razorpay-order', async (req, res) => {
  await assertOrderingOpen();   // an order created before the pause must not still open a payment
  if (!razorpayConfigured()) { console.log(`[PAYMENT] rzp-order | order=${req.params.id} | ✗ not_configured`); throw new ApiError('Payments are not configured', 503); }
  const user = await userByEmail(req.user.email);
  const order = await getOne('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!order) { console.log(`[PAYMENT] rzp-order | order=${req.params.id} | ✗ order_not_found`); throw new ApiError('Order not found'); }
  if (order.payment_status === 'PAID') { console.log(`[PAYMENT] rzp-order | order=${order.order_number} | ✗ already_paid`); throw new ApiError('Order already paid', 409); }
  // A cancelled order is finished. Without this, a stale tab left open on the payment step could
  // still open Checkout against an order that was abandoned and closed, and take real money for it.
  if (order.payment_status === 'CANCELLED' || order.order_status === 'CANCELLED') {
    console.log(`[PAYMENT] rzp-order | order=${order.order_number} | ✗ cancelled`);
    throw new ApiError('This order was cancelled. Please start a new order.', 409);
  }

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
