import pg from 'pg';

const { Pool } = pg;

// If DATABASE_URL is set (and non-empty) it wins; otherwise node-postgres reads
// PGHOST / PGDATABASE / PGUSER / PGPASSWORD / PGPORT from the environment (.env).
// Remote hosts (e.g. Supabase) require SSL; local Unix-socket auth does not.
export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {}
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

    -- Idempotent migrations
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT 'Home';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delhivery_waybill TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delhivery_shipment_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_status TEXT NOT NULL DEFAULT 'NOT_CREATED';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_generated BOOLEAN NOT NULL DEFAULT FALSE;

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
