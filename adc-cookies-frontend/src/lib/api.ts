// Same-origin by default: the browser calls /api/... on whatever host served the page
// (localhost or your LAN IP on a phone), and Next.js rewrites it to the backend server-side.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('adc_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ---- Auth ---- */
export interface AuthResponse { token: string; email: string; name: string; role: string; }

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export async function register(name: string, email: string, phone: string, password: string): Promise<AuthResponse> {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, phone, password }) });
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function resetPassword(email: string, otp: string, newPassword: string): Promise<{ message: string }> {
  return request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, otp, newPassword }) });
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
}

export async function getAddresses(): Promise<Address[]> { return request('/addresses'); }

export async function addAddress(data: Omit<Address, 'id'>): Promise<Address> {
  return request('/addresses', { method: 'POST', body: JSON.stringify(data) });
}

/* ---- Contact ---- */
export interface ContactInput { name: string; email: string; phone?: string; message: string; }

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

/* ---- Orders ---- */
export interface Order {
  id: number; orderNumber: string; totalAmount: number;
  orderStatus: string; paymentStatus: string; createdAt: string;
  subtotal?: number; discountAmount?: number; deliveryFee?: number; taxAmount?: number;
  couponCode?: string | null; shipmentStatus?: string; trackingUrl?: string | null;
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

export async function getOrders(): Promise<Order[]> { return request('/orders'); }

export async function getOrder(id: number): Promise<Order> { return request(`/orders/${id}`); }

/* ---- Admin ---- */
export interface AdminStats {
  totalOrders: number; totalRevenue: number; paidRevenue: number;
  totalProducts: number; totalUsers: number; totalAdmins: number;
  lowStock: number; newMessages: number;
  ordersByStatus: Record<string, number>;
  topProducts: { name: string; qty: number; revenue: number }[];
}
export interface AdminUser { id: number; name: string; email: string; phone?: string; role: string; createdAt: string; orderCount: number; }
export interface AdminCoupon { id: number; code: string; discountType: string; discountValue: number; minimumOrderAmount?: number | null; maximumDiscount?: number | null; expiryDate?: string | null; usageLimit?: number | null; isActive: boolean; }
export interface AdminMessage { id: number; name: string; email: string; phone?: string | null; message: string; handled: boolean; createdAt: string; }
export interface ProductInput {
  name: string; category: 'COOKIES' | 'TINS'; description?: string; price: number;
  stockQuantity?: number; images?: string; options?: string; isAvailable?: boolean;
  menuGroup?: string; tag?: string; featured?: boolean;
}

export async function adminDashboard(): Promise<AdminStats> { return request('/admin/dashboard'); }

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
export async function adminToggleCoupon(id: number): Promise<AdminCoupon> {
  return request(`/admin/coupons/${id}/toggle`, { method: 'PATCH' });
}

export async function adminGetUsers(): Promise<AdminUser[]> { return request('/admin/users'); }
export async function adminGetMessages(): Promise<AdminMessage[]> { return request('/admin/contact'); }
export async function adminMarkMessageHandled(id: number): Promise<{ id: number; handled: boolean }> {
  return request(`/admin/contact/${id}/handled`, { method: 'PATCH' });
}
