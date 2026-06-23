import { Router } from 'express';
import { getOne, getAll, query, nowIso } from '../db.js';
import { requireAdmin, ApiError } from '../middleware.js';
import { serializeProduct, serializeOrder, serializeOrderItem, serializeAddress, serializeCoupon, serializeUser, serializeWarehouse, PAYMENT_SELECT } from '../serializers.js';
import {
  delhiveryConfigured,
  fetchWaybill,
  createWarehouseOnDelhivery,
  updateWarehouseOnDelhivery,
  getShippingCost,
  createShipment,
  cancelShipment,
  createPickupRequest,
  shippingLabelUrl,
  trackShipment,
} from '../delhivery.js';

const router = Router();
router.use(requireAdmin);

/* ---------- Products ---------- */
router.get('/products', async (_req, res) => {
  const rows = await getAll('SELECT * FROM products ORDER BY id');
  res.json(rows.map(serializeProduct));
});

router.post('/products', async (req, res) => {
  const b = req.body || {};
  const ts = nowIso();
  const row = await getOne(
    `INSERT INTO products (name, category, description, price, stock_quantity, images, options, is_available, menu_group, tag, featured, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [b.name, b.category, b.description ?? null, b.price, b.stockQuantity ?? 0,
     b.images ?? null, b.options ?? null, b.isAvailable !== false,
     b.menuGroup ?? null, b.tag ?? null, !!b.featured, ts, ts]
  );
  res.json(serializeProduct(row));
});

router.put('/products/:id', async (req, res) => {
  const existing = await getOne('SELECT 1 FROM products WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError('Product not found');
  const b = req.body || {};
  const row = await getOne(
    `UPDATE products SET name=$1, category=$2, description=$3, price=$4, stock_quantity=$5,
       images=$6, options=$7, is_available=$8, menu_group=$9, tag=$10, featured=$11, updated_at=$12 WHERE id=$13 RETURNING *`,
    [b.name, b.category, b.description ?? null, b.price, b.stockQuantity ?? 0,
     b.images ?? null, b.options ?? null, b.isAvailable !== false,
     b.menuGroup ?? null, b.tag ?? null, !!b.featured, nowIso(), req.params.id]
  );
  res.json(serializeProduct(row));
});

router.patch('/products/:id/stock', async (req, res) => {
  const qty = Number(req.body?.quantity ?? req.query.quantity);
  const existing = await getOne('SELECT 1 FROM products WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError('Product not found');
  await query('UPDATE products SET stock_quantity=$1, updated_at=$2 WHERE id=$3', [qty, nowIso(), req.params.id]);
  res.status(200).end();
});

router.delete('/products/:id', async (req, res) => {
  await query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.status(200).end();
});

/* ---------- Orders ---------- */
router.get('/orders', async (req, res) => {
  const { search, status } = req.query;
  let sql = 'SELECT o.* FROM orders o';
  const params = [];
  const where = [];
  if (status) { params.push(status); where.push(`o.order_status = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(o.order_number ILIKE $${params.length} OR EXISTS (
      SELECT 1 FROM addresses a WHERE a.id = o.address_id AND (a.full_name ILIKE $${params.length} OR a.city ILIKE $${params.length})
    ))`);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY o.created_at DESC, o.id DESC';
  const rows = await getAll(sql, params);
  const serialized = await Promise.all(rows.map(async (o) => {
    const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [o.id]);
    const address = o.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [o.address_id]) : null;
    const payment = await getOne(PAYMENT_SELECT, [o.id]);
    return serializeOrder(o, items, address, payment);
  }));
  res.json(serialized);
});

router.get('/orders/:id', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found');
  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [order.id]);
  const address = order.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null;
  const payment = await getOne(PAYMENT_SELECT, [order.id]);
  res.json(serializeOrder(order, items, address, payment));
});

router.patch('/orders/:id/status', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found');
  const { status, remarks } = req.body || {};
  const ts = nowIso();
  await query('UPDATE orders SET order_status=$1, updated_at=$2 WHERE id=$3', [status, ts, order.id]);
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, status, remarks ?? null, ts]);
  const updated = await getOne('SELECT * FROM orders WHERE id = $1', [order.id]);
  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [order.id]);
  const address = updated.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [updated.address_id]) : null;
  res.json(serializeOrder(updated, items, address));
});

/* ---------- Coupons ---------- */
router.get('/coupons', async (_req, res) => {
  const rows = await getAll('SELECT * FROM coupons ORDER BY id');
  res.json(rows.map(serializeCoupon));
});

router.post('/coupons', async (req, res) => {
  const b = req.body || {};
  const row = await getOne(
    `INSERT INTO coupons (code, discount_type, discount_value, minimum_order_amount, maximum_discount, expiry_date, usage_limit, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [String(b.code || '').toUpperCase(), b.discountType, b.discountValue,
     b.minimumOrderAmount ?? null, b.maximumDiscount ?? null, b.expiryDate ?? null,
     b.usageLimit ?? null, b.isActive !== false]
  );
  res.json(serializeCoupon(row));
});

router.patch('/coupons/:id/toggle', async (req, res) => {
  const coupon = await getOne('SELECT * FROM coupons WHERE id = $1', [req.params.id]);
  if (!coupon) throw new ApiError('Coupon not found');
  const row = await getOne('UPDATE coupons SET is_active = $1 WHERE id = $2 RETURNING *', [!coupon.is_active, coupon.id]);
  res.json(serializeCoupon(row));
});

/* ---------- Users ---------- */
router.get('/users', async (_req, res) => {
  const rows = await getAll('SELECT * FROM users ORDER BY id DESC');
  const withCounts = await Promise.all(rows.map(async (u) => {
    const { c } = await getOne('SELECT COUNT(*) AS c FROM orders WHERE user_id = $1', [u.id]);
    return { ...serializeUser(u), orderCount: Number(c) };
  }));
  res.json(withCounts);
});

/* ---------- Contact messages ---------- */
router.get('/contact', async (_req, res) => {
  const rows = await getAll('SELECT * FROM contact_messages ORDER BY id DESC');
  res.json(rows.map(m => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, message: m.message, handled: !!m.handled, createdAt: m.created_at })));
});

router.patch('/contact/:id/handled', async (req, res) => {
  const row = await getOne('UPDATE contact_messages SET handled = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
  if (!row) throw new ApiError('Message not found');
  res.json({ id: row.id, handled: !!row.handled });
});

/* ---------- Dashboard ---------- */
router.get('/dashboard', async (_req, res) => {
  const orders = await getAll('SELECT total_amount, order_status, payment_status, created_at FROM orders');
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const paidRevenue = orders.filter(o => o.payment_status === 'PAID').reduce((s, o) => s + Number(o.total_amount), 0);

  const { c: totalProducts } = await getOne('SELECT COUNT(*) AS c FROM products');
  const { c: totalUsers } = await getOne("SELECT COUNT(*) AS c FROM users WHERE role = 'CUSTOMER'");
  const { c: totalAdmins } = await getOne("SELECT COUNT(*) AS c FROM users WHERE role = 'ADMIN'");
  const { c: lowStock } = await getOne('SELECT COUNT(*) AS c FROM products WHERE stock_quantity <= 10');
  let newMessages = 0;
  try { const r = await getOne('SELECT COUNT(*) AS c FROM contact_messages WHERE handled = FALSE'); newMessages = Number(r.c); } catch {}

  // Orders grouped by status (e.g. PLACED / PREPARING / DELIVERED …)
  const ordersByStatus = {};
  for (const o of orders) ordersByStatus[o.order_status] = (ordersByStatus[o.order_status] || 0) + 1;

  // Top products by quantity sold
  const topRows = await getAll(
    `SELECT product_name, SUM(quantity) AS qty, SUM(total_price) AS revenue
       FROM order_items GROUP BY product_name ORDER BY qty DESC LIMIT 5`
  );
  const topProducts = topRows.map(r => ({ name: r.product_name, qty: Number(r.qty), revenue: Number(r.revenue) }));

  res.json({
    totalOrders, totalRevenue, paidRevenue,
    totalProducts: Number(totalProducts),
    totalUsers: Number(totalUsers), totalAdmins: Number(totalAdmins),
    lowStock: Number(lowStock), newMessages,
    ordersByStatus, topProducts,
  });
});

/* ---------- Analytics (charts) ---------- */
router.get('/analytics', async (_req, res) => {
  // created_at is stored as an ISO text string, so compare/group on its date prefix (LEFT 10).
  const since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);

  const salesByDay = (await getAll(
    `SELECT LEFT(created_at,10) AS day, COUNT(*) AS orders,
            COALESCE(SUM(total_amount),0) AS revenue,
            COALESCE(SUM(CASE WHEN payment_status='PAID' THEN total_amount ELSE 0 END),0) AS paid
       FROM orders WHERE LEFT(created_at,10) >= $1 GROUP BY day ORDER BY day`, [since]
  )).map(r => ({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue), paid: Number(r.paid) }));

  const ordersByArea = (await getAll(
    `SELECT COALESCE(NULLIF(a.city,''),'Unknown') AS city, COUNT(o.id) AS orders,
            COALESCE(SUM(o.total_amount),0) AS revenue
       FROM orders o LEFT JOIN addresses a ON a.id = o.address_id
      GROUP BY 1 ORDER BY orders DESC LIMIT 8`
  )).map(r => ({ city: r.city, orders: Number(r.orders), revenue: Number(r.revenue) }));

  const usersByCity = (await getAll(
    `SELECT COALESCE(NULLIF(a.city,''),'Unknown') AS city, COUNT(DISTINCT a.user_id) AS users
       FROM addresses a JOIN users u ON u.id = a.user_id AND u.role='CUSTOMER'
      GROUP BY 1 ORDER BY users DESC LIMIT 8`
  )).map(r => ({ city: r.city, users: Number(r.users) }));

  const paymentBreakdown = (await getAll(
    `SELECT payment_status AS status, COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS amount
       FROM orders GROUP BY payment_status`
  )).map(r => ({ status: r.status, count: Number(r.count), amount: Number(r.amount) }));

  const shipmentByStatus = (await getAll(
    `SELECT COALESCE(NULLIF(shipment_status,''),'NOT_CREATED') AS status, COUNT(*) AS count
       FROM orders GROUP BY 1 ORDER BY count DESC`
  )).map(r => ({ status: r.status, count: Number(r.count) }));

  const topProducts = (await getAll(
    `SELECT product_name AS name, SUM(quantity) AS qty, COALESCE(SUM(total_price),0) AS revenue
       FROM order_items GROUP BY product_name ORDER BY revenue DESC LIMIT 8`
  )).map(r => ({ name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) }));

  res.json({ salesByDay, ordersByArea, usersByCity, paymentBreakdown, shipmentByStatus, topProducts });
});

/* ======================================================================
   Delivery — Warehouses
   ====================================================================== */

router.get('/delivery/warehouses', async (_req, res) => {
  const rows = await getAll('SELECT * FROM warehouses ORDER BY is_default DESC, id ASC');
  res.json(rows.map(serializeWarehouse));
});

router.post('/delivery/warehouses', async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.pickupLocation || !b.pincode) throw new ApiError('name, pickupLocation and pincode are required', 400);

  // Register with Delhivery unless caller says it's already registered there.
  const dhResult = (!b.skipDelhivery && delhiveryConfigured())
    ? await createWarehouseOnDelhivery(b)
    : { ok: true, skipped: true };

  if (b.isDefault) await query('UPDATE warehouses SET is_default = FALSE');

  const row = await getOne(
    `INSERT INTO warehouses (name, registered_name, pickup_location, address_line1, address_line2, city, state, pincode, return_pincode, phone, email, is_active, is_default, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [b.name, b.registeredName || b.name, b.pickupLocation, b.addressLine1 || null, b.addressLine2 || null,
     b.city || null, b.state || null, b.pincode, b.returnPincode || b.pincode,
     b.phone || null, b.email || null, true, !!b.isDefault, nowIso()]
  );
  res.json({ ...serializeWarehouse(row), delhivery: dhResult });
});

router.put('/delivery/warehouses/:id', async (req, res) => {
  const existing = await getOne('SELECT * FROM warehouses WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError('Warehouse not found', 404);
  const b = req.body || {};

  const dhResult = delhiveryConfigured() ? await updateWarehouseOnDelhivery({ ...b, pickupLocation: existing.pickup_location }) : { ok: false, reason: 'not_configured' };

  const row = await getOne(
    `UPDATE warehouses SET name=$1, registered_name=$2, address_line1=$3, address_line2=$4, city=$5, state=$6, pincode=$7, return_pincode=$8, phone=$9, email=$10
     WHERE id=$11 RETURNING *`,
    [b.name || existing.name, b.registeredName || existing.registered_name,
     b.addressLine1 || null, b.addressLine2 || null, b.city || null, b.state || null,
     b.pincode || existing.pincode, b.returnPincode || existing.return_pincode,
     b.phone || null, b.email || null, req.params.id]
  );
  res.json({ ...serializeWarehouse(row), delhivery: dhResult });
});

router.patch('/delivery/warehouses/:id/default', async (req, res) => {
  const existing = await getOne('SELECT 1 FROM warehouses WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError('Warehouse not found', 404);
  await query('UPDATE warehouses SET is_default = FALSE');
  await query('UPDATE warehouses SET is_default = TRUE WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

router.patch('/delivery/warehouses/:id/toggle', async (req, res) => {
  const existing = await getOne('SELECT * FROM warehouses WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError('Warehouse not found', 404);
  const row = await getOne('UPDATE warehouses SET is_active = $1 WHERE id = $2 RETURNING *', [!existing.is_active, req.params.id]);
  res.json(serializeWarehouse(row));
});

/* ======================================================================
   Delivery — Shipping cost (admin reference; customer always pays ₹100)
   ====================================================================== */

router.get('/delivery/shipping-cost', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);
  const { destPin, weight = '0.5', cod = '0', mode = 'S' } = req.query;
  // Origin from default warehouse, fall back to env
  const wh = await getOne('SELECT pincode FROM warehouses WHERE is_default = TRUE AND is_active = TRUE LIMIT 1');
  const originPin = wh?.pincode || process.env.ORIGIN_PINCODE || '';
  if (!originPin) throw new ApiError('No default warehouse / origin pincode configured', 400);
  if (!destPin) throw new ApiError('destPin is required', 400);
  const result = await getShippingCost({ originPin, destPin, weight: Number(weight), cod: Number(cod), mode });
  res.json(result);
});

/* ======================================================================
   Delivery — Shipment actions per order
   ====================================================================== */

// POST /api/admin/orders/:id/shipment — create shipment on Delhivery for this order
router.post('/orders/:id/shipment', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);

  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (order.delhivery_waybill) throw new ApiError('Shipment already created for this order', 409);

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
    shipping_mode: 'Surface',
    address_type: 'home',
    seller_gst_tin: '',
  };

  const result = await createShipment(shipmentData, wh.pickup_location);
  if (!result.ok) {
    console.log(`[ADMIN-SHIPMENT] create FAILED | order=${order.order_number} | reason=${result.reason} | detail=${JSON.stringify(result.detail || '').slice(0, 300)}`);
    return res.status(502).json({ error: result.reason, detail: result.detail });
  }

  await query(
    `UPDATE orders SET delhivery_waybill=$1, shipment_status='CREATED', tracking_url=$2, label_generated=TRUE, updated_at=$3 WHERE id=$4`,
    [result.waybill, `https://www.delhivery.com/track/package/${result.waybill}`, nowIso(), order.id]
  );
  console.log(`[ADMIN-SHIPMENT] create OK | order=${order.order_number} | waybill=${result.waybill} | label=ready`);
  const updated = await getOne('SELECT * FROM orders WHERE id = $1', [order.id]);
  const serialized = serializeOrder(updated, items, address);
  res.json({ ...serialized, waybill: result.waybill });
});

// DELETE /api/admin/orders/:id/shipment — cancel shipment
router.delete('/orders/:id/shipment', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (!order.delhivery_waybill) throw new ApiError('No shipment exists for this order', 400);

  console.log(`[ADMIN-SHIPMENT] cancel | order=${order.order_number} | waybill=${order.delhivery_waybill}`);
  const result = await cancelShipment(order.delhivery_waybill);
  if (!result.ok) {
    console.log(`[ADMIN-SHIPMENT] cancel FAILED | waybill=${order.delhivery_waybill} | reason=${result.reason}`);
    return res.status(502).json({ error: result.reason, detail: result.detail });
  }

  await query(
    `UPDATE orders SET shipment_status='CANCELLED', updated_at=$1 WHERE id=$2`,
    [nowIso(), order.id]
  );
  res.json({ ok: true, waybill: order.delhivery_waybill });
});

// GET /api/admin/orders/:id/track — pull fresh tracking from Delhivery
router.get('/orders/:id/track', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (!order.delhivery_waybill) return res.json({ ok: false, reason: 'no_shipment' });

  const result = await trackShipment(order.delhivery_waybill);
  if (result.ok && result.data) {
    // Update our local shipment_status from tracking data
    const pkg = Array.isArray(result.data?.ShipmentData) ? result.data.ShipmentData[0]?.Shipment : null;
    if (pkg?.Status?.Status) {
      await query('UPDATE orders SET shipment_status=$1, updated_at=$2 WHERE id=$3',
        [pkg.Status.Status, nowIso(), order.id]);
    }
  }
  res.json(result);
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
  res.json(result);
});

export default router;
