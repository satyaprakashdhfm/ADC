import { Router } from 'express';
import { getOne, getAll, query, nowIso } from '../../db.js';
import { ApiError } from '../../middleware.js';
import { serializeProduct, withImageUrls } from '../../serializers.js';
import { parseMediaList, serialiseMediaList, deleteMedia, isMediaRef } from '../../storage.js';

const router = Router();

/* ---------- Products ---------- */

/*
 * There is no stock quantity any more.
 *
 * The column is still on the table (dropping it would rewrite a live table for no gain) but nothing
 * reads or writes it: a cookie shop bakes to order, and a number nobody decrements is worse than no
 * number at all — it was driving a "low stock" warning off a figure that had not changed since the
 * row was seeded. Availability is the one switch: is_available, plus the per-delivery-mode and
 * per-store flags that already existed.
 */

/**
 * What the client is allowed to set on a product.
 *
 * imageRefs is the list of STORED references ('supabase://products/…' or a legacy '/assets/…' path),
 * never the signed URLs the GET handed out. Writing a signed URL back into the column would work for
 * a week and then 404, so the field the admin form round-trips is deliberately a different one from
 * the field it displays — see serializeProduct.
 *
 * `images` is still accepted as a fallback for an older bundle that has not been redeployed yet, but
 * only when it is not one of our own signed URLs.
 */
function productValues(b) {
  const refs = Array.isArray(b.imageRefs)
    ? b.imageRefs
    : parseMediaList(b.images).filter((v) => !/\/storage\/v1\/object\/sign\//.test(v));
  return [
    b.name, b.category, b.description ?? null, b.price,
    serialiseMediaList(refs), b.options ?? null, b.isAvailable !== false,
    b.menuGroup ?? null, b.tag ?? null, !!b.featured,
    b.intracityAvailable !== false, b.intracityUnavailableReason || null,
    b.intercityAvailable !== false, b.intercityUnavailableReason || null,
    b.restrictCities || null,
  ];
}

router.get('/products', async (_req, res) => {
  const rows = await getAll('SELECT * FROM products ORDER BY id');
  res.json(await withImageUrls(rows.map(serializeProduct)));
});

router.post('/products', async (req, res) => {
  const b = req.body || {};
  const ts = nowIso();
  const row = await getOne(
    `INSERT INTO products (name, category, description, price, images, options, is_available, menu_group, tag, featured,
       intracity_available, intracity_unavailable_reason, intercity_available, intercity_unavailable_reason, restrict_cities, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
    [...productValues(b), ts, ts]
  );
  res.json(await withImageUrls(serializeProduct(row)));
});

router.put('/products/:id', async (req, res) => {
  const existing = await getOne('SELECT images FROM products WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError('Product not found');
  const b = req.body || {};
  const row = await getOne(
    `UPDATE products SET name=$1, category=$2, description=$3, price=$4,
       images=$5, options=$6, is_available=$7, menu_group=$8, tag=$9, featured=$10,
       intracity_available=$11, intracity_unavailable_reason=$12,
       intercity_available=$13, intercity_unavailable_reason=$14,
       restrict_cities=$15, updated_at=$16 WHERE id=$17 RETURNING *`,
    [...productValues(b), nowIso(), req.params.id]
  );

  /* Tidy up an uploaded photo the edit just dropped. Done AFTER the row is saved, and only for refs
     the new row no longer names — deleting first would leave a broken image if the write failed. */
  const kept = new Set(parseMediaList(row.images));
  for (const ref of parseMediaList(existing.images)) {
    if (isMediaRef(ref) && !kept.has(ref)) await deleteMedia(ref);
  }

  res.json(await withImageUrls(serializeProduct(row)));
});

router.delete('/products/:id', async (req, res) => {
  const existing = await getOne('SELECT images FROM products WHERE id = $1', [req.params.id]);
  await query('DELETE FROM products WHERE id = $1', [req.params.id]);
  // Nothing points at these objects now, so leaving them would just accrue storage cost forever.
  for (const ref of parseMediaList(existing?.images)) if (isMediaRef(ref)) await deleteMedia(ref);
  res.status(200).end();
});

export default router;
