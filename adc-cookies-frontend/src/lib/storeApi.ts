/*
 * API client for the STORE STAFF portal (/store/<code>).
 *
 * Deliberately separate from lib/api.ts. That module signs every call with the shopper's Supabase
 * session; this one signs with a store token from POST /api/store/login, which is a different
 * credential entirely (see adc-cookies-backend-node/src/storeAuth.js). Sharing one client would
 * mean one bad `if` could send a counter tablet's token to a customer endpoint, or a shopper's
 * session to a store one. Keeping the two apart makes that impossible rather than unlikely.
 *
 * The token lives in localStorage under a per-store key, so a tablet signed into Jayanagar and a
 * laptop signed into Begur can share a browser profile without evicting each other.
 */

const API_BASE = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api');

const tokenKey = (storeCode: string) => `adc.store.token.${storeCode}`;

export function getStoreToken(storeCode: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(tokenKey(storeCode));
}
export function setStoreToken(storeCode: string, token: string) {
  window.localStorage.setItem(tokenKey(storeCode), token);
}
export function clearStoreToken(storeCode: string) {
  window.localStorage.removeItem(tokenKey(storeCode));
}

/** Thrown on 401/403 so the portal can drop to the sign-in screen instead of showing an error. */
export class StoreAuthError extends Error {}

async function request<T>(storeCode: string, path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoreToken(storeCode);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/store${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    const message = err.message || err.error || `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) {
      // The token is dead — remove it, or every later call retries with the same bad credential.
      clearStoreToken(storeCode);
      throw new StoreAuthError(message);
    }
    throw new Error(message);
  }
  return res.json();
}

/* ---- Types ---- */

export interface StoreInfo {
  code: string; name: string; city?: string; state?: string; pincode?: number;
  address?: string; phone?: string;
  /** 'AUTO' — we push the order to Petpooja. 'MANUAL' — this store keys it into its own terminal. */
  posMode: 'AUTO' | 'MANUAL';
  relaysToPos: boolean;
}

export interface StoreSession { username: string; name: string | null; store: StoreInfo; id: number }

export interface StoreOrderItem {
  id: number; name: string; quantity: number; unitPrice: number; totalPrice: number;
  selectedOptions: string | null; specialNotes: string | null;
  posItemId: string | null; posVariation: string | null;
}

export interface StoreOrder {
  id: number; orderNumber: string; placedAt: string; status: string; paymentStatus: string;
  subtotal: number; discountAmount: number; deliveryFee: number; totalAmount: number;
  couponCode: string | null;
  items: StoreOrderItem[];
  customer: { name: string; phone: string } | null;
  address: {
    line1: string; line2: string | null; city: string; state: string; pincode: string;
    latitude: number | null; longitude: number | null; label: string;
  } | null;
  delivery: {
    carrier: string | null; waybill: string | null; shipmentId: string | null;
    shipmentStatus: string | null; trackingUrl: string | null;
    shipmentError: string | null; estimatedDelivery: string | null;
  };
  pos: { manual: boolean; relayed: boolean; petpoojaOrderId: string | null; lastError: string | null; billNo: string | null };
  workflow: { acceptedAt: string | null; acceptedBy: number | null; readyAt: string | null };
  timeline?: { status: string; remarks: string | null; created_at: string }[];
}

export interface StoreOrdersResponse {
  store: { code: string; name: string; posMode: 'AUTO' | 'MANUAL'; relaysToPos: boolean };
  orders: StoreOrder[];
  /** Paid orders nobody at this store has accepted yet — what the new-order alert counts. */
  pendingCount: number;
  serverTime: string;
}

export interface StoreTrack {
  ok: boolean; reason?: string; carrier?: string; status?: string | null;
  awb?: string | null; courier?: string | null; trackUrl?: string | null;
  rider?: { name: string | null; phone: string | null } | null;
  activities?: { date?: string; activity?: string; status?: string }[];
  shipmentError?: string | null;
}

export interface StoreMenuItem {
  id: number; name: string; category: string; menuGroup: string | null;
  price: number; available: boolean;
  /** Whether THIS store carries it — separate from `available`, which is storewide. A same-day-only,
   *  city-restricted item (Red Velvet: Bengaluru only) is a flat no at Besant Nagar regardless. */
  availableHere: boolean;
  posItemId: string | null; posVariation: string | null;
  posPrice: number | null; posInStock: boolean | null;
}

/* ---- Calls ---- */

export async function storeLogin(username: string, password: string): Promise<{ token: string; storeCode: string; username: string; name: string | null }> {
  const res = await fetch(`${API_BASE}/store/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Sign-in failed' }));
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const storeMe = (code: string) => request<StoreSession>(code, '/me');
export const storeOrders = (code: string, days = 7) => request<StoreOrdersResponse>(code, `/orders?days=${days}`);
export const storeOrder = (code: string, id: number) => request<StoreOrder>(code, `/orders/${id}`);
export const storeTrack = (code: string, id: number) => request<StoreTrack>(code, `/orders/${id}/track`);
export const storeMenu = (code: string) => request<StoreMenuItem[]>(code, '/menu');

export const storeAcceptOrder = (code: string, id: number) =>
  request<{ ok: boolean; acceptedAt: string; alreadyAccepted?: boolean }>(code, `/orders/${id}/accept`, { method: 'POST' });

export const storeMarkReady = (code: string, id: number) =>
  request<{ ok: boolean; readyAt: string }>(code, `/orders/${id}/ready`, { method: 'POST' });

export const storeSetPosBill = (code: string, id: number, billNo: string) =>
  request<{ ok: boolean; billNo: string }>(code, `/orders/${id}/pos-bill`, { method: 'POST', body: JSON.stringify({ billNo }) });

export const storeChangePassword = (code: string, currentPassword: string, newPassword: string) =>
  request<{ ok: boolean }>(code, '/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
