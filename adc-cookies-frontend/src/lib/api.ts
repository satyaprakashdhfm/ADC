// Same-origin by default: the browser calls /api/... on whatever host served the page
// (localhost or your LAN IP on a phone), and Next.js rewrites it to the backend server-side.
import { supabase } from './supabase';
import type { ProductCategory } from './categories';

// Where the browser sends API calls. In the browser we ALWAYS use the same-origin `/api` path so
// Next.js rewrites it to the backend (see next.config.ts). This keeps `next dev` hitting your LOCAL
// backend (and works for phones on the LAN) and avoids CORS — regardless of NEXT_PUBLIC_API_URL.
// Server-side rendering has no origin, so it needs an absolute URL (local in dev, configured in prod).
const API_BASE =
  typeof window !== 'undefined'
    ? '/api'
    : process.env.NODE_ENV === 'production'
      ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api')
      : 'http://localhost:8080/api';

// The bearer token is the current Supabase session access token (auto-refreshed by the client).
async function getToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    // Surface the real backend reason. Delhivery failures put the human-readable cause in
    // `error` (e.g. shipment_rejected) and the carrier's own message in `detail.rmk`.
    const detailRmk = err?.detail?.rmk || err?.detail?.remarks;
    const base = err.message || err.error || `HTTP ${res.status}`;
    throw new Error(detailRmk && detailRmk !== base ? `${base}: ${detailRmk}` : base);
  }
  return res.json();
}

/* ---- Auth ---- */
// Google + email/password run through Supabase directly (see AuthContext). Phone OTP is
// driven by our backend (Message Central), which returns a real Supabase session on success.

/** Start phone verification — texts an OTP and returns a verificationId to confirm it. */
export async function sendOtp(phone: string): Promise<{ verificationId: string; timeout: number }> {
  return request('/auth/otp/send', { method: 'POST', body: JSON.stringify({ phone }) });
}

/** Confirm the OTP. Returns Supabase session tokens plus whether we still need the user's name
 *  (true for a brand-new number or an account that never set one). */
export async function verifyOtp(phone: string, verificationId: string, code: string): Promise<{ accessToken: string; refreshToken: string; needsName: boolean }> {
  return request('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, verificationId, code }) });
}

/** The signed-in user as our backend sees them (synced from the Supabase session). */
export interface MeResponse { email: string | null; name: string; role: string; phone: string | null; }
export async function getMe(): Promise<MeResponse> {
  return request('/auth/me');
}

/** Update the signed-in user's profile (name and/or phone). Persists to the DB. */
export async function updateMe(patch: { name?: string; phone?: string; email?: string }): Promise<MeResponse> {
  return request('/auth/me', { method: 'PATCH', body: JSON.stringify(patch) });
}

/** Best-effort: records the city/region this login is coming from (IP-based, no permission prompt). */
export async function logLoginLocation(): Promise<{ ok: boolean }> {
  return request('/auth/log-location', { method: 'POST' });
}

/* ---- Products ---- */
export interface Product {
  id: number; name: string; category: ProductCategory;
  description: string; price: number; stockQuantity: number;
  images: string; options: string; isAvailable: boolean;
  menuGroup: string; tag: string; featured: boolean;
  /** Per-delivery-mode availability, each with the reason to show the customer when off (e.g. Red
   *  Velvet: intercityAvailable=false, "must be enjoyed within 24 hours"). restrictCities narrows
   *  WHICH intracity cities count when intracity IS available ('Bengaluru') since a store's
   *  same-day reach isn't the same as "this item is made there"; null/empty means any intracity
   *  city is fine. */
  intracityAvailable: boolean; intracityUnavailableReason: string | null;
  intercityAvailable: boolean; intercityUnavailableReason: string | null;
  restrictCities: string | null;
}

/** Parse the JSON `images` column and return the first url, or a fallback. */
export function firstImage(images: string | null | undefined, fallback = '/assets/products/adc-special.jpg'): string {
  if (!images) return fallback;
  try {
    const arr = JSON.parse(images);
    return Array.isArray(arr) && arr.length ? arr[0] : fallback;
  } catch {
    return images || fallback;
  }
}

export async function getProducts(params?: { category?: string; search?: string }): Promise<Product[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.search) qs.set('search', params.search);
  const q = qs.toString();
  return request(`/products${q ? '?' + q : ''}`);
}

/** The product the admin chose for the homepage promo popup (or null if none set). */
export async function getPromoProduct(): Promise<Product | null> { return request('/products/promo'); }

/* ---- Cart ---- */
export interface CartItem {
  id: number; productId: number; productName: string;
  quantity: number; unitPrice: number; selectedOptions: string;
}
export interface Cart { id: number; items: CartItem[]; }

export async function getCart(): Promise<Cart> { return request('/cart'); }

export async function addToCart(productId: number, quantity: number, selectedOptions?: string): Promise<Cart> {
  return request('/cart/items', { method: 'POST', body: JSON.stringify({ productId, quantity, selectedOptions }) });
}

export async function updateCartItem(itemId: number, quantity: number): Promise<Cart> {
  return request(`/cart/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) });
}

export async function removeCartItem(itemId: number): Promise<void> {
  return request(`/cart/items/${itemId}`, { method: 'DELETE' });
}

export async function clearCart(): Promise<void> { return request('/cart', { method: 'DELETE' }); }

/* ---- Addresses ---- */
export interface Address {
  id: number; fullName: string; phone: string;
  addressLine1: string; addressLine2?: string;
  city: string; state: string; pincode: string; isDefault: boolean;
  label?: string; // Home / Office / Other
  // Captured from the browser when the shopper uses "detect my location". REQUIRED for same-day
  // intracity delivery — Shiprocket Hyperlocal returns no couriers for a pincode without
  // coordinates, so an address lacking them silently falls back to multi-day courier.
  latitude?: number | null; longitude?: number | null;
}

export async function getAddresses(): Promise<Address[]> { return request('/addresses'); }

export async function addAddress(data: Omit<Address, 'id'>): Promise<Address> {
  return request('/addresses', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAddress(id: number, data: Omit<Address, 'id'>): Promise<Address> {
  return request(`/addresses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

/* ---- Contact ---- */
export interface ContactInput { name: string; email: string; phone?: string; message: string; company?: string; }

export async function submitContact(data: ContactInput): Promise<{ ok: boolean; id: number }> {
  return request('/contact', { method: 'POST', body: JSON.stringify(data) });
}

/* ---- Coupons ---- */
export interface CouponResult {
  valid: boolean; discountType: string; discountValue: number;
  maximumDiscount?: number; message?: string;
  // Set for "free item" rewards (free tin / free cookie) — the named product should be added to
  // the cart, free (capped at maximumDiscount), rather than treating this as a flat money-off.
  giftProduct?: { id: number; name: string; price: number; images?: string } | null;
}

export async function validateCoupon(code: string, orderAmount: number): Promise<CouponResult> {
  return request(`/coupons/validate?code=${encodeURIComponent(code)}&orderAmount=${orderAmount}`);
}

// Active, currently-usable SPIN WHEEL rewards (admin-controlled) — the wheel only ever hands
// out real codes that work at checkout. Empty array = no active offers right now. Public
// (no auth) so guests can spin before logging in.
export interface ActiveCoupon {
  code: string; discountType: string; discountValue: number;
  minimumOrderAmount?: number | null; maximumDiscount?: number | null;
  weight: number; label: string; terms: string;
  isGift?: boolean; // a real product is added to the cart, not a generic amount off
}
export async function getActiveCoupons(): Promise<ActiveCoupon[]> {
  return request('/coupons/active');
}

// General, anyone-can-use coupons (admin-created, not a personal spin-wheel win) — shown at
// checkout as a Zomato/Swiggy-style tappable offers list. Public (no auth) so it can render
// before login; actually applying one still goes through validateCoupon as normal.
export interface AvailableCoupon {
  code: string; discountType: string; discountValue: number;
  minimumOrderAmount?: number | null; maximumDiscount?: number | null;
  label: string; terms: string; isGift?: boolean;
}
export async function getAvailableCoupons(): Promise<AvailableCoupon[]> {
  return request('/coupons/available');
}
// A random id generated once per browser and reused forever — lets the backend recognize repeat
// spin attempts from the same device (see spinDraw) without requiring an account. Not a security
// boundary (clearing storage resets it), just enough to stop casual "reload and try again" abuse.
function getDeviceId(): string {
  const KEY = 'adc_device_id';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}
// Server-authoritative draw from the shuffled ticket pool — guarantees exact odds across every
// batch of spins. Returns the winning coupon code (or null for "no reward"), and when this draw
// expires — a repeat call before then just replays the SAME result, it doesn't draw again.
// One spin per device/account, period: once that draw's own window has passed too, `completed`
// comes back true for good — there is no `nextSpinAt` to wait out. The only reset is an admin
// wiping every spin at once (see adminResetAllSpins).
export interface SpinDrawResult {
  code: string | null; expiresAt?: string; completed?: boolean;
}
export async function spinDraw(): Promise<SpinDrawResult> {
  return request('/coupons/spin', { method: 'POST', body: JSON.stringify({ deviceId: getDeviceId() }) });
}

// Read-only check for the same one-spin lock — lets the wheel show "already spun" the moment it
// opens, without the side effect of actually drawing (see the backend route for why POST /spin
// alone can't safely double as this check).
export async function getSpinCooldown(): Promise<{ completed: boolean }> {
  return request(`/coupons/spin-cooldown?deviceId=${encodeURIComponent(getDeviceId())}`);
}

// A claimed spin reward — the SAME reward is honoured for a fixed window after the first
// claim (see CLAIM_WINDOW_HOURS on the backend), so re-spinning inside that window can't win
// something else.
export interface SpinClaim {
  code: string; label: string; discountType: string; discountValue: number;
  minimumOrderAmount?: number | null; maximumDiscount?: number | null; terms: string;
  isGift?: boolean;
  claimedAt: string; expiresAt: string;
}
// Does the signed-in shopper already hold an unexpired spin reward?
export async function getSpinStatus(): Promise<{ active: SpinClaim | null }> {
  return request('/coupons/spin-status');
}
// Record a spin win against the signed-in shopper's account (idempotent — see backend).
export async function claimSpin(code: string): Promise<SpinClaim> {
  return request('/coupons/claim-spin', { method: 'POST', body: JSON.stringify({ code }) });
}

// Claim a spin win by EMAIL (subscribe-to-claim) — no login needed. The backend emails the coupon
// and, once they sign in with this same email, attaches it to their account for checkout.
export interface EmailSpinClaim {
  code: string; label: string; discountType?: string; discountValue?: number;
  minimumOrderAmount?: number | null; maximumDiscount?: number | null; terms?: string;
  isGift?: boolean; expiresAt: string; alreadyClaimed?: boolean;
}
export async function claimEmailSpin(code: string, email: string, name: string): Promise<EmailSpinClaim> {
  return request('/coupons/claim-email', { method: 'POST', body: JSON.stringify({ code, email, name }) });
}

/* ---- Orders ---- */
export interface OrderPayment { provider: string; transactionId: string | null; status: string; paidAt: string | null; }

export interface Order {
  id: number; orderNumber: string; totalAmount: number;
  orderStatus: string; paymentStatus: string; createdAt: string;
  subtotal?: number; discountAmount?: number; deliveryFee?: number; taxAmount?: number;
  couponCode?: string | null; shipmentStatus?: string; trackingUrl?: string | null;
  delhiveryWaybill?: string | null; delhiveryShipmentId?: string | null; labelGenerated?: boolean;
  carrierOrderId?: string | null;   // the carrier's own order id — Shiprocket's cancel API keys off it
  carrier?: string | null; // 'SHIPROCKET' (intracity, same-day) | 'DELHIVERY' (outstation)
  shipmentError?: string | null;    // why the automatic courier booking failed, if it did
  estimatedDelivery?: string | null; // carrier promised date from webhook (YYYY-MM-DD HH:MM:SS)
  payment?: OrderPayment | null;
  /** Petpooja relay state (admin views only) — whether the kitchen actually received the ticket. */
  pos?: { relayed: boolean; petpoojaOrderId: string | null; attempts: number; lastError: string | null } | null;
  /** Which store is making it and how far they have got. `posBillNo` is the bill from that store's
   *  own Petpooja terminal — the only link to the POS for every outlet except Begur. */
  store?: { code: string; acceptedAt: string | null; readyAt: string | null; posBillNo: string | null } | null;
  address?: Address | null; items?: OrderItem[];
  warningFlags?: string[]; // e.g. 'DUPLICATE_CHARGE' — admin-facing alerts, doesn't affect order status
}

export interface OrderItem {
  id: number; productId: number | null; productName: string;
  quantity: number; unitPrice: number; totalPrice: number;
  selectedOptions?: string | null; specialNotes?: string | null;
}

export interface OrderItemInput { productId: number; quantity: number; selectedOptions?: unknown; specialNotes?: string; }

export async function createOrder(addressId: number, couponCode?: string, items?: OrderItemInput[]): Promise<Order> {
  return request('/orders', { method: 'POST', body: JSON.stringify({ addressId, couponCode, items }) });
}

export interface RazorpayOrder { keyId: string; orderId: string; amount: number; currency: string; orderNumber: string; }

/** Step 1: ask the backend to create a Razorpay order so Checkout can open. */
export async function createRazorpayOrder(orderId: number): Promise<RazorpayOrder> {
  return request(`/orders/${orderId}/payment/razorpay-order`, { method: 'POST' });
}

/** Step 2: confirm payment. Backend verifies the signature, marks PAID, then auto-creates the shipment. */
export interface PaymentConfirmation { razorpayPaymentId: string; razorpayOrderId: string; razorpaySignature: string; }
export async function verifyPayment(orderId: number, confirmation?: PaymentConfirmation): Promise<Order> {
  return request(`/orders/${orderId}/payment/verify`, { method: 'POST', body: JSON.stringify(confirmation || {}) });
}

/**
 * Tell the backend the shopper closed or failed the payment, so the unpaid order it created to open
 * Razorpay with is cancelled rather than left sitting as PENDING.
 *
 * Never throws. It runs on the way out of a payment the shopper has already given up on, and an
 * error here must not become a second thing going wrong in front of them — the order stays
 * invisible to them either way, since the account list excludes PENDING.
 */
export async function abandonOrder(orderId: number): Promise<void> {
  try { await request(`/orders/${orderId}/abandon`, { method: 'POST' }); } catch { /* best effort */ }
}

export async function getOrders(): Promise<Order[]> { return request('/orders'); }

export async function getOrder(id: number): Promise<Order> { return request(`/orders/${id}`); }

export interface DelhiveryTrackResult {
  tracked: boolean; waybill?: string; reason?: string;
  // Normalized fields returned for BOTH carriers (Delhivery + Shiprocket).
  carrier?: string; status?: string | null; trackUrl?: string | null;
  scans?: { time: string; event: string }[];
  data?: { ShipmentData?: { Shipment?: { Status?: { Status?: string; Instructions?: string }; Scans?: { ScanDetail?: { ScanDateTime?: string; Instructions?: string; Scan?: string } }[] } }[] };
}
export async function trackOrderShipment(orderId: number): Promise<DelhiveryTrackResult> {
  return request(`/orders/${orderId}/delhivery-track`);
}

/* ---- Delivery (user-facing) ---- */
export interface DeliveryCheck {
  serviceable: boolean;
  embargo?: boolean;
  reason?: string;
  cod?: boolean;
  pincode?: string;
  tat?: number | null;
  expectedDeliveryDate?: string | null;
  intracity?: boolean;          // near one of our stores → same-day from that store
  carrier?: string;             // 'SHIPROCKET' when intracity
  store?: string;               // nearest store name (intracity)
  city?: string;
  sameDay?: boolean;
  deliveryFee?: number;         // the REAL charge: Shiprocket's live quote (intracity) or the admin-set flat outstation fee
  etaHours?: number;            // intracity only — real ETA from the carrier quote
  distanceKm?: number | null;   // intracity only — carrier's routing distance from the dispatching store, which is what the fee is priced on
  etaLabel?: string;            // e.g. "within ~1 hour" — same-day intracity promise
  maintenanceMessage?: string;  // shown when same-day is unavailable and checkout is blocked
  /** Per-product delivery eligibility for THIS pincode — independent of `serviceable`, which is
   *  about the destination in general. Cross-reference against cart contents to flag a restricted
   *  line item with its admin-written reason ("must be enjoyed within 24 hours…") right where the
   *  customer can see it, instead of only finding out when the order is refused at checkout. */
  sameDayRestrictions?: { productId: number; name: string; eligible: boolean; reason: string | null }[];
}

/** Combined serviceability + TAT check — used at checkout when an address is selected. */
export async function checkDeliveryPin(pincode: string, lat?: number | null, lng?: number | null): Promise<DeliveryCheck> {
  // Coordinates are not optional in practice for intracity: Shiprocket hyperlocal prices by
  // distance, so without a lat/lng the backend answers `location_required` and the address looks
  // "not serviceable" even though same-day is available. Saved addresses are geocoded on save, so
  // pass those through whenever we have them.
  const qs = new URLSearchParams({ pincode });
  if (lat != null && lng != null) { qs.set('lat', String(lat)); qs.set('lng', String(lng)); }
  console.log(`[delivery] checking pincode ${pincode}${lat != null && lng != null ? ` @ ${lat},${lng}` : ' (no coordinates — intracity cannot be quoted)'} …`);
  const r = await request<DeliveryCheck>(`/delivery/check?${qs.toString()}`);
  console.log(`[delivery] pincode ${pincode} →`, r.intracity ? `SHIPROCKET (intracity, ${r.store})` : r.serviceable ? 'DELHIVERY (pan-India)' : 'not serviceable', r);
  return r;
}

/* ---- Admin ---- */
export interface AdminStats {
  totalOrders: number; totalRevenue: number; paidRevenue: number;
  totalProducts: number; totalUsers: number; totalAdmins: number;
  lowStock: number; newMessages: number;
  ordersByStatus: Record<string, number>;
  topProducts: { name: string; qty: number; revenue: number }[];
}
export interface AdminUser { id: number; name: string; email: string | null; phone?: string; role: string; createdAt: string; orderCount: number; addresses?: Address[]; lastLoginLocation?: string | null; }
export interface AdminCoupon { id: number; code: string; discountType: string; discountValue: number; minimumOrderAmount?: number | null; maximumDiscount?: number | null; expiryDate?: string | null; usageLimit?: number | null; isActive: boolean; timesUsed?: number; spinWeight?: number | null; spinLabel?: string | null; terms?: string | null; }
export interface CouponInput { code: string; discountType: 'PERCENTAGE' | 'FIXED'; discountValue: number; minimumOrderAmount?: number | null; maximumDiscount?: number | null; expiryDate?: string | null; usageLimit?: number | null; isActive?: boolean; spinWeight?: number | null; spinLabel?: string | null; terms?: string | null; }
export interface AdminMessage { id: number; name: string; email: string; phone?: string | null; message: string; handled: boolean; createdAt: string; }
export interface ProductInput {
  name: string; category: ProductCategory; description?: string; price: number;
  stockQuantity?: number; images?: string; options?: string; isAvailable?: boolean;
  menuGroup?: string; tag?: string; featured?: boolean;
  intracityAvailable?: boolean; intracityUnavailableReason?: string;
  intercityAvailable?: boolean; intercityUnavailableReason?: string;
  restrictCities?: string;
}

export interface AdminAnalytics {
  from?: string; to?: string;
  salesByDay: { day: string; orders: number; revenue: number; paid: number }[];
  ordersByArea: { city: string; orders: number; revenue: number }[];
  usersByCity: { city: string; users: number }[];
  paymentBreakdown: { status: string; count: number; amount: number }[];
  shipmentByStatus: { status: string; count: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
}

interface SiteSettings { promoProductId: number | null; headerOffer: string | null; stallInfo: string | null; deliveryFeeOutstation: number; }
export async function adminDashboard(): Promise<AdminStats> { return request('/admin/dashboard'); }
export async function adminGetSettings(): Promise<SiteSettings> { return request('/admin/settings'); }
export async function adminSetPromoProduct(promoProductId: number | null): Promise<SiteSettings> {
  return request('/admin/settings', { method: 'PUT', body: JSON.stringify({ promoProductId }) });
}
// Free-text offer shown in the site header banner — e.g. "Get 5% off with code XYZ". null/empty clears it.
export async function adminSetHeaderOffer(headerOffer: string | null): Promise<SiteSettings> {
  return request('/admin/settings', { method: 'PUT', body: JSON.stringify({ headerOffer }) });
}
// Free-text "today's stall / visit us" note shown as a homepage card. null/empty hides the card.
export async function adminSetStallInfo(stallInfo: string | null): Promise<SiteSettings> {
  return request('/admin/settings', { method: 'PUT', body: JSON.stringify({ stallInfo }) });
}
// Flat fee customers pay for outstation (Delhivery) delivery. Intracity is never set here — it's
// Shiprocket's own live per-order quote, charged exactly as quoted (see orders.js).
export async function adminSetDeliveryFeeOutstation(deliveryFeeOutstation: number): Promise<SiteSettings> {
  return request('/admin/settings', { method: 'PUT', body: JSON.stringify({ deliveryFeeOutstation }) });
}

/* ---- Store online/offline, and per-store product availability ---- */
export interface AdminStoreStatus { code: string; name: string; city: string; posMode: 'AUTO' | 'MANUAL'; isActive: boolean; }
export async function adminGetStoreStatus(): Promise<{ stores: AdminStoreStatus[] }> { return request('/admin/store-status'); }
export async function adminToggleStoreStatus(code: string): Promise<{ ok: boolean; code: string; isActive: boolean }> {
  return request(`/admin/store-status/${code}/toggle`, { method: 'PATCH' });
}
export interface AdminStoreProduct { id: number; name: string; available: boolean; isOverride: boolean; automaticallyAvailable: boolean; }
export async function adminGetStoreProducts(code: string): Promise<{ products: AdminStoreProduct[] }> {
  return request(`/admin/store-products/${code}`);
}
// available: true/false sets an explicit override; null clears it, reverting to the automatic rule.
export async function adminSetStoreProductOverride(code: string, productId: number, available: boolean | null): Promise<{ ok: boolean }> {
  return request(`/admin/store-products/${code}/${productId}`, { method: 'PUT', body: JSON.stringify({ available }) });
}
// Public: the current header-banner offer text (or null if the admin hasn't set one).
export async function getAnnouncement(): Promise<{ text: string | null }> { return request('/products/announcement'); }
// Public: today's stall/store-visit note (or null if the admin hasn't set one).
export async function getStallInfo(): Promise<{ text: string | null }> { return request('/products/stall-info'); }
export async function adminAnalytics(from?: string, to?: string): Promise<AdminAnalytics> {
  const qs = from && to ? `?from=${from}&to=${to}` : '';
  return request(`/admin/analytics${qs}`);
}

export async function adminGetOrders(): Promise<Order[]> { return request('/admin/orders'); }

/**
 * Cancelling also cancels the POS ticket and the courier booking. `cancelWarnings` lists any leg
 * that refused — those need doing by hand in the carrier's or Petpooja's own dashboard.
 */
export async function adminUpdateOrderStatus(id: number, status: string, remarks?: string): Promise<Order & { cancelWarnings?: string[] }> {
  return request(`/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, remarks }) });
}

/** Everything that took money but did not complete downstream. Empty lists = nothing to chase. */
export interface AttentionReport {
  paidNoShipment: { id: number; order_number: string; total_amount: number; created_at: string; shipment_error: string | null; carrier: string | null; has_address: boolean }[];
  paidNoPosTicket: { id: number; order_number: string; total_amount: number; created_at: string; last_error: string | null; attempts: number }[];
  cancelStuckDownstream: { id: number; order_number: string; status: string; remarks: string; created_at: string }[];
  moneyReversed: { id: number; order_number: string; status: string; remarks: string; created_at: string }[];
  /** Paid, made at a store that bills on its OWN Petpooja terminal, and no bill number typed back —
   *  so there is nothing to reconcile the Razorpay settlement against. */
  posManualUnbilled: { id: number; order_number: string; total_amount: number; created_at: string; store_code: string; store_accepted_at: string | null; store_ready_at: string | null }[];
  total: number;
}
export async function adminAttention(): Promise<AttentionReport> { return request('/admin/attention'); }

/* ---- Admin: Stores (staff portal) ---- */

export interface StoreStaff {
  id: number; username: string; name: string | null; isActive: boolean;
  lastLoginAt: string | null; passwordSetAt: string | null;
  /** Never signed in and never had its password changed — so the starting password still works. */
  onStartingPassword: boolean;
  /** Only present while `onStartingPassword` holds; a hash cannot be read back once it doesn't. */
  startingPassword: string | null;
}
export interface AdminStore {
  code: string; name: string; city: string; state: string; pincode: number;
  address: string; phone: string;
  /** 'AUTO' — we relay to Petpooja. 'MANUAL' — this store bills on its own terminal. */
  posMode: 'AUTO' | 'MANUAL';
  pickupName: string | null;
  portalPath: string;
  last30Days: { paid: number; unaccepted: number; unbilled: number };
  /** Storewide-available, same-day-only products this store cannot sell (city rule excludes it) —
   *  e.g. Besant Nagar (Chennai) never carries a Bengaluru-only item. Computed with the exact same
   *  rule the store's own menu view and the checkout guard use, so this can never drift from reality. */
  doesNotCarry: string[];
  staff: StoreStaff[];
}
export interface AdminStoresReport {
  stores: AdminStore[];
  orphanedStaff: { id: number; username: string; storeCode: string }[];
}
export async function adminGetStores(): Promise<AdminStoresReport> { return request('/admin/stores'); }

export async function adminCreateStoreStaff(code: string, username: string, password: string, name?: string): Promise<{ ok: boolean; id: number; username: string }> {
  return request(`/admin/stores/${code}/staff`, { method: 'POST', body: JSON.stringify({ username, password, name }) });
}
export async function adminSetStoreStaffPassword(id: number, password: string): Promise<{ ok: boolean }> {
  return request(`/admin/stores/staff/${id}/password`, { method: 'POST', body: JSON.stringify({ password }) });
}
export async function adminToggleStoreStaff(id: number): Promise<{ ok: boolean; isActive: boolean }> {
  return request(`/admin/stores/staff/${id}/toggle`, { method: 'PATCH' });
}
export async function adminDeleteStoreStaff(id: number): Promise<{ ok: boolean }> {
  return request(`/admin/stores/staff/${id}`, { method: 'DELETE' });
}

/**
 * Can each store ACTUALLY dispatch a same-day order right now? `verified` is the only thing that
 * matters — an unverified Shiprocket pickup quotes fine and then refuses the booking.
 */
export interface StoreReadiness {
  name: string; city: string; state: string; pincode: number;
  pickupName: string | null; registered: boolean; verified: boolean | null;
  isPrimary: boolean; phoneVerified: boolean; pickupId: number | null; usable?: boolean;
  contact: string | null; blockedReason: string | null;
}
export interface StoreReadinessReport {
  configured: boolean; ok?: boolean; reason?: string | null;
  stores: StoreReadiness[]; verifiedCount: number;
  unmappedPickups?: { id: number; nickname: string; city: string; pincode: string; verified: boolean }[];
}
export async function adminGetStoreReadiness(): Promise<StoreReadinessReport> { return request('/admin/delivery/stores'); }

/* ---- Admin: Petpooja (POS) ---- */

/** One row of Petpooja's catalogue. `productId` null means it is not yet linked to a product. */
export interface PetpoojaItem {
  item_id: string; variation_id: string; name: string; variation_name: string | null;
  price: number | null; in_stock: boolean; product_id: number | null; category_id: string | null;
}
export interface PetpoojaMapping {
  restId: string;
  items: PetpoojaItem[];
  products: { id: number; name: string; price: number; is_available: boolean }[];
  unmapped: { id: number; name: string }[];
  taxes: { tax_id: string; name: string; percentage: number }[];
  /** Every menu Petpooja has pushed us, newest first. */
  pushes: { id: number; rest_id: string; source: string; item_count: number; received_at: string }[];
  menuSynced: boolean;
}
export async function adminGetPetpoojaMapping(): Promise<PetpoojaMapping> { return request('/admin/petpooja/mapping'); }

/** Link a Petpooja item to one of our products, or pass null to unlink. */
export async function adminSetPetpoojaMapping(itemId: string, variationId: string, productId: number | null): Promise<{ ok: boolean }> {
  return request('/admin/petpooja/mapping', { method: 'POST', body: JSON.stringify({ itemId, variationId, productId }) });
}

/** Link from OUR side: pick which Petpooja item a product is. Pass itemId null to unlink. */
export async function adminLinkProductToPetpooja(productId: number, itemId: string | null, variationId = ''): Promise<{ ok: boolean }> {
  return request('/admin/petpooja/mapping/by-product', { method: 'POST', body: JSON.stringify({ productId, itemId, variationId }) });
}

/** Create one of our products from a Petpooja item and link the two in one step. */
export async function adminCreateProductFromPetpooja(itemId: string, variationId: string): Promise<{ ok: boolean; created: boolean; product: Product }> {
  return request('/admin/petpooja/mapping/create-product', { method: 'POST', body: JSON.stringify({ itemId, variationId }) });
}

/** Which orders reached the POS, which failed, and why. */
export interface PetpoojaRelay {
  order_id: number; order_number: string; total_amount: number; relay_ok: boolean;
  petpooja_order_id: string | null; petpooja_status: string | null; attempts: number;
  last_error: string | null; updated_at: string;
}
export async function adminGetPetpoojaRelays(): Promise<PetpoojaRelay[]> { return request('/admin/petpooja/orders'); }

/** Re-run the AUTOMATIC carrier routing (intracity → Shiprocket, else Delhivery) for a paid order. */
export async function adminRebookShipment(orderId: number): Promise<{ ok: boolean; reason?: string; waybill?: string; carrier?: string }> {
  return request(`/admin/orders/${orderId}/rebook`, { method: 'POST' });
}

/** Push a paid order to the Petpooja POS again after a failed relay (e.g. once mapping is fixed). */
export async function adminRetryPosRelay(orderId: number): Promise<{ ok: boolean; reason?: string; skipped?: boolean }> {
  return request(`/admin/petpooja/orders/${orderId}/retry`, { method: 'POST', body: JSON.stringify({}) });
}

export async function adminGetProducts(): Promise<Product[]> { return request('/admin/products'); }
export async function adminCreateProduct(data: ProductInput): Promise<Product> {
  return request('/admin/products', { method: 'POST', body: JSON.stringify(data) });
}
export async function adminUpdateProduct(id: number, data: ProductInput): Promise<Product> {
  return request(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function adminDeleteProduct(id: number): Promise<void> {
  return request(`/admin/products/${id}`, { method: 'DELETE' });
}

export async function adminGetCoupons(): Promise<AdminCoupon[]> { return request('/admin/coupons'); }
export async function adminCreateCoupon(data: CouponInput): Promise<AdminCoupon> {
  return request('/admin/coupons', { method: 'POST', body: JSON.stringify(data) });
}
export async function adminUpdateCoupon(id: number, data: CouponInput): Promise<AdminCoupon> {
  return request(`/admin/coupons/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function adminToggleCoupon(id: number): Promise<AdminCoupon> {
  return request(`/admin/coupons/${id}/toggle`, { method: 'PATCH' });
}
export async function adminDeleteCoupon(id: number): Promise<{ ok: boolean }> {
  return request(`/admin/coupons/${id}`, { method: 'DELETE' });
}
// Wheel is one spin per device/account for good — this is the only way to open a fresh round for
// everyone at once. Leaves already-issued coupons (spin_claims/spin_email_claims) untouched.
export async function adminResetAllSpins(): Promise<{ ok: boolean; cleared: number }> {
  return request('/admin/coupons/reset-spins', { method: 'POST' });
}

export async function adminGetUsers(): Promise<AdminUser[]> { return request('/admin/users'); }
export async function adminGetMessages(): Promise<AdminMessage[]> { return request('/admin/contact'); }
export async function adminMarkMessageHandled(id: number): Promise<{ id: number; handled: boolean }> {
  return request(`/admin/contact/${id}/handled`, { method: 'PATCH' });
}

/* ---- Admin: Delivery — Warehouses ---- */
export interface Warehouse {
  id: number; name: string; registeredName?: string;
  pickupLocation: string; addressLine1?: string; addressLine2?: string;
  city?: string; state?: string; pincode: string; returnPincode?: string;
  phone?: string; email?: string; isActive: boolean; isDefault: boolean; createdAt: string;
}
export interface WarehouseInput {
  name: string; registeredName?: string; pickupLocation: string;
  addressLine1?: string; addressLine2?: string; city?: string; state?: string;
  pincode: string; returnPincode?: string; phone?: string; email?: string; isDefault?: boolean;
  skipDelhivery?: boolean;
}

export async function adminGetWarehouses(): Promise<Warehouse[]> { return request('/admin/delivery/warehouses'); }
export async function adminCreateWarehouse(data: WarehouseInput): Promise<Warehouse> {
  return request('/admin/delivery/warehouses', { method: 'POST', body: JSON.stringify(data) });
}
export async function adminUpdateWarehouse(id: number, data: WarehouseInput): Promise<Warehouse> {
  return request(`/admin/delivery/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function adminSetDefaultWarehouse(id: number): Promise<{ ok: boolean }> {
  return request(`/admin/delivery/warehouses/${id}/default`, { method: 'PATCH' });
}
export async function adminToggleWarehouse(id: number): Promise<Warehouse> {
  return request(`/admin/delivery/warehouses/${id}/toggle`, { method: 'PATCH' });
}


/* ---- Admin: Delivery — Shipping cost ---- */
export interface ShippingCostResult { ok: boolean; data?: unknown; reason?: string; }
export async function adminGetShippingCost(destPin: string, weight = 0.5): Promise<ShippingCostResult> {
  return request(`/admin/delivery/shipping-cost?destPin=${encodeURIComponent(destPin)}&weight=${weight}`);
}

/* ---- Admin: Delivery — Shipment actions ---- */
export async function adminCreateShipment(orderId: number, weight = 0.5): Promise<Order> {
  return request(`/admin/orders/${orderId}/shipment`, { method: 'POST', body: JSON.stringify({ weight }) });
}
/**
 * Cancel with whichever carrier booked it. `dispatched` says whether a rider had already been
 * allocated — for Shiprocket that is the AWB existing, which only happens once a real rider is
 * found, so it also means the delivery charge has already been taken.
 */
export async function adminCancelShipment(orderId: number): Promise<{ ok: boolean; waybill: string; carrier?: string; dispatched?: boolean; message?: string }> {
  return request(`/admin/orders/${orderId}/shipment`, { method: 'DELETE' });
}
export async function adminTrackOrder(orderId: number): Promise<{ ok: boolean; data?: unknown; reason?: string; carrier?: string; status?: string | null; scans?: { time: string; event: string }[] }> {
  return request(`/admin/orders/${orderId}/track`);
}
export function adminLabelUrl(waybills: string): string {
  return `${API_BASE}/admin/delivery/label?waybills=${encodeURIComponent(waybills)}`;
}

/** Delhivery B2C documents that can be fetched for an order (only after it ships). */
export type DelhiveryDocType = 'SIGNATURE_URL' | 'RVP_QC_IMAGE' | 'EPOD' | 'SELLER_RETURN_IMAGE';
export interface OrderDocumentResult { ok: boolean; docType?: string; waybill?: string; url?: string | null; data?: unknown; reason?: string; }
/** Fetch a Delhivery document (proof of delivery, signature, return image) for a shipped order. */
export async function adminFetchOrderDocument(orderId: number, docType: DelhiveryDocType): Promise<OrderDocumentResult> {
  return request(`/admin/orders/${orderId}/document?type=${encodeURIComponent(docType)}`);
}


/**
 * Open the shipping-label PDF in a new tab. The label route is admin-protected, so a plain
 * <a href> link 401s (browser navigation can't send the Bearer token). We fetch it with the
 * auth header, then open the PDF as a blob URL.
 */
export async function openLabel(waybills: string): Promise<void> {
  const token = await getToken();
  const res = await fetch(adminLabelUrl(waybills), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || err?.message || `Label fetch failed (${res.status})`);
  }
  const blobUrl = URL.createObjectURL(await res.blob());
  window.open(blobUrl, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/* ---- Admin: Delivery — Pickup request ---- */
export async function adminCreatePickupRequest(pickupDate: string, pickupTime: string, packageCount: number): Promise<{ ok: boolean; data?: unknown; reason?: string }> {
  return request('/admin/delivery/pickup-request', { method: 'POST', body: JSON.stringify({ pickupDate, pickupTime, packageCount }) });
}
