import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getOne, getAll } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { serializeCoupon } from '../serializers.js';

const router = Router();

// Generous enough that a real shopper (who tries a handful of codes at checkout) never hits it,
// tight enough to blunt anonymous brute-force code-guessing. Combined with requireAuth below.
const couponLimiter = rateLimit({
  windowMs: 10 * 60_000, max: 40, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts', message: 'Too many coupon attempts — please try again in a few minutes.' },
});

export async function validateCoupon(code, orderAmount) {
  const coupon = await getOne('SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE', [String(code).toUpperCase()]);
  if (!coupon) throw new ApiError('Invalid or inactive coupon');

  if (coupon.expiry_date && coupon.expiry_date < new Date().toISOString().slice(0, 10)) {
    throw new ApiError('Coupon has expired');
  }
  if (coupon.usage_limit != null) {
    const row = await getOne('SELECT COUNT(*) AS c FROM coupon_usage WHERE coupon_id = $1', [coupon.id]);
    if (Number(row.c) >= coupon.usage_limit) throw new ApiError('Coupon usage limit reached');
  }
  if (coupon.minimum_order_amount != null && Number(orderAmount) < coupon.minimum_order_amount) {
    throw new ApiError('Order amount below minimum for this coupon');
  }
  return coupon;
}

export function calculateDiscount(coupon, subtotal) {
  let discount = coupon.discount_type === 'PERCENTAGE'
    ? (Number(subtotal) * coupon.discount_value) / 100
    : coupon.discount_value;
  if (coupon.maximum_discount != null && discount > coupon.maximum_discount) {
    discount = coupon.maximum_discount;
  }
  return discount;
}

// Auth-gated + rate-limited: only logged-in shoppers can test a code, so anonymous
// brute-force guessing of unadvertised coupons is blocked (and any abuse is traceable).
router.get('/validate', requireAuth, couponLimiter, async (req, res) => {
  const { code, orderAmount } = req.query;
  const coupon = await validateCoupon(String(code || ''), orderAmount ?? 0);
  res.json({ ...serializeCoupon(coupon), valid: true });
});

// Currently-usable SPIN WHEEL rewards (spin_weight IS NOT NULL) — the admin's other, regular
// coupons never appear on the wheel. Returns only coupons that are ACTIVE, haven't expired and
// haven't hit their usage limit, so any code the wheel hands out actually works at checkout.
// Public — the wheel lets guests spin before logging in, so this can't be auth-gated; it's
// still rate-limited to blunt scraping.
router.get('/active', couponLimiter, async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await getAll('SELECT * FROM coupons WHERE is_active = TRUE AND spin_weight IS NOT NULL ORDER BY spin_weight ASC');
  const usable = [];
  for (const c of rows) {
    if (c.expiry_date && c.expiry_date < today) continue;
    if (c.usage_limit != null) {
      const row = await getOne('SELECT COUNT(*) AS n FROM coupon_usage WHERE coupon_id = $1', [c.id]);
      if (Number(row.n) >= c.usage_limit) continue;
    }
    usable.push({
      code: c.code,
      discountType: c.discount_type,
      discountValue: c.discount_value,
      minimumOrderAmount: c.minimum_order_amount,
      maximumDiscount: c.maximum_discount,
      weight: Number(c.spin_weight),
      label: c.spin_label || (c.discount_type === 'PERCENTAGE' ? `${Math.round(c.discount_value)}% OFF` : `₹${Math.round(c.discount_value)} OFF`),
      terms: c.terms || '',
    });
  }
  res.json(usable);
});

// How long a claimed spin reward is honoured before it expires (see spin_claims in db.js).
const CLAIM_WINDOW_HOURS = 12;

function serializeClaim(row, coupon) {
  return {
    code: row.code, label: row.label,
    discountType: coupon.discount_type, discountValue: coupon.discount_value,
    minimumOrderAmount: coupon.minimum_order_amount, maximumDiscount: coupon.maximum_discount,
    terms: coupon.terms || '',
    claimedAt: row.claimed_at, expiresAt: row.expires_at,
  };
}

// Does this signed-in shopper currently hold an unexpired spin reward? Used to (a) resume
// showing their win across page loads/devices and (b) block spinning again inside the window.
router.get('/spin-status', requireAuth, async (req, res) => {
  const nowIsoStr = new Date().toISOString();
  const claim = await getOne(
    `SELECT sc.*, c.discount_type, c.discount_value, c.minimum_order_amount, c.maximum_discount, c.terms
     FROM spin_claims sc JOIN coupons c ON c.id = sc.coupon_id
     WHERE sc.user_id = $1 AND sc.expires_at > $2 ORDER BY sc.id DESC LIMIT 1`,
    [req.user.id, nowIsoStr]
  );
  res.json({ active: claim ? serializeClaim(claim, claim) : null });
});

// Claim a spin result — called right after spinning (if already logged in) or right after
// logging in (if the spin happened as a guest). Idempotent + anti-abuse: if the user already
// holds an unexpired claim, THAT original reward is returned regardless of what `code` is
// passed — so a user can't spin repeatedly to trade up, and "the same coupon for 12h" holds.
router.post('/claim-spin', requireAuth, couponLimiter, async (req, res) => {
  const { code } = req.body || {};
  const nowMs = Date.now();
  const nowIsoStr = new Date(nowMs).toISOString();

  const existing = await getOne(
    `SELECT sc.*, c.discount_type, c.discount_value, c.minimum_order_amount, c.maximum_discount, c.terms
     FROM spin_claims sc JOIN coupons c ON c.id = sc.coupon_id
     WHERE sc.user_id = $1 AND sc.expires_at > $2 ORDER BY sc.id DESC LIMIT 1`,
    [req.user.id, nowIsoStr]
  );
  if (existing) return res.json(serializeClaim(existing, existing));

  const coupon = await getOne(
    'SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE AND spin_weight IS NOT NULL',
    [String(code || '').toUpperCase()]
  );
  if (!coupon) throw new ApiError('This reward is no longer available.');

  const expiresAt = new Date(nowMs + CLAIM_WINDOW_HOURS * 3600_000).toISOString();
  const row = await getOne(
    `INSERT INTO spin_claims (user_id, coupon_id, code, label, claimed_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.id, coupon.id, coupon.code, coupon.spin_label || coupon.code, nowIsoStr, expiresAt]
  );
  res.status(201).json(serializeClaim(row, coupon));
});

export default router;
