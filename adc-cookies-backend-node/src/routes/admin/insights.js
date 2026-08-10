import { Router } from 'express';
import { getOne, getAll, query } from '../../db.js';

const router = Router();

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

export default router;
