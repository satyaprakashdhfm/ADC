import { Router } from 'express';
import { trafficReport, liveVisitors } from '../../services/trafficAnalytics.service.js';

/*
 * The admin "Traffic" tab. Behind requireAdminSession like everything under /api/admin.
 *
 * GET /traffic?from&to   visits, sources, Meta ads and the orders they led to, for a date range
 * GET /traffic/live      who is on the site in the last 30 minutes
 *
 * Both are cached in the service; ?fresh=1 skips the cache for the tab's Refresh button.
 */
const router = Router();

/* Dates as YYYY-MM-DD, cut in IST — the same rules as /analytics, so the two tabs agree on what
   "today" and "the last 30 days" mean. Capped at two years: GA4 keeps fourteen months by default
   and nothing older is worth nine queries. */
function range(query: any) {
  const istDay = (ms: number) => new Date(ms + 5.5 * 3600_000).toISOString().slice(0, 10);
  const ok = (s: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  let from = ok(query.from) ? String(query.from) : istDay(Date.now() - 29 * 864e5);
  let to = ok(query.to) ? String(query.to) : istDay(Date.now());
  if (from > to) [from, to] = [to, from];
  const floor = istDay(Date.parse(to) - 730 * 864e5);
  if (from < floor) from = floor;
  return { from, to };
}

router.get('/traffic', async (req, res) => {
  const { from, to } = range(req.query);
  res.json(await trafficReport(from, to, { fresh: req.query.fresh === '1' }));
});

router.get('/traffic/live', async (req, res) => {
  res.json(await liveVisitors({ fresh: req.query.fresh === '1' }));
});

export default router;
