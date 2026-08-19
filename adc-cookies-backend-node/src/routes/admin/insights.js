import { Router } from 'express';
import { getOne, getAll } from '../../db.js';

const router = Router();

/*
 * Dashboard numbers and the Overview charts.
 *
 * Two faults lived in the same place here, and they are worth naming because the symptom read as
 * missing data rather than as a break:
 *
 *   1. Every query cut days with LEFT(created_at, 10), on the assumption that created_at was ISO
 *      text. It is TIMESTAMPTZ, and Postgres has no left(timestamptz, integer) — so the call raised
 *      "function left(timestamp with time zone, integer) does not exist" and the WHOLE /analytics
 *      endpoint 500'd on every request. The client swallowed the error, so all four charts painted
 *      their empty states: "No payments yet", "No shipments yet", "No orders yet". Nothing was ever
 *      counted at all.
 *
 *   2. Even once that is fixed, cutting days in the session timezone (UTC, on Supabase) files an
 *      order placed at 1am IST under the previous day. The shop trades in IST and the admin reads
 *      these charts as trading days, so days are cut in IST.
 *
 * A CANCELLED order is not a sale. Revenue, order counts, the city breakdown and top products all
 * exclude them, which is what makes these totals agree with the Orders tab. They are still
 * reported, separately, as cancelledOrders/cancelledByDay — money that was nearly taken is worth
 * seeing, just not inside the revenue line.
 */

/** The day an order belongs to, in the timezone the shop actually trades in. */
const IST_DAY = "(o.created_at AT TIME ZONE 'Asia/Kolkata')::date";
/** Cancelled covers both halves: an abandoned checkout, and an admin cancellation after payment. */
const VALID = "o.order_status <> 'CANCELLED'";

/* ---------- Dashboard ---------- */
router.get('/dashboard', async (_req, res) => {
  const orders = await getAll('SELECT total_amount, order_status, payment_status FROM orders');
  const live = orders.filter((o) => o.order_status !== 'CANCELLED');
  const totalOrders = live.length;
  const cancelledOrders = orders.length - live.length;
  const totalRevenue = live.reduce((s, o) => s + Number(o.total_amount), 0);
  const paidRevenue = live.filter((o) => o.payment_status === 'PAID').reduce((s, o) => s + Number(o.total_amount), 0);

  const { c: totalProducts } = await getOne('SELECT COUNT(*) AS c FROM products');
  const { c: unavailableProducts } = await getOne('SELECT COUNT(*) AS c FROM products WHERE is_available = FALSE');
  const { c: totalUsers } = await getOne("SELECT COUNT(*) AS c FROM users WHERE role = 'CUSTOMER'");
  /* Admins live in admin_accounts now, not users.role — that column was retired when the dashboard
     moved to its own phone-allowlist login, so counting 'ADMIN' rows in users always returned 0. */
  let totalAdmins = 0;
  try { const r = await getOne('SELECT COUNT(*) AS c FROM admin_accounts WHERE is_active = TRUE'); totalAdmins = Number(r.c); } catch { /* table arrives on first boot */ }
  let newMessages = 0;
  try { const r = await getOne('SELECT COUNT(*) AS c FROM contact_messages WHERE handled = FALSE'); newMessages = Number(r.c); } catch { /* older schema */ }

  /* Orders grouped by status (PLACED / PREPARING / DELIVERED …). CANCELLED is deliberately absent:
     it has its own number above rather than a bar competing with the live ones. */
  const ordersByStatus = {};
  for (const o of live) ordersByStatus[o.order_status] = (ordersByStatus[o.order_status] || 0) + 1;

  // Top products by quantity sold, cancelled orders excluded — an abandoned basket is not a sale.
  const topRows = await getAll(
    `SELECT oi.product_name, SUM(oi.quantity) AS qty, SUM(oi.total_price) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE ${VALID}
      GROUP BY oi.product_name ORDER BY qty DESC LIMIT 5`
  );
  const topProducts = topRows.map((r) => ({ name: r.product_name, qty: Number(r.qty), revenue: Number(r.revenue) }));

  res.json({
    totalOrders, cancelledOrders, totalRevenue, paidRevenue,
    totalProducts: Number(totalProducts),
    unavailableProducts: Number(unavailableProducts),
    totalUsers: Number(totalUsers), totalAdmins,
    newMessages,
    ordersByStatus, topProducts,
  });
});

/* ---------- Analytics (charts) ---------- */
// All order-based metrics are scoped to [from, to] inclusive, cut on IST calendar days.
// Defaults to the last 30 days when no range is given.
router.get('/analytics', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const def = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  let from = okDate(req.query.from) ? req.query.from : def;
  let to = okDate(req.query.to) ? req.query.to : today;
  if (from > to) [from, to] = [to, from];
  const p = [from, to];
  const inRange = `${IST_DAY} BETWEEN $1::date AND $2::date`;

  /* ::text on the date so the wire format is a plain YYYY-MM-DD the chart can key on, rather than a
     driver-dependent Date that picks up a timezone again on the way out. */
  const salesByDay = (await getAll(
    `SELECT ${IST_DAY}::text AS day,
            COUNT(*) AS orders,
            COALESCE(SUM(o.total_amount),0) AS revenue,
            COALESCE(SUM(CASE WHEN o.payment_status='PAID' THEN o.total_amount ELSE 0 END),0) AS paid
       FROM orders o WHERE ${inRange} AND ${VALID} GROUP BY 1 ORDER BY 1`, p
  )).map((r) => ({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue), paid: Number(r.paid) }));

  /* Cancelled orders per day, alongside the revenue series rather than inside it — so a run of
     abandoned checkouts is visible without inflating what the shop actually took. */
  const cancelledByDay = (await getAll(
    `SELECT ${IST_DAY}::text AS day, COUNT(*) AS orders
       FROM orders o WHERE ${inRange} AND o.order_status = 'CANCELLED' GROUP BY 1 ORDER BY 1`, p
  )).map((r) => ({ day: r.day, orders: Number(r.orders) }));

  /*
   * Where the orders actually went.
   *
   * The city is the delivery address's city, which is the only place the customer's own city is
   * recorded. Orders also carry a store_code, but that answers a different question — an outstation
   * parcel is baked in Bengaluru and delivered to Hyderabad, so grouping on the store would file it
   * under the wrong city entirely.
   *
   * LEFT JOIN, so an order whose address row was deleted still counts (under 'Unknown') instead of
   * vanishing from a total the admin is reconciling against the Orders tab. INITCAP(LOWER(city))
   * merges case variants of legacy rows ("bengaluru"/"BENGALURU" -> "Bengaluru"), and TRIM catches
   * the ones with a stray leading space, which used to group as a separate city.
   */
  const ordersByArea = (await getAll(
    `SELECT COALESCE(INITCAP(LOWER(NULLIF(TRIM(a.city),''))),'Unknown') AS city,
            COUNT(o.id) AS orders,
            COALESCE(SUM(o.total_amount),0) AS revenue
       FROM orders o LEFT JOIN addresses a ON a.id = o.address_id
      WHERE ${inRange} AND ${VALID}
      GROUP BY 1 ORDER BY orders DESC, revenue DESC LIMIT 8`, p
  )).map((r) => ({ city: r.city, orders: Number(r.orders), revenue: Number(r.revenue) }));

  // Distinct customers who ordered in this period, by their delivery city.
  const usersByCity = (await getAll(
    `SELECT COALESCE(INITCAP(LOWER(NULLIF(TRIM(a.city),''))),'Unknown') AS city, COUNT(DISTINCT o.user_id) AS users
       FROM orders o LEFT JOIN addresses a ON a.id = o.address_id
      WHERE ${inRange} AND ${VALID}
      GROUP BY 1 ORDER BY users DESC LIMIT 8`, p
  )).map((r) => ({ city: r.city, users: Number(r.users) }));

  /*
   * Payments and shipments deliberately count EVERY order in the range, cancelled included.
   *
   * These two answer "what state is the money / the parcel in", and a cancelled order still has a
   * payment state worth seeing — a cancelled-but-PAID row is a refund somebody owes. Excluding them
   * here would hide exactly the rows an admin opens this panel to find.
   */
  const paymentBreakdown = (await getAll(
    `SELECT o.payment_status AS status, COUNT(*) AS count, COALESCE(SUM(o.total_amount),0) AS amount
       FROM orders o WHERE ${inRange} GROUP BY 1 ORDER BY count DESC`, p
  )).map((r) => ({ status: r.status, count: Number(r.count), amount: Number(r.amount) }));

  const shipmentByStatus = (await getAll(
    `SELECT COALESCE(NULLIF(TRIM(o.shipment_status),''),'NOT_CREATED') AS status, COUNT(*) AS count
       FROM orders o WHERE ${inRange} GROUP BY 1 ORDER BY count DESC`, p
  )).map((r) => ({ status: r.status, count: Number(r.count) }));

  const topProducts = (await getAll(
    `SELECT oi.product_name AS name, SUM(oi.quantity) AS qty, COALESCE(SUM(oi.total_price),0) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE ${inRange} AND ${VALID}
      GROUP BY 1 ORDER BY revenue DESC LIMIT 8`, p
  )).map((r) => ({ name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) }));

  res.json({ from, to, salesByDay, cancelledByDay, ordersByArea, usersByCity, paymentBreakdown, shipmentByStatus, topProducts });
});

export default router;
