-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"selected_options" text,
	"unit_price" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status" text NOT NULL,
	"remarks" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_tracking" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "petpooja_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"rest_id" text NOT NULL,
	"item_id" text NOT NULL,
	"variation_id" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"variation_name" text,
	"price" double precision,
	"category_id" text,
	"tax_ids" text,
	"in_stock" boolean DEFAULT true NOT NULL,
	"product_id" integer,
	"raw" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "petpooja_items_rest_id_item_id_variation_id_key" UNIQUE("rest_id","item_id","variation_id")
);
--> statement-breakpoint
ALTER TABLE "petpooja_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"provider" text NOT NULL,
	"transaction_id" text,
	"amount" double precision NOT NULL,
	"status" text NOT NULL,
	"paid_at" text,
	"created_at" text NOT NULL,
	"razorpay_fee" double precision,
	"razorpay_tax" double precision,
	"method" text,
	"card_network" text,
	"card_last4" text,
	"vpa" text,
	"bank" text,
	"amount_refunded" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "coupon_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"coupon_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"used_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coupon_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "spin_ticket_pool" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"signature" text NOT NULL,
	"tickets" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "spin_ticket_pool_id_check" CHECK (id = 1)
);
--> statement-breakpoint
ALTER TABLE "spin_ticket_pool" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "spin_email_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"coupon_id" integer NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"claimed_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"linked_user_id" integer,
	"gift_product_id" integer
);
--> statement-breakpoint
ALTER TABLE "spin_email_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cart" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "cart_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "cart" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "petpooja_stores" (
	"rest_id" text PRIMARY KEY NOT NULL,
	"store_status" boolean DEFAULT true NOT NULL,
	"turn_on_time" text,
	"reason" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petpooja_stores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text
);
--> statement-breakpoint
ALTER TABLE "site_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"registered_name" varchar(255),
	"pickup_location" varchar(255) NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"return_pincode" varchar(10),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "petpooja_taxes" (
	"id" serial PRIMARY KEY NOT NULL,
	"rest_id" text NOT NULL,
	"tax_id" text NOT NULL,
	"name" text NOT NULL,
	"percentage" double precision DEFAULT 0 NOT NULL,
	"tax_type" text,
	"raw" jsonb,
	"updated_at" text NOT NULL,
	CONSTRAINT "petpooja_taxes_rest_id_tax_id_key" UNIQUE("rest_id","tax_id")
);
--> statement-breakpoint
ALTER TABLE "petpooja_taxes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text NOT NULL,
	"handled" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "spin_draws" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"user_id" integer,
	"code" text,
	"drawn_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"ip" text
);
--> statement-breakpoint
ALTER TABLE "spin_draws" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "petpooja_addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"rest_id" text NOT NULL,
	"addon_id" text NOT NULL,
	"group_id" text,
	"group_name" text,
	"name" text NOT NULL,
	"price" double precision DEFAULT 0 NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"raw" jsonb,
	"updated_at" text NOT NULL,
	CONSTRAINT "petpooja_addons_rest_id_addon_id_key" UNIQUE("rest_id","addon_id")
);
--> statement-breakpoint
ALTER TABLE "petpooja_addons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" double precision NOT NULL,
	"minimum_order_amount" double precision,
	"maximum_discount" double precision,
	"expiry_date" text,
	"usage_limit" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"spin_weight" double precision,
	"spin_label" text,
	"terms" text,
	"gift_kind" text,
	"gift_product_id" integer,
	CONSTRAINT "coupons_code_key" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "password_reset_otps" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"otp" text NOT NULL,
	"expires_at" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_otps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "petpooja_menu_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"rest_id" text NOT NULL,
	"source" text NOT NULL,
	"payload" jsonb NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"received_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petpooja_menu_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"price" double precision NOT NULL,
	"stock_quantity" integer NOT NULL,
	"images" text,
	"options" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"menu_group" text,
	"tag" text,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"same_day_only" boolean DEFAULT false NOT NULL,
	"restrict_cities" text
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"is_default" boolean DEFAULT false NOT NULL,
	"label" text DEFAULT 'Home' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"password" text NOT NULL,
	"role" text DEFAULT 'CUSTOMER' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"last_login_location" text,
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_phone_key" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "store_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_code" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" text,
	"password_set_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "store_users_username_key" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "store_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "spin_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"coupon_id" integer NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"claimed_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"gift_product_id" integer
);
--> statement-breakpoint
ALTER TABLE "spin_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "petpooja_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"rest_id" text NOT NULL,
	"relay_ok" boolean DEFAULT false NOT NULL,
	"petpooja_order_id" text,
	"petpooja_status" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"request" jsonb,
	"response" jsonb,
	"last_error" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "petpooja_orders_order_id_key" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "petpooja_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"user_id" integer NOT NULL,
	"address_id" integer,
	"subtotal" double precision NOT NULL,
	"discount_amount" double precision DEFAULT 0 NOT NULL,
	"delivery_fee" double precision DEFAULT 0 NOT NULL,
	"tax_amount" double precision DEFAULT 0 NOT NULL,
	"total_amount" double precision NOT NULL,
	"coupon_code" text,
	"payment_status" text DEFAULT 'PENDING' NOT NULL,
	"order_status" text DEFAULT 'PLACED' NOT NULL,
	"delhivery_waybill" text,
	"delhivery_shipment_id" text,
	"tracking_url" text,
	"shipment_status" text DEFAULT 'NOT_CREATED' NOT NULL,
	"label_generated" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"razorpay_order_id" text,
	"carrier" text,
	"estimated_delivery" text,
	"carrier_order_id" text,
	"shipment_error" text,
	"store_code" text,
	"store_accepted_at" text,
	"store_accepted_by" integer,
	"store_ready_at" text,
	"store_pos_bill_no" text,
	CONSTRAINT "orders_order_number_key" UNIQUE("order_number")
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" double precision NOT NULL,
	"total_price" double precision NOT NULL,
	"selected_options" text,
	"special_notes" text
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_tracking" ADD CONSTRAINT "order_tracking_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "petpooja_items" ADD CONSTRAINT "petpooja_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "spin_email_claims" ADD CONSTRAINT "spin_email_claims_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_email_claims" ADD CONSTRAINT "spin_email_claims_gift_product_id_fkey" FOREIGN KEY ("gift_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_email_claims" ADD CONSTRAINT "spin_email_claims_linked_user_id_fkey" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "spin_draws" ADD CONSTRAINT "spin_draws_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_gift_product_id_fkey" FOREIGN KEY ("gift_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "spin_claims" ADD CONSTRAINT "spin_claims_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_claims" ADD CONSTRAINT "spin_claims_gift_product_id_fkey" FOREIGN KEY ("gift_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_claims" ADD CONSTRAINT "spin_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petpooja_orders" ADD CONSTRAINT "petpooja_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_accepted_by_fkey" FOREIGN KEY ("store_accepted_by") REFERENCES "public"."store_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_spin_email_claims_email" ON "spin_email_claims" USING btree (lower(email) text_ops);--> statement-breakpoint
CREATE INDEX "idx_spin_draws_device_id" ON "spin_draws" USING btree ("device_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_spin_draws_ip" ON "spin_draws" USING btree ("ip" text_ops);--> statement-breakpoint
CREATE INDEX "idx_spin_draws_user_id" ON "spin_draws" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_store_users_store_code" ON "store_users" USING btree ("store_code" text_ops);--> statement-breakpoint
CREATE INDEX "idx_orders_store_code" ON "orders" USING btree ("store_code" text_ops);
*/