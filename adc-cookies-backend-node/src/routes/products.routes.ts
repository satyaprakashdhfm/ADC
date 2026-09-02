import { Router } from 'express';
import { getAll, getOne } from '../db/index.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeProduct, withImageUrls } from '../serializers/index.js';
import { readBannerMessages, resolveHeroBanner } from '../services/siteContent.service.js';
import { resolvePackOptions } from '../services/pack.service.js';
import { publicCache } from '../middlewares/cache.middleware.js';

const router = Router();

router.get('/', async (req, res) => {
  const { category, search } = req.query;
  let rows;
  if (search && String(search).trim()) {
    rows = await getAll('SELECT * FROM products WHERE name ILIKE $1 ORDER BY id', [`%${String(search).trim()}%`]);
  } else if (category) {
    rows = await getAll('SELECT * FROM products WHERE category = $1 AND is_available = TRUE ORDER BY id', [String(category)]);
  } else {
    rows = await getAll('SELECT * FROM products WHERE is_available = TRUE ORDER BY id');
  }
  /* The catalogue is identical for every visitor and is fetched on every page load, so it is worth
     having at the edge. Sixty seconds: long enough to absorb a burst, short enough that switching a
     product off in admin shows up almost at once, and far inside the life of the signed image URLs
     this response carries. */
  publicCache(res, 60);
  res.json(await withImageUrls(rows.map(serializeProduct)));
});

/* Public: the rotating lines for the top ribbon, in the order the admin arranged them.
   Declared before '/:id' so "announcement" isn't captured as an id.

   `text` is the old single-offer shape, kept because the frontend and backend deploy to different
   hosts and so never cut over at the same instant — during that window an older bundle is still
   asking for it. */
router.get('/announcement', async (_req, res) => {
  const messages = await readBannerMessages();
  publicCache(res, 60);
  res.json({ messages, text: messages[0] || null });
});

/* Public: the home page's hero photograph and where clicking it goes.
   Declared before '/:id' so "hero-banner" isn't captured as an id.

   Asked for at run time rather than baked into the page because an uploaded image resolves to a
   SIGNED url with an expiry — one captured at build time would stop working a week after a deploy,
   on the first image every visitor sees. Nothing set here means the storefront keeps the file it
   ships, so this can never blank the hero. */
router.get('/hero-banner', async (_req, res) => {
  publicCache(res, 60);
  res.json(await resolveHeroBanner());
});

/* Public: is online ordering paused, and what should we say?
   Declared before '/:id' so "ordering-status" isn't captured as an id.
   Read by checkout before it will place an order, and by the storefront so the message is on screen
   long before anybody reaches the payment step. */
router.get('/ordering-status', async (_req, res) => {
  const row = await getOne("SELECT value FROM site_settings WHERE key = 'ordering_paused'");
  /* Deliberately NOT cached, alone among its neighbours. This is the switch that decides whether
     the shop can take money, and checkout reads it immediately before placing an order — a stale
     "we are open" served from an edge for even a minute is an order taken during a pause. */
  res.json({ paused: !!row?.value, message: row?.value || null });
});

/* Public: what goes in a build-your-own pack, resolved against the live catalogue.
   Declared before '/:id' so "packs" isn't captured as an id.

   The slots and their eligible cookies are worked out on the server (see packs.js) rather than
   listed in the storefront, because the same rules decide whether an order is accepted. Two copies
   of "which cookie may go in which slot" is how a picker and a validator end up disagreeing, and
   the customer meets that disagreement at the Pay button. */
router.get('/packs', async (_req, res) => {
  const rows = await getAll("SELECT * FROM products WHERE is_available = TRUE AND category = 'COMBOS' ORDER BY id");
  const packs = (await Promise.all(rows.map(resolvePackOptions))).filter(Boolean);
  publicCache(res, 60);
  res.json(packs);
});

router.get('/:id', async (req, res) => {
  const row = await getOne('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!row) throw new ApiError('Product not found');
  publicCache(res, 60);
  res.json(await withImageUrls(serializeProduct(row)));
});

export default router;
