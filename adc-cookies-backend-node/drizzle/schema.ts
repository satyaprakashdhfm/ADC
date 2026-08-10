import { pgTable, foreignKey, serial, integer, text, doublePrecision, unique, boolean, jsonb, check, uniqueIndex, varchar, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const cartItems = pgTable("cart_items", {
	id: serial().primaryKey().notNull(),
	cartId: integer("cart_id").notNull(),
	productId: integer("product_id").notNull(),
	quantity: integer().notNull(),
	selectedOptions: text("selected_options"),
	unitPrice: doublePrecision("unit_price").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.cartId],
			foreignColumns: [cart.id],
			name: "cart_items_cart_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "cart_items_product_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const orderTracking = pgTable("order_tracking", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id").notNull(),
	status: text().notNull(),
	remarks: text(),
	createdAt: text("created_at").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_tracking_order_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const petpoojaItems = pgTable("petpooja_items", {
	id: serial().primaryKey().notNull(),
	restId: text("rest_id").notNull(),
	itemId: text("item_id").notNull(),
	variationId: text("variation_id").default(').notNull(),
	name: text().notNull(),
	variationName: text("variation_name"),
	price: doublePrecision(),
	categoryId: text("category_id"),
	taxIds: text("tax_ids"),
	inStock: boolean("in_stock").default(true).notNull(),
	productId: integer("product_id"),
	raw: jsonb(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "petpooja_items_product_id_fkey"
		}).onDelete("set null"),
	unique("petpooja_items_rest_id_item_id_variation_id_key").on(table.restId, table.itemId, table.variationId),
]);

export const payments = pgTable("payments", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id").notNull(),
	provider: text().notNull(),
	transactionId: text("transaction_id"),
	amount: doublePrecision().notNull(),
	status: text().notNull(),
	paidAt: text("paid_at"),
	createdAt: text("created_at").notNull(),
	razorpayFee: doublePrecision("razorpay_fee"),
	razorpayTax: doublePrecision("razorpay_tax"),
	method: text(),
	cardNetwork: text("card_network"),
	cardLast4: text("card_last4"),
	vpa: text(),
	bank: text(),
	amountRefunded: doublePrecision("amount_refunded").default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "payments_order_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const couponUsage = pgTable("coupon_usage", {
	id: serial().primaryKey().notNull(),
	couponId: integer("coupon_id").notNull(),
	userId: integer("user_id").notNull(),
	orderId: integer("order_id").notNull(),
	usedAt: text("used_at").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.couponId],
			foreignColumns: [coupons.id],
			name: "coupon_usage_coupon_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "coupon_usage_order_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "coupon_usage_user_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const spinTicketPool = pgTable("spin_ticket_pool", {
	id: integer().default(1).primaryKey().notNull(),
	signature: text().notNull(),
	tickets: text().notNull(),
	position: integer().default(0).notNull(),
	updatedAt: text("updated_at").notNull(),
}, (table) => [
	check("spin_ticket_pool_id_check", sql`id = 1`),
]);

export const spinEmailClaims = pgTable("spin_email_claims", {
	id: serial().primaryKey().notNull(),
	email: text().notNull(),
	name: text(),
	couponId: integer("coupon_id").notNull(),
	code: text().notNull(),
	label: text().notNull(),
	claimedAt: text("claimed_at").notNull(),
	expiresAt: text("expires_at").notNull(),
	linkedUserId: integer("linked_user_id"),
	giftProductId: integer("gift_product_id"),
}, (table) => [
	uniqueIndex("idx_spin_email_claims_email").using("btree", sql`lower(email)`),
	foreignKey({
			columns: [table.couponId],
			foreignColumns: [coupons.id],
			name: "spin_email_claims_coupon_id_fkey"
		}),
	foreignKey({
			columns: [table.giftProductId],
			foreignColumns: [products.id],
			name: "spin_email_claims_gift_product_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.linkedUserId],
			foreignColumns: [users.id],
			name: "spin_email_claims_linked_user_id_fkey"
		}).onDelete("set null"),
]);

export const cart = pgTable("cart", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "cart_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	unique("cart_user_id_key").on(table.userId),
]);

export const petpoojaStores = pgTable("petpooja_stores", {
	restId: text("rest_id").primaryKey().notNull(),
	storeStatus: boolean("store_status").default(true).notNull(),
	turnOnTime: text("turn_on_time"),
	reason: text(),
	updatedAt: text("updated_at").notNull(),
});

export const siteSettings = pgTable("site_settings", {
	key: text().primaryKey().notNull(),
	value: text(),
});

export const warehouses = pgTable("warehouses", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	registeredName: varchar("registered_name", { length: 255 }),
	pickupLocation: varchar("pickup_location", { length: 255 }).notNull(),
	addressLine1: text("address_line1"),
	addressLine2: text("address_line2"),
	city: varchar({ length: 100 }),
	state: varchar({ length: 100 }),
	pincode: varchar({ length: 10 }).notNull(),
	phone: varchar({ length: 20 }),
	email: varchar({ length: 255 }),
	returnPincode: varchar("return_pincode", { length: 10 }),
	isActive: boolean("is_active").default(true).notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	createdAt: text("created_at").notNull(),
});

export const petpoojaTaxes = pgTable("petpooja_taxes", {
	id: serial().primaryKey().notNull(),
	restId: text("rest_id").notNull(),
	taxId: text("tax_id").notNull(),
	name: text().notNull(),
	percentage: doublePrecision().default(0).notNull(),
	taxType: text("tax_type"),
	raw: jsonb(),
	updatedAt: text("updated_at").notNull(),
}, (table) => [
	unique("petpooja_taxes_rest_id_tax_id_key").on(table.restId, table.taxId),
]);

export const contactMessages = pgTable("contact_messages", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	phone: text(),
	message: text().notNull(),
	handled: boolean().default(false).notNull(),
	createdAt: text("created_at").notNull(),
});

export const spinDraws = pgTable("spin_draws", {
	id: serial().primaryKey().notNull(),
	deviceId: text("device_id").notNull(),
	userId: integer("user_id"),
	code: text(),
	drawnAt: text("drawn_at").notNull(),
	expiresAt: text("expires_at").notNull(),
	ip: text(),
}, (table) => [
	index("idx_spin_draws_device_id").using("btree", table.deviceId.asc().nullsLast().op("text_ops")),
	index("idx_spin_draws_ip").using("btree", table.ip.asc().nullsLast().op("text_ops")),
	index("idx_spin_draws_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "spin_draws_user_id_fkey"
		}).onDelete("set null"),
]);

export const petpoojaAddons = pgTable("petpooja_addons", {
	id: serial().primaryKey().notNull(),
	restId: text("rest_id").notNull(),
	addonId: text("addon_id").notNull(),
	groupId: text("group_id"),
	groupName: text("group_name"),
	name: text().notNull(),
	price: doublePrecision().default(0).notNull(),
	inStock: boolean("in_stock").default(true).notNull(),
	raw: jsonb(),
	updatedAt: text("updated_at").notNull(),
}, (table) => [
	unique("petpooja_addons_rest_id_addon_id_key").on(table.restId, table.addonId),
]);

export const coupons = pgTable("coupons", {
	id: serial().primaryKey().notNull(),
	code: text().notNull(),
	discountType: text("discount_type").notNull(),
	discountValue: doublePrecision("discount_value").notNull(),
	minimumOrderAmount: doublePrecision("minimum_order_amount"),
	maximumDiscount: doublePrecision("maximum_discount"),
	expiryDate: text("expiry_date"),
	usageLimit: integer("usage_limit"),
	isActive: boolean("is_active").default(true).notNull(),
	spinWeight: doublePrecision("spin_weight"),
	spinLabel: text("spin_label"),
	terms: text(),
	giftKind: text("gift_kind"),
	giftProductId: integer("gift_product_id"),
}, (table) => [
	foreignKey({
			columns: [table.giftProductId],
			foreignColumns: [products.id],
			name: "coupons_gift_product_id_fkey"
		}).onDelete("set null"),
	unique("coupons_code_key").on(table.code),
]);

export const passwordResetOtps = pgTable("password_reset_otps", {
	id: serial().primaryKey().notNull(),
	email: text().notNull(),
	otp: text().notNull(),
	expiresAt: text("expires_at").notNull(),
	used: boolean().default(false).notNull(),
	createdAt: text("created_at").notNull(),
});

export const petpoojaMenuSnapshots = pgTable("petpooja_menu_snapshots", {
	id: serial().primaryKey().notNull(),
	restId: text("rest_id").notNull(),
	source: text().notNull(),
	payload: jsonb().notNull(),
	itemCount: integer("item_count").default(0).notNull(),
	receivedAt: text("received_at").notNull(),
});

export const products = pgTable("products", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	category: text().notNull(),
	description: text(),
	price: doublePrecision().notNull(),
	stockQuantity: integer("stock_quantity").notNull(),
	images: text(),
	options: text(),
	isAvailable: boolean("is_available").default(true).notNull(),
	menuGroup: text("menu_group"),
	tag: text(),
	featured: boolean().default(false).notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
	sameDayOnly: boolean("same_day_only").default(false).notNull(),
	restrictCities: text("restrict_cities"),
});

export const addresses = pgTable("addresses", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	fullName: text("full_name").notNull(),
	phone: text().notNull(),
	addressLine1: text("address_line1").notNull(),
	addressLine2: text("address_line2"),
	city: text().notNull(),
	state: text().notNull(),
	pincode: text().notNull(),
	latitude: doublePrecision(),
	longitude: doublePrecision(),
	isDefault: boolean("is_default").default(false).notNull(),
	label: text().default('Home').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "addresses_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	email: text(),
	phone: text(),
	password: text().notNull(),
	role: text().default('CUSTOMER').notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
	lastLoginLocation: text("last_login_location"),
}, (table) => [
	unique("users_email_key").on(table.email),
	unique("users_phone_key").on(table.phone),
]);

export const storeUsers = pgTable("store_users", {
	id: serial().primaryKey().notNull(),
	storeCode: text("store_code").notNull(),
	username: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	name: text(),
	isActive: boolean("is_active").default(true).notNull(),
	lastLoginAt: text("last_login_at"),
	passwordSetAt: text("password_set_at"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
}, (table) => [
	index("idx_store_users_store_code").using("btree", table.storeCode.asc().nullsLast().op("text_ops")),
	unique("store_users_username_key").on(table.username),
]);

export const spinClaims = pgTable("spin_claims", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	couponId: integer("coupon_id").notNull(),
	code: text().notNull(),
	label: text().notNull(),
	claimedAt: text("claimed_at").notNull(),
	expiresAt: text("expires_at").notNull(),
	giftProductId: integer("gift_product_id"),
}, (table) => [
	foreignKey({
			columns: [table.couponId],
			foreignColumns: [coupons.id],
			name: "spin_claims_coupon_id_fkey"
		}),
	foreignKey({
			columns: [table.giftProductId],
			foreignColumns: [products.id],
			name: "spin_claims_gift_product_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "spin_claims_user_id_fkey"
		}).onDelete("cascade"),
]);

export const petpoojaOrders = pgTable("petpooja_orders", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id").notNull(),
	restId: text("rest_id").notNull(),
	relayOk: boolean("relay_ok").default(false).notNull(),
	petpoojaOrderId: text("petpooja_order_id"),
	petpoojaStatus: text("petpooja_status"),
	attempts: integer().default(0).notNull(),
	request: jsonb(),
	response: jsonb(),
	lastError: text("last_error"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "petpooja_orders_order_id_fkey"
		}).onDelete("cascade"),
	unique("petpooja_orders_order_id_key").on(table.orderId),
]);

export const orders = pgTable("orders", {
	id: serial().primaryKey().notNull(),
	orderNumber: text("order_number").notNull(),
	userId: integer("user_id").notNull(),
	addressId: integer("address_id"),
	subtotal: doublePrecision().notNull(),
	discountAmount: doublePrecision("discount_amount").default(0).notNull(),
	deliveryFee: doublePrecision("delivery_fee").default(0).notNull(),
	taxAmount: doublePrecision("tax_amount").default(0).notNull(),
	totalAmount: doublePrecision("total_amount").notNull(),
	couponCode: text("coupon_code"),
	paymentStatus: text("payment_status").default('PENDING').notNull(),
	orderStatus: text("order_status").default('PLACED').notNull(),
	delhiveryWaybill: text("delhivery_waybill"),
	delhiveryShipmentId: text("delhivery_shipment_id"),
	trackingUrl: text("tracking_url"),
	shipmentStatus: text("shipment_status").default('NOT_CREATED').notNull(),
	labelGenerated: boolean("label_generated").default(false).notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
	razorpayOrderId: text("razorpay_order_id"),
	carrier: text(),
	estimatedDelivery: text("estimated_delivery"),
	carrierOrderId: text("carrier_order_id"),
	shipmentError: text("shipment_error"),
	storeCode: text("store_code"),
	storeAcceptedAt: text("store_accepted_at"),
	storeAcceptedBy: integer("store_accepted_by"),
	storeReadyAt: text("store_ready_at"),
	storePosBillNo: text("store_pos_bill_no"),
}, (table) => [
	index("idx_orders_store_code").using("btree", table.storeCode.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.addressId],
			foreignColumns: [addresses.id],
			name: "orders_address_id_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.storeAcceptedBy],
			foreignColumns: [storeUsers.id],
			name: "orders_store_accepted_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "orders_user_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	unique("orders_order_number_key").on(table.orderNumber),
]);

export const orderItems = pgTable("order_items", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id").notNull(),
	productId: integer("product_id"),
	productName: text("product_name").notNull(),
	quantity: integer().notNull(),
	unitPrice: doublePrecision("unit_price").notNull(),
	totalPrice: doublePrecision("total_price").notNull(),
	selectedOptions: text("selected_options"),
	specialNotes: text("special_notes"),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "order_items_product_id_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);
