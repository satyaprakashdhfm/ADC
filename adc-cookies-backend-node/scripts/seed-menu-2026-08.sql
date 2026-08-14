-- Full menu seed — August 2026.
--
-- Adds the 26 products that exist on the printed menu but not yet in the database: Hug in a Dip,
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
--   * Every product is intracity_available. Bengaluru and Chennai get the whole menu, same-day.
--   * Only COOKIES, TINS and HUG_IN_A_DIP travel by courier to the rest of India. Everything else
--     is made fresh and served straight away — a milkshake or a skillet cookie has no business in a
--     three-day parcel.
--   * Red Velvet never travels in any form, whatever its category, because of its 24-hour life.
--     Set explicitly below AND enforced at boot by the ILIKE '%red velvet%' rule in src/db.js, so a
--     Red Velvet item added later by hand through the admin still gets the rule applied.
--
--   NOTE: intercity_available DEFAULTS TO TRUE on the column. A product added later in a same-day
--   category will therefore be offered for courier unless someone turns it off in the admin.
--
-- Prices are the printed in-store menu, NOT the delivery-aggregator listing, which carries a
-- platform markup of roughly 20-30% on the same items.
--
-- Descriptions come from the aggregator listing, which is the copy already written for these
-- dishes. Six had none there and are marked below.
--
-- Images point at files in public/assets/products/new_coming/, URL-encoded because the filenames
-- contain spaces. Only the 4 Cookie Cakes are still without a photograph, so their images column is
-- NULL — firstImage() falls back to the ADC Special shot rather than rendering a broken tile.
-- Replace them from the admin Products tab as the photos arrive.

BEGIN;

INSERT INTO products (
  name, category, description, price, stock_quantity, images, options, is_available,
  menu_group, tag, featured,
  intracity_available, intercity_available, intercity_unavailable_reason, restrict_cities,
  created_at, updated_at
)
SELECT
  v.name, v.category, v.description, v.price, 100, v.images, NULL, TRUE,
  v.menu_group, NULL, FALSE,
  TRUE, v.intercity,
  CASE
    WHEN v.intercity THEN NULL
    WHEN v.name ILIKE '%red velvet%' THEN
      'This item must be enjoyed within 24 hours of baking, so we only deliver it same-day within our intracity area.'
    ELSE
      'This is made fresh and served straight away, so we only deliver it same-day in the cities where we have a shop — it cannot travel by courier.'
  END,
  -- restrict_cities narrows WHICH shop city may sell an item, and nothing on this menu is narrowed:
  -- every city with a shop bakes the whole thing. "Same-day only" is intercity_available above and
  -- is a different question — Red Velvet and a milkshake are both same-day everywhere, Chennai
  -- included. Pinning Red Velvet to Bengaluru here is what used to lock Chennai out of it.
  NULL,
  -- created_at/updated_at are timestamptz in the real database, whatever drizzle/schema.ts says
  -- about them being text — that baseline predates the change and was never regenerated.
  now(), now()
FROM (VALUES
  -- Hug in a Dip is ONE product, not one per flavour: a single tub of assorted mini cookies around
  -- a pot of chocolate dip. Description written from the photograph, since the aggregator does not
  -- list this dish.
  ('Mini Cookies (Hug in a Dip)', 'HUG_IN_A_DIP', 230,
   'A tub of assorted mini cookies — chocolate chip, double chocolate and red velvet — set around a pot of warm chocolate dip. Made for sharing.',
   '["/assets/products/new_coming/Hug%20in%20a%20Dip.jpeg"]', 'Hug in a Dip', TRUE),

  -- Skillet Cookie with Ice Cream
  ('Chocolate Chip Skillet Cookie', 'SKILLET', 220,
   'Half-baked chocolate chip cookie dough topped with two scoops of ice cream and rich chocolate drizzle.',
   '["/assets/products/new_coming/Chocolate%20Chip%20Skillet%20Cookie.jpeg"]', 'Skillet Cookie with Ice Cream', FALSE),
  ('Double Choc Chip Skillet Cookie', 'SKILLET', 230,
   'Warm double chocolate cookie dough served with two scoops of ice cream and decadent chocolate topping.',
   '["/assets/products/new_coming/Double%20Choc%20Chip%20Skillet%20Cookie.jpeg"]', 'Skillet Cookie with Ice Cream', FALSE),
  ('Biscoff Filled Skillet Cookie', 'SKILLET', 270,
   'Half-baked cookie filled with creamy Biscoff spread, topped with two scoops of ice cream and Biscoff crumble.',
   '["/assets/products/new_coming/Biscoff%20Filled%20Skillet%20Cookie.jpeg"]', 'Skillet Cookie with Ice Cream', FALSE),
  ('Nutella Filled Skillet Cookie', 'SKILLET', 260,
   'Half-baked cookie filled with molten Nutella, topped with two scoops of ice cream and chocolate drizzle.',
   '["/assets/products/new_coming/Nutella%20Filled%20Skillet%20Cookie.jpeg"]', 'Skillet Cookie with Ice Cream', FALSE),

  -- Cookie Sundae is NOT inserted here — a disabled 'Cookie Sundae' row already exists and is
  -- reused instead, further down, so the menu doesn't end up with two sundaes one of which is
  -- invisible.

  -- Cookie Shakes
  ('Chocolate Cookie Shake', 'SHAKES', 180,
   'Creamy milkshake blended with chocolate cookies and ice cream for a rich, velvety treat.',
   '["/assets/products/new_coming/Chocolate%20Cookie%20Shake.jpeg"]', 'Cookie Shakes', FALSE),
  ('Red Velvet Cookie Shake', 'SHAKES', 190,
   'Creamy shake blended with red velvet cookies for a smooth, rich dessert in every sip.',
   '["/assets/products/new_coming/Red%20Velvet%20Cookie%20Shake.jpeg"]', 'Cookie Shakes', FALSE),
  ('Hazelnut Cookie Shake', 'SHAKES', 210,
   'Smooth hazelnut cookie shake blended with creamy ice cream for a nutty, indulgent sip.',
   '["/assets/products/new_coming/Hazelnut%20Cookie%20Shake.jpeg"]', 'Cookie Shakes', FALSE),
  ('Mocha Cookie Shake', 'SHAKES', 230,
   'Coffee meets chocolate cookies in a creamy shake made for true mocha lovers.',
   '["/assets/products/new_coming/Mocha%20Cookie%20shake.jpeg"]', 'Cookie Shakes', FALSE),

  -- Hot Drinks — Hazelnut Latte uses the Hazelnut Cappuccino shot, the nearest available.
  ('Hot Chocolate', 'HOT_DRINKS', 149,
   'Rich, velvety hot chocolate crafted for a smooth, comforting, chocolate-filled indulgence.',
   '["/assets/products/new_coming/Hot%20Chocolate.jpeg"]', 'Hot Drinks', FALSE),
  ('Americano', 'HOT_DRINKS', 99,
   'Bold Arabica espresso with hot water for a smooth, clean coffee experience.',
   '["/assets/products/new_coming/Americano.jpeg"]', 'Hot Drinks', FALSE),
  ('Cappuccino', 'HOT_DRINKS', 119,
   'Rich Arabica espresso topped with silky steamed milk and a velvety foam finish.',
   '["/assets/products/new_coming/Cappuccino.jpeg"]', 'Hot Drinks', FALSE),
  ('Latte', 'HOT_DRINKS', 119,
   'Fresh Arabica espresso blended with silky steamed milk for a smooth, balanced coffee.',
   '["/assets/products/new_coming/Latte.jpeg"]', 'Hot Drinks', FALSE),
  ('Caramel Latte', 'HOT_DRINKS', 139,
   'Smooth Arabica espresso blended with steamed milk and luscious caramel for a comforting sip.',
   '["/assets/products/new_coming/Caramel%20latte.jpeg"]', 'Hot Drinks', FALSE),
  ('Hazelnut Latte', 'HOT_DRINKS', 169,
   'Creamy latte infused with rich hazelnut flavour and freshly brewed Arabica espresso.',
   '["/assets/products/new_coming/Hazelnut%20Cappuccino.jpeg"]', 'Hot Drinks', FALSE),

  -- Cold Coffee
  ('Iced Cappuccino', 'COLD_COFFEE', 129,
   'Chilled Arabica espresso blended with creamy milk and finished with a light foam.',
   '["/assets/products/new_coming/Iced%20Cappuccino.jpeg"]', 'Cold Coffee', FALSE),
  ('Iced Caramel Macchiato', 'COLD_COFFEE', 149,
   'Refreshing iced milk layered with caramel and bold Arabica espresso for a smooth coffee finish.',
   '["/assets/products/new_coming/Iced%20Caramel%20Macchiato.jpeg"]', 'Cold Coffee', FALSE),
  ('Iced Hazelnut Coffee', 'COLD_COFFEE', 179,
   'Cold Arabica coffee blended with creamy milk and rich hazelnut flavour.',
   '["/assets/products/new_coming/Iced%20hazelnut%20coffee.jpeg"]', 'Cold Coffee', FALSE),
  ('Double Chocolate Chip Frappuccino', 'COLD_COFFEE', 179,
   'Creamy iced coffee blended with rich chocolate and double chocolate chips for an indulgent refreshment.',
   '["/assets/products/new_coming/Double%20Choco%20Chip%20Frapuccino.jpeg"]', 'Cold Coffee', FALSE),

  -- Cookie Cake — no photographs and no aggregator copy; these descriptions state only what the
  -- name already promises, and are the ones to replace first once the real wording exists.
  ('Chocolate Chip Cookie Cake - 1/2 KG', 'CAKES', 800,
   'Our chocolate chip cookie baked as one half-kilo cake, ready to slice and share.',
   NULL, 'Cookie Cake', FALSE),
  ('Double Choc Chip Cookie Cake - 1/2 KG', 'CAKES', 900,
   'Our double chocolate chip cookie baked as one half-kilo cake, ready to slice and share.',
   NULL, 'Cookie Cake', FALSE),
  ('Chocolate Chip Cookie Cake - 1 KG', 'CAKES', 1600,
   'A full kilo of our chocolate chip cookie, baked as one cake for a bigger table.',
   NULL, 'Cookie Cake', FALSE),
  ('Double Choc Chip Cookie Cake - 1 KG', 'CAKES', 1700,
   'A full kilo of our double chocolate chip cookie, baked as one cake for a bigger table.',
   NULL, 'Cookie Cake', FALSE),

  -- Combos — the shake combo has no aggregator copy either; written from its photograph.
  ('Chocolate Chip + Hot Chocolate', 'COMBOS', 190,
   'A comforting hot chocolate paired with our freshly baked signature chocolate chip cookie.',
   '["/assets/products/new_coming/Hot%20Chocolate%20and%20Chocolate%20Chunk%20Cookie.jpeg"]', 'Combos', FALSE),
  ('Mini Cookie + Cookie Shake', 'COMBOS', 300,
   'A thick cookie shake served with a handful of freshly baked mini cookies on the side.',
   '["/assets/products/new_coming/Cookie%20Shake%20and%20Mini%20Cookies.jpeg"]', 'Combos', FALSE),
  ('8 Pack Cookies', 'COMBOS', 600,
   'Choose any eight freshly baked cookies and enjoy your favourite flavours in one delicious assortment.',
   '["/assets/products/new_coming/Pack%20of%208%20Cookies.jpeg"]', 'Combos', FALSE)
) AS v(name, category, price, description, images, menu_group, intercity)
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
  description = 'Four scoops of vanilla ice cream, six mini cookies, one classic cookie, rich chocolate sauce, and indulgent toppings.',
  images = '["/assets/products/new_coming/Cookie%20Sundae.jpeg"]',
  is_available = TRUE,
  intercity_available = FALSE,
  intercity_unavailable_reason = 'This is made fresh and served straight away, so we only deliver it same-day in the cities where we have a shop — it cannot travel by courier.',
  updated_at = now()
WHERE name = 'Cookie Sundae';

-- Cookie Cake goes in but stays switched off: there are no photographs for any of the four, and a
-- cake is not a thing anyone buys sight unseen. The section is also commented out of MENU_SECTIONS
-- in the frontend, so nothing links to it. Delete this statement and uncomment that line to launch
-- the category — the products and their prices are already here and correct.
UPDATE products SET is_available = FALSE, updated_at = now() WHERE category = 'CAKES';

COMMIT;

-- Check what landed:
--   SELECT category, count(*), min(price), max(price) FROM products GROUP BY category ORDER BY 1;
--   SELECT name, intercity_available, restrict_cities FROM products WHERE name ILIKE '%red velvet%';
--   SELECT name FROM products WHERE description IS NULL OR images IS NULL;
