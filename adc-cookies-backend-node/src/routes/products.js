import { Router } from 'express';
import { getAll, getOne } from '../db.js';
import { ApiError } from '../middleware.js';
import { serializeProduct } from '../serializers.js';
import { readBannerMessages } from '../bannerMessages.js';

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
  res.json(rows.map(serializeProduct));
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

/* Public: is online ordering paused, and what should we say?
   Declared before '/:id' so "ordering-status" isn't captured as an id.
   Read by checkout before it will place an order, and by the storefront so the message is on screen
   long before anybody reaches the payment step. */
router.get('/ordering-status', async (_req, res) => {
  const row = await getOne("SELECT value FROM site_settings WHERE key = 'ordering_paused'");
  res.json({ paused: !!row?.value, message: row?.value || null });
});

router.get('/:id', async (req, res) => {
  const row = await getOne('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!row) throw new ApiError('Product not found');
  res.json(serializeProduct(row));
});

export default router;
