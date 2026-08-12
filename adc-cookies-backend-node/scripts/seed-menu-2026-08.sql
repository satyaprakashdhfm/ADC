-- Full menu seed — August 2026.
--
-- Adds the 28 products that exist on the printed menu but not yet in the database: Hug in a Dip,
-- Skillet Cookies, Cookie Shakes, Hot Drinks, Cold Coffee, Cookie Cakes and Combos. The live
-- products are NOT touched — not their prices, not their names, not their flags. The single
-- exception is the already-disabled 'Cookie Sundae', which becomes the menu's Fudge & Fold Sundae
-- (see the UPDATE at the bottom).
--
-- Idempotent: every row is guarded by NOT EXISTS on the product name, so running this twice adds
-- nothing the second time. Safe to run against staging, check, then run against production.
--
--   psql "$DATABASE_URL" -f scripts/seed-menu-2026-08.sql
--
-- Delivery rules, per the standing policy:
--   * Every product is intracity_available — the full menu is served same-day inside a store city.
--   * Every product is intercity_available EXCEPT anything named Red Velvet, whose 24-hour shelf
--     life rules out a multi-day Delhivery parcel. That is set explicitly below AND enforced at
--     boot by the ILIKE '%red velvet%' rule in src/db.js, so a Red Velvet item added later by hand
--     through the admin still gets the rule applied.
--
-- Images: 21 of the 29 point at files in public/assets/products/new_coming/ (URL-encoded, the
-- filenames contain spaces). The 4 Skillet Cookies and 4 Cookie Cakes have no photograph yet, so
-- their images column is NULL — firstImage() falls back to the ADC Special shot rather than
-- rendering a broken tile. Replace them from the admin Products tab as the photos arrive.

BEGIN;

INSERT INTO products (
  name, category, description, price, stock_quantity, images, options, is_available,
  menu_group, tag, featured,
  intracity_available, intercity_available, intercity_unavailable_reason, restrict_cities,
  created_at, updated_at
)
SELECT
  v.name, v.category, NULL, v.price, 100, v.images, NULL, TRUE,
  v.menu_group, NULL, FALSE,
  TRUE, v.intercity,
  CASE WHEN v.intercity THEN NULL ELSE
    'This item must be enjoyed within 24 hours of baking, so we only deliver it same-day within our intracity area.' END,
  CASE WHEN v.intercity THEN NULL ELSE 'Bengaluru' END,
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM (VALUES
  -- Hug in a Dip — one photograph covers all three flavours for now.
  ('Chocolate Chip Hug in a Dip',        'HUG_IN_A_DIP', 230, '["/assets/products/new_coming/Hug%20in%20a%20Dip.jpeg"]',                            'Hug in a Dip',                  TRUE),
  ('Double Choc Chip Hug in a Dip',      'HUG_IN_A_DIP', 230, '["/assets/products/new_coming/Hug%20in%20a%20Dip.jpeg"]',                            'Hug in a Dip',                  TRUE),
  ('Red Velvet Hug in a Dip',            'HUG_IN_A_DIP', 230, '["/assets/products/new_coming/Hug%20in%20a%20Dip.jpeg"]',                            'Hug in a Dip',                  FALSE),

  -- Skillet Cookie with Ice Cream — no photographs yet.
  ('Chocolate Chip Skillet Cookie',      'SKILLET',      220, NULL,                                                                                  'Skillet Cookie with Ice Cream', TRUE),
  ('Double Choc Chip Skillet Cookie',    'SKILLET',      230, NULL,                                                                                  'Skillet Cookie with Ice Cream', TRUE),
  ('Biscoff Filled Skillet Cookie',      'SKILLET',      270, NULL,                                                                                  'Skillet Cookie with Ice Cream', TRUE),
  ('Nutella Filled Skillet Cookie',      'SKILLET',      260, NULL,                                                                                  'Skillet Cookie with Ice Cream', TRUE),

  -- Cookie Sundae is NOT inserted here — a disabled 'Cookie Sundae' row already exists and is
  -- reused instead, further down, so the menu doesn't end up with two sundaes one of which is
  -- invisible.

  -- Cookie Shakes
  ('Chocolate Cookie Shake',             'SHAKES',       180, '["/assets/products/new_coming/Chocolate%20Cookie%20Shake.jpeg"]',                     'Cookie Shakes',                 TRUE),
  ('Red Velvet Cookie Shake',            'SHAKES',       190, '["/assets/products/new_coming/Red%20Velvet%20Cookie%20Shake.jpeg"]',                  'Cookie Shakes',                 FALSE),
  ('Hazelnut Cookie Shake',              'SHAKES',       210, '["/assets/products/new_coming/Hazelnut%20Cookie%20Shake.jpeg"]',                      'Cookie Shakes',                 TRUE),
  ('Mocha Cookie Shake',                 'SHAKES',       230, '["/assets/products/new_coming/Mocha%20Cookie%20shake.jpeg"]',                         'Cookie Shakes',                 TRUE),

  -- Hot Drinks — Hazelnut Latte uses the Hazelnut Cappuccino shot, the nearest available.
  ('Hot Chocolate',                      'HOT_DRINKS',   149, '["/assets/products/new_coming/Hot%20Chocolate.jpeg"]',                                'Hot Drinks',                    TRUE),
  ('Americano',                          'HOT_DRINKS',    99, '["/assets/products/new_coming/Americano.jpeg"]',                                      'Hot Drinks',                    TRUE),
  ('Cappuccino',                         'HOT_DRINKS',   119, '["/assets/products/new_coming/Cappuccino.jpeg"]',                                     'Hot Drinks',                    TRUE),
  ('Latte',                              'HOT_DRINKS',   119, '["/assets/products/new_coming/Latte.jpeg"]',                                          'Hot Drinks',                    TRUE),
  ('Caramel Latte',                      'HOT_DRINKS',   139, '["/assets/products/new_coming/Caramel%20latte.jpeg"]',                                'Hot Drinks',                    TRUE),
  ('Hazelnut Latte',                     'HOT_DRINKS',   169, '["/assets/products/new_coming/Hazelnut%20Cappuccino.jpeg"]',                          'Hot Drinks',                    TRUE),

  -- Cold Coffee
  ('Iced Cappuccino',                    'COLD_COFFEE',  129, '["/assets/products/new_coming/Iced%20Cappuccino.jpeg"]',                              'Cold Coffee',                   TRUE),
  ('Iced Caramel Macchiato',             'COLD_COFFEE',  149, '["/assets/products/new_coming/Iced%20Caramel%20Macchiato.jpeg"]',                     'Cold Coffee',                   TRUE),
  ('Iced Hazelnut Coffee',               'COLD_COFFEE',  179, '["/assets/products/new_coming/Iced%20hazelnut%20coffee.jpeg"]',                       'Cold Coffee',                   TRUE),
  ('Double Chocolate Chip Frappuccino',  'COLD_COFFEE',  179, '["/assets/products/new_coming/Double%20Choco%20Chip%20Frapuccino.jpeg"]',             'Cold Coffee',                   TRUE),

  -- Cookie Cake — no photographs yet.
  ('Chocolate Chip Cookie Cake - 1/2 KG',   'CAKES',      800, NULL,                                                                                 'Cookie Cake',                   TRUE),
  ('Double Choc Chip Cookie Cake - 1/2 KG', 'CAKES',      900, NULL,                                                                                 'Cookie Cake',                   TRUE),
  ('Chocolate Chip Cookie Cake - 1 KG',     'CAKES',     1600, NULL,                                                                                 'Cookie Cake',                   TRUE),
  ('Double Choc Chip Cookie Cake - 1 KG',   'CAKES',     1700, NULL,                                                                                 'Cookie Cake',                   TRUE),

  -- Combos
  ('Chocolate Chip + Hot Chocolate',     'COMBOS',       190, '["/assets/products/new_coming/Hot%20Chocolate%20and%20Chocolate%20Chunk%20Cookie.jpeg"]', 'Combos',                    TRUE),
  ('Mini Cookie + Cookie Shake',         'COMBOS',       300, '["/assets/products/new_coming/Cookie%20Shake%20and%20Mini%20Cookies.jpeg"]',          'Combos',                        TRUE),
  ('8 Pack Cookies',                     'COMBOS',       600, '["/assets/products/new_coming/Pack%20of%208%20Cookies.jpeg"]',                        'Combos',                        TRUE)
) AS v(name, category, price, images, menu_group, intercity)
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.name = v.name);

-- The one existing row this script touches, and the only one.
--
-- A 'Cookie Sundae' has been sitting in the table since before this menu, disabled, filed under
-- COOKIES at Rs150 — which is why the catalog API reports 12 products while the table holds 13. It
-- is the same dish the menu now calls Fudge & Fold Sundae at Rs250, so it is renamed, repriced,
-- moved into its own category and switched on, rather than inserting a second sundae and leaving
-- this one to sit there invisible forever.
--
-- Matched on name, not id: the ids differ between the staging and production databases, the names
-- do not. Guarded on the old name so re-running after the rename does nothing.
UPDATE products SET
  name = 'Fudge & Fold Sundae',
  category = 'SUNDAE',
  price = 250,
  menu_group = 'Cookie Sundae',
  images = '["/assets/products/new_coming/Cookie%20Sundae.jpeg"]',
  is_available = TRUE,
  updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE name = 'Cookie Sundae';

COMMIT;

-- Check what landed:
--   SELECT category, count(*), min(price), max(price) FROM products GROUP BY category ORDER BY 1;
--   SELECT name, intercity_available, restrict_cities FROM products WHERE name ILIKE '%red velvet%';
