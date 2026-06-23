export function serializeUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
           createdAt: u.created_at, updatedAt: u.updated_at };
}

export function serializeAddress(a) {
  if (!a) return null;
  return {
    id: a.id, fullName: a.full_name, phone: a.phone,
    addressLine1: a.address_line1, addressLine2: a.address_line2,
    city: a.city, state: a.state, pincode: a.pincode,
    latitude: a.latitude, longitude: a.longitude, isDefault: !!a.is_default,
    label: a.label || 'Home',
  };
}

export function serializeWarehouse(w) {
  if (!w) return null;
  return {
    id: w.id, name: w.name, registeredName: w.registered_name,
    pickupLocation: w.pickup_location,
    addressLine1: w.address_line1, addressLine2: w.address_line2,
    city: w.city, state: w.state, pincode: w.pincode,
    returnPincode: w.return_pincode || w.pincode,
    phone: w.phone, email: w.email,
    isActive: !!w.is_active, isDefault: !!w.is_default,
    createdAt: w.created_at,
  };
}

export function serializeProduct(p) {
  if (!p) return null;
  return {
    id: p.id, name: p.name, category: p.category, description: p.description,
    price: p.price, stockQuantity: p.stock_quantity, images: p.images, options: p.options,
    isAvailable: !!p.is_available, menuGroup: p.menu_group, tag: p.tag, featured: !!p.featured,
    createdAt: p.created_at, updatedAt: p.updated_at,
  };
}

export function serializeCoupon(c) {
  if (!c) return null;
  return {
    id: c.id, code: c.code, discountType: c.discount_type, discountValue: c.discount_value,
    minimumOrderAmount: c.minimum_order_amount, maximumDiscount: c.maximum_discount,
    expiryDate: c.expiry_date, usageLimit: c.usage_limit, isActive: !!c.is_active,
  };
}

// product is pre-loaded by the caller
export function serializeCartItem(ci, product = null) {
  if (!ci) return null;
  return {
    id: ci.id, product: serializeProduct(product), productId: ci.product_id,
    productName: product ? product.name : null, quantity: ci.quantity,
    selectedOptions: ci.selected_options, unitPrice: ci.unit_price,
  };
}

// items are already serialized by the caller
export function serializeCart(cart, items = []) {
  if (!cart) return null;
  return { id: cart.id, items, createdAt: cart.created_at, updatedAt: cart.updated_at };
}

export function serializeOrderItem(oi) {
  if (!oi) return null;
  return {
    id: oi.id, productId: oi.product_id, productName: oi.product_name,
    quantity: oi.quantity, unitPrice: oi.unit_price, totalPrice: oi.total_price,
    selectedOptions: oi.selected_options, specialNotes: oi.special_notes,
  };
}

// items, address and payment are pre-loaded by the caller
export function serializeOrder(order, items = [], address = null, payment = null) {
  if (!order) return null;
  return {
    id: order.id, orderNumber: order.order_number,
    subtotal: order.subtotal, discountAmount: order.discount_amount,
    deliveryFee: order.delivery_fee, taxAmount: order.tax_amount, totalAmount: order.total_amount,
    couponCode: order.coupon_code, paymentStatus: order.payment_status, orderStatus: order.order_status,
    delhiveryWaybill: order.delhivery_waybill, delhiveryShipmentId: order.delhivery_shipment_id,
    trackingUrl: order.tracking_url, shipmentStatus: order.shipment_status,
    labelGenerated: !!order.label_generated,
    payment: payment
      ? { provider: payment.provider, transactionId: payment.transaction_id, status: payment.status, paidAt: payment.paid_at }
      : null,
    address: serializeAddress(address), items: items.map(serializeOrderItem),
    createdAt: order.created_at, updatedAt: order.updated_at,
  };
}

// Latest payment row for an order (most recent first). Returns null if none.
export const PAYMENT_SELECT = 'SELECT provider, transaction_id, status, paid_at FROM payments WHERE order_id = $1 ORDER BY id DESC LIMIT 1';

export function serializeTracking(t) {
  if (!t) return null;
  return { id: t.id, status: t.status, remarks: t.remarks, createdAt: t.created_at };
}
