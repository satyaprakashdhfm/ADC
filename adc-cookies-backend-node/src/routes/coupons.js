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

export async function getCouponByCode(code) {
  return getOne('SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE', [String(code || '').toUpperCase()]);
}

// A "free item" coupon (gift_kind set) doesn't just knock money off — it hands over a real
// product. This resolves WHICH one, right now, so admin catalog/price changes are honoured:
//   TIN            → the cheapest currently-available gift tin
//   FILLED_COOKIE  → the cheapest currently-available filled cookie
//   PRODUCT        → a fixed catalog item (coupon.gift_product_id)
//   MYSTERY        → whatever cookie was randomly assigned to THIS user's claim (see
//                    /claim-spin) — resolved from spin_claims, not re-randomized here, so the
//                    same surprise is shown at preview and charged at checkout.
export async function resolveGiftProduct(coupon, userId) {
  if (!coupon?.gift_kind) return null;
  if (coupon.gift_kind === 'TIN') {
    return getOne("SELECT * FROM products WHERE category = 'TINS' AND is_available = TRUE ORDER BY price ASC LIMIT 1");
  }
  if (coupon.gift_kind === 'FILLED_COOKIE') {
    return getOne("SELECT * FROM products WHERE is_available = TRUE AND LOWER(menu_group) LIKE '%filled%' ORDER BY price ASC LIMIT 1");
  }
  if (coupon.gift_kind === 'PRODUCT') {
    return coupon.gift_product_id
      ? getOne('SELECT * FROM products WHERE id = $1 AND is_available = TRUE', [coupon.gift_product_id])
      : null;
  }
  if (coupon.gift_kind === 'MYSTERY') {
    if (!userId) return null;
    const claim = await getOne(
      `SELECT gift_product_id FROM spin_claims
       WHERE user_id = $1 AND code = $2 AND gift_product_id IS NOT NULL
       ORDER BY id DESC LIMIT 1`,
      [userId, coupon.code],
    );
    return claim?.gift_product_id
      ? getOne('SELECT * FROM products WHERE id = $1 AND is_available = TRUE', [claim.gift_product_id])
      : null;
  }
  return null;
}

// giftValue (the gift product's price, when this is a gift-type coupon) is subtracted from
// orderAmount before the minimum-order check — the freebie itself shouldn't help a cart
// qualify for its own reward; the rest of the cart has to clear the minimum on its own.
export async function validateCoupon(code, orderAmount, giftValue = 0) {
  const coupon = await getCouponByCode(code);
  if (!coupon) throw new ApiError('Invalid or inactive coupon');

  if (coupon.expiry_date && coupon.expiry_date < new Date().toISOString().slice(0, 10)) {
    throw new ApiError('Coupon has expired');
  }
  if (coupon.usage_limit != null) {
    const row = await getOne('SELECT COUNT(*) AS c FROM coupon_usage WHERE coupon_id = $1', [coupon.id]);
    if (Number(row.c) >= coupon.usage_limit) throw new ApiError('Coupon usage limit reached');
  }
  const qualifyingAmount = Number(orderAmount) - Number(giftValue || 0);
  if (coupon.minimum_order_amount != null && qualifyingAmount < coupon.minimum_order_amount) {
    throw new ApiError('Order amount below minimum for this coupon');
  }
  return coupon;
}

// For a gift-type coupon the discount is exactly one unit of the gift product's real price
// (capped at maximum_discount, same as before) — not the flat discount_value, and never
// multiplied by quantity, so "free tin" means one tin free, however many are in the cart.
export function calculateDiscount(coupon, subtotal, giftProduct) {
  if (giftProduct) {
    const cap = coupon.maximum_discount != null ? Number(coupon.maximum_discount) : Number(giftProduct.price);
    return Math.min(Number(giftProduct.price), cap);
  }
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
  const raw = await getCouponByCode(String(code || ''));
  const giftProduct = raw ? await resolveGiftProduct(raw, req.user.id) : null;
  const coupon = await validateCoupon(String(code || ''), orderAmount ?? 0, giftProduct ? Number(giftProduct.price) : 0);
  res.json({
    ...serializeCoupon(coupon),
    valid: true,
    giftProduct: giftProduct ? { id: giftProduct.id, name: giftProduct.name, price: Number(giftProduct.price), images: giftProduct.images } : null,
  });
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
      // A "free item" reward (see gift_kind) hands over a real product — the wheel should say so
      // rather than a misleading "₹X off", which is really just the internal discount mechanics.
      isGift: !!c.gift_kind,
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

  // The Mystery Cookie Gift is a surprise picked ONCE, right now — a random cookie priced at or
  // under this coupon's cap, so it's always genuinely free, never a partial discount. Storing it
  // on the claim (rather than re-rolling on every preview/checkout call) keeps it consistent.
  let giftProductId = null;
  if (coupon.gift_kind === 'MYSTERY') {
    const pick = await getOne(
      "SELECT id FROM products WHERE category = 'COOKIES' AND is_available = TRUE AND price <= $1 ORDER BY RANDOM() LIMIT 1",
      [coupon.maximum_discount ?? coupon.discount_value]
    );
    giftProductId = pick?.id ?? null;
  }

  const expiresAt = new Date(nowMs + CLAIM_WINDOW_HOURS * 3600_000).toISOString();
  const row = await getOne(
    `INSERT INTO spin_claims (user_id, coupon_id, code, label, claimed_at, expires_at, gift_product_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.id, coupon.id, coupon.code, coupon.spin_label || coupon.code, nowIsoStr, expiresAt, giftProductId]
  );
  res.status(201).json(serializeClaim(row, coupon));
});

export default router;
