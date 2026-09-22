import { Router } from 'express';
import { seoReport } from '../../services/seoReport.service.js';

/*
 * The admin "SEO" tab. Behind requireAdminSession like everything under /api/admin.
 *
 * GET /seo?days=28&paths=/cookie-tins,/blog/…   Google Search Console numbers for those pages
 *
 * The paths come from the admin (the SEO plan lives in the frontend). They are checked to be plain
 * site paths and capped at 30, since each one costs a URL Inspection call against a daily quota.
 * Cached in the service; ?fresh=1 skips the cache for the tab's Refresh button.
 */
const router = Router();

const DAYS = new Set([7, 28, 90]);
const PATH = /^\/[a-z0-9\-/]*$/;

router.get('/seo', async (req, res) => {
  const days = DAYS.has(Number(req.query.days)) ? Number(req.query.days) : 28;
  const paths = [...new Set(String(req.query.paths || '').split(',').map(p => p.trim()).filter(p => PATH.test(p)))].slice(0, 30);
  res.json(await seoReport(paths, days, { fresh: req.query.fresh === '1' }));
});

export default router;
