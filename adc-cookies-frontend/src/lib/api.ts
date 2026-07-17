// Same-origin by default: the browser calls /api/... on whatever host served the page
// (localhost or your LAN IP on a phone), and Next.js rewrites it to the backend server-side.
import { supabase } from './supabase';

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

/* ---- Products ---- */
export interface Product {
  id: number; name: string; category: 'COOKIES' | 'TINS';
  description: string; price: number; stockQuantity: number;
  images: string; options: string; isAvailable: boolean;
  menuGroup: string; tag: string; featured: boolean;
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
}
export async function getActiveCoupons(): Promise<ActiveCoupon[]> {
  return request('/coupons/active');
}

// A claimed spin reward — the SAME reward is honoured for a fixed window after the first
// claim (see CLAIM_WINDOW_HOURS on the backend), so re-spinning inside that window can't win
// something else.
export interface SpinClaim {
  code: string; label: string; discountType: string; discountValue: number;
  minimumOrderAmount?: number | null; maximumDiscount?: number | null; terms: string;
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

/* ---- Orders ---- */
export interface OrderPayment { provider: string; transactionId: string | null; status: string; paidAt: string | null; }

export interface Order {
  id: number; orderNumber: string; totalAmount: number;
  orderStatus: string; paymentStatus: string; createdAt: string;
  subtotal?: number; discountAmount?: number; deliveryFee?: number; taxAmount?: number;
  couponCode?: string | null; shipmentStatus?: string; trackingUrl?: string | null;
  delhiveryWaybill?: string | null; delhiveryShipmentId?: string | null; labelGenerated?: boolean;
  carrier?: string | null; // 'SHADOWFAX' (intracity) | 'DELHIVERY' (outstation)
  estimatedDelivery?: string | null; // Shadowfax promised date from webhook (YYYY-MM-DD HH:MM:SS)
  payment?: OrderPayment | null;
  address?: Address | null; items?: OrderItem[];
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

export async function getOrders(): Promise<Order[]> { return request('/orders'); }

export async function getOrder(id: number): Promise<Order> { return request(`/orders/${id}`); }

export interface DelhiveryTrackResult {
  tracked: boolean; waybill?: string; reason?: string;
  // Normalized fields returned for BOTH carriers (Delhivery + Shadowfax).
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
  intracity?: boolean;          // near one of our stores → ships same-day via Shadowfax
  carrier?: string;             // 'SHADOWFAX' when intracity
  store?: string;               // nearest store name (intracity)
  city?: string;
  sameDay?: boolean;
}

/** Combined serviceability + TAT check — used at checkout when an address is selected. */
export async function checkDeliveryPin(pincode: string): Promise<DeliveryCheck> {
  console.log(`[delivery] checking pincode ${pincode} …`);
  const r = await request<DeliveryCheck>(`/delivery/check?pincode=${encodeURIComponent(pincode)}`);
  console.log(`[delivery] pincode ${pincode} →`, r.intracity ? `SHADOWFAX (intracity, ${r.store})` : r.serviceable ? 'DELHIVERY (pan-India)' : 'not serviceable', r);
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
export interface AdminUser { id: number; name: string; email: string | null; phone?: string; role: string; createdAt: string; orderCount: number; addresses?: Address[]; }
export interface AdminCoupon { id: number; code: string; discountType: string; discountValue: number; minimumOrderAmount?: number | null; maximumDiscount?: number | null; expiryDate?: string | null; usageLimit?: number | null; isActive: boolean; timesUsed?: number; spinWeight?: number | null; spinLabel?: string | null; terms?: string | null; }
export interface CouponInput { code: string; discountType: 'PERCENTAGE' | 'FIXED'; discountValue: number; minimumOrderAmount?: number | null; maximumDiscount?: number | null; expiryDate?: string | null; usageLimit?: number | null; isActive?: boolean; spinWeight?: number | null; spinLabel?: string | null; terms?: string | null; }
export interface AdminMessage { id: number; name: string; email: string; phone?: string | null; message: string; handled: boolean; createdAt: string; }
export interface ProductInput {
  name: string; category: 'COOKIES' | 'TINS'; description?: string; price: number;
  stockQuantity?: number; images?: string; options?: string; isAvailable?: boolean;
  menuGroup?: string; tag?: string; featured?: boolean;
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

export async function adminDashboard(): Promise<AdminStats> { return request('/admin/dashboard'); }
export async function adminGetSettings(): Promise<{ promoProductId: number | null }> { return request('/admin/settings'); }
export async function adminSetPromoProduct(promoProductId: number | null): Promise<{ promoProductId: number | null }> {
  return request('/admin/settings', { method: 'PUT', body: JSON.stringify({ promoProductId }) });
}
export async function adminAnalytics(from?: string, to?: string): Promise<AdminAnalytics> {
  const qs = from && to ? `?from=${from}&to=${to}` : '';
  return request(`/admin/analytics${qs}`);
}

export async function adminGetOrders(): Promise<Order[]> { return request('/admin/orders'); }
export async function adminUpdateOrderStatus(id: number, status: string, remarks?: string): Promise<Order> {
  return request(`/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, remarks }) });
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
export async function adminCancelShipment(orderId: number): Promise<{ ok: boolean; waybill: string }> {
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

/** Shadowfax (intracity) documents: proof-of-delivery signature + shareable customer tracking link. */
export interface ShadowfaxDocResult { ok: boolean; awb?: string; status?: string | null; trackUrl?: string | null; pod?: { recipient?: string | null; urls: string[] } | null; reason?: string; }
export async function adminFetchShadowfaxDoc(orderId: number): Promise<ShadowfaxDocResult> {
  return request(`/admin/orders/${orderId}/shadowfax-doc`);
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
