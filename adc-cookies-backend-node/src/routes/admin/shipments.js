import { Router } from 'express';
import { getOne, getAll, query, nowIso } from '../../db.js';
import { ApiError } from '../../middleware.js';
import { serializeOrder } from '../../serializers.js';
import { delhiveryConfigured, fetchWaybill, createShipment, cancelShipment, createPickupRequest, shippingLabelUrl, trackShipment, fetchDocument, DELHIVERY_DOC_TYPES } from '../../delhivery.js';
import { cancelShiprocketOrder, trackShiprocket } from '../../shiprocket.js';
import { autoCreateShipment } from '../orders.js';

const router = Router();

/* ======================================================================
   Delivery — Shipment actions per order
   ====================================================================== */

// POST /api/admin/orders/:id/shipment — create shipment on Delhivery for this order
router.post('/orders/:id/shipment', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);

  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (order.delhivery_waybill) throw new ApiError('Shipment already created for this order', 409);
  // Booking a courier costs real money out of the Delhivery wallet the moment the shipment is
  // created, so it must not be possible to do it for an order nobody has paid for. `force` covers
  // the genuine case of a payment reconciled outside Razorpay.
  if (order.payment_status !== 'PAID' && String(req.body?.force) !== 'true') {
    throw new ApiError(`Order is not paid (payment_status=${order.payment_status}) — booking a courier would spend from the Delhivery wallet for an unpaid order. Send force:true to override.`, 409);
  }
  if (order.order_status === 'CANCELLED' && String(req.body?.force) !== 'true') {
    throw new ApiError('Order is cancelled — send force:true to book a courier anyway.', 409);
  }

  const address = order.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null;
  if (!address) throw new ApiError('Order has no delivery address', 400);

  const wh = await getOne('SELECT * FROM warehouses WHERE is_default = TRUE AND is_active = TRUE LIMIT 1');
  if (!wh) throw new ApiError('No active default warehouse configured — create one in Delivery > Warehouses', 400);

  const waybillRes = await fetchWaybill(1);
  if (!waybillRes.ok || !waybillRes.waybills?.length) {
    console.log(`[ADMIN-SHIPMENT] create FAILED | order=${order.order_number} | waybill_fetch=FAILED | reason=${waybillRes.reason}`);
    throw new ApiError(`Could not fetch waybill from Delhivery: ${waybillRes.reason}`, 502);
  }
  const waybill = String(waybillRes.waybills[0]);
  console.log(`[ADMIN-SHIPMENT] create | order=${order.order_number} | wh=${wh.pickup_location} | dest=${address.pincode} | weight=${req.body?.weight || 0.5} | waybill=${waybill}`);

  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
  const productsDesc = items.map(i => `${i.product_name} x${i.quantity}`).join(', ') || 'Cookies';

  const shipmentData = {
    waybill,
    name: address.full_name,
    add: [address.address_line1, address.address_line2].filter(Boolean).join(', '),
    pin: address.pincode,
    city: address.city,
    state: address.state || '',
    country: 'India',
    phone: address.phone,
    order: order.order_number,
    payment_mode: 'Pre-paid',
    return_pin: wh.return_pincode || wh.pincode,
    return_city: wh.city || '',
    return_state: wh.state || '',
    return_country: 'India',
    return_add: [wh.address_line1, wh.address_line2].filter(Boolean).join(', ') || wh.city || '',
    return_name: wh.name,
    return_phone: wh.phone || '',
    products_desc: productsDesc,
    hsn_code: '19053100',
    cod_amount: 0,
    order_date: order.created_at ? order.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    total_amount: String(order.total_amount),
    seller_add: [wh.address_line1, wh.city].filter(Boolean).join(', '),
    seller_name: wh.registered_name || wh.name,
    seller_inv: order.order_number,
    quantity: String(items.reduce((s, i) => s + i.quantity, 0) || 1),
    shipment_type: 0,
    origin_scan: 1,
    weight: String(req.body?.weight || 0.5),
    shipping_mode: 'Express',
    address_type: 'home',
    seller_gst_tin: '',
  };

  const result = await createShipment(shipmentData, wh.pickup_location);
  if (!result.ok) {
    console.log(`[ADMIN-SHIPMENT] create FAILED | order=${order.order_number} | reason=${result.reason} | detail=${JSON.stringify(result.detail || '').slice(0, 300)}`);
    return res.status(502).json({ error: result.reason, detail: result.detail });
  }

  await query(
    `UPDATE orders SET delhivery_waybill=$1, carrier='DELHIVERY', shipment_status='CREATED', tracking_url=$2, label_generated=TRUE, updated_at=$3 WHERE id=$4`,
    [result.waybill, `https://www.delhivery.com/track/package/${result.waybill}`, nowIso(), order.id]
  );
  console.log(`[ADMIN-SHIPMENT] create OK | order=${order.order_number} | waybill=${result.waybill} | label=ready`);
  const updated = await getOne('SELECT * FROM orders WHERE id = $1', [order.id]);
  const serialized = serializeOrder(updated, items, address);
  res.json({ ...serialized, waybill: result.waybill });
});

// DELETE /api/admin/orders/:id/shipment — cancel the shipment WITH WHOEVER BOOKED IT.
// This used to always call Delhivery, so cancelling an intracity order sent a Shiprocket AWB to
// Delhivery's edit endpoint, which rejected it while the rider was still on the way.
/*
 * Has a rider actually been allocated to this order?
 *
 * For Shiprocket the AWB is the tell, and it is a reliable one: assignment is asynchronous and the
 * AWB only appears once a real rider has been found. Confirmed live on 2026-08-07 — a create +
 * assign + cancel cycle that was cancelled during "Searching For Rider" never produced an AWB and
 * never charged the wallet. So AWB present = rider allocated = money already spent = someone is on
 * their way to the store, which is a materially different thing to cancel than a pending search.
 *
 * The status text is checked too, for orders whose AWB arrived by webhook before we stored it.
 */
function riderDispatched(order) {
  if (order.carrier !== 'SHIPROCKET') return false;
  if (order.delhivery_waybill) return true;
  return /RIDER ASSIGNED|PICKED ?UP|IN TRANSIT|OUT FOR DELIVERY|REACHED/i.test(String(order.shipment_status || ''));
}

router.delete('/orders/:id/shipment', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (!order.delhivery_waybill && !order.carrier_order_id) throw new ApiError('No shipment exists for this order', 400);

  const dispatched = riderDispatched(order);
  const ref = order.delhivery_waybill || order.carrier_order_id;
  console.log(`[ADMIN-SHIPMENT] cancel | order=${order.order_number} | carrier=${order.carrier || 'DELHIVERY'} | ref=${ref}`);

  let result;
  if (order.carrier === 'SHIPROCKET') {
    if (!order.carrier_order_id) {
      throw new ApiError('This Shiprocket booking predates us storing their order id — cancel it in the Shiprocket panel.', 409);
    }
    result = await cancelShiprocketOrder(order.carrier_order_id);
  } else {
    if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);
    result = await cancelShipment(order.delhivery_waybill);
  }

  if (!result.ok) {
    console.log(`[ADMIN-SHIPMENT] cancel FAILED | ref=${ref} | reason=${JSON.stringify(result.reason)}`);
    const carrier = order.carrier || 'DELHIVERY';
    const raw = typeof result.reason === 'string' ? result.reason : JSON.stringify(result.reason ?? '');
    await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [order.id, 'SHIPMENT_CANCEL_FAILED', `⚠ ${carrier} refused to cancel ${ref}: ${raw.slice(0, 300)}`, nowIso()]).catch(() => {});
    // A human sentence, not a reason code — this is read by whoever now has to go and cancel it by
    // hand, and "the rider is still coming" is the part that matters.
    const panel = carrier === 'SHIPROCKET' ? 'Shiprocket' : 'Delhivery';
    const message = dispatched
      ? `A rider has already been dispatched for this order, and ${carrier} refused to call them off: ${raw.slice(0, 240)}. The rider is still on their way to the store. Phone the store and the rider to stop the handover, then cancel it in the ${panel} dashboard. The delivery charge has already been taken and will not come back on its own.`
      : `${carrier} refused to cancel ${ref}: ${raw.slice(0, 300)}. The booking is still LIVE — a rider may still collect this order. Cancel it directly in the ${panel} dashboard.`;
    return res.status(502).json({ ok: false, error: message, message, carrier, dispatched, reason: result.reason, detail: result.detail });
  }

  await query(`UPDATE orders SET shipment_status='CANCELLED', updated_at=$1 WHERE id=$2`, [nowIso(), order.id]);
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'SHIPMENT_CANCELLED', `${order.carrier || 'DELHIVERY'} booking ${ref} cancelled${dispatched ? ' (rider had already been dispatched)' : ''}`, nowIso()]).catch(() => {});
  /*
   * Shiprocket accepts the cancel but leaves `status` reading NEW — their own panel shows the same,
   * and only the activity log records "Order Canceled" (verified live 2026-08-07). So a 200 is the
   * best confirmation their API offers, and we do not try to re-read the status to "verify": doing
   * so would report every successful cancellation as a failure.
   */
  const message = dispatched
    ? `Booking ${ref} cancelled and the rider called off. Please confirm with the store that nobody collects it — the delivery charge was already taken, so check whether it is refunded to your wallet.`
    : `Booking ${ref} cancelled with ${order.carrier || 'the carrier'}. No rider had been allocated yet, so nothing was charged. The customer's payment is NOT refunded by this.`;
  res.json({ ok: true, waybill: order.delhivery_waybill, carrier: order.carrier || 'DELHIVERY', dispatched, message });
});

/*
 * POST /api/admin/orders/:id/rebook — retry the AUTOMATIC carrier booking.
 *
 * Distinct from POST /orders/:id/shipment, which only ever books Delhivery from the default
 * warehouse. This re-runs the real routing (intracity → nearest serviceable store on Shiprocket,
 * otherwise Delhivery), so an order whose booking failed at payment time is retried exactly as it
 * would have been booked then — no manual carrier choice, and no wrong-carrier bookings.
 */
/*
 * Turn autoCreateShipment's internal reason code into something an operator can act on, and pick a
 * status that reflects WHOSE problem it is: 409 when the order itself cannot be shipped (nothing to
 * retry until the data is fixed), 502 when the carrier refused or was unreachable (retrying may
 * work). Returning a bare reason code was useless — the frontend reads `message`/`error`, so a
 * failure surfaced in the UI as an unexplained "HTTP 502".
 */
function shipmentFailureResponse(reason) {
  const r = String(reason || '');
  if (r === 'no_address') return { status: 409, message: 'This order has no delivery address, so there is nowhere to ship it. Orders created directly for testing (and any placed without an address) can never be booked — this is not a carrier problem.' };
  if (r === 'order_not_found') return { status: 404, message: 'Order not found.' };
  if (r === 'not_configured') return { status: 503, message: 'No courier is configured on this environment, so nothing can be booked here.' };
  if (r === 'no_warehouse') return { status: 409, message: 'No active default warehouse — set one under Delivery → Warehouses before booking Delhivery.' };
  if (r.startsWith('waybill_fetch:')) return { status: 502, message: `Delhivery would not issue a waybill (${r.slice(14)}). This is usually a wallet balance or account issue on their side.` };
  return { status: 502, message: `The carrier refused the booking: ${r}` };
}

router.post('/orders/:id/rebook', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (order.delhivery_waybill) throw new ApiError('This order already has a shipment — cancel it first.', 409);
  if (order.payment_status !== 'PAID') throw new ApiError(`Order is not paid (payment_status=${order.payment_status}).`, 409);
  if (order.order_status === 'CANCELLED') throw new ApiError('Order is cancelled.', 409);

  const r = await autoCreateShipment(order.id);
  if (!r.ok) {
    const { status, message } = shipmentFailureResponse(r.reason);
    return res.status(status).json({ ok: false, reason: r.reason, error: message, message });
  }
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'SHIPMENT_CREATED', `${r.carrier || 'Carrier'} waybill ${r.waybill} (re-booked by admin)`, nowIso()]).catch(() => {});
  res.json(r);
});

// GET /api/admin/orders/:id/track — pull fresh tracking from whichever carrier created the shipment.
router.get('/orders/:id/track', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (!order.delhivery_waybill) return res.json({ ok: false, reason: 'no_shipment' });

  // Shiprocket (intracity) — normalize into the same { ok, carrier, status, scans } shape.
  // Without this branch an intracity AWB was sent to Delhivery's tracker, which of course
  // knows nothing about it, so the admin saw "not found" for a parcel that was moving fine.
  if (order.carrier === 'SHIPROCKET') {
    const sid = order.delhivery_shipment_id;
    if (!sid) return res.json({ ok: false, carrier: 'SHIPROCKET', reason: 'no_shipment_id' });
    const result = await trackShiprocket(sid);
    if (result.ok && result.status) {
      await query('UPDATE orders SET shipment_status=$1, updated_at=$2 WHERE id=$3', [result.status, nowIso(), order.id]);
    }
    const scans = (result.activities || []).map((a) => ({ time: a.date || a.time, event: a.activity || a.status }));
    return res.json({ ok: result.ok, carrier: 'SHIPROCKET', status: result.status || null, awb: result.awb || order.delhivery_waybill, scans });
  }

  // Delhivery (outstation)
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);
  const result = await trackShipment(order.delhivery_waybill);
  if (result.ok && result.data) {
    const pkg = Array.isArray(result.data?.ShipmentData) ? result.data.ShipmentData[0]?.Shipment : null;
    // Same Status + Instructions join as the customer-facing route (routes/orders.js) — keeps
    // shipment_status consistently formatted regardless of which route last updated it.
    const latestStatus = [pkg?.Status?.Status, pkg?.Status?.Instructions].filter(Boolean).join(' — ') || null;
    if (latestStatus) {
      await query('UPDATE orders SET shipment_status=$1, updated_at=$2 WHERE id=$3',
        [latestStatus, nowIso(), order.id]);
    }
  }
  res.json({ ...result, carrier: 'DELHIVERY' });
});

// Recursively find the first http(s) URL anywhere in a Delhivery response (the document API's
// shape varies by doc type), so the UI can open it directly.
function firstUrl(v) {
  if (!v) return null;
  if (typeof v === 'string') return /^https?:\/\//i.test(v.trim()) ? v.trim() : null;
  if (Array.isArray(v)) { for (const x of v) { const u = firstUrl(x); if (u) return u; } return null; }
  if (typeof v === 'object') { for (const x of Object.values(v)) { const u = firstUrl(x); if (u) return u; } return null; }
  return null;
}

// GET /api/admin/orders/:id/document?type=EPOD — fetch a B2C document (proof of delivery,
// signature, return-QC image) for a Delhivery order. Only after the shipment exists.
router.get('/orders/:id/document', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (!order.delhivery_waybill) return res.json({ ok: false, reason: 'no_shipment' });
  if (order.carrier !== 'DELHIVERY') return res.json({ ok: false, reason: 'not_delhivery' });
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);

  const docType = String(req.query.type || '').toUpperCase();
  if (!DELHIVERY_DOC_TYPES.includes(docType)) {
    throw new ApiError(`Invalid document type. Allowed: ${DELHIVERY_DOC_TYPES.join(', ')}`, 400);
  }

  const result = await fetchDocument({ docType, waybill: order.delhivery_waybill });
  if (!result.ok) return res.status(502).json({ ok: false, reason: result.reason, detail: result.detail });
  res.json({ ok: true, docType, waybill: order.delhivery_waybill, url: firstUrl(result.data), data: result.data });
});

// GET /api/admin/delivery/label?waybills=X,Y — proxy the Delhivery shipping label PDF.
// packing_slip returns EITHER raw PDF bytes OR JSON with a pre-signed pdf_download_link;
// we stream the PDF through our server either way so the browser just downloads it.
router.get('/delivery/label', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);
  const { waybills } = req.query;
  if (!waybills) throw new ApiError('waybills param required', 400);

  const { url, headers } = shippingLabelUrl(waybills);
  const sendPdf = (buf, via) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="label-${waybills}.pdf"`);
    console.log(`[ADMIN-LABEL] wbns=${waybills} | ✓ ${via} | ${buf.byteLength}b`);
    res.send(Buffer.from(buf));
  };

  try {
    const upstream = await fetch(url, { headers });
    const ct = upstream.headers.get('Content-Type') || '';

    if (ct.includes('application/pdf')) {
      return sendPdf(await upstream.arrayBuffer(), 'direct pdf');
    }

    // JSON response: pull the pre-signed PDF link and stream that.
    const data = await upstream.json().catch(() => null);
    const pkg = Array.isArray(data?.packages) ? data.packages[0] : null;
    const pdfUrl = pkg?.pdf_download_link || pkg?.pdf_download_url || data?.pdf_download_link || null;
    if (!pdfUrl) {
      console.log(`[ADMIN-LABEL] wbns=${waybills} | ✗ no_pdf_link | ${JSON.stringify(data || {}).slice(0, 200)}`);
      return res.status(502).json({ error: 'no_pdf_link', detail: data });
    }
    const pdfRes = await fetch(pdfUrl);
    return sendPdf(await pdfRes.arrayBuffer(), 'via link');
  } catch (e) {
    console.log(`[ADMIN-LABEL] wbns=${waybills} | ✗ ${e.message}`);
    throw new ApiError('Could not fetch label from Delhivery', 502);
  }
});

// POST /api/admin/delivery/pickup-request
router.post('/delivery/pickup-request', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);
  const { pickupDate, pickupTime, packageCount } = req.body || {};
  if (!pickupDate || !pickupTime) throw new ApiError('pickupDate and pickupTime are required', 400);

  const wh = await getOne('SELECT * FROM warehouses WHERE is_default = TRUE AND is_active = TRUE LIMIT 1');
  if (!wh) throw new ApiError('No active default warehouse configured', 400);

  const result = await createPickupRequest({
    pickupDate, pickupTime, pickupLocation: wh.pickup_location, packageCount: Number(packageCount || 1),
  });

  /*
   * Delhivery's rejections are terse and name no cause, so translate the two that actually happen.
   * A wallet under ₹500 is the common one — it applies to Prepaid and COD alike (confirmed live) —
   * and the other is a slot already open for this warehouse today, since only one pickup request
   * per location per day is allowed until the existing one is closed.
   */
  if (!result.ok) {
    const raw = JSON.stringify(result.reason ?? result.detail ?? '').toLowerCase();
    let hint = null;
    if (/balance|wallet|insufficient|recharge|fund/.test(raw)) {
      hint = 'Your Delhivery wallet is below the ₹500 minimum needed to book a pickup. Top it up in the Delhivery panel and try again. (Prepaid and COD both require this.)';
    } else if (/already|exist|duplicate|open|pending/.test(raw)) {
      hint = `A pickup request is already open for ${wh.pickup_location} today. Delhivery allows only one per warehouse per day — the existing one must be closed before another can be raised. Check it in their panel.`;
    }
    const message = hint || `Delhivery refused the pickup request: ${JSON.stringify(result.reason ?? '').slice(0, 300)}`;
    return res.status(502).json({ ...result, error: message, message, warehouse: wh.pickup_location });
  }
  res.json({ ...result, warehouse: wh.pickup_location });
});

export default router;
