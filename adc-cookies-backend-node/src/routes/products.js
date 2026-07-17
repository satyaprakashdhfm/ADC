import { Router } from 'express';
import { getAll, getOne } from '../db.js';
import { ApiError } from '../middleware.js';
import { serializeProduct } from '../serializers.js';

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

// Public: the product the admin chose to feature in the homepage promo popup (or null).
// Declared before '/:id' so "promo" isn't captured as an id.
router.get('/promo', async (_req, res) => {
  const setting = await getOne("SELECT value FROM site_settings WHERE key = 'promo_product_id'");
  const id = setting?.value ? Number(setting.value) : null;
  if (!id) return res.json(null);
  const product = await getOne('SELECT * FROM products WHERE id = $1 AND is_available = TRUE', [id]);
  res.json(product ? serializeProduct(product) : null);
});

// Public: the admin's current header-banner offer text (or null) — free text, so the admin
// only ever advertises a real, currently-active offer, never a hardcoded placeholder.
// Declared before '/:id' so "announcement" isn't captured as an id.
router.get('/announcement', async (_req, res) => {
  const setting = await getOne("SELECT value FROM site_settings WHERE key = 'header_offer'");
  res.json({ text: setting?.value || null });
});

// Public: today's stall/store-visit note (or null) — shown as a homepage card.
// Declared before '/:id' so "stall-info" isn't captured as an id.
router.get('/stall-info', async (_req, res) => {
  const setting = await getOne("SELECT value FROM site_settings WHERE key = 'stall_info'");
  res.json({ text: setting?.value || null });
});

router.get('/:id', async (req, res) => {
  const row = await getOne('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!row) throw new ApiError('Product not found');
  res.json(serializeProduct(row));
});

export default router;
