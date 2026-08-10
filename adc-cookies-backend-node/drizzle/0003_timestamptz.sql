-- Timestamps: TEXT -> TIMESTAMPTZ, and coupons.expiry_date TEXT -> DATE.
--
-- These held ISO strings in two different shapes, because some were written by Postgres now()::text
-- ("2026-08-01 12:53:04.836233+00") and others by JS nowIso() ("2026-08-01T19:11:16.464Z"). Text
-- sorting between those two shapes is wrong (a space sorts before 'T'), so any comparison mixing
-- them was already subtly broken. Real timestamps remove the whole class of problem and let SQL do
-- date arithmetic instead of pulling rows into JS to group them.
--
-- nullif(c,'') guards rows holding an empty string rather than NULL.
--
-- NOTE ON READ BEHAVIOUR — db.js registers type parsers alongside this:
--   TIMESTAMPTZ (1184) -> ISO string, so the API keeps emitting strings, now consistently ISO.
--   DATE        (1082) -> raw 'YYYY-MM-DD' string. This one is load-bearing: coupons.js compares
--                         expiry_date directly against a 'YYYY-MM-DD' string in three places, and a
--                         JS Date there would compare as "Mon Aug 11 2026..." and silently expire
--                         coupons a day early.


ALTER TABLE cart ALTER COLUMN created_at TYPE TIMESTAMPTZ USING nullif(created_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE cart ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE contact_messages ALTER COLUMN created_at TYPE TIMESTAMPTZ USING nullif(created_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE coupon_usage ALTER COLUMN used_at TYPE TIMESTAMPTZ USING nullif(used_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE order_tracking ALTER COLUMN created_at TYPE TIMESTAMPTZ USING nullif(created_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE orders ALTER COLUMN created_at TYPE TIMESTAMPTZ USING nullif(created_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE orders ALTER COLUMN store_accepted_at TYPE TIMESTAMPTZ USING nullif(store_accepted_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE orders ALTER COLUMN store_ready_at TYPE TIMESTAMPTZ USING nullif(store_ready_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE orders ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE password_reset_otps ALTER COLUMN created_at TYPE TIMESTAMPTZ USING nullif(created_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE password_reset_otps ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING nullif(expires_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE payments ALTER COLUMN created_at TYPE TIMESTAMPTZ USING nullif(created_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE payments ALTER COLUMN paid_at TYPE TIMESTAMPTZ USING nullif(paid_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE petpooja_addons ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE petpooja_items ALTER COLUMN created_at TYPE TIMESTAMPTZ USING nullif(created_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE petpooja_items ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE petpooja_menu_snapshots ALTER COLUMN received_at TYPE TIMESTAMPTZ USING nullif(received_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE petpooja_orders ALTER COLUMN created_at TYPE TIMESTAMPTZ USING nullif(created_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE petpooja_orders ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE petpooja_stores ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE petpooja_taxes ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE products ALTER COLUMN created_at TYPE TIMESTAMPTZ USING nullif(created_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE products ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE spin_claims ALTER COLUMN claimed_at TYPE TIMESTAMPTZ USING nullif(claimed_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE spin_claims ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING nullif(expires_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE spin_draws ALTER COLUMN drawn_at TYPE TIMESTAMPTZ USING nullif(drawn_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE spin_draws ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING nullif(expires_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE spin_email_claims ALTER COLUMN claimed_at TYPE TIMESTAMPTZ USING nullif(claimed_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE spin_email_claims ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING nullif(expires_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE spin_ticket_pool ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE store_product_overrides ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE store_status ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE store_users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING nullif(created_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE store_users ALTER COLUMN last_login_at TYPE TIMESTAMPTZ USING nullif(last_login_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE store_users ALTER COLUMN password_set_at TYPE TIMESTAMPTZ USING nullif(password_set_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE store_users ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING nullif(created_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE users ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING nullif(updated_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE warehouses ALTER COLUMN created_at TYPE TIMESTAMPTZ USING nullif(created_at,'')::timestamptz;
--> statement-breakpoint
ALTER TABLE coupons ALTER COLUMN expiry_date TYPE DATE USING nullif(expiry_date,'')::date;
