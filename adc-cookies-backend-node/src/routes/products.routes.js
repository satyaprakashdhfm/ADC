import { Router } from 'express';
import { getAll, getOne } from '../db/index.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeProduct, withImageUrls } from '../serializers/index.js';
import { readBannerMessages } from '../services/bannerMessages.service.js';
import { resolveHeroBanner } from '../services/heroBanner.service.js';
import { resolvePackOptions } from '../services/pack.service.js';

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
  res.json(await withImageUrls(rows.map(serializeProduct)));
});

/* Public: the rotating lines for the top ribbon, in the order the admin arranged them.
   Declared before '/:id' so "announcement" isn't captured as an id.

   `text` is the old single-offer shape, kept because the frontend and backend deploy to different
   hosts and so never cut over at the same instant — during that window an older bundle is still
   asking for it. */
router.get('/announcement', async (_req, res) => {
  const messages = await readBannerMessages();
  res.json({ messages, text: messages[0] || null });
});

/* Public: the home page's hero photograph and where clicking it goes.
   Declared before '/:id' so "hero-banner" isn't captured as an id.

   Asked for at run time rather than baked into the page because an uploaded image resolves to a
   SIGNED url with an expiry — one captured at build time would stop working a week after a deploy,
   on the first image every visitor sees. Nothing set here means the storefront keeps the file it
   ships, so this can never blank the hero. */
router.get('/hero-banner', async (_req, res) => {
  res.json(await resolveHeroBanner());
});

/* Public: is online ordering paused, and what should we say?
   Declared before '/:id' so "ordering-status" isn't captured as an id.
   Read by checkout before it will place an order, and by the storefront so the message is on screen
   long before anybody reaches the payment step. */
router.get('/ordering-status', async (_req, res) => {
  const row = await getOne("SELECT value FROM site_settings WHERE key = 'ordering_paused'");
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
  res.json(packs);
});

router.get('/:id', async (req, res) => {
  const row = await getOne('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!row) throw new ApiError('Product not found');
  res.json(await withImageUrls(serializeProduct(row)));
});

export default router;
