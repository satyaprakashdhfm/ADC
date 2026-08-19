import { Router } from 'express';
import { getOne, getAll, query, nowIso } from '../../db.js';
import { ApiError } from '../../middleware.js';
import { ADC_STORES, storeProductAvailable, resolveProductAvailability, SERVICE_MODES } from '../../stores.js';
import { hashPassword, defaultPasswordFor } from '../../storeAuth.js';

const router = Router();

/* ---------- Stores (staff portal) ---------- */

/*
 * Every outlet, its staff logins and what it is currently holding.
 *
 * `onStartingPassword` is the closest thing to an honest answer to "what is their password". A hash
 * cannot be read back, so instead we report whether the account has ever been used or had its
 * password changed. If neither has happened, the starting password still works and the UI can print
 * it; once either has, it cannot, and the UI says so rather than showing a stale one.
 */
router.get('/stores', async (_req, res) => {
  const [staff, counts, products] = await Promise.all([
    getAll('SELECT * FROM store_users ORDER BY store_code, username'),
    getAll(`SELECT store_code,
                   COUNT(*) FILTER (WHERE payment_status = 'PAID' AND order_status <> 'CANCELLED') AS paid,
                   COUNT(*) FILTER (WHERE payment_status = 'PAID' AND order_status <> 'CANCELLED' AND store_accepted_at IS NULL) AS unaccepted,
                   COUNT(*) FILTER (WHERE payment_status = 'PAID' AND order_status <> 'CANCELLED' AND (store_pos_bill_no IS NULL OR store_pos_bill_no = '')) AS unbilled
              FROM orders WHERE created_at >= $1 GROUP BY store_code`,
      [new Date(Date.now() - 30 * 864e5).toISOString()]),
    // For "does this store even carry it" — an intracity-disabled or city-restricted product
    // (Red Velvet: Bengaluru only) is a flat no at some stores regardless of storewide availability.
    getAll(`SELECT id, name, intracity_available, restrict_cities FROM products
             WHERE is_available = TRUE AND (intracity_available = FALSE OR restrict_cities IS NOT NULL)`),
  ]);
  const countBy = new Map(counts.map((c) => [c.store_code, c]));
  res.json({
    // Begur is AUTO — we relay it ourselves and it has no accept/bill step, so there is nothing for
    // a staff portal to do there. It never appears here; a login for it can't be created either
    // (see POST /stores/:code/staff below).
    stores: ADC_STORES.filter((s) => s.posMode === 'MANUAL').map((s) => {
      const c = countBy.get(s.code) || {};
      return {
        code: s.code, name: s.name, city: s.city, state: s.state, pincode: s.pincode,
        address: s.address_line_1, phone: s.contact, posMode: s.posMode,
        pickupName: s.pickupName,
        portalPath: `/store/${s.code}`,
        last30Days: { paid: Number(c.paid || 0), unaccepted: Number(c.unaccepted || 0), unbilled: Number(c.unbilled || 0) },
        // Kept in sync with exactly the rule the store's own /menu view and the checkout guard use
        // (storeProductAvailable in stores.js) — nothing here is computed a second, different way.
        doesNotCarry: products.filter((p) => !storeProductAvailable(s.code, p)).map((p) => p.name),
        staff: staff.filter((u) => u.store_code === s.code).map((u) => ({
          id: u.id, username: u.username, name: u.name, isActive: !!u.is_active,
          lastLoginAt: u.last_login_at, passwordSetAt: u.password_set_at,
          onStartingPassword: !u.last_login_at && !u.password_set_at,
          startingPassword: (!u.last_login_at && !u.password_set_at) ? defaultPasswordFor(s.code) : null,
        })),
      };
    }),
    // Accounts pointing at a store code that no longer exists in stores.js. They cannot sign in
    // (requireStoreUser refuses them), so surfacing them is the only way they get cleaned up.
    orphanedStaff: staff.filter((u) => !ADC_STORES.some((s) => s.code === u.store_code))
      .map((u) => ({ id: u.id, username: u.username, storeCode: u.store_code })),
  });
});

/*
 * Every store, online or off — including Begur (AUTO), which the staff-portal /stores endpoint
 * above deliberately excludes. Distinct concept: this is "is it currently taking new orders", not
 * "does it have a staff portal". No row in store_status means active — see isStoreActive in
 * stores.js, which orders.js and delivery.js's checkout quote both already consult.
 */
router.get('/store-status', async (_req, res) => {
  const rows = await getAll('SELECT store_code, is_active, service_mode FROM store_status');
  const byCode = new Map(rows.map((r) => [r.store_code, r]));
  res.json({
    stores: ADC_STORES.map((s) => {
      const row = byCode.get(s.code);
      const mode = String(row?.service_mode || 'BOTH').toUpperCase();
      return {
        code: s.code, name: s.name, city: s.city, posMode: s.posMode,
        isActive: row ? !!row.is_active : true,
        serviceMode: SERVICE_MODES.includes(mode) ? mode : 'BOTH',
      };
    }),
  });
});

/*
 * Which delivery kinds this store takes part in. INTRACITY keeps it out of outstation pickups,
 * INTERCITY keeps it out of same-day. Narrowing every store in one zone to INTERCITY does NOT
 * close that zone — activeZoneStores falls back to the nearest open store rather than refusing the
 * city, so this switch cannot be used to accidentally stop serving Bengaluru.
 */
router.patch('/store-status/:code/service-mode', async (req, res) => {
  const code = String(req.params.code).trim().toLowerCase();
  const store = ADC_STORES.find((s) => s.code === code);
  if (!store) throw new ApiError('No such store');
  const mode = String(req.body?.serviceMode || '').trim().toUpperCase();
  if (!SERVICE_MODES.includes(mode)) throw new ApiError('Delivery mode must be BOTH, INTRACITY or INTERCITY.');
  // The row may not exist yet — a store with no row is active, so preserve that when creating one.
  await query(
    `INSERT INTO store_status (store_code, is_active, service_mode, updated_at) VALUES ($1, TRUE, $2, $3)
     ON CONFLICT (store_code) DO UPDATE SET service_mode = EXCLUDED.service_mode, updated_at = EXCLUDED.updated_at`,
    [code, mode, nowIso()]
  );
  res.json({ ok: true, code, serviceMode: mode });
});

router.patch('/store-status/:code/toggle', async (req, res) => {
  const code = String(req.params.code).trim().toLowerCase();
  const store = ADC_STORES.find((s) => s.code === code);
  if (!store) throw new ApiError('No such store');
  const existing = await getOne('SELECT is_active FROM store_status WHERE store_code = $1', [code]);
  const next = existing ? !existing.is_active : false; // no row yet = currently active, so toggling means turning it off
  await query(
    `INSERT INTO store_status (store_code, is_active, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (store_code) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at`,
    [code, next, nowIso()]
  );
  res.json({ ok: true, code, isActive: next });
});

/*
 * Per-store product availability — a manual override generalizing the intracity_available/
 * restrict_cities rule (which only understands "restricted to city X") to any product/store an
 * admin wants to flip directly, e.g. "Jayanagar is out of Red Velvet today". Returns EVERY
 * available product for the given store with its resolved availability and whether that's an
 * explicit override or the automatic rule, so the admin UI can show one flat on/off list per store.
 */
router.get('/store-products/:code', async (req, res) => {
  const code = String(req.params.code).trim().toLowerCase();
  const store = ADC_STORES.find((s) => s.code === code);
  if (!store) throw new ApiError('No such store');
  const [products, overrides] = await Promise.all([
    getAll('SELECT id, name, intracity_available, restrict_cities FROM products WHERE is_available = TRUE ORDER BY name'),
    getAll('SELECT product_id, is_available FROM store_product_overrides WHERE store_code = $1', [code]),
  ]);
  const overrideBy = new Map(overrides.map((o) => [o.product_id, o.is_available]));
  res.json({
    products: products.map((p) => {
      const override = overrideBy.has(p.id) ? overrideBy.get(p.id) : null;
      return {
        id: p.id, name: p.name,
        available: resolveProductAvailability(code, p, override),
        isOverride: override != null,
        automaticallyAvailable: storeProductAvailable(code, p),
      };
    }),
  });
});

// body: { available: true | false | null } — null clears the override, reverting to the
// automatic intracity_available/restrict_cities rule (or plain availability) for this store/product.
router.put('/store-products/:code/:productId', async (req, res) => {
  const code = String(req.params.code).trim().toLowerCase();
  const store = ADC_STORES.find((s) => s.code === code);
  if (!store) throw new ApiError('No such store');
  const productId = Number(req.params.productId);
  const available = req.body?.available;
  if (available === null) {
    await query('DELETE FROM store_product_overrides WHERE store_code = $1 AND product_id = $2', [code, productId]);
  } else {
    await query(
      `INSERT INTO store_product_overrides (store_code, product_id, is_available, updated_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (store_code, product_id) DO UPDATE SET is_available = EXCLUDED.is_available, updated_at = EXCLUDED.updated_at`,
      [code, productId, !!available, nowIso()]
    );
  }
  res.json({ ok: true });
});

router.post('/stores/:code/staff', async (req, res) => {
  const store = ADC_STORES.find((s) => s.code === String(req.params.code).toLowerCase());
  if (!store) throw new ApiError('No such store');
  if (store.posMode !== 'MANUAL') throw new ApiError('This store is automatic — it has no staff portal to log in to');
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new ApiError('Username: 3–40 characters, letters/numbers/._- only');
  if (password.length < 8) throw new ApiError('Choose a password of at least 8 characters');
  const ts = nowIso();
  const row = await getOne(
    `INSERT INTO store_users (store_code, username, password_hash, name, password_set_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$5,$5) RETURNING id, username`,
    [store.code, username, await hashPassword(password), String(req.body?.name || '').trim() || null, ts]
  );
  res.json({ ok: true, id: row.id, username: row.username });
});

// Set a staff password to something the admin types. There is no "email them a reset link" here —
// these accounts have no mailbox; the admin hands the password over in person.
router.post('/stores/staff/:id/password', async (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 8) throw new ApiError('Choose a password of at least 8 characters');
  const user = await getOne('SELECT id FROM store_users WHERE id = $1', [req.params.id]);
  if (!user) throw new ApiError('No such staff account');
  const ts = nowIso();
  await query('UPDATE store_users SET password_hash = $1, password_set_at = $2, updated_at = $2 WHERE id = $3',
    [await hashPassword(password), ts, user.id]);
  res.json({ ok: true });
});

router.patch('/stores/staff/:id/toggle', async (req, res) => {
  const row = await getOne('UPDATE store_users SET is_active = NOT is_active, updated_at = $1 WHERE id = $2 RETURNING id, is_active',
    [nowIso(), req.params.id]);
  if (!row) throw new ApiError('No such staff account');
  res.json({ ok: true, isActive: !!row.is_active });
});

router.delete('/stores/staff/:id', async (req, res) => {
  await query('DELETE FROM store_users WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
