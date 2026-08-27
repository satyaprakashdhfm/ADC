import { getOne, getAll, query } from '../db/index.js';
import { ApiError } from '../utils/ApiError.js';

/*
 * What a coupon is worth, and whether this person may use it.
 *
 * Lifted out of routes/coupons.js in Phase B, unchanged. The order route needed all four of
 * validateCoupon / calculateDiscount / getCouponByCode / resolveGiftProduct to price a checkout,
 * and the auth route needed linkEmailClaimsToUser on sign-in, so both were importing a ROUTER to
 * get at them.
 *
 * The spin wheel itself — ticket pools, odds signatures, claim windows — deliberately stays in
 * the route file. Nothing outside it uses that machinery, it is written against a transaction it
 * owns end to end, and moving intricate code that nobody is asking to share buys risk and no
 * clarity.
 */

// Attach any pending email-subscribe spin claim for `email` to this user account: create their
// spin_claims row (so the coupon works at checkout) and mark the email claim linked. Called on
// login (GET /auth/me). Safe to call often — it no-ops once linked or if they already hold a reward.
export async function linkEmailClaimsToUser(userId, email) {
  if (!userId || !email) return;
  const em = String(email).trim().toLowerCase();
  const nowIsoStr = new Date().toISOString();
  const pending = await getAll(
    `SELECT * FROM spin_email_claims WHERE lower(email) = $1 AND linked_user_id IS NULL AND expires_at > $2`,
    [em, nowIsoStr],
  );
  for (const ec of pending) {
    const already = await getOne('SELECT 1 FROM spin_claims WHERE user_id = $1 AND expires_at > $2 LIMIT 1', [userId, nowIsoStr]);
    if (!already) {
      await query(
        `INSERT INTO spin_claims (user_id, coupon_id, code, label, claimed_at, expires_at, gift_product_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [userId, ec.coupon_id, ec.code, ec.label, ec.claimed_at, ec.expires_at, ec.gift_product_id],
      );
    }
    await query('UPDATE spin_email_claims SET linked_user_id = $1 WHERE id = $2', [userId, ec.id]);
  }
}


export async function getCouponByCode(code) {
  return getOne('SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE', [String(code || '').toUpperCase()]);
}

// A "free item" coupon (gift_kind set) doesn't just knock money off — it hands over a real
// product. This resolves WHICH one, right now, so admin catalog/price changes are honoured:
//   TIN            → an eligible currently-available gift tin
//   FILLED_COOKIE  → an eligible currently-available filled cookie
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

// The minimum-order check is measured against the order amount as it stands, with nothing netted
// off it.
//
// It used to subtract a gift coupon's freebie first, so that the reward could not help a cart
// qualify for itself. The intent was right but it could not work from a single scalar: at
// /validate the amount is the cart BEFORE the frontend auto-adds the gift, and at order-create it
// is the cart AFTER. Subtracting unconditionally therefore charged the gift twice on the first
// call — a ₹500 cart against a ₹500 minimum was told it was ₹200 short, and only passed once the
// gift it was being refused had been added to it.
//
// userId is required to redeem a SPIN-WHEEL coupon: those are personal rewards, only valid for
// the exact account that won them (has an unexpired spin_claims row). Regular admin coupons
// ignore userId and work for anyone, as before.
export async function validateCoupon(code, orderAmount, userId: number | null = null) {
  const coupon = await getCouponByCode(code);
  if (!coupon) throw new ApiError('Invalid or inactive coupon');

  if (coupon.expiry_date && coupon.expiry_date < new Date().toISOString().slice(0, 10)) {
    throw new ApiError('Coupon has expired');
  }
  // Spin-wheel reward: must belong to THIS account. Stops someone sharing their won code with a
  // friend — a code only works for the account whose spin produced it, within its 12h window.
  if (coupon.spin_weight != null) {
    const claim = userId ? await getOne(
      'SELECT 1 FROM spin_claims WHERE user_id = $1 AND code = $2 AND expires_at > $3 LIMIT 1',
      [userId, coupon.code, new Date().toISOString()]
    ) : null;
    if (!claim) throw new ApiError('This reward code isn’t linked to your account. Spin the wheel to win your own!');
    /* One spin, one prize — spend it and it is gone.
     *
     * The claim row only proves the code was won and has not expired, both of which stay true
     * after it is redeemed, and these coupons carry no usage_limit, so the global cap below never
     * caught it either. A shopper could apply the same won code to order after order for the whole
     * seven days. usage_limit is a cap for everyone sharing a public code; this is per-person,
     * which is what a personal reward needs. */
    const spent = await getOne(
      'SELECT 1 FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2 LIMIT 1',
      [coupon.id, userId]
    );
    if (spent) throw new ApiError('You have already used this reward.');
  }
  if (coupon.usage_limit != null) {
    const row = await getOne('SELECT COUNT(*) AS c FROM coupon_usage WHERE coupon_id = $1', [coupon.id]);
    // COUNT(*) always returns a row; the ?? keeps the compiler honest without changing behaviour.
    if (Number(row?.c ?? 0) >= coupon.usage_limit) throw new ApiError('Coupon usage limit reached');
  }
  if (coupon.minimum_order_amount != null && Number(orderAmount) < coupon.minimum_order_amount) {
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