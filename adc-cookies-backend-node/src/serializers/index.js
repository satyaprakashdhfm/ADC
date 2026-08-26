import { storeByCode } from '../services/store.service.js';
import { parseMediaList, signMediaRefs, isMediaRef } from '../services/storage.client.js';

export function serializeUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
           lastLoginLocation: u.last_login_location ?? null,
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

/*
 * A product for the wire.
 *
 * Two image fields, and the difference matters:
 *
 *   imageRefs — what is actually stored ('supabase://products/…' or a legacy '/assets/…' path).
 *               This is what the admin editor round-trips on save.
 *   images    — the same list resolved to URLs a browser can load, which for a bucket object is a
 *               signed URL that expires. NEVER write this back to the database.
 *
 * The signing is asynchronous and this function is not, so `images` starts out holding the raw refs
 * and withImageUrls() (below) fills it in before the response goes out. Every route that returns a
 * product must await it; a route that forgets will serve 'supabase://…' to an <img> tag, which fails
 * visibly rather than silently.
 */
export function serializeProduct(p) {
  if (!p) return null;
  const refs = parseMediaList(p.images);
  return {
    id: p.id, name: p.name, category: p.category, description: p.description,
    price: p.price,
    imageRefs: refs, images: p.images, options: p.options,
    isAvailable: !!p.is_available, menuGroup: p.menu_group, tag: p.tag, featured: !!p.featured,
    // Per-delivery-mode availability, each with the reason to show the customer when off. See
    // deliveryEligible() / intracityEligible() / intercityEligible() in stores.js for enforcement —
    // this is data only, never re-derive the rule here.
    intracityAvailable: !!p.intracity_available, intracityUnavailableReason: p.intracity_unavailable_reason || null,
    intercityAvailable: !!p.intercity_available, intercityUnavailableReason: p.intercity_unavailable_reason || null,
    restrictCities: p.restrict_cities || null,
    createdAt: p.created_at, updatedAt: p.updated_at,
  };
}

/**
 * Replace every serialized product's `images` with URLs a browser can load.
 *
 * Takes one product, an array, or anything with a `.product` (a cart item) — the shapes the callers
 * actually have — and signs all of their references in ONE round trip rather than one per photo.
 * Returns its argument so it reads as `res.json(await withImageUrls(rows.map(serializeProduct)))`.
 */
export async function withImageUrls(input) {
  const list = (Array.isArray(input) ? input : [input]).filter(Boolean);
  const products = list.map((x) => (x && x.product !== undefined ? x.product : x)).filter(Boolean);
  if (!products.length) return input;

  const signed = await signMediaRefs(products.flatMap((pr) => pr.imageRefs || []));
  for (const pr of products) {
    pr.images = displayable((pr.imageRefs || []), signed);
  }
  return input;
}

/*
 * Refs to a JSON array of loadable URLs, dropping any that could not be signed.
 *
 * signMediaRefs returns the reference unchanged when signing failed, and putting 'supabase://…' in
 * an <img src> is a visibly broken image. Dropping it instead lets the caller's own fallback take
 * over — firstImage() on the frontend already has one.
 */
function displayable(refs, signed) {
  const urls = refs.map((r) => signed.get(r) || r).filter((u) => u && !isMediaRef(u));
  return urls.length ? JSON.stringify(urls) : null;
}

/**
 * One stored `images` column resolved to the same JSON-array-of-URLs shape a product carries.
 *
 * For the places that hand out an image without a whole product — the spin wheel's gift item, the
 * hero banner — so they go through exactly the same signing path rather than a second one that
 * could disagree with it.
 */
export async function resolveImagesValue(stored) {
  const refs = parseMediaList(stored);
  if (!refs.length) return null;
  return displayable(refs, await signMediaRefs(refs));
}

export function serializeCoupon(c) {
  if (!c) return null;
  return {
    id: c.id, code: c.code, discountType: c.discount_type, discountValue: c.discount_value,
    minimumOrderAmount: c.minimum_order_amount, maximumDiscount: c.maximum_discount,
    expiryDate: c.expiry_date, usageLimit: c.usage_limit, isActive: !!c.is_active,
    spinWeight: c.spin_weight, spinLabel: c.spin_label, terms: c.terms,
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

// items, address and payment are pre-loaded by the caller. `warningFlags` is an optional array
// of short codes (e.g. 'DUPLICATE_CHARGE') the caller pre-computed from order_tracking rows —
// admin-facing alerts that don't affect order/payment status itself. `pos` is the petpooja_orders
// row for this order (admin views only) — whether the kitchen actually received the ticket.
export function serializeOrder(order, items = [], address = null, payment = null, warningFlags = [], pos = null) {
  if (!order) return null;
  return {
    pos: pos ? { relayed: !!pos.relay_ok, petpoojaOrderId: pos.petpooja_order_id ?? null, attempts: pos.attempts, lastError: pos.last_error ?? null } : null,
    id: order.id, orderNumber: order.order_number,
    subtotal: order.subtotal, discountAmount: order.discount_amount,
    deliveryFee: order.delivery_fee, taxAmount: order.tax_amount, totalAmount: order.total_amount,
    couponCode: order.coupon_code, paymentStatus: order.payment_status, orderStatus: order.order_status,
    delhiveryWaybill: order.delhivery_waybill, delhiveryShipmentId: order.delhivery_shipment_id,
    carrierOrderId: order.carrier_order_id ?? null,
    trackingUrl: order.tracking_url, shipmentStatus: order.shipment_status,
    // Why the automatic courier booking failed, if it did — a paid order with no shipment is money
    // taken for something nobody is delivering, so the reason belongs on the order, not in a log.
    shipmentError: order.shipment_error ?? null,
    // How many automatic "Ship Now" retries this intracity booking has used. The Delivery tab
    // shows it so a rider search that is quietly going nowhere reads as such, rather than as an
    // order that has simply not moved yet.
    riderRetryCount: order.rider_retry_count ?? 0,
    riderRetryAt: order.rider_retry_at ?? null,
    carrier: order.carrier ?? null,
    estimatedDelivery: order.estimated_delivery ?? null,
    // Which kitchen owns this order, and how far it has got with it. Everywhere except Begur the
    // store bills on its own Petpooja terminal, so posBillNo is the only link between this order
    // and its POS bill — its absence is a reconciliation gap, not a cosmetic one.
    store: order.store_code
      ? {
          code: order.store_code,
          acceptedAt: order.store_accepted_at ?? null,
          readyAt: order.store_ready_at ?? null,
          posBillNo: order.store_pos_bill_no ?? null,
          /* Whether this store bills by hand. Without it every screen has to know that Begur is the
             only AUTO outlet, and admin was reading "no Petpooja ticket" as a failure on the four
             stores that are never meant to have one. */
          posManual: (storeByCode(order.store_code)?.posMode ?? 'MANUAL') !== 'AUTO',
        }
      : null,
    labelGenerated: !!order.label_generated,
    payment: payment
      ? { provider: payment.provider, transactionId: payment.transaction_id, status: payment.status, paidAt: payment.paid_at }
      : null,
    address: serializeAddress(address), items: items.map(serializeOrderItem),
    warningFlags,
    createdAt: order.created_at, updatedAt: order.updated_at,
  };
}

// Latest payment row for an order (most recent first). Returns null if none.
export const PAYMENT_SELECT = 'SELECT provider, transaction_id, status, paid_at FROM payments WHERE order_id = $1 ORDER BY id DESC LIMIT 1';

export function serializeTracking(t) {
  if (!t) return null;
  return { id: t.id, status: t.status, remarks: t.remarks, createdAt: t.created_at };
}
