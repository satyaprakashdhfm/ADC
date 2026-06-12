-- ============================================================================
--  ADC Cookies — full schema + seed for Supabase (PostgreSQL)
--  Paste this whole file into the Supabase SQL Editor and run it once.
--
--  It is self-contained and re-runnable: it DROPS existing ADC tables, recreates
--  the schema, and loads seed data (logins below work as-is).
--    Admin    : admin@adccookies.com / admin123
--    Customer : priya@example.com   / priya123
--    Customer : rahul@example.com   / rahul123
--
--  After running, point the backend at Supabase by setting in .env:
--    DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres
--  (The Node app connects directly with these credentials, so Supabase RLS does
--   not need policies — RLS only gates the PostgREST anon/authenticated roles.)
-- ============================================================================

BEGIN;

-- ---- Clean slate (children first via CASCADE) -----------------------------
DROP TABLE IF EXISTS coupon_usage   CASCADE;
DROP TABLE IF EXISTS payments       CASCADE;
DROP TABLE IF EXISTS order_tracking CASCADE;
DROP TABLE IF EXISTS order_items    CASCADE;
DROP TABLE IF EXISTS orders         CASCADE;
DROP TABLE IF EXISTS cart_items     CASCADE;
DROP TABLE IF EXISTS cart           CASCADE;
DROP TABLE IF EXISTS coupons        CASCADE;
DROP TABLE IF EXISTS products       CASCADE;
DROP TABLE IF EXISTS addresses      CASCADE;
DROP TABLE IF EXISTS users          CASCADE;

-- ---- Schema ----------------------------------------------------------------
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  phone      TEXT UNIQUE,
  password   TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'CUSTOMER',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE addresses (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  pincode       TEXT NOT NULL,
  latitude      FLOAT8,
  longitude     FLOAT8,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE products (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL,
  description    TEXT,
  price          FLOAT8 NOT NULL,
  stock_quantity INTEGER NOT NULL,
  images         TEXT,
  options        TEXT,
  is_available   BOOLEAN NOT NULL DEFAULT TRUE,
  menu_group     TEXT,
  tag            TEXT,
  featured       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE coupons (
  id                   SERIAL PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  discount_type        TEXT NOT NULL,
  discount_value       FLOAT8 NOT NULL,
  minimum_order_amount FLOAT8,
  maximum_discount     FLOAT8,
  expiry_date          TEXT,
  usage_limit          INTEGER,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE cart (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE cart_items (
  id               SERIAL PRIMARY KEY,
  cart_id          INTEGER NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL REFERENCES products(id),
  quantity         INTEGER NOT NULL,
  selected_options TEXT,
  unit_price       FLOAT8 NOT NULL
);

CREATE TABLE orders (
  id                    SERIAL PRIMARY KEY,
  order_number          TEXT NOT NULL UNIQUE,
  user_id               INTEGER NOT NULL REFERENCES users(id),
  address_id            INTEGER REFERENCES addresses(id),
  subtotal              FLOAT8 NOT NULL,
  discount_amount       FLOAT8 NOT NULL DEFAULT 0,
  delivery_fee          FLOAT8 NOT NULL DEFAULT 0,
  tax_amount            FLOAT8 NOT NULL DEFAULT 0,
  total_amount          FLOAT8 NOT NULL,
  coupon_code           TEXT,
  payment_status        TEXT NOT NULL DEFAULT 'PENDING',
  order_status          TEXT NOT NULL DEFAULT 'PLACED',
  delhivery_waybill     TEXT,
  delhivery_shipment_id TEXT,
  tracking_url          TEXT,
  shipment_status       TEXT NOT NULL DEFAULT 'NOT_CREATED',
  label_generated       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE TABLE order_items (
  id               SERIAL PRIMARY KEY,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       INTEGER REFERENCES products(id),
  product_name     TEXT NOT NULL,
  quantity         INTEGER NOT NULL,
  unit_price       FLOAT8 NOT NULL,
  total_price      FLOAT8 NOT NULL,
  selected_options TEXT,
  special_notes    TEXT
);

CREATE TABLE order_tracking (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  remarks    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE payments (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,
  transaction_id TEXT,
  amount         FLOAT8 NOT NULL,
  status         TEXT NOT NULL,
  paid_at        TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE coupon_usage (
  id        SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id),
  user_id   INTEGER NOT NULL REFERENCES users(id),
  order_id  INTEGER NOT NULL REFERENCES orders(id),
  used_at   TEXT NOT NULL
);

-- ---- Seed: a reusable ISO-8601 UTC timestamp -------------------------------
-- (now() is fixed within this single transaction, so all rows share one stamp)

-- Users (passwords are real bcrypt hashes of admin123 / priya123 / rahul123) --
INSERT INTO users (name, email, phone, password, role, created_at, updated_at) VALUES
  ('ADC Admin',    'admin@adccookies.com', '9000000001', '$2a$10$H0Gwg8sN8yyrRCmOb5LEvexUIHE7jXxp.dsb4yvSzp0gu9qVRaLry', 'ADMIN',
     to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  ('Priya Sharma', 'priya@example.com',    '9876543210', '$2a$10$51lf6/pDQQCDF7YrvYnsu.tZGoIqmtj1.d6Hba3fVEVt5naS54A1G', 'CUSTOMER',
     to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  ('Rahul Verma',  'rahul@example.com',    '9123456789', '$2a$10$CSSGAymjKt60wsZzKE6F..EE.pIYj9HiWqAF53NOiAvAAZJA9.QRm', 'CUSTOMER',
     to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));

-- Addresses --
INSERT INTO addresses (user_id, full_name, phone, address_line1, address_line2, city, state, pincode, latitude, longitude, is_default) VALUES
  ((SELECT id FROM users WHERE email='priya@example.com'), 'Priya Sharma', '9876543210', '42, MG Road', 'Near Metro Station', 'Bangalore', 'Karnataka', '560001', 12.9716, 77.5946, TRUE),
  ((SELECT id FROM users WHERE email='rahul@example.com'), 'Rahul Verma',  '9123456789', '17, Connaught Place', NULL,         'New Delhi', 'Delhi',     '110001', 28.6315, 77.2167, TRUE);

-- Products (the real ADC menu) --
INSERT INTO products (name, category, description, price, stock_quantity, images, options, is_available, menu_group, tag, featured, created_at, updated_at) VALUES
  ('Chocolate Chip', 'COOKIES', 'The original. Buttery dough, browned-butter base and premium dark chocolate chips — crisp at the edges, gooey at the core.', 60, 150, '["/assets/products/blueberry.jpg"]', '["Extra Chocolate","Less Sweet","Gift Wrap","Message Card"]', TRUE, 'Classic Cookies', 'Classic', FALSE, to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  ('Double Choc Chip', 'COOKIES', 'Rich cocoa dough loaded with extra-dark chocolate chunks and a dusting of Dutch cocoa. Fudgy and impossible to resist.', 65, 130, '["/assets/products/triple-choc.jpg"]', '["Extra Chocolate","Gift Wrap","Message Card"]', TRUE, 'Classic Cookies', 'Bestseller', TRUE, to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  ('Raagi (Gluten Free)', 'COOKIES', 'Wholesome finger-millet cookie, naturally gluten free, with a warm nutty depth and just the right chew.', 60, 90, '["/assets/products/oatmeal-raisin.jpg"]', '["Less Sweet","Gift Wrap","Message Card"]', TRUE, 'Classic Cookies', 'Gluten Free', FALSE, to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  ('Matcha', 'COOKIES', 'Stone-ground ceremonial matcha from Uji, Japan folded into buttery dough with cacao-butter white-chocolate chips.', 90, 70, '["/assets/products/matcha.jpg"]', '["Extra White Chocolate","Less Sugar","Gift Wrap","Message Card"]', TRUE, 'Premium Cookies', 'Premium', TRUE, to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  ('ADC Special', 'COOKIES', 'Our crown jewel — slow-browned butter, three kinds of premium chocolate and hand-harvested Maldon sea-salt flakes.', 90, 120, '["/assets/products/adc-special.jpg"]', '["Extra Chocolate","Sea Salt","Gift Wrap","Message Card"]', TRUE, 'Premium Cookies', 'Signature', TRUE, to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  ('Red Velvet With Cheese', 'COOKIES', 'Deep cocoa-red velvet dough wrapped around a tangy cream-cheese centre that softens as it bakes. Our most dramatic cookie.', 90, 80, '["/assets/products/red-velvet.jpg"]', '["Extra Cream Cheese","Gift Wrap","Message Card"]', TRUE, 'Premium Cookies', 'Premium', TRUE, to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  ('Biscoff Filled', 'COOKIES', 'Caramelised cookie shell around a warm, molten river of Belgian Lotus Biscoff spread. Frozen before baking for a lava-like centre.', 110, 100, '["/assets/products/peanut-butter.jpg"]', '["Extra Biscoff","Gift Wrap","Message Card"]', TRUE, 'Filled Cookies', 'Bestseller', TRUE, to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  ('Nutella Filled', 'COOKIES', 'A gooey Nutella centre tucked inside a soft chocolate cookie. Absolutely irresistible warm.', 90, 110, '["/assets/products/caramel-cashew.jpg"]', '["Extra Nutella","Gift Wrap","Message Card"]', TRUE, 'Filled Cookies', 'Recommended', FALSE, to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  ('Nutella Tin', 'TINS', 'Six premium Nutella-filled cookies in a keepsake gift tin. Perfect for gifting and celebrations.', 600, 30, '["/assets/products/coffee-almond.jpg"]', '["Custom Message","Ribbon Wrap","Premium Box"]', TRUE, 'Gift Tins', 'Gift', FALSE, to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  ('Biscoff Tin', 'TINS', 'Nine Biscoff-filled cookies, gift-ready in a premium tin with a ribbon wrap and name tag.', 850, 20, '["/assets/products/m-and-m.jpg"]', '["Custom Message","Ribbon Wrap","Premium Box","Free Name Tag"]', TRUE, 'Gift Tins', 'Gift', FALSE, to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));

-- Coupons (expiry relative to the run date) --
INSERT INTO coupons (code, discount_type, discount_value, minimum_order_amount, maximum_discount, expiry_date, usage_limit, is_active) VALUES
  ('WELCOME10',   'PERCENTAGE', 10,  300,  100, to_char(CURRENT_DATE + INTERVAL '90 days','YYYY-MM-DD'), 500, TRUE),
  ('FLAT50',      'FLAT',       50,  500, NULL, to_char(CURRENT_DATE + INTERVAL '30 days','YYYY-MM-DD'), 200, TRUE),
  ('SWEETDEAL20', 'PERCENTAGE', 20,  700,  200, to_char(CURRENT_DATE + INTERVAL '60 days','YYYY-MM-DD'), 100, TRUE),
  ('DIWALI25',    'PERCENTAGE', 25, 1000,  300, to_char(CURRENT_DATE - INTERVAL '10 days','YYYY-MM-DD'),  50, FALSE);

-- Sample Order 1 — Priya, delivered --
INSERT INTO orders (order_number, user_id, address_id, subtotal, discount_amount, delivery_fee, tax_amount, total_amount,
                    coupon_code, payment_status, order_status, delhivery_waybill, tracking_url, shipment_status, label_generated, created_at, updated_at)
VALUES ('ADC20260610001',
        (SELECT id FROM users WHERE email='priya@example.com'),
        (SELECT a.id FROM addresses a JOIN users u ON u.id=a.user_id WHERE u.email='priya@example.com' LIMIT 1),
        185, 18.50, 49, 0, 215.50, 'WELCOME10', 'PAID', 'DELIVERED',
        'DLV123456789', 'https://www.delhivery.com/track/package/DLV123456789', 'DELIVERED', TRUE,
        to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));

INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, selected_options, special_notes) VALUES
  ((SELECT id FROM orders WHERE order_number='ADC20260610001'), (SELECT id FROM products WHERE name='Chocolate Chip'),   'Chocolate Chip',   2, 60, 120, '["Extra Chocolate"]', NULL),
  ((SELECT id FROM orders WHERE order_number='ADC20260610001'), (SELECT id FROM products WHERE name='Double Choc Chip'), 'Double Choc Chip', 1, 65,  65, '[]',                  NULL);

INSERT INTO payments (order_id, provider, transaction_id, amount, status, paid_at, created_at) VALUES
  ((SELECT id FROM orders WHERE order_number='ADC20260610001'), 'RAZORPAY', 'pay_ADC001ABCDEF', 215.50, 'PAID',
     to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));

INSERT INTO order_tracking (order_id, status, remarks, created_at)
SELECT (SELECT id FROM orders WHERE order_number='ADC20260610001'), s.status, s.remarks,
       to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM (VALUES
  ('PLACED','Order placed'), ('CONFIRMED','Payment received'), ('PREPARING','Baking in progress'),
  ('PACKED','Packed and ready for pickup'), ('OUT_FOR_DELIVERY','Out for delivery with Delhivery'), ('DELIVERED','Delivered successfully')
) AS s(status, remarks);

-- Sample Order 2 — Rahul, in progress --
INSERT INTO orders (order_number, user_id, address_id, subtotal, discount_amount, delivery_fee, tax_amount, total_amount,
                    coupon_code, payment_status, order_status, shipment_status, label_generated, created_at, updated_at)
VALUES ('ADC20260610002',
        (SELECT id FROM users WHERE email='rahul@example.com'),
        (SELECT a.id FROM addresses a JOIN users u ON u.id=a.user_id WHERE u.email='rahul@example.com' LIMIT 1),
        850, 0, 0, 0, 850, NULL, 'PAID', 'PREPARING', 'NOT_CREATED', FALSE,
        to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));

INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, selected_options, special_notes) VALUES
  ((SELECT id FROM orders WHERE order_number='ADC20260610002'), (SELECT id FROM products WHERE name='Biscoff Tin'),
   'Biscoff Tin', 1, 850, 850, '["Custom Message","Ribbon Wrap"]', 'Please write ''Happy Birthday Meera'' on the card');

INSERT INTO payments (order_id, provider, transaction_id, amount, status, paid_at, created_at) VALUES
  ((SELECT id FROM orders WHERE order_number='ADC20260610002'), 'RAZORPAY', 'pay_ADC002XYZABC', 850, 'PAID',
     to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));

INSERT INTO order_tracking (order_id, status, remarks, created_at)
SELECT (SELECT id FROM orders WHERE order_number='ADC20260610002'), s.status, s.remarks,
       to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM (VALUES
  ('PLACED','Order placed'), ('CONFIRMED','Payment confirmed'), ('PREPARING','Baking your cookies')
) AS s(status, remarks);

COMMIT;
