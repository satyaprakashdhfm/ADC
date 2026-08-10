-- Money: FLOAT8 -> NUMERIC. Binary floats cannot represent decimal money exactly; NUMERIC can.
--
-- Charging was never wrong: orders.js rounds to integer paise at the Razorpay boundary
-- (Math.round(Number(total_amount) * 100)), so float dust never reached a customer. What this fixes
-- is stored values and SQL-side SUM() in reporting, which had no such rounding.
--
-- round(x::numeric, 2) snaps any existing float dust to exact paise as it converts.
--
-- Deliberately NOT converted:
--   addresses.latitude / longitude  — coordinates are measurements, not currency; FLOAT8 is right.
--   petpooja_taxes.percentage, coupons.spin_weight — ratios, given 3 decimals rather than 2.
--
-- NOTE: node-postgres returns NUMERIC as a STRING by default, which would turn `a + b` into string
-- concatenation. db.js registers a type parser (OID 1700 -> parseFloat) so JS keeps seeing numbers.
-- That parser ships WITH this migration and is not optional.
--
-- ALTER TYPE rewrites the table and takes ACCESS EXCLUSIVE. Done now because production has 0
-- orders; it only gets more expensive as real orders accumulate.


ALTER TABLE cart_items ALTER COLUMN unit_price TYPE NUMERIC(12,2) USING round(unit_price::numeric, 2);
--> statement-breakpoint
ALTER TABLE coupons ALTER COLUMN discount_value TYPE NUMERIC(12,2) USING round(discount_value::numeric, 2);
--> statement-breakpoint
ALTER TABLE coupons ALTER COLUMN maximum_discount TYPE NUMERIC(12,2) USING round(maximum_discount::numeric, 2);
--> statement-breakpoint
ALTER TABLE coupons ALTER COLUMN minimum_order_amount TYPE NUMERIC(12,2) USING round(minimum_order_amount::numeric, 2);
--> statement-breakpoint
ALTER TABLE order_items ALTER COLUMN total_price TYPE NUMERIC(12,2) USING round(total_price::numeric, 2);
--> statement-breakpoint
ALTER TABLE order_items ALTER COLUMN unit_price TYPE NUMERIC(12,2) USING round(unit_price::numeric, 2);
--> statement-breakpoint
ALTER TABLE orders ALTER COLUMN delivery_fee TYPE NUMERIC(12,2) USING round(delivery_fee::numeric, 2);
--> statement-breakpoint
ALTER TABLE orders ALTER COLUMN discount_amount TYPE NUMERIC(12,2) USING round(discount_amount::numeric, 2);
--> statement-breakpoint
ALTER TABLE orders ALTER COLUMN subtotal TYPE NUMERIC(12,2) USING round(subtotal::numeric, 2);
--> statement-breakpoint
ALTER TABLE orders ALTER COLUMN tax_amount TYPE NUMERIC(12,2) USING round(tax_amount::numeric, 2);
--> statement-breakpoint
ALTER TABLE orders ALTER COLUMN total_amount TYPE NUMERIC(12,2) USING round(total_amount::numeric, 2);
--> statement-breakpoint
ALTER TABLE payments ALTER COLUMN amount TYPE NUMERIC(12,2) USING round(amount::numeric, 2);
--> statement-breakpoint
ALTER TABLE payments ALTER COLUMN amount_refunded TYPE NUMERIC(12,2) USING round(amount_refunded::numeric, 2);
--> statement-breakpoint
ALTER TABLE payments ALTER COLUMN razorpay_fee TYPE NUMERIC(12,2) USING round(razorpay_fee::numeric, 2);
--> statement-breakpoint
ALTER TABLE payments ALTER COLUMN razorpay_tax TYPE NUMERIC(12,2) USING round(razorpay_tax::numeric, 2);
--> statement-breakpoint
ALTER TABLE petpooja_addons ALTER COLUMN price TYPE NUMERIC(12,2) USING round(price::numeric, 2);
--> statement-breakpoint
ALTER TABLE petpooja_items ALTER COLUMN price TYPE NUMERIC(12,2) USING round(price::numeric, 2);
--> statement-breakpoint
ALTER TABLE products ALTER COLUMN price TYPE NUMERIC(12,2) USING round(price::numeric, 2);
--> statement-breakpoint
ALTER TABLE coupons ALTER COLUMN spin_weight TYPE NUMERIC(6,3) USING round(spin_weight::numeric, 3);
--> statement-breakpoint
ALTER TABLE petpooja_taxes ALTER COLUMN percentage TYPE NUMERIC(6,3) USING round(percentage::numeric, 3);
