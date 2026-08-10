import { relations } from "drizzle-orm/relations";
import { cart, cartItems, products, orders, orderTracking, petpoojaItems, payments, coupons, couponUsage, users, spinEmailClaims, spinDraws, addresses, spinClaims, petpoojaOrders, storeUsers, orderItems } from "./schema";

export const cartItemsRelations = relations(cartItems, ({one}) => ({
	cart: one(cart, {
		fields: [cartItems.cartId],
		references: [cart.id]
	}),
	product: one(products, {
		fields: [cartItems.productId],
		references: [products.id]
	}),
}));

export const cartRelations = relations(cart, ({one, many}) => ({
	cartItems: many(cartItems),
	user: one(users, {
		fields: [cart.userId],
		references: [users.id]
	}),
}));

export const productsRelations = relations(products, ({many}) => ({
	cartItems: many(cartItems),
	petpoojaItems: many(petpoojaItems),
	spinEmailClaims: many(spinEmailClaims),
	coupons: many(coupons),
	spinClaims: many(spinClaims),
	orderItems: many(orderItems),
}));

export const orderTrackingRelations = relations(orderTracking, ({one}) => ({
	order: one(orders, {
		fields: [orderTracking.orderId],
		references: [orders.id]
	}),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	orderTrackings: many(orderTracking),
	payments: many(payments),
	couponUsages: many(couponUsage),
	petpoojaOrders: many(petpoojaOrders),
	address: one(addresses, {
		fields: [orders.addressId],
		references: [addresses.id]
	}),
	storeUser: one(storeUsers, {
		fields: [orders.storeAcceptedBy],
		references: [storeUsers.id]
	}),
	user: one(users, {
		fields: [orders.userId],
		references: [users.id]
	}),
	orderItems: many(orderItems),
}));

export const petpoojaItemsRelations = relations(petpoojaItems, ({one}) => ({
	product: one(products, {
		fields: [petpoojaItems.productId],
		references: [products.id]
	}),
}));

export const paymentsRelations = relations(payments, ({one}) => ({
	order: one(orders, {
		fields: [payments.orderId],
		references: [orders.id]
	}),
}));

export const couponUsageRelations = relations(couponUsage, ({one}) => ({
	coupon: one(coupons, {
		fields: [couponUsage.couponId],
		references: [coupons.id]
	}),
	order: one(orders, {
		fields: [couponUsage.orderId],
		references: [orders.id]
	}),
	user: one(users, {
		fields: [couponUsage.userId],
		references: [users.id]
	}),
}));

export const couponsRelations = relations(coupons, ({one, many}) => ({
	couponUsages: many(couponUsage),
	spinEmailClaims: many(spinEmailClaims),
	product: one(products, {
		fields: [coupons.giftProductId],
		references: [products.id]
	}),
	spinClaims: many(spinClaims),
}));

export const usersRelations = relations(users, ({many}) => ({
	couponUsages: many(couponUsage),
	spinEmailClaims: many(spinEmailClaims),
	carts: many(cart),
	spinDraws: many(spinDraws),
	addresses: many(addresses),
	spinClaims: many(spinClaims),
	orders: many(orders),
}));

export const spinEmailClaimsRelations = relations(spinEmailClaims, ({one}) => ({
	coupon: one(coupons, {
		fields: [spinEmailClaims.couponId],
		references: [coupons.id]
	}),
	product: one(products, {
		fields: [spinEmailClaims.giftProductId],
		references: [products.id]
	}),
	user: one(users, {
		fields: [spinEmailClaims.linkedUserId],
		references: [users.id]
	}),
}));

export const spinDrawsRelations = relations(spinDraws, ({one}) => ({
	user: one(users, {
		fields: [spinDraws.userId],
		references: [users.id]
	}),
}));

export const addressesRelations = relations(addresses, ({one, many}) => ({
	user: one(users, {
		fields: [addresses.userId],
		references: [users.id]
	}),
	orders: many(orders),
}));

export const spinClaimsRelations = relations(spinClaims, ({one}) => ({
	coupon: one(coupons, {
		fields: [spinClaims.couponId],
		references: [coupons.id]
	}),
	product: one(products, {
		fields: [spinClaims.giftProductId],
		references: [products.id]
	}),
	user: one(users, {
		fields: [spinClaims.userId],
		references: [users.id]
	}),
}));

export const petpoojaOrdersRelations = relations(petpoojaOrders, ({one}) => ({
	order: one(orders, {
		fields: [petpoojaOrders.orderId],
		references: [orders.id]
	}),
}));

export const storeUsersRelations = relations(storeUsers, ({many}) => ({
	orders: many(orders),
}));

export const orderItemsRelations = relations(orderItems, ({one}) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	product: one(products, {
		fields: [orderItems.productId],
		references: [products.id]
	}),
}));