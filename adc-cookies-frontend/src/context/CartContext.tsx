'use client';
import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import type { PackPick } from '@/lib/api';

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

  const setQty = useCallback((id: string, qty: number, name?: string, price?: number, img?: string, addOns?: string[], note?: string, extra?: { productId?: number; packPicks?: PackPick[] }) => {
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
