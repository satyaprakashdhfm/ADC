import { Router } from 'express';
import { getOne, getAll, query, nowIso } from '../db.js';
import { requireAdmin, ApiError } from '../middleware.js';
import { serializeProduct, serializeOrder, serializeOrderItem, serializeAddress, serializeCoupon } from '../serializers.js';

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
router.get('/orders', async (_req, res) => {
  const rows = await getAll('SELECT * FROM orders ORDER BY created_at DESC, id DESC');
  const serialized = await Promise.all(rows.map(async (o) => {
    const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [o.id]);
    const address = o.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [o.address_id]) : null;
    return serializeOrder(o, items, address);
  }));
  res.json(serialized);
});

router.get('/orders/:id', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found');
  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [order.id]);
  const address = order.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null;
  res.json(serializeOrder(order, items, address));
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

/* ---------- Dashboard ---------- */
router.get('/dashboard', async (_req, res) => {
  const orders = await getAll('SELECT total_amount FROM orders');
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const { c: totalProducts } = await getOne('SELECT COUNT(*) AS c FROM products');
  res.json({ totalOrders, totalRevenue, totalProducts: Number(totalProducts) });
});

export default router;
