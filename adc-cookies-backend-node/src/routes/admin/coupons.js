import { Router } from 'express';
import { getOne, getAll, query } from '../../db.js';
import { ApiError } from '../../middleware.js';
import { serializeCoupon } from '../../serializers.js';

const router = Router();

/* ---------- Coupons ---------- */
router.get('/coupons', async (_req, res) => {
  const rows = await getAll('SELECT * FROM coupons ORDER BY id');
  // Attach live redemption counts so the UI can show Active / Expired / Limit-reached at a glance.
  const withUsage = await Promise.all(rows.map(async (c) => {
    const { n } = await getOne('SELECT COUNT(*) AS n FROM coupon_usage WHERE coupon_id = $1', [c.id]);
    return { ...serializeCoupon(c), timesUsed: Number(n) };
  }));
  res.json(withUsage);
});

router.post('/coupons', async (req, res) => {
  const b = req.body || {};
  const row = await getOne(
    `INSERT INTO coupons (code, discount_type, discount_value, minimum_order_amount, maximum_discount, expiry_date, usage_limit, is_active, spin_weight, spin_label, terms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [String(b.code || '').toUpperCase(), b.discountType, b.discountValue,
     b.minimumOrderAmount ?? null, b.maximumDiscount ?? null, b.expiryDate ?? null,
     b.usageLimit ?? null, b.isActive !== false,
     b.spinWeight ?? null, b.spinLabel ?? null, b.terms ?? null]
  );
  res.json(serializeCoupon(row));
});

// Full edit — used by the Spin Wheel Offers panel to adjust odds/terms/limits on an existing
// reward (creating a fresh row each time would break the /order?coupon= links already handed
// out and orphan its usage history).
router.put('/coupons/:id', async (req, res) => {
  const b = req.body || {};
  const row = await getOne(
    `UPDATE coupons SET code=$1, discount_type=$2, discount_value=$3, minimum_order_amount=$4,
       maximum_discount=$5, expiry_date=$6, usage_limit=$7, is_active=$8, spin_weight=$9, spin_label=$10, terms=$11
     WHERE id=$12 RETURNING *`,
    [String(b.code || '').toUpperCase(), b.discountType, b.discountValue,
     b.minimumOrderAmount ?? null, b.maximumDiscount ?? null, b.expiryDate ?? null,
     b.usageLimit ?? null, b.isActive !== false,
     b.spinWeight ?? null, b.spinLabel ?? null, b.terms ?? null, req.params.id]
  );
  if (!row) throw new ApiError('Coupon not found', 404);
  res.json(serializeCoupon(row));
});

router.patch('/coupons/:id/toggle', async (req, res) => {
  const coupon = await getOne('SELECT * FROM coupons WHERE id = $1', [req.params.id]);
  if (!coupon) throw new ApiError('Coupon not found');
  const row = await getOne('UPDATE coupons SET is_active = $1 WHERE id = $2 RETURNING *', [!coupon.is_active, coupon.id]);
  res.json(serializeCoupon(row));
});

router.delete('/coupons/:id', async (req, res) => {
  const coupon = await getOne('SELECT * FROM coupons WHERE id = $1', [req.params.id]);
  if (!coupon) throw new ApiError('Coupon not found', 404);
  await query('DELETE FROM coupon_usage WHERE coupon_id = $1', [coupon.id]);
  await query('DELETE FROM spin_claims WHERE coupon_id = $1', [coupon.id]);
  await query('DELETE FROM coupons WHERE id = $1', [coupon.id]);
  res.json({ ok: true });
});

// The wheel is one spin per device/account for good (see coupons.js POST /spin) — this is the
// only way to open a fresh round for everyone at once, short of a redeploy. Deliberately only
// touches spin_draws (who has already spun): already-issued coupons in spin_claims /
// spin_email_claims are real discount codes someone may still redeem, so they're left alone.
router.post('/coupons/reset-spins', async (_req, res) => {
  const result = await query('DELETE FROM spin_draws');
  res.json({ ok: true, cleared: result.rowCount });
});

export default router;
