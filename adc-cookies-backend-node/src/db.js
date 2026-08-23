import pg from 'pg';

const { Pool } = pg;

/*
 * How Postgres types come back into JavaScript.
 *
 * These MUST stay in step with the 0002/0003 migrations, and must be registered before any query
 * runs. node-postgres' defaults would otherwise change the shape of values the routes already
 * depend on, silently:
 *
 *   NUMERIC (1700)     default is a STRING, to avoid losing precision on huge values. Our amounts
 *                      are rupees, so a JS number is exact and safe — and leaving it a string would
 *                      turn `subtotal + deliveryFee` into "500" + "40" = "50040". Parsed to number.
 *   TIMESTAMPTZ (1184) default is a JS Date. The API has always emitted strings here, so we keep
 *                      strings — normalised to ISO, which is what most rows already held.
 *   DATE (1082)        default is a JS Date. coupons.js compares expiry_date directly against a
 *                      'YYYY-MM-DD' string in three places; a Date would stringify as
 *                      "Mon Aug 11 2026 ..." and expire coupons a day early. Kept as the raw
 *                      'YYYY-MM-DD' string it has always been.
 */
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number.parseFloat(v)));
pg.types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).toISOString()));
pg.types.setTypeParser(1082, (v) => v);

// If DATABASE_URL is set (and non-empty) it wins; otherwise node-postgres reads
// PGHOST / PGDATABASE / PGUSER / PGPASSWORD / PGPORT from the environment (.env).
// Remote hosts (e.g. Supabase) require SSL; local Unix-socket auth does not.
// max:10 — we connect through the Supabase SESSION pooler, which caps THIS backend at
// ~15 client connections (exceeding it returns EMAXCONNSESSION). 10 stays safely under that.
// To raise it, switch DATABASE_URL to the TRANSACTION pooler (port 6543), which multiplexes
// connections and removes the per-client session cap.
export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 10 }
    : { max: 10 }
);

export const query  = (sql, p = []) => pool.query(sql, p);
export const getOne = async (sql, p = []) => (await pool.query(sql, p)).rows[0] ?? null;
export const getAll = async (sql, p = []) => (await pool.query(sql, p)).rows;
export const nowIso = () => new Date().toISOString();

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'CUSTOMER',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      latitude FLOAT8,
      longitude FLOAT8,
      is_default BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      price NUMERIC(12,2) NOT NULL,
      stock_quantity INTEGER NOT NULL,
      images TEXT,
      options TEXT,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      menu_group TEXT,
      tag TEXT,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    -- Idempotent migrations for pre-existing products tables
    ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_group TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS tag TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
    -- Per-product, per-delivery-mode availability, each with an admin-supplied reason shown to the
    -- customer when off. Two independent switches, not one:
    --   intracity_available  — can this be sold on a same-day, store-fulfilled order at all right now?
    --   intercity_available  — can this be sold on a multi-day Delhivery parcel at all right now?
    -- Both default TRUE (ordinary products, unrestricted). Turning either off is a normal OPERATIONAL
    -- lever (out of stock today, kitchen issue, temporary pause) — nothing structural required.
    --
    -- restrict_cities (comma-separated, e.g. 'Bengaluru') narrows WHICH intracity cities count when
    -- intracity_available is true, since a store's own same-day network is not necessarily where a
    -- given item is even made — Besant Nagar (Chennai) is intracity-capable in general but does not
    -- carry Red Velvet. NULL/empty means any intracity city is fine.
    --
    -- A STRUCTURAL rule (Red Velvet: 24-hour shelf life, can never survive a multi-day parcel) is
    -- just intercity_available=FALSE with a permanent reason — the same mechanism as a temporary
    -- operational pause, not a separate concept.
    ALTER TABLE products ADD COLUMN IF NOT EXISTS intracity_available BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS intracity_unavailable_reason TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS intercity_available BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS intercity_unavailable_reason TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS restrict_cities TEXT;
    /* Stock tracking is gone. A cookie shop bakes to order, and nothing ever decremented this
       column — it sat at whatever the seed put there while driving a "low stock" warning off it.
       The column stays (dropping it rewrites a live table for no gain) but it now has a default so
       no INSERT has to mention it, and no code reads it. Availability is is_available, plus the
       per-delivery-mode and per-store flags. */
    ALTER TABLE products ALTER COLUMN stock_quantity SET DEFAULT 0;

    -- One-time: migrate the old same_day_only flag into the new shape, then drop it — superseded,
    -- not parallel. Guarded by the column's existence so this runs exactly once, ever.
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'same_day_only') THEN
        UPDATE products SET intercity_available = FALSE,
          intercity_unavailable_reason = COALESCE(intercity_unavailable_reason,
            'This item must be enjoyed within 24 hours of baking, so we only deliver it same-day within our intracity area.')
          WHERE same_day_only = TRUE;
        ALTER TABLE products DROP COLUMN same_day_only;
      END IF;
    END $$;

    -- Red Velvet's 24-hour shelf life means it can never go by Delhivery, in any form: the filled
    -- cookie, the tin, the shake, the dip. Matched on the NAME rather than a list of exact titles,
    -- which is what this used to be — that list named 'Red Velvet Filled Cookie' and 'Red Velvet
    -- Cookie Tin' and so quietly stopped covering the cookie the day it was renamed, and never
    -- covered a new Red Velvet item at all. Anything we call Red Velvet is intracity-only, and the
    -- rule should not have to be re-remembered each time the menu grows.
    --
    -- It does NOT touch restrict_cities. That column narrows WHICH shop city may sell an item, and
    -- Red Velvet is not narrowed — every city with a shop bakes it, so Chennai sells it same-day
    -- exactly as Bengaluru does. This used to force restrict_cities to 'Bengaluru', which is a
    -- different rule wearing the same clothes, and it silently locked Chennai out.
    --
    -- Still guarded by "intercity_available = TRUE" so it sets the rule once and never fights an
    -- admin who deliberately edits it afterward via the Products tab.
    UPDATE products SET intercity_available = FALSE,
        intercity_unavailable_reason = COALESCE(intercity_unavailable_reason,
          'This item must be enjoyed within 24 hours of baking, so we only deliver it same-day within our intracity area.')
      WHERE name ILIKE '%red velvet%' AND intercity_available = TRUE;

    -- One-time repair for databases seeded while the rule above still pinned Red Velvet to
    -- Bengaluru. Without this the column keeps the old value forever, since nothing else clears it.
    UPDATE products SET restrict_cities = NULL
      WHERE name ILIKE '%red velvet%' AND restrict_cities = 'Bengaluru';

    -- A store not currently taking orders (closed for the day, out of stock entirely, whatever the
    -- reason) — distinct from posMode/staff login state, which is about HOW it fulfils, not WHETHER
    -- it currently can. Checked at order-creation and by the delivery quote, same idea as
    -- SHIPROCKET_DISABLED but scoped to one store instead of the whole carrier. No row = active
    -- (every ADC_STORES entry starts on; this only ever records an explicit admin flip).
    CREATE TABLE IF NOT EXISTS store_status (
      store_code TEXT PRIMARY KEY,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL
    );
    -- Which kinds of delivery this store takes part in: 'BOTH' (default), 'INTRACITY' (same-day
    -- only — never used as an outstation pickup) or 'INTERCITY' (parcels only — not picked for
    -- same-day). Sits here rather than in ADC_STORES because it is an admin switch, not a fact
    -- about the shop. See activeZoneStores: setting every store in a zone to INTERCITY can never
    -- strand that zone, it falls back rather than refusing the city.
    ALTER TABLE store_status ADD COLUMN IF NOT EXISTS service_mode TEXT NOT NULL DEFAULT 'BOTH';

    -- Manual per-store product availability — generalizes intracity_available/restrict_cities (which only
    -- ever understands "restricted to city X") to any product/store combination an admin wants to
    -- flip directly, no code change needed: "Jayanagar is out of Red Velvet today", or the reverse,
    -- turning something ordinarily city-restricted back on for one specific store. No row for a
    -- store/product pair means "no override" — the automatic intracity_available/restrict_cities rule (or
    -- plain storewide availability) still decides it.
    -- ADMIN ACCESS, deliberately not a flag on the users table.
    --
    -- Admin used to mean users.role = 'ADMIN', which put the dashboard behind the same login as the
    -- storefront: an email/password or Google session could hold it. It is now a phone allowlist
    -- with its own OTP login and its own session, and the two share nothing.
    --
    -- Why not simply trust a phone claim on the customer's Supabase token: user_metadata is
    -- writable by the account holder, so any customer could set user_metadata.phone to an admin
    -- number and be believed. Authorisation has to rest on something the client cannot author,
    -- which is a row here plus a session row below.
    CREATE TABLE IF NOT EXISTS admin_accounts (
      phone TEXT PRIMARY KEY,                       -- 10 digits, no country code
      name TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );

    -- One row per signed-in admin. Only the SHA-256 of the bearer token is stored, so a dump of
    -- this table cannot be replayed as a login. expires_at is what enforces the re-authentication
    -- window; a Supabase JWT refreshes itself indefinitely and could not.
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      phone TEXT NOT NULL REFERENCES admin_accounts(phone) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ,
      user_agent TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_phone ON admin_sessions(phone);

    CREATE TABLE IF NOT EXISTS store_product_overrides (
      store_code TEXT NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      is_available BOOLEAN NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (store_code, product_id)
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL,
      discount_value NUMERIC(12,2) NOT NULL,
      minimum_order_amount NUMERIC(12,2),
      maximum_discount NUMERIC(12,2),
      expiry_date DATE,
      usage_limit INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS cart (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      cart_id INTEGER NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      selected_options TEXT,
      unit_price NUMERIC(12,2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      address_id INTEGER REFERENCES addresses(id),
      subtotal NUMERIC(12,2) NOT NULL,
      discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
      tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(12,2) NOT NULL,
      coupon_code TEXT,
      payment_status TEXT NOT NULL DEFAULT 'PENDING',
      order_status TEXT NOT NULL DEFAULT 'PLACED',
      delhivery_waybill TEXT,
      delhivery_shipment_id TEXT,
      tracking_url TEXT,
      shipment_status TEXT NOT NULL DEFAULT 'NOT_CREATED',
      label_generated BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    /* Automatic "Ship Now" retries after Shiprocket abandons a rider search.
       When nobody accepts, Shiprocket drops the ASSIGNMENT and puts the order back to NEW - the
       shipment itself is still live, which is why the retry re-assigns rather than re-books.
       rider_retry_at is the debounce: a refused assign (an empty wallet is the usual one) leaves
       the status at NEW, so without it every retry would burn in one poll interval on a problem
       that has nothing to do with whether a rider is available. */
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_retry_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_retry_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(12,2) NOT NULL,
      total_price NUMERIC(12,2) NOT NULL,
      selected_options TEXT,
      special_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS order_tracking (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      remarks TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      transaction_id TEXT,
      amount NUMERIC(12,2) NOT NULL,
      status TEXT NOT NULL,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coupon_usage (
      id SERIAL PRIMARY KEY,
      coupon_id INTEGER NOT NULL REFERENCES coupons(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      order_id INTEGER NOT NULL REFERENCES orders(id),
      used_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      handled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      registered_name VARCHAR(255),
      pickup_location VARCHAR(255) NOT NULL,
      address_line1 TEXT,
      address_line2 TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      pincode VARCHAR(10) NOT NULL,
      phone VARCHAR(20),
      email VARCHAR(255),
      return_pincode VARCHAR(10),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL
    );

    -- Simple key/value store for site-wide settings (e.g. which product the homepage promo shows)
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- A spin (before or after login) that has won a real prize. Guests spin first — the pending
    -- win is held client-side until they log in, then this row is created (or reused, if they
    -- already have an unexpired one) so the SAME reward is honoured for CLAIM_WINDOW_HOURS
    -- (12h) — spinning again inside that window can't win a different prize.
    CREATE TABLE IF NOT EXISTS spin_claims (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      coupon_id INTEGER NOT NULL REFERENCES coupons(id),
      code TEXT NOT NULL,
      label TEXT NOT NULL,
      claimed_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      gift_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL
    );

    -- Spin & Win's server-authoritative "ticket pool": a shuffled batch of POOL_SIZE (1000)
    -- outcomes built from the admin's current odds (e.g. tin=5% -> exactly 50 tickets in the
    -- batch), so every batch of spins delivers an EXACT ratio instead of independent randomness
    -- that only converges to the target % over a long run. Singleton row (id=1) advanced one
    -- ticket per spin under a row lock (see POST /coupons/spin); rebuilt automatically whenever
    -- the admin's weights/coupons change (signature mismatch) or the batch runs out.
    CREATE TABLE IF NOT EXISTS spin_ticket_pool (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      signature TEXT NOT NULL,
      tickets TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL
    );

    -- Anti-abuse: without this, someone could just keep re-spinning (reload the page, reopen the
    -- wheel) discarding every result they don't like — and since each attempt still consumes a
    -- ticket from the shared pool, that also burns through tickets meant for other real
    -- customers. One row per device (and per account, once logged in) records its current
    -- unexpired draw; a repeat spin request within the window replays that SAME draw instead of
    -- pulling a new ticket. See POST /coupons/spin.
    CREATE TABLE IF NOT EXISTS spin_draws (
      id SERIAL PRIMARY KEY,
      device_id TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      code TEXT,
      drawn_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_spin_draws_device_id ON spin_draws(device_id);
    CREATE INDEX IF NOT EXISTS idx_spin_draws_user_id ON spin_draws(user_id);
    -- Clearing site data or opening a private window mints a fresh device id, which was enough to
    -- keep re-spinning until a good prize came up. The origin IP is the one identifier the browser
    -- can't rewrite, so the cooldown checks it too.
    ALTER TABLE spin_draws ADD COLUMN IF NOT EXISTS ip TEXT;
    CREATE INDEX IF NOT EXISTS idx_spin_draws_ip ON spin_draws(ip);

    -- Email-subscribe spin claims: a guest who wins subscribes with their email to claim the coupon
    -- (instead of logging in). We email them the code and, once they sign in with that same email,
    -- attach it to their account (a spin_claims row) so it works at checkout. One reward per email
    -- (unique index on lower(email)).
    CREATE TABLE IF NOT EXISTS spin_email_claims (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      coupon_id INTEGER NOT NULL REFERENCES coupons(id),
      code TEXT NOT NULL,
      label TEXT NOT NULL,
      claimed_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      linked_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      gift_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_spin_email_claims_email ON spin_email_claims(lower(email));

    -- Idempotent migrations
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT 'Home';
    -- Spin & Win: which active coupons the wheel can award, their odds, and their terms.
    -- spin_weight is a 0-100 probability share; NULL = a normal (non-wheel) coupon.
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS spin_weight NUMERIC(6,3);
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS spin_label TEXT;
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS terms TEXT;
    -- "Free item" rewards (a tin / a cookie) don't just knock money off — they hand over a real
    -- product. gift_kind tells the redemption code WHICH product: 'TIN'/'FILLED_COOKIE' resolve to
    -- an eligible currently-available match (so catalog/price changes are honoured automatically),
    -- 'PRODUCT' is a fixed item (gift_product_id), 'MYSTERY' is assigned once per spin_claims row
    -- (see below) so the same surprise cookie is used consistently from preview through checkout.
    -- NULL = a normal money-off coupon, unchanged.
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS gift_kind TEXT;
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS gift_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
    ALTER TABLE spin_claims ADD COLUMN IF NOT EXISTS gift_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delhivery_waybill TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delhivery_shipment_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_status TEXT NOT NULL DEFAULT 'NOT_CREATED';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_generated BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier TEXT; -- 'SHADOWFAX' (intracity) or 'DELHIVERY' (outstation)
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery TEXT; -- Shadowfax promised date from the webhook (YYYY-MM-DD HH:MM:SS)
    -- The carrier's OWN order id, distinct from the waybill/AWB and from delhivery_shipment_id.
    -- Shiprocket's cancel API (POST /orders/cancel) takes order ids, NOT shipment ids, so without
    -- this a cancelled order could not be cancelled at Shiprocket and a rider would still turn up.
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier_order_id TEXT;
    -- Why the automatic shipment booking failed. Previously this only ever reached the console, so
    -- a paid order with no shipment looked identical to one that simply hadn't been booked yet.
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_error TEXT;
    -- Phone-login users have no email: it stays NULL (we never fabricate a synthetic address).
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    -- Best-effort city/region from the IP they last logged in from (see POST /auth/log-location) —
    -- for admin visibility into where customers are logging in from, not precise geolocation.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_location TEXT;

    -- The admin allowlist has to exist on every environment: seed.js is skipped on staging
    -- (SKIP_SEED=true) and an empty allowlist means nobody can open the dashboard at all.
    -- Kept here rather than run by hand against each database, so staging and production cannot end
    -- up with different admins and a number added for one is not forgotten for the other.
    -- DO NOTHING on conflict, so a redeploy never switches a number back on that was turned off,
    -- and never overwrites a name somebody edited.
    INSERT INTO admin_accounts (phone, name, is_active, created_at)
    VALUES ('9381502998', 'ADC Admin', TRUE, NOW()),
           ('8861657617', 'ADC Admin', TRUE, NOW()),
           ('7032529546', 'ADC Admin', TRUE, NOW())
    ON CONFLICT (phone) DO NOTHING;

    -- Retire admin from the users table. The role grants nothing now (see admin_accounts above), and
    -- leaving rows that still say ADMIN invites someone to wire a check back to it later.
    UPDATE users SET role = 'CUSTOMER' WHERE role = 'ADMIN';

    -- And drop the old seeded admin account outright. Guarded on having no orders and no coupon
    -- usage because both reference users with ON DELETE RESTRICT: a real account that happens to
    -- carry this address must not be deleted out from under its own order history.
    DELETE FROM users u
     WHERE LOWER(u.email) = 'admin@adccookies.com'
       AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM coupon_usage c WHERE c.user_id = u.id);

    -- Spin & Win wheel — exactly 5 real rewards + one "better luck next time" slot.
    -- Odds: 50% 5% off, 10% free filled cookie, 10% ₹75 off on ₹599, 1% free tin,
    -- 10% free mini cookie bowl on ₹1500, and the remaining 19% no reward.
    INSERT INTO coupons (code, discount_type, discount_value, minimum_order_amount, maximum_discount, usage_limit, is_active, spin_weight, spin_label, terms) VALUES
      ('SPIN5', 'PERCENTAGE', 5, NULL, NULL, NULL, TRUE, 50, '5% off', '5% off your order. One reward per account per spin. Valid for 12 hours. Cannot be combined with other offers.'),
      ('SPINCOOKIE', 'FIXED', 110, 299, 110, NULL, TRUE, 10, 'Free Filled Cookie', 'A filled cookie is added to your cart automatically when you redeem this reward, free of charge. Valid once the rest of your cart totals ₹299 or more. One reward per account per spin. Cannot be combined with other offers.'),
      ('SPIN75', 'FIXED', 75, 599, 75, NULL, TRUE, 10, '₹75 off on ₹599', 'Flat ₹75 off your order. Valid on a cart of ₹599 or more. One reward per account per spin. Cannot be combined with other offers.'),
      ('SPINTIN', 'FIXED', 850, 1600, 850, NULL, TRUE, 1, 'Free Cookie Tin', 'A gift tin is added to your cart automatically when you redeem this reward, free of charge. Valid once the rest of your cart totals ₹1600 or more. One reward per account per spin. Cannot be combined with other offers.'),
      ('SPINBOWL', 'FIXED', 0, 1500, 0, NULL, TRUE, 10, 'Free Mini Cookie Bowl', 'A free mini cookie bowl is included with your order. Valid on a cart of ₹1500 or more. One reward per account per spin. Cannot be combined with other offers.')
    ON CONFLICT (code) DO UPDATE SET
      discount_type = EXCLUDED.discount_type,
      discount_value = EXCLUDED.discount_value,
      minimum_order_amount = EXCLUDED.minimum_order_amount,
      maximum_discount = EXCLUDED.maximum_discount,
      usage_limit = EXCLUDED.usage_limit,
      is_active = EXCLUDED.is_active,
      spin_weight = EXCLUDED.spin_weight,
      spin_label = EXCLUDED.spin_label,
      terms = EXCLUDED.terms;

    UPDATE coupons
      SET spin_weight = NULL, is_active = FALSE
      WHERE spin_weight IS NOT NULL AND code NOT IN ('SPIN5','SPINCOOKIE','SPIN75','SPINTIN','SPINBOWL');

    -- One-time backfill: tag the 4 "free item" wheel rewards with WHICH product they hand
    -- over (see gift_kind above), and correct SPINCHOC's label — "Chocolate Chunk" was never
    -- a real menu item; Double Choc Chip is the actual ₹65 cookie this reward was priced for.
    -- Guarded by "gift_kind IS NULL" so this runs once only and can never overwrite a later
    -- admin edit to these coupons.
    UPDATE coupons SET gift_kind = 'TIN',
      discount_value = 850, maximum_discount = 850, minimum_order_amount = 1600,
      terms = 'A gift tin is added to your cart automatically when you redeem this reward, free of charge. Valid once the rest of your cart totals ₹1600 or more. One reward per account per spin. Cannot be combined with other offers.'
      WHERE code = 'SPINTIN' AND gift_kind IS NULL;
    UPDATE coupons SET gift_kind = 'FILLED_COOKIE',
      minimum_order_amount = 299,
      terms = 'A filled cookie is added to your cart automatically when you redeem this reward, free of charge. Valid once the rest of your cart totals ₹299 or more. One reward per account per spin. Cannot be combined with other offers.'
      WHERE code = 'SPINCOOKIE' AND gift_kind IS NULL;
    UPDATE coupons SET gift_kind = 'MYSTERY',
      terms = 'A surprise cookie is added to your cart automatically when you redeem this reward, free of charge. Valid once the rest of your cart totals ₹150 or more. One reward per account per spin. Cannot be combined with other offers.'
      WHERE code = 'SPINMYSTERY' AND gift_kind IS NULL;
    UPDATE coupons SET gift_kind = 'PRODUCT',
      gift_product_id = (SELECT id FROM products WHERE name = 'Double Choc Chip' LIMIT 1),
      spin_label = 'Free Double Choc Chip Cookie',
      terms = 'A free Double Choc Chip cookie is added to your cart automatically when you redeem this reward, free of charge (discount capped at ₹65). Valid once the rest of your cart totals ₹65 or more. One reward per account per spin. Cannot be combined with other offers.'
      WHERE code = 'SPINCHOC' AND gift_kind IS NULL;

    /* ---------------- Petpooja (POS / billing) ----------------
       Petpooja owns the menu: it pushes its catalogue to us and every line we relay back must
       carry THEIR item ids, so the whole integration hinges on holding that mapping. Everything
       is keyed by rest_id even though only one outlet is live today, so adding outlets later is
       configuration rather than a migration. */

    -- Every menu payload exactly as received (push or fetch). Kept verbatim because their schema
    -- carries optional objects we don't parse yet — re-reading a stored snapshot beats asking the
    -- merchant to re-trigger a push when we need a field we skipped.
    CREATE TABLE IF NOT EXISTS petpooja_menu_snapshots (
      id SERIAL PRIMARY KEY,
      rest_id TEXT NOT NULL,
      source TEXT NOT NULL,                       -- 'push' (they call us) | 'fetch' (we pull)
      payload JSONB NOT NULL,
      item_count INTEGER NOT NULL DEFAULT 0,
      received_at TIMESTAMPTZ NOT NULL
    );

    -- Flattened item catalogue and, critically, product_id: the link from their menu to ours.
    -- A variation is its own row (their order payload wants item id + variation id together), so
    -- variation_id defaults to '' rather than NULL to keep the unique index usable.
    CREATE TABLE IF NOT EXISTS petpooja_items (
      id SERIAL PRIMARY KEY,
      rest_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      variation_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      variation_name TEXT,
      price NUMERIC(12,2),
      category_id TEXT,
      tax_ids TEXT,                               -- their comma-separated item_tax ids
      in_stock BOOLEAN NOT NULL DEFAULT TRUE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      raw JSONB,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE (rest_id, item_id, variation_id)
    );

    -- Their tax definitions (CGST/SGST ids + percentages) — needed to build item_tax on an order.
    CREATE TABLE IF NOT EXISTS petpooja_taxes (
      id SERIAL PRIMARY KEY,
      rest_id TEXT NOT NULL,
      tax_id TEXT NOT NULL,
      name TEXT NOT NULL,
      percentage NUMERIC(6,3) NOT NULL DEFAULT 0,
      tax_type TEXT,
      raw JSONB,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE (rest_id, tax_id)
    );

    -- Add-on items, flattened out of addongroups/addongroupitems.
    CREATE TABLE IF NOT EXISTS petpooja_addons (
      id SERIAL PRIMARY KEY,
      rest_id TEXT NOT NULL,
      addon_id TEXT NOT NULL,
      group_id TEXT,
      group_name TEXT,
      name TEXT NOT NULL,
      price NUMERIC(12,2) NOT NULL DEFAULT 0,
      in_stock BOOLEAN NOT NULL DEFAULT TRUE,
      raw JSONB,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE (rest_id, addon_id)
    );

    -- Store open/closed, which the merchant toggles from their POS. We honour it at checkout.
    CREATE TABLE IF NOT EXISTS petpooja_stores (
      rest_id TEXT PRIMARY KEY,
      store_status BOOLEAN NOT NULL DEFAULT TRUE, -- true = open
      turn_on_time TEXT,
      reason TEXT,
      updated_at TIMESTAMPTZ NOT NULL
    );

    -- Relay audit: one row per order we push, so a failed relay is visible and replayable rather
    -- than lost in logs. petpooja_status mirrors their callback (-1/1/2/3/4/5/10).
    CREATE TABLE IF NOT EXISTS petpooja_orders (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      rest_id TEXT NOT NULL,
      relay_ok BOOLEAN NOT NULL DEFAULT FALSE,
      petpooja_order_id TEXT,
      petpooja_status TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      request JSONB,
      response JSONB,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE (order_id)
    );

    /* ---------------- Store staff portal ----------------
       Each shop-front runs its own kitchen: it takes the order, bakes it, hands it to the rider and
       (everywhere except Begur) keys the bill into its OWN Petpooja terminal. The portal at
       /store/<code> is what they work from.

       The store LIST itself is not a table — it lives in src/stores.js, because the same five
       records also carry coordinates and Shiprocket pickup nicknames that the routing code reads on
       every quote. Mirroring them into Postgres would create two sources of truth that drift.
       Credentials are the part that genuinely needs a table, and only that is stored here. */
    CREATE TABLE IF NOT EXISTS store_users (
      id SERIAL PRIMARY KEY,
      store_code TEXT NOT NULL,                   -- matches ADC_STORES[].code in src/stores.js
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      -- NULL until the first successful login. The admin screen reads it as "this account is still
      -- on its handed-out password", which is the only safe way to show that without storing one.
      last_login_at TIMESTAMPTZ,
      password_set_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_store_users_store_code ON store_users(store_code);

    -- Which kitchen owns an order, and how far that kitchen has got with it. Kept on the orders
    -- row rather than in a side table because every read of an order needs it and none of it is
    -- historical — the timeline of who did what is already in order_tracking.
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_code TEXT;
    -- Set when the store accepts the order. Until then nobody has confirmed they are baking it,
    -- which is exactly what the portal's unaccepted list is for.
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_accepted_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_accepted_by INTEGER REFERENCES store_users(id) ON DELETE SET NULL;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_ready_at TIMESTAMPTZ;
    -- The bill number from the store's own Petpooja terminal, typed in by staff. For every outlet
    -- except Begur this is the ONLY link between a web order and its POS bill — without it the
    -- day's takings cannot be reconciled against what Razorpay settled.
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_pos_bill_no TEXT;
    CREATE INDEX IF NOT EXISTS idx_orders_store_code ON orders(store_code);

    -- Security: enable Row Level Security on every public table so the Supabase auto REST
    -- API (reachable with the public anon key) denies all anon/authenticated access. This
    -- backend connects as the table owner, which bypasses RLS, so the app is unaffected.
    DO $$ DECLARE r RECORD; BEGIN
      FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        BEGIN
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        EXCEPTION WHEN OTHERS THEN NULL; -- skip tables this role can't alter
        END;
      END LOOP;
    END $$;
  `);
}
