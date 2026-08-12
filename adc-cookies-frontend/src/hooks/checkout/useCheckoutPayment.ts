'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getProducts, createOrder, createRazorpayOrder, verifyPayment, abandonOrder, type Product, type OrderItemInput, type Address } from '@/lib/api';
import { loadRazorpay } from '@/lib/razorpay';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

interface Args {
  step: 'review' | 'pay';
  chosen?: Address;
  addresses: Address[];
  /** The exact total shown to the shopper. The backend recomputes and charges its own figure. */
  grand: number;
  onNeedLogin: () => void;
}

/**
 * Placing the order and taking the payment.
 *
 * Kept in one hook because the steps are a single transaction in practice: resolve the cart to real
 * product ids, create the order, create the Razorpay order, open Checkout, then verify server-side.
 * Splitting them further would only spread one failure path across several files.
 */
export function useCheckoutPayment({ step, chosen, addresses, grand, onNeedLogin }: Args) {
  const router = useRouter();
  const { cart, gift, giftMessage, giftOccasion, addrId: addr, coupon, applied, clearAll } = useCart();
  const { user } = useAuth();
  const [placing, setPlacing] = useState(false);
  const [payError, setPayError] = useState('');
  const [payFailMsg, setPayFailMsg] = useState(''); // shown on the review step after a failed payment redirect
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [paid, setPaid] = useState(0);
  const [placedOrderSummary, setPlacedOrderSummary] = useState<{ items: { name: string; qty: number }[]; couponCode: string | null } | null>(null);
  const [pendingPayment, setPendingPayment] = useState(false); // true when confirmed via stall mode (no Razorpay), not yet actually paid

  const lines = Object.values(cart);

  // A failed payment bounces back here (/checkout?payment=failed) — surface why, then clean the URL
  // so a refresh doesn't keep showing it.
  useEffect(() => {
    if (step !== 'review' || typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('payment') !== 'failed') return;
    let msg = 'Your payment didn’t go through — no money was taken. Please review and try again.';
    try { const s = sessionStorage.getItem('adc_pay_error'); if (s) msg = s; sessionStorage.removeItem('adc_pay_error'); } catch {}
    setPayFailMsg(msg);
    window.history.replaceState(null, '', '/checkout');
  }, [step]);

  // Resolve cart items to REAL backend product ids. The cart may hold fallback-menu items
  // whose ids aren't real ids (added before products finished loading) — resolve those by
  // name (the fallback names match the DB exactly), so the order works regardless. Shared by
  // both the real Razorpay flow and the stall-mode "confirm order" flow below.
  const resolveOrderItems = async (): Promise<OrderItemInput[]> => {
    let catalog: Product[] = [];
    try { catalog = await getProducts(); } catch {}
    const idByName = new Map(catalog.map(p => [p.name.trim().toLowerCase(), p.id]));
    return Object.values(cart)
      .map((e, index) => {
        const opts: Record<string, unknown> = {};
        if (e.addOns && e.addOns.length) opts.addOns = e.addOns;
        if (index === 0 && gift) { opts.giftWrap = true; opts.giftMessage = giftMessage; if (giftOccasion) opts.giftOccasion = giftOccasion; }
        const numericId = Number(e.id);
        const productId = Number.isFinite(numericId) ? numericId : idByName.get(e.name.trim().toLowerCase());
        return {
          productId: productId as number,
          quantity: e.qty,
          selectedOptions: Object.keys(opts).length ? opts : undefined,
          specialNotes: e.note || undefined,
        };
      })
      .filter(it => Number.isFinite(it.productId) && it.quantity > 0);
  };

  // Create the order, then open the Razorpay popup. On success the handler verifies the
  // payment on our backend (which marks PAID + auto-creates the Delhivery shipment), then
  // shows the success screen. The user never leaves this page.

  const handlePlace = async () => {
    if (!user) { onNeedLogin(); return; }
    if (!addr || !addresses.some(a => a.id === addr)) { setPayError('Please select a delivery address first.'); return; }
    if (lines.length === 0) { setPayError('Your cart is empty.'); return; }
    setPayError('');
    setPlacing(true);
    try {
      const items = await resolveOrderItems();
      if (items.length === 0) {
        setPlacing(false);
        setPayError('Could not match your cart items to the menu. Please refresh the page, add them again, and retry.');
        return;
      }

      const order = await createOrder(addr, applied ? coupon : undefined, items);
      const rp = await createRazorpayOrder(order.id);

      const ready = await loadRazorpay();
      if (!ready || !window.Razorpay) throw new Error('Could not load the payment window. Check your connection and try again.');

      const rzp = new window.Razorpay({
        key: rp.keyId,
        order_id: rp.orderId,
        amount: rp.amount,
        currency: rp.currency,
        name: 'A Dough Cookie',
        description: `Order ${rp.orderNumber}`,
        prefill: { name: user.name || '', email: user.email || '', contact: chosen?.phone || '' },
        theme: { color: 'var(--orange-cta)' },
        // Fallback path for Instagram/FB Messenger/Opera Mini/UC in-app browsers, which can't run
        // the iframe/popup flow below — Checkout redirects there instead of calling `handler`.
        // It's a browser navigation (not server-to-server), so `/api/...` works via the same
        // Next.js rewrite proxy every other API call already uses.
        callback_url: `${window.location.origin}/api/payment-callback/${order.id}?return=${encodeURIComponent(window.location.origin)}`,
        handler: async (resp) => {
          try {
            await verifyPayment(order.id, {
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpayOrderId: resp.razorpay_order_id,
              razorpaySignature: resp.razorpay_signature,
            });
            // Snapshot before clearAll() wipes the cart — the success screen still needs to show
            // what was actually ordered.
            setPlacedOrderSummary({ items: lines.map(l => ({ name: l.name, qty: l.qty })), couponCode: applied ? coupon : null });
            setPendingPayment(false);
            setPaid(grand);
            setOrderId(rp.orderNumber);
            clearAll();
            setDone(true);
          } catch (e) {
            setPlacing(false);
            setPayError(e instanceof Error ? e.message : 'We could not confirm your payment. If money was deducted, contact us with your order number.');
          }
        },
        /*
         * They closed the payment window. Two things have to happen, and neither used to.
         *
         * The order created a moment ago to open Razorpay with is now an order nobody is going to
         * pay for, so cancel it. And send them back to checkout rather than leaving them sitting on
         * a payment screen whose popup they just dismissed — the only thing to do there is press
         * Pay again, which is not what closing the window meant.
         */
        modal: {
          ondismiss: () => {
            setPlacing(false);
            void abandonOrder(order.id);
            router.push('/checkout');
          },
        },
      });
      rzp.on('payment.failed', (resp) => {
        setPlacing(false);
        // Same as dismissing, with a reason to carry across: the unpaid order goes, and the shopper
        // goes back to checkout to review and retry rather than being stranded on the pay screen.
        void abandonOrder(order.id);
        try { sessionStorage.setItem('adc_pay_error', resp?.error?.description || 'Payment failed. Please try again.'); } catch {}
        router.push('/checkout?payment=failed');
      });
      rzp.open();
    } catch (e) {
      setPlacing(false);
      setPayError(e instanceof Error ? e.message : 'Something went wrong starting the payment. Please try again.');
    }
  };

  return {
    placing, payError, setPayError, payFailMsg, setPayFailMsg, done, orderId, paid,
    placedOrderSummary, pendingPayment, setPendingPayment, setDone, setPaid, setOrderId,
    setPlacedOrderSummary, resolveOrderItems, handlePlace,
  };
}
