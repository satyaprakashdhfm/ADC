import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getOne, getAll, query, withTransaction, nowIso } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { serializeCoupon } from '../serializers.js';
import { sendCouponEmail } from '../mailer.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Emailed spin coupons stay valid a week — long enough that the winner can create an account with
// that email and still redeem it, unlike the tight 12h window for an already-logged-in claim.
const EMAIL_CLAIM_WINDOW_DAYS = 7;

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
export async function validateCoupon(code, orderAmount, userId = null) {
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
    if (Number(row.c) >= coupon.usage_limit) throw new ApiError('Coupon usage limit reached');
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

// Auth-gated + rate-limited: only logged-in shoppers can test a code, so anonymous
// brute-force guessing of unadvertised coupons is blocked (and any abuse is traceable).
router.get('/validate', requireAuth, couponLimiter, async (req, res) => {
  const { code, orderAmount } = req.query;
  const raw = await getCouponByCode(String(code || ''));
  const giftProduct = raw ? await resolveGiftProduct(raw, req.user.id) : null;
  const coupon = await validateCoupon(String(code || ''), orderAmount ?? 0, req.user.id);
  res.json({
    ...serializeCoupon(coupon),
    valid: true,
    giftProduct: giftProduct ? { id: giftProduct.id, name: giftProduct.name, price: Number(giftProduct.price), images: giftProduct.images } : null,
  });
});

// Currently-usable SPIN WHEEL rewards (spin_weight IS NOT NULL, active, not expired, under their
// usage limit) — shared by /active (what the wheel displays) and /spin (what it can actually
// draw), so the two are always in lockstep.
async function getUsableSpinCoupons() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await getAll('SELECT * FROM coupons WHERE is_active = TRUE AND spin_weight IS NOT NULL ORDER BY spin_weight ASC');
  const usable = [];
  for (const c of rows) {
    if (c.expiry_date && c.expiry_date < today) continue;
    if (c.usage_limit != null) {
      const row = await getOne('SELECT COUNT(*) AS n FROM coupon_usage WHERE coupon_id = $1', [c.id]);
      if (Number(row.n) >= c.usage_limit) continue;
    }
    usable.push(c);
  }
  return usable;
}

// Currently-usable SPIN WHEEL rewards — the admin's other, regular coupons never appear on the
// wheel. Public — the wheel lets guests spin before logging in, so this can't be auth-gated;
// it's still rate-limited to blunt scraping.
router.get('/active', couponLimiter, async (_req, res) => {
  const usable = await getUsableSpinCoupons();
  res.json(usable.map(c => ({
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
  })));
});

// Currently-usable GENERAL coupons (spin_weight IS NULL, active, not expired, under their usage
// limit) — the codes anyone can use, as opposed to a personal spin-wheel win. Public listing (no
// auth) so the checkout page can show a Zomato/Swiggy-style "available offers" list before login;
// actually redeeming one still goes through /validate as normal.
async function getUsableGeneralCoupons() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await getAll('SELECT * FROM coupons WHERE is_active = TRUE AND spin_weight IS NULL ORDER BY id DESC');
  const usable = [];
  for (const c of rows) {
    if (c.expiry_date && c.expiry_date < today) continue;
    if (c.usage_limit != null) {
      const row = await getOne('SELECT COUNT(*) AS n FROM coupon_usage WHERE coupon_id = $1', [c.id]);
      if (Number(row.n) >= c.usage_limit) continue;
    }
    usable.push(c);
  }
  return usable;
}

router.get('/available', couponLimiter, async (_req, res) => {
  const usable = await getUsableGeneralCoupons();
  res.json(usable.map(c => ({
    code: c.code,
    discountType: c.discount_type,
    discountValue: c.discount_value,
    minimumOrderAmount: c.minimum_order_amount,
    maximumDiscount: c.maximum_discount,
    label: c.discount_type === 'PERCENTAGE' ? `${Math.round(c.discount_value)}% OFF` : `₹${Math.round(c.discount_value)} OFF`,
    terms: c.terms || '',
    isGift: !!c.gift_kind,
  })));
});

// --- Server-authoritative draw: a shuffled "ticket pool" guarantees EXACT odds across every
// batch of spins (e.g. precisely 5% land on the tin), instead of independent per-spin randomness
// that only converges to the target % over a long run. See spin_ticket_pool in db.js. ---
const POOL_SIZE = 1000;
const NO_REWARD = '__NONE__';
// How long a draw (win or miss) — and separately, a claimed reward — is honoured before it
// expires. Shared by /spin's device-lock and claim-spin's claim window (see spin_claims in db.js).
//
// Seven days, not twelve hours. Half a day meant a code won in the evening was dead before most
// people next thought about cookies, so the reward pushed for an order right now or went to waste —
// which is a discount that mostly expires unused. A week is long enough to be worth keeping.
//
// It is also the device lock: this same window is how long a device/account waits before it could
// spin again, so lengthening it makes a spin scarcer as well as its prize longer-lived.
const CLAIM_WINDOW_HOURS = 7 * 24;
// One spin per device/account, period — not a daily reset. Once a draw's own CLAIM_WINDOW_HOURS
// window lapses, that device/account is done until an admin opens a fresh round for everyone at
// once (POST /admin/coupons/reset-spins wipes spin_draws). There is no per-user timed cooldown.

// A stable fingerprint of the current odds config — if the admin changes a weight, adds, removes,
// or deactivates a wheel coupon, this changes too, which tells /spin to reshuffle a fresh batch
// instead of keeping handing out tickets built from stale odds.
function oddsSignature(coupons) {
  return JSON.stringify(coupons.map(c => [c.code, Number(c.spin_weight)]).sort((a, b) => a[0].localeCompare(b[0])));
}

function shuffled(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Builds one batch: each coupon gets round(weight% of POOL_SIZE) tickets; "no reward" silently
// absorbs whatever's left so the batch always totals exactly POOL_SIZE, then the whole thing is
// shuffled once. Drawing tickets off the front in order is what makes the ratio exact per batch.
function buildTickets(coupons) {
  const tickets = [];
  for (const c of coupons) {
    const count = Math.round((Number(c.spin_weight) || 0) / 100 * POOL_SIZE);
    for (let i = 0; i < count; i++) tickets.push(c.code);
  }
  const noRewardCount = Math.max(0, POOL_SIZE - tickets.length);
  for (let i = 0; i < noRewardCount; i++) tickets.push(NO_REWARD);
  return shuffled(tickets);
}

// Read-only status check — lets the wheel show "you're done for today, come back at X" the
// moment it opens, without actually drawing. (POST /spin itself can't safely be called just to
// check: once the cooldown has fully elapsed, it draws for real rather than only reporting.)
router.get('/spin-cooldown', couponLimiter, async (req, res) => {
  const deviceId = String(req.query.deviceId || '').trim();
  const userId = req.user?.id ?? null;
  if (!deviceId && !userId) return res.json({ completed: false });
  const nowIsoStr = nowIso();
  const existing = await getOne(
    `SELECT * FROM spin_draws WHERE (device_id = $1 OR user_id = $2) ORDER BY id DESC LIMIT 1`,
    [deviceId, userId]
  );
  if (!existing || existing.expires_at > nowIsoStr) return res.json({ completed: false });
  // Their one spin is done and its window has passed — permanently, until an admin resets
  // spin_draws for a fresh round. No nextSpinAt: there is no time-based reset to count down to.
  res.json({ completed: true });
});

router.post('/spin', couponLimiter, async (req, res) => {
  const deviceId = String(req.body?.deviceId || '').trim();
  if (!deviceId) throw new ApiError('Missing device id.');
  const userId = req.user?.id ?? null; // parseAuth already ran — set if this caller happens to be logged in
  const ip = req.ip || null;
  const nowIsoStr = nowIso();

  // Latest draw for this device or account, regardless of whether its own window has expired —
  // needed to enforce the cooldown below, not just the in-progress replay. Deliberately NOT keyed
  // on IP: everyone behind one café/office/CGNAT address would share a single cooldown.
  const existing = await getOne(
    `SELECT * FROM spin_draws WHERE (device_id = $1 OR user_id = $2) ORDER BY id DESC LIMIT 1`,
    [deviceId, userId]
  );
  if (existing) {
    // Still within its own 12h window (win or miss) — replay it instead of drawing again. This is
    // what actually stops "keep spinning until I like the result": once drawn, that's the outcome
    // for this window, whether it's been claimed or not.
    if (existing.expires_at > nowIsoStr) {
      return res.json({ code: existing.code, expiresAt: existing.expires_at });
    }
    // That window is over — this device/account has had its one spin and there is no daily
    // reset. Done until an admin wipes spin_draws for a fresh round (POST /admin/coupons/reset-spins).
    return res.json({ code: null, completed: true });
  }

  const coupons = await getUsableSpinCoupons();
  const signature = oddsSignature(coupons);
  const expiresAt = new Date(Date.now() + CLAIM_WINDOW_HOURS * 3600_000).toISOString();

  const code = await withTransaction(async (client) => {
    let ticket = null;
    if (coupons.length) {
      const { rows } = await client.query('SELECT * FROM spin_ticket_pool WHERE id = 1 FOR UPDATE');
      const pool = rows[0];
      let tickets = pool && pool.signature === signature ? JSON.parse(pool.tickets) : null;
      let position = tickets ? pool.position : 0;
      // Reshuffle a fresh batch the moment the odds changed (signature mismatch) or the current
      // batch is used up — either way this spin draws from a batch that matches today's odds.
      if (!tickets || position >= tickets.length) {
        tickets = buildTickets(coupons);
        position = 0;
      }
      ticket = tickets[position];
      await client.query(
        `INSERT INTO spin_ticket_pool (id, signature, tickets, position, updated_at) VALUES (1,$1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET signature=$1, tickets=$2, position=$3, updated_at=$4`,
        [signature, JSON.stringify(tickets), position + 1, nowIsoStr]
      );
    }
    const drawnCode = ticket && ticket !== NO_REWARD ? ticket : null;
    await client.query(
      'INSERT INTO spin_draws (device_id, user_id, code, drawn_at, expires_at, ip) VALUES ($1,$2,$3,$4,$5,$6)',
      [deviceId, userId, drawnCode, nowIsoStr, expiresAt, ip]
    );
    return drawnCode;
  });

  res.json({ code, expiresAt });
});

function serializeClaim(row, coupon) {
  return {
    code: row.code, label: row.label,
    discountType: coupon.discount_type, discountValue: coupon.discount_value,
    minimumOrderAmount: coupon.minimum_order_amount, maximumDiscount: coupon.maximum_discount,
    terms: coupon.terms || '',
    isGift: !!coupon.gift_kind || Number(coupon.discount_value) === 0,
    claimedAt: row.claimed_at, expiresAt: row.expires_at,
  };
}

// Does this signed-in shopper currently hold an unexpired spin reward? Used to (a) resume
// showing their win across page loads/devices and (b) block spinning again inside the window.
router.get('/spin-status', requireAuth, async (req, res) => {
  const nowIsoStr = new Date().toISOString();
  /* Unexpired AND unspent. Expiry alone left a redeemed reward sitting in checkout and on the
     account page for the rest of its week, still offering an Apply button that now refuses — which
     reads as the site having lost track of an order the shopper definitely placed. */
  const claim = await getOne(
    `SELECT sc.*, c.discount_type, c.discount_value, c.minimum_order_amount, c.maximum_discount, c.terms
     FROM spin_claims sc JOIN coupons c ON c.id = sc.coupon_id
     WHERE sc.user_id = $1 AND sc.expires_at > $2
       AND NOT EXISTS (
         SELECT 1 FROM coupon_usage cu WHERE cu.coupon_id = sc.coupon_id AND cu.user_id = sc.user_id
       )
     ORDER BY sc.id DESC LIMIT 1`,
    [req.user.id, nowIsoStr]
  );
  res.json({ active: claim ? serializeClaim(claim, claim) : null });
});

// The one-line "what you actually won" for the coupon email. Shared by both claim routes so the
// two cannot describe the same reward differently.
function offerTextFor(coupon) {
  if (coupon.discount_type === 'PERCENTAGE') {
    return `${Math.round(coupon.discount_value)}% off${coupon.maximum_discount ? `, up to ₹${coupon.maximum_discount}` : ''}`;
  }
  return Number(coupon.discount_value) > 0 ? `₹${Math.round(coupon.discount_value)} off` : 'A free treat';
}

// Claim a spin result — called right after spinning (if already logged in) or right after
// logging in (if the spin happened as a guest). Idempotent + anti-abuse: if the user already
// holds an unexpired claim, THAT original reward is returned regardless of what `code` is
// passed — so a user can't spin repeatedly to trade up, and "the same coupon for 12h" holds.
router.post('/claim-spin', requireAuth, couponLimiter, async (req, res) => {
  const { code } = req.body || {};
  const nowMs = Date.now();
  const nowIsoStr = new Date(nowMs).toISOString();

  // Locked per-user for the whole check-then-insert: the frontend can legitimately fire this
  // twice in quick succession right after login (the auth state updates a couple of times in a
  // row, each re-triggering the pending-claim resolver), and without serializing here both calls
  // can see "no existing claim" before either commits, inserting two spin_claims rows for the
  // same win. The advisory lock makes the second call wait for the first to finish and commit,
  // so it then correctly finds and replays the first one's row instead of inserting again.
  const result = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [req.user.id]);

    const { rows: existingRows } = await client.query(
      `SELECT sc.*, c.discount_type, c.discount_value, c.minimum_order_amount, c.maximum_discount, c.terms
       FROM spin_claims sc JOIN coupons c ON c.id = sc.coupon_id
       WHERE sc.user_id = $1 AND sc.expires_at > $2 ORDER BY sc.id DESC LIMIT 1`,
      [req.user.id, nowIsoStr]
    );
    if (existingRows[0]) return { row: existingRows[0], coupon: existingRows[0], isNew: false };

    const { rows: couponRows } = await client.query(
      'SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE AND spin_weight IS NOT NULL',
      [String(code || '').toUpperCase()]
    );
    const coupon = couponRows[0];
    if (!coupon) throw new ApiError('This reward is no longer available.');

    // The Mystery Cookie Gift is a surprise picked ONCE, right now — a random cookie priced at or
    // under this coupon's cap, so it's always genuinely free, never a partial discount. Storing
    // it on the claim (rather than re-rolling on every preview/checkout call) keeps it consistent.
    let giftProductId = null;
    if (coupon.gift_kind === 'MYSTERY') {
      const { rows: pickRows } = await client.query(
        "SELECT id FROM products WHERE category = 'COOKIES' AND is_available = TRUE AND price <= $1 ORDER BY RANDOM() LIMIT 1",
        [coupon.maximum_discount ?? coupon.discount_value]
      );
      giftProductId = pickRows[0]?.id ?? null;
    }

    const expiresAt = new Date(nowMs + CLAIM_WINDOW_HOURS * 3600_000).toISOString();
    const { rows: inserted } = await client.query(
      `INSERT INTO spin_claims (user_id, coupon_id, code, label, claimed_at, expires_at, gift_product_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, coupon.id, coupon.code, coupon.spin_label || coupon.code, nowIsoStr, expiresAt, giftProductId]
    );
    return { row: inserted[0], coupon, isNew: true };
  });

  // Email the code. Signing in is now the only way to claim a win (the wheel used to take a name
  // and an email instead), so without this nobody receives their coupon at all.
  //
  // Only on a genuinely new claim: the frontend calls this more than once per win on purpose — the
  // post-login resolver is a deliberate backstop for the in-popup claim — and the replay path
  // returns the original row, so mailing there would send a duplicate on every retry.
  if (result.isNew && req.user.email) {
    sendCouponEmail({
      email: req.user.email, name: req.user.name, code: result.row.code, label: result.row.label,
      offerText: offerTextFor(result.coupon), terms: result.coupon.terms || '',
      expiresAt: result.row.expires_at, alreadyInAccount: true,
    }).catch(() => {});
  }

  res.status(result.isNew ? 201 : 200).json(serializeClaim(result.row, result.coupon));
});

// Claim a spin win by EMAIL (subscribe-to-claim) instead of logging in. One reward per email:
// records it, emails the code, and — if an account with that email already exists — attaches it to
// that account now. Otherwise it's attached the moment they sign in with this email (see /auth/me).
router.post('/claim-email', couponLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim();
  const code = String(req.body?.code || '').toUpperCase();
  if (!EMAIL_RE.test(email)) throw new ApiError('Please enter a valid email address.');
  if (name.length < 2) throw new ApiError('Please enter your name.');
  if (!code) throw new ApiError('Missing reward code.');
  const nowMs = Date.now();
  const nowIsoStr = new Date(nowMs).toISOString();

  const serialize = (row, coupon, alreadyClaimed) => ({
    code: row.code, label: row.label,
    discountType: coupon.discount_type, discountValue: coupon.discount_value,
    minimumOrderAmount: coupon.minimum_order_amount, maximumDiscount: coupon.maximum_discount,
    terms: coupon.terms || '',
    isGift: !!coupon.gift_kind || Number(coupon.discount_value) === 0,
    expiresAt: row.expires_at, alreadyClaimed: !!alreadyClaimed,
  });

  // Once per email — return their existing reward if they've already claimed with this address.
  const existing = await getOne('SELECT * FROM spin_email_claims WHERE lower(email) = $1', [email]);
  if (existing) {
    const coupon = await getOne('SELECT * FROM coupons WHERE id = $1', [existing.coupon_id]);
    return res.json(serialize(existing, coupon || {}, true));
  }

  const coupon = await getOne('SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE AND spin_weight IS NOT NULL', [code]);
  if (!coupon) throw new ApiError('This reward is no longer available.');

  // Mystery gift: pick the surprise cookie once, now (same as the logged-in claim path).
  let giftProductId = null;
  if (coupon.gift_kind === 'MYSTERY') {
    const pick = await getOne(
      "SELECT id FROM products WHERE category = 'COOKIES' AND is_available = TRUE AND price <= $1 ORDER BY RANDOM() LIMIT 1",
      [coupon.maximum_discount ?? coupon.discount_value],
    );
    giftProductId = pick?.id ?? null;
  }

  const expiresAt = new Date(nowMs + EMAIL_CLAIM_WINDOW_DAYS * 24 * 3600_000).toISOString();
  const label = coupon.spin_label || coupon.code;
  let row;
  try {
    row = await getOne(
      `INSERT INTO spin_email_claims (email, name, coupon_id, code, label, claimed_at, expires_at, gift_product_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [email, name, coupon.id, coupon.code, label, nowIsoStr, expiresAt, giftProductId],
    );
  } catch (e) {
    // Unique(email) race — someone claimed with this email a moment ago; return that one.
    const dupe = await getOne('SELECT * FROM spin_email_claims WHERE lower(email) = $1', [email]);
    if (dupe) return res.json(serialize(dupe, coupon, true));
    throw e;
  }

  // If an account with this email already exists, attach the reward to it right away.
  const user = await getOne('SELECT id FROM users WHERE lower(email) = $1', [email]);
  if (user) { try { await linkEmailClaimsToUser(user.id, email); } catch { /* best effort */ } }

  // Email the coupon (never blocks the response — the mailer swallows its own errors).
  sendCouponEmail({ email, name, code: coupon.code, label, offerText: offerTextFor(coupon), terms: coupon.terms || '', expiresAt }).catch(() => {});

  res.status(201).json(serialize(row, coupon, false));
});

export default router;
