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
  fetchDocument,
  DELHIVERY_DOC_TYPES,
} from '../delhivery.js';
import { shadowfaxConfigured, trackShadowfax, getShadowfaxPod, sfxStatusLabel, SFX_STORES, sfxServiceability } from '../shadowfax.js';

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
  // Set-based fetch instead of one query per order: 3 queries total, not 3*N. The old
  // per-order Promise.all fired ~3*N simultaneous queries and exhausted the Supabase
  // session pooler (~15 client cap) -> EMAXCONNSESSION -> 500 (empty admin shipments table).
  const orderIds = rows.map((o) => o.id);
  const addrIds = [...new Set(rows.map((o) => o.address_id).filter(Boolean))];
  const [items, payments, addresses, warnings] = await Promise.all([
    orderIds.length ? getAll('SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id', [orderIds]) : [],
    orderIds.length ? getAll('SELECT DISTINCT ON (order_id) order_id, provider, transaction_id, status, paid_at FROM payments WHERE order_id = ANY($1) ORDER BY order_id, id DESC', [orderIds]) : [],
    addrIds.length ? getAll('SELECT * FROM addresses WHERE id = ANY($1)', [addrIds]) : [],
    orderIds.length ? getAll("SELECT DISTINCT order_id FROM order_tracking WHERE order_id = ANY($1) AND status = 'DUPLICATE_CHARGE_WARNING'", [orderIds]) : [],
  ]);
  const itemsByOrder = new Map();
  for (const it of items) {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id).push(it);
  }
  const payByOrder = new Map(payments.map((p) => [p.order_id, p]));
  const addrById = new Map(addresses.map((a) => [a.id, a]));
  const duplicateChargeOrderIds = new Set(warnings.map((w) => w.order_id));
  const serialized = rows.map((o) =>
    serializeOrder(o, itemsByOrder.get(o.id) || [], o.address_id ? addrById.get(o.address_id) || null : null, payByOrder.get(o.id) || null,
      duplicateChargeOrderIds.has(o.id) ? ['DUPLICATE_CHARGE'] : [])
  );
  res.json(serialized);
});

router.get('/orders/:id', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found');
  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [order.id]);
  const address = order.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null;
  const payment = await getOne(PAYMENT_SELECT, [order.id]);
  const hasDuplicateCharge = await getOne("SELECT 1 FROM order_tracking WHERE order_id = $1 AND status = 'DUPLICATE_CHARGE_WARNING' LIMIT 1", [order.id]);
  res.json(serializeOrder(order, items, address, payment, hasDuplicateCharge ? ['DUPLICATE_CHARGE'] : []));
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
  // Attach live redemption counts so the UI can show Active / Expired / Limit-reached at a glance.
  const withUsage = await Promise.all(rows.map(async (c) => {
    const { n } = await getOne('SELECT COUNT(*) AS n FROM coupon_usage WHERE coupon_id = $1', [c.id]);
    return { ...serializeCoupon(c), timesUsed: Number(n) };
  }));
  res.json(withUsage);
});

router.post('/coupons', async (req, res) => {
  const b = req.body || {};
  const row = await getOne(
    `INSERT INTO coupons (code, discount_type, discount_value, minimum_order_amount, maximum_discount, expiry_date, usage_limit, is_active, spin_weight, spin_label, terms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [String(b.code || '').toUpperCase(), b.discountType, b.discountValue,
     b.minimumOrderAmount ?? null, b.maximumDiscount ?? null, b.expiryDate ?? null,
     b.usageLimit ?? null, b.isActive !== false,
     b.spinWeight ?? null, b.spinLabel ?? null, b.terms ?? null]
  );
  res.json(serializeCoupon(row));
});

// Full edit — used by the Spin Wheel Offers panel to adjust odds/terms/limits on an existing
// reward (creating a fresh row each time would break the /order?coupon= links already handed
// out and orphan its usage history).
router.put('/coupons/:id', async (req, res) => {
  const b = req.body || {};
  const row = await getOne(
    `UPDATE coupons SET code=$1, discount_type=$2, discount_value=$3, minimum_order_amount=$4,
       maximum_discount=$5, expiry_date=$6, usage_limit=$7, is_active=$8, spin_weight=$9, spin_label=$10, terms=$11
     WHERE id=$12 RETURNING *`,
    [String(b.code || '').toUpperCase(), b.discountType, b.discountValue,
     b.minimumOrderAmount ?? null, b.maximumDiscount ?? null, b.expiryDate ?? null,
     b.usageLimit ?? null, b.isActive !== false,
     b.spinWeight ?? null, b.spinLabel ?? null, b.terms ?? null, req.params.id]
  );
  if (!row) throw new ApiError('Coupon not found', 404);
  res.json(serializeCoupon(row));
});

router.patch('/coupons/:id/toggle', async (req, res) => {
  const coupon = await getOne('SELECT * FROM coupons WHERE id = $1', [req.params.id]);
  if (!coupon) throw new ApiError('Coupon not found');
  const row = await getOne('UPDATE coupons SET is_active = $1 WHERE id = $2 RETURNING *', [!coupon.is_active, coupon.id]);
  res.json(serializeCoupon(row));
});

router.delete('/coupons/:id', async (req, res) => {
  const coupon = await getOne('SELECT * FROM coupons WHERE id = $1', [req.params.id]);
  if (!coupon) throw new ApiError('Coupon not found', 404);
  await query('DELETE FROM coupon_usage WHERE coupon_id = $1', [coupon.id]);
  await query('DELETE FROM spin_claims WHERE coupon_id = $1', [coupon.id]);
  await query('DELETE FROM coupons WHERE id = $1', [coupon.id]);
  res.json({ ok: true });
});

/* ---------- Users ---------- */
router.get('/users', async (_req, res) => {
  // Customers only — admin accounts are separated out and never listed here.
  const rows = await getAll("SELECT * FROM users WHERE role <> 'ADMIN' ORDER BY id DESC");
  const withCounts = await Promise.all(rows.map(async (u) => {
    const { c } = await getOne('SELECT COUNT(*) AS c FROM orders WHERE user_id = $1', [u.id]);
    // Their saved delivery addresses (default first) so the Customers tab can show where they order from.
    const addrs = await getAll('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC', [u.id]);
    return { ...serializeUser(u), orderCount: Number(c), addresses: addrs.map(serializeAddress) };
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

/* ---------- Site settings (homepage promo popup target + header banner offer) ---------- */
router.get('/settings', async (_req, res) => {
  const row = await getOne("SELECT value FROM site_settings WHERE key = 'promo_product_id'");
  const offer = await getOne("SELECT value FROM site_settings WHERE key = 'header_offer'");
  const stall = await getOne("SELECT value FROM site_settings WHERE key = 'stall_info'");
  res.json({ promoProductId: row?.value ? Number(row.value) : null, headerOffer: offer?.value || null, stallInfo: stall?.value || null });
});
router.put('/settings', async (req, res) => {
  if (req.body?.promoProductId !== undefined) {
    const raw = req.body.promoProductId;
    const val = raw == null || raw === '' ? null : String(Number(raw));
    if (val === null || Number.isNaN(Number(val))) {
      await query("DELETE FROM site_settings WHERE key = 'promo_product_id'");
    } else {
      await query(
        `INSERT INTO site_settings (key, value) VALUES ('promo_product_id', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [val]
      );
    }
  }
  // Free text the admin controls directly — e.g. "Get 5% off with code XYZ" — so the header
  // banner never advertises a discount that isn't a real, currently-active coupon.
  if (req.body?.headerOffer !== undefined) {
    const text = String(req.body.headerOffer || '').trim();
    if (!text) {
      await query("DELETE FROM site_settings WHERE key = 'header_offer'");
    } else {
      await query(
        `INSERT INTO site_settings (key, value) VALUES ('header_offer', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [text]
      );
    }
  }
  // Today's stall/store-visit note shown as a homepage card — same free-text pattern.
  if (req.body?.stallInfo !== undefined) {
    const text = String(req.body.stallInfo || '').trim();
    if (!text) {
      await query("DELETE FROM site_settings WHERE key = 'stall_info'");
    } else {
      await query(
        `INSERT INTO site_settings (key, value) VALUES ('stall_info', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [text]
      );
    }
  }
  const row = await getOne("SELECT value FROM site_settings WHERE key = 'promo_product_id'");
  const offer = await getOne("SELECT value FROM site_settings WHERE key = 'header_offer'");
  const stall = await getOne("SELECT value FROM site_settings WHERE key = 'stall_info'");
  res.json({ promoProductId: row?.value ? Number(row.value) : null, headerOffer: offer?.value || null, stallInfo: stall?.value || null });
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
// All order-based metrics are scoped to [from, to] (inclusive). created_at is ISO text, so we
// compare on its date prefix (LEFT 10). Defaults to the last 30 days when no range is given.
router.get('/analytics', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const def = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  let from = okDate(req.query.from) ? req.query.from : def;
  let to = okDate(req.query.to) ? req.query.to : today;
  if (from > to) [from, to] = [to, from];
  const p = [from, to];

  const salesByDay = (await getAll(
    `SELECT LEFT(created_at,10) AS day, COUNT(*) AS orders,
            COALESCE(SUM(total_amount),0) AS revenue,
            COALESCE(SUM(CASE WHEN payment_status='PAID' THEN total_amount ELSE 0 END),0) AS paid
       FROM orders WHERE LEFT(created_at,10) BETWEEN $1 AND $2 GROUP BY day ORDER BY day`, p
  )).map(r => ({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue), paid: Number(r.paid) }));

  // INITCAP(LOWER(city)) merges case variants of legacy rows ("bengaluru"/"BENGALURU" -> "Bengaluru").
  const ordersByArea = (await getAll(
    `SELECT COALESCE(INITCAP(LOWER(NULLIF(a.city,''))),'Unknown') AS city, COUNT(o.id) AS orders,
            COALESCE(SUM(o.total_amount),0) AS revenue
       FROM orders o LEFT JOIN addresses a ON a.id = o.address_id
      WHERE LEFT(o.created_at,10) BETWEEN $1 AND $2
      GROUP BY 1 ORDER BY orders DESC LIMIT 8`, p
  )).map(r => ({ city: r.city, orders: Number(r.orders), revenue: Number(r.revenue) }));

  // Distinct customers who ordered in this period, by their delivery city.
  const usersByCity = (await getAll(
    `SELECT COALESCE(INITCAP(LOWER(NULLIF(a.city,''))),'Unknown') AS city, COUNT(DISTINCT o.user_id) AS users
       FROM orders o JOIN addresses a ON a.id = o.address_id
      WHERE LEFT(o.created_at,10) BETWEEN $1 AND $2
      GROUP BY 1 ORDER BY users DESC LIMIT 8`, p
  )).map(r => ({ city: r.city, users: Number(r.users) }));

  const paymentBreakdown = (await getAll(
    `SELECT payment_status AS status, COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS amount
       FROM orders WHERE LEFT(created_at,10) BETWEEN $1 AND $2 GROUP BY payment_status`, p
  )).map(r => ({ status: r.status, count: Number(r.count), amount: Number(r.amount) }));

  const shipmentByStatus = (await getAll(
    `SELECT COALESCE(NULLIF(shipment_status,''),'NOT_CREATED') AS status, COUNT(*) AS count
       FROM orders WHERE LEFT(created_at,10) BETWEEN $1 AND $2 GROUP BY 1 ORDER BY count DESC`, p
  )).map(r => ({ status: r.status, count: Number(r.count) }));

  const topProducts = (await getAll(
    `SELECT oi.product_name AS name, SUM(oi.quantity) AS qty, COALESCE(SUM(oi.total_price),0) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE LEFT(o.created_at,10) BETWEEN $1 AND $2
      GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 8`, p
  )).map(r => ({ name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) }));

  res.json({ from, to, salesByDay, ordersByArea, usersByCity, paymentBreakdown, shipmentByStatus, topProducts });
});

/* ======================================================================
   Delivery — Warehouses
   ====================================================================== */

// All Shadowfax pickup stores + whether each one's pincode is CURRENTLY serviceable on the
// connected Shadowfax environment (staging today) — so admin can see at a glance which stores
// actually work as an intracity pickup point right now vs which ones are only real-store
// listings that the sandbox doesn't service yet. Live-checked on every call (cheap, no caching)
// so this reflects reality immediately, not a stale snapshot.
router.get('/delivery/shadowfax-stores', async (_req, res) => {
  if (!shadowfaxConfigured()) return res.json(SFX_STORES.map((s) => ({ ...s, serviceable: null, services: [] })));
  const results = await Promise.all(SFX_STORES.map(async (s) => {
    const r = await sfxServiceability(s.pincode);
    return { ...s, serviceable: r.ok ? r.serviceable : null, services: r.services || [] };
  }));
  res.json(results);
});

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

// GET /api/admin/orders/:id/track — pull fresh tracking from whichever carrier created the shipment.
router.get('/orders/:id/track', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (!order.delhivery_waybill) return res.json({ ok: false, reason: 'no_shipment' });

  // Shadowfax (intracity) — normalize into { ok, carrier, status, scans } for the admin UI.
  if (order.carrier === 'SHADOWFAX') {
    if (!shadowfaxConfigured()) throw new ApiError('Shadowfax not configured', 503);
    const result = await trackShadowfax(order.delhivery_waybill);
    if (result.ok && result.status) {
      // Store the friendly label, not the raw status_id — the customer-facing track route
      // (routes/orders.js) stores sfxStatusLabel(result.status) here too; storing the raw slug
      // instead would leave shipment_status inconsistently formatted depending on which route
      // last touched it.
      await query('UPDATE orders SET shipment_status=$1, updated_at=$2 WHERE id=$3', [sfxStatusLabel(result.status), nowIso(), order.id]);
    }
    const scans = (result.data?.tracking_details || [])
      .map(t => ({ time: t.created, event: sfxStatusLabel(t.status_id) || t.status || t.remarks }))
      .reverse();
    return res.json({ ok: result.ok, carrier: 'SHADOWFAX', status: sfxStatusLabel(result.status) || result.status || null, scans });
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

// GET /api/admin/orders/:id/shadowfax-doc — Shadowfax documents for an intracity order:
// proof-of-delivery signature (after delivery) + the shareable customer tracking link.
router.get('/orders/:id/shadowfax-doc', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (order.carrier !== 'SHADOWFAX') return res.json({ ok: false, reason: 'not_shadowfax' });
  if (!order.delhivery_waybill) return res.json({ ok: false, reason: 'no_shipment' });
  if (!shadowfaxConfigured()) throw new ApiError('Shadowfax not configured', 503);

  const awb = order.delhivery_waybill;
  const [pod, track] = await Promise.all([getShadowfaxPod(awb), trackShadowfax(awb)]);
  res.json({
    ok: true,
    awb,
    status: track.ok ? (track.status || null) : null,
    trackUrl: track.ok ? (track.trackUrl || null) : null,
    pod: pod.ok ? { recipient: pod.recipient, urls: pod.urls } : null,
  });
});

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
  res.json(result);
});

export default router;
