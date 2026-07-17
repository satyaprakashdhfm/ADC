import pg from 'pg';

const { Pool } = pg;

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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
      price FLOAT8 NOT NULL,
      stock_quantity INTEGER NOT NULL,
      images TEXT,
      options TEXT,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      menu_group TEXT,
      tag TEXT,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Idempotent migrations for pre-existing products tables
    ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_group TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS tag TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL,
      discount_value FLOAT8 NOT NULL,
      minimum_order_amount FLOAT8,
      maximum_discount FLOAT8,
      expiry_date TEXT,
      usage_limit INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS cart (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      cart_id INTEGER NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      selected_options TEXT,
      unit_price FLOAT8 NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      address_id INTEGER REFERENCES addresses(id),
      subtotal FLOAT8 NOT NULL,
      discount_amount FLOAT8 NOT NULL DEFAULT 0,
      delivery_fee FLOAT8 NOT NULL DEFAULT 0,
      tax_amount FLOAT8 NOT NULL DEFAULT 0,
      total_amount FLOAT8 NOT NULL,
      coupon_code TEXT,
      payment_status TEXT NOT NULL DEFAULT 'PENDING',
      order_status TEXT NOT NULL DEFAULT 'PLACED',
      delhivery_waybill TEXT,
      delhivery_shipment_id TEXT,
      tracking_url TEXT,
      shipment_status TEXT NOT NULL DEFAULT 'NOT_CREATED',
      label_generated BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price FLOAT8 NOT NULL,
      total_price FLOAT8 NOT NULL,
      selected_options TEXT,
      special_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS order_tracking (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      remarks TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      transaction_id TEXT,
      amount FLOAT8 NOT NULL,
      status TEXT NOT NULL,
      paid_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coupon_usage (
      id SERIAL PRIMARY KEY,
      coupon_id INTEGER NOT NULL REFERENCES coupons(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      order_id INTEGER NOT NULL REFERENCES orders(id),
      used_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      handled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL
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
      created_at TEXT NOT NULL
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
      claimed_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      gift_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL
    );

    -- Idempotent migrations
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT 'Home';
    -- Spin & Win: which active coupons the wheel can award, their odds, and their terms.
    -- spin_weight is a 0-100 probability share; NULL = a normal (non-wheel) coupon.
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS spin_weight FLOAT8;
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS spin_label TEXT;
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS terms TEXT;
    -- "Free item" rewards (a tin / a cookie) don't just knock money off — they hand over a real
    -- product. gift_kind tells the redemption code WHICH product: 'TIN'/'FILLED_COOKIE' resolve to
    -- the cheapest currently-available match (so catalog/price changes are honoured automatically),
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
    -- Phone-login users have no email: it stays NULL (we never fabricate a synthetic address).
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    -- Best-effort city/region from the IP they last logged in from (see POST /auth/log-location) —
    -- for admin visibility into where customers are logging in from, not precise geolocation.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_location TEXT;

    -- Spin & Win wheel — 7 real rewards + one "no reward" slot (the 8th, handled client-side).
    -- Odds: Free Cookie Tin is rare (5%); the other 6 real rewards split the remaining 95%
    -- evenly alongside the no-reward slot (~13.57% each of 7). Runs every boot but only
    -- inserts a code the first time — the admin's later edits (value, weight, terms, limits,
    -- active/expiry) are never overwritten.
    INSERT INTO coupons (code, discount_type, discount_value, minimum_order_amount, maximum_discount, usage_limit, is_active, spin_weight, spin_label, terms) VALUES
      ('SPINTIN', 'FIXED', 800, 800, 800, NULL, TRUE, 5, 'Free Cookie Tin', 'Valid on a cart of ₹800 or more. Discount capped at ₹800 — the value of one gift tin. One reward per account per spin. Cannot be combined with other offers.'),
      ('SPINCOOKIE', 'FIXED', 110, 110, 110, NULL, TRUE, 13.57, 'Free Filled Cookie', 'Valid on a cart of ₹110 or more. Discount capped at ₹110 — the price of one filled cookie of your choice. One reward per account per spin. Cannot be combined with other offers.'),
      ('SPIN100', 'FIXED', 100, 200, 100, NULL, TRUE, 13.57, 'Flat ₹100 OFF', 'Valid on a cart of ₹200 or more. Flat ₹100 off your order. One reward per account per spin. Cannot be combined with other offers.'),
      ('SPINMYSTERY', 'FIXED', 60, 150, 60, NULL, TRUE, 13.57, 'Mystery Cookie Gift', 'A surprise reward. Valid on a cart of ₹150 or more. One reward per account per spin. Cannot be combined with other offers.'),
      ('SPINCHOC', 'FIXED', 65, 65, 65, NULL, TRUE, 13.57, 'Free Signature Choc Chunk Cookie', 'Valid on a cart of ₹65 or more. Discount capped at ₹65 — the price of one Chocolate Chunk cookie. One reward per account per spin. Cannot be combined with other offers.'),
      ('SPIN10', 'PERCENTAGE', 10, 200, 150, NULL, TRUE, 13.57, '10% OFF', '10% off your order, capped at ₹150. Valid on a cart of ₹200 or more. One reward per account per spin. Cannot be combined with other offers.'),
      ('SPIN75', 'FIXED', 75, 499, 75, NULL, TRUE, 13.57, '₹75 OFF on ₹499', 'Valid on a cart of ₹499 or more. Flat ₹75 off your order. One reward per account per spin. Cannot be combined with other offers.')
    ON CONFLICT (code) DO NOTHING;

    -- One-time backfill: tag the 4 "free item" wheel rewards with WHICH product they hand
    -- over (see gift_kind above), and correct SPINCHOC's label — "Chocolate Chunk" was never
    -- a real menu item; Double Choc Chip is the actual ₹65 cookie this reward was priced for.
    -- Guarded by "gift_kind IS NULL" so this runs once only and can never overwrite a later
    -- admin edit to these coupons.
    UPDATE coupons SET gift_kind = 'TIN',
      terms = 'Our cheapest gift tin is added to your cart automatically when you redeem this reward, free of charge (discount capped at ₹800). Valid once the rest of your cart totals ₹800 or more. One reward per account per spin. Cannot be combined with other offers.'
      WHERE code = 'SPINTIN' AND gift_kind IS NULL;
    UPDATE coupons SET gift_kind = 'FILLED_COOKIE',
      terms = 'Our cheapest filled cookie is added to your cart automatically when you redeem this reward, free of charge (discount capped at ₹110). Valid once the rest of your cart totals ₹110 or more. One reward per account per spin. Cannot be combined with other offers.'
      WHERE code = 'SPINCOOKIE' AND gift_kind IS NULL;
    UPDATE coupons SET gift_kind = 'MYSTERY',
      terms = 'A surprise cookie is added to your cart automatically when you redeem this reward, free of charge. Valid once the rest of your cart totals ₹150 or more. One reward per account per spin. Cannot be combined with other offers.'
      WHERE code = 'SPINMYSTERY' AND gift_kind IS NULL;
    UPDATE coupons SET gift_kind = 'PRODUCT',
      gift_product_id = (SELECT id FROM products WHERE name = 'Double Choc Chip' LIMIT 1),
      spin_label = 'Free Double Choc Chip Cookie',
      terms = 'A free Double Choc Chip cookie is added to your cart automatically when you redeem this reward, free of charge (discount capped at ₹65). Valid once the rest of your cart totals ₹65 or more. One reward per account per spin. Cannot be combined with other offers.'
      WHERE code = 'SPINCHOC' AND gift_kind IS NULL;

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
