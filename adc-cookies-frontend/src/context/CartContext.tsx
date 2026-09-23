'use client';
import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getSavedCart, putSavedCart, type PackPick } from '@/lib/api';
import { trackAddToCart, trackRemoveFromCart } from '@/lib/analytics';

export interface CartEntry {
  id: string; name: string; price: number; qty: number; img?: string; addOns?: string[]; note?: string;
  /* The real product id. A pack's cart key has its picks baked into it so two differently-filled
     packs stay two lines, which makes the key unparseable as a number — and checkout used to derive
     the product id from exactly that. Carried explicitly rather than inferred from the key. */
  productId?: number;
  /* Set only on a pack line: the eight cookies chosen. Re-validated server-side at order time. */
  packPicks?: PackPick[];
}

// Flat fee to wrap the whole order as a gift (with an optional message card).
export const GIFT_FEE = 30;

interface CartContextType {
  cart: Record<string, CartEntry>;
  count: number;
  total: number;
  setQty: (id: string, qty: number, name?: string, price?: number, img?: string, addOns?: string[], note?: string, extra?: { productId?: number; packPicks?: PackPick[] }) => void;
  gift: boolean;
  setGift: (v: boolean) => void;
  giftMessage: string;
  setGiftMessage: (v: string) => void;
  giftOccasion: string;
  setGiftOccasion: (v: string) => void;
  // Checkout selections that must survive navigation between /checkout and /payment.
  addrId: number;
  setAddrId: (v: number) => void;
  coupon: string;
  setCoupon: (v: string) => void;
  applied: boolean;
  setApplied: (v: boolean) => void;
  discount: number;
  setDiscount: (v: number) => void;
  // Cart line id of a "free item" reward's product we auto-added (null if none, or if the
  // customer already had it in their cart themselves) — so removing the coupon removes only
  // what we added on its behalf, not something they were buying anyway.
  giftLineId: string | null;
  setGiftLineId: (v: string | null) => void;
  clearAll: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [gift, setGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [giftOccasion, setGiftOccasion] = useState('');
  const [addrId, setAddrId] = useState(0);   // 0 = nothing selected yet (never a real address id)
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [giftLineId, setGiftLineId] = useState<string | null>(null);

  // Persist the cart across sessions so a returning visitor still sees their items on reopen.
  // Hydrate once on mount (client-only), then save on every change. Cleared when clearAll runs.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      try { const saved = localStorage.getItem('adc_cart'); if (saved) setCart(JSON.parse(saved)); } catch { /* ignore corrupt / unavailable storage */ }
      return;
    }
    try { localStorage.setItem('adc_cart', JSON.stringify(cart)); } catch { /* quota / private mode */ }
  }, [cart]);

  /* The cart as of the last render, so setQty can tell an add from a removal without doing it inside
     the state updater — React may run an updater twice, and an analytics call in there would count
     every add twice. */
  const cartRef = useRef(cart);
  useEffect(() => { cartRef.current = cart; }, [cart]);

  const setQty = useCallback((id: string, qty: number, name?: string, price?: number, img?: string, addOns?: string[], note?: string, extra?: { productId?: number; packPicks?: PackPick[] }) => {
    /* Every add and removal on the site comes through here — the menu's Add, the + and −, a pack
       from the builder, the cart's own controls — so this is the one place both are reported, as
       the difference from what the line held before. Lines without a price are skipped. */
    const was = cartRef.current[id];
    const unit = price || was?.price || 0;
    const before = was?.qty || 0;
    const line = { id: extra?.productId ?? was?.productId ?? id, name: name || was?.name || id, price: unit };
    if (unit > 0 && qty > before) trackAddToCart({ ...line, qty: qty - before });
    else if (unit > 0 && qty < before) trackRemoveFromCart({ ...line, qty: before - Math.max(0, qty) });
    setCart(prev => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[id];
      } else {
        next[id] = {
          id,
          name: name || prev[id]?.name || id,
          price: price ?? prev[id]?.price ?? 0,
          qty,
          img: img || prev[id]?.img,
          addOns: addOns !== undefined ? addOns : prev[id]?.addOns,
          note: note !== undefined ? note : prev[id]?.note,
          // Preserved across a quantity change: bumping a pack from 1 to 2 must not forget what is in it.
          productId: extra?.productId ?? prev[id]?.productId,
          packPicks: extra?.packPicks ?? prev[id]?.packPicks,
        };
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => { setCart({}); setGift(false); setGiftMessage(''); setGiftOccasion(''); setCoupon(''); setApplied(false); setDiscount(0); setGiftLineId(null); }, []);

  /*
   * Keep carts independent per account: when someone LOGS OUT, or a different person signs in on
   * this browser, start fresh so nobody inherits someone else's items. A guest signing in
   * (null → account) keeps their cart, which is the whole point — items added before signing in
   * have to survive it.
   *
   * Keyed on authId, the Supabase auth user id. It used to be keyed on
   * `user.phone || user.email || 'user'`, which is not an identity — it is whichever contact field
   * happened to arrive first, and it changes for the SAME person moments after signing in:
   * refineFromBackend replaces `user` wholesale with the DB row, so a phone-OTP login went
   * 'user' → '9999999999' and a Google login went 'a@b.com' → the phone on its DB row. Either
   * transition read as "a different person signed in" and wiped the guest cart it was supposed to
   * be preserving. authId comes from the session alone and does not move.
   */
  const { authId } = useAuth();
  const prevAuthId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevAuthId.current === undefined) { prevAuthId.current = authId; return; } // record initial; never clear on first resolve
    if (prevAuthId.current !== null && prevAuthId.current !== authId) {
      clearAll();
      try { localStorage.removeItem('adc_cart'); } catch { /* ignore */ }
    }
    prevAuthId.current = authId;
  }, [authId, clearAll]);

  /*
   * The basket, saved to the account while someone is signed in.
   *
   * Only in the browser, a basket built on a laptop was empty on the customer's phone, and we
   * could not remind anyone about a basket we never saw. So a signed-in basket is copied to the
   * server on every change, and brought back when they sign in somewhere it is empty.
   *
   * Nothing is written until the saved copy has been read for THIS account. Writing first would
   * let a browser that opens with an empty basket wipe the one saved from the other device, which
   * is the one thing this must never do. After that the rule is simple: a browser that already has
   * items keeps them and saves them; an empty one takes the saved basket.
   *
   * Signing out saves nothing and deletes nothing: the basket waits on the account for next time.
   * A free item a coupon added is left out, since the coupon does not travel with it.
   */
  const syncedFor = useRef<string | null>(null);
  const giftLineRef = useRef(giftLineId);
  useEffect(() => { giftLineRef.current = giftLineId; }, [giftLineId]);
  const forServer = useCallback((c: Record<string, CartEntry>) => {
    const out = { ...c };
    if (giftLineRef.current) delete out[giftLineRef.current];
    return out;
  }, []);

  useEffect(() => {
    syncedFor.current = null;
    if (!authId) return;
    let stale = false;
    (async () => {
      let saved: Record<string, CartEntry>;
      try {
        saved = ((await getSavedCart())?.lines || {}) as Record<string, CartEntry>;
      } catch {
        return; // could not read it, so never overwrite it: this visit simply is not saved
      }
      if (stale) return;
      const local = cartRef.current;
      if (!Object.keys(local).length) {
        if (Object.keys(saved).length) setCart(saved);
      } else {
        await putSavedCart(forServer(local)).catch(() => { /* the next change tries again */ });
      }
      if (!stale) syncedFor.current = authId;
    })();
    return () => { stale = true; };
  }, [authId, forServer]);

  useEffect(() => {
    if (!authId || syncedFor.current !== authId) return;
    // Debounced: pressing + five times is one save, not five.
    const t = setTimeout(() => { putSavedCart(forServer(cart)).catch(() => { /* next change retries */ }); }, 1500);
    return () => clearTimeout(t);
  }, [cart, authId, forServer]);

  const count = Object.values(cart).reduce((s, e) => s + e.qty, 0);
  const total = Object.values(cart).reduce((s, e) => s + e.price * e.qty, 0);

  return (
    <CartContext.Provider value={{ cart, count, total, setQty, gift, setGift, giftMessage, setGiftMessage, giftOccasion, setGiftOccasion, addrId, setAddrId, coupon, setCoupon, applied, setApplied, discount, setDiscount, giftLineId, setGiftLineId, clearAll }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
