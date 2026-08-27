import { getOne, getAll, query, nowIso } from '../db/index.js';
import { createShipment, delhiveryConfigured, fetchWaybill } from './delhivery.client.js';
import { shiprocketConfigured, createHyperlocalOrder, assignAwb, trackShiprocket, pickServiceableStore, getWalletBalance } from './shiprocket.client.js';
import { zoneStores, storeByCode, storeForAddress } from './store.service.js';
import { relayOrder } from './petpooja.service.js';
import { bookingNote } from './orderProgress.service.js';

/*
 * Booking the parcel: which carrier, from which store, and what to do when that fails.
 *
 * Lifted out of routes/orders.js in Phase B, unchanged. The admin's manual "create shipment"
 * button and a store's Accept tap both need this, and both were importing the ORDER ROUTER to get
 * at it — dragging requireAuth and every order handler along for one function.
 *
 * Nothing here throws. The money is already taken by the time any of it runs, so a carrier problem
 * has to come back as a value the caller can record, not an exception that unwinds into a 500 and
 * leaves a paid order with no parcel and no explanation.
 */

// Kill switch: flip this and intracity stops being offered (it is never sent to a slower courier).
export const SHIPROCKET_DISABLED = process.env.SHIPROCKET_DISABLED === 'true';

// Auto-create a shipment once an order is PAID. Routes by DESTINATION PINCODE:
//   • pincode in a city where we have a store (Bengaluru 560xxx / Chennai 600xxx) → Shadowfax (intracity)
//   • anywhere else → Delhivery (out-of-city)
// If Shadowfax isn't configured/serviceable or the call fails, it falls back to Delhivery.
// Never throws — returns { ok, reason?, waybill?, carrier? }. Idempotent (skips if a waybill exists).
//
// Every failure is PERSISTED (orders.shipment_error + a SHIPMENT_FAILED tracking row), not just
// logged. The money is already taken by the time this runs, so "paid but never shipped" has to be
// visible in the admin dashboard rather than buried in a Railway log line nobody reads.
export async function autoCreateShipment(orderId, addressArg?) {
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


async function attemptShipment(orderId, addressArg?) {
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
        let assignError: string | null = null;
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
