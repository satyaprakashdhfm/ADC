'use client';

export interface RazorpayResponse { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string; }

export interface RazorpayOptions {
  key: string; order_id: string; amount: number; currency: string;
  name: string; description?: string; image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (resp: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
  // Fallback for browsers that can't run the iframe/popup flow (Instagram/FB Messenger in-app
  // browser, Opera Mini, UC Browser) — Checkout redirects there instead of calling `handler`.
  callback_url?: string;
}
export interface RazorpayInstance { open: () => void; on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void; }
declare global { interface Window { Razorpay?: new (opts: RazorpayOptions) => RazorpayInstance; } }

// Inject Razorpay's checkout.js once; resolves true when window.Razorpay is ready.
export function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}
