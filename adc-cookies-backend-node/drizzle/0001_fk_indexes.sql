-- Index the foreign keys that every customer-facing read goes through.
--
-- Postgres indexes primary keys and unique columns automatically. It does NOT index foreign keys.
-- The introspected baseline confirmed 24 foreign keys but only 6 indexes, and none of the six
-- covered these four — so each of these reads is a sequential scan of the whole table today:
--
--   orders.user_id        every "my orders" load on /account
--   order_items.order_id  every order detail, and every row of the admin order list
--   addresses.user_id     every checkout address load
--   payments.order_id     payment lookup and reconciliation
--
-- It is invisible at current volume and gets linearly worse: at 50k orders the same query reads
-- 50k rows, for every customer, on every page load. Supabase rates indexing FKs at 10-100x on
-- joins and cascades.
--
-- CONCURRENTLY builds without taking a write lock, so this is safe to run against live production
-- while orders are being placed. The trade-off is that it cannot run inside a transaction — see
-- the note in drizzle/README.md about applying this one with psql rather than a transactional
-- migration runner. IF NOT EXISTS keeps it re-runnable.

CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_user_id_idx ON orders (user_id);
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS addresses_user_id_idx ON addresses (user_id);
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS payments_order_id_idx ON payments (order_id);
