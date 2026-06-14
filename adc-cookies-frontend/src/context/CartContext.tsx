'use client';
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { addToCart, updateCartItem, removeCartItem, clearCart } from '@/lib/api';

export interface CartEntry { id: string; name: string; price: number; qty: number; img?: string; }

// Flat fee to wrap the whole order as a gift (with an optional message card).
export const GIFT_FEE = 30;

interface CartContextType {
  cart: Record<string, CartEntry>;
  count: number;
  total: number;
  setQty: (id: string, qty: number, name?: string, price?: number, img?: string) => void;
  gift: boolean;
  setGift: (v: boolean) => void;
  giftMessage: string;
  setGiftMessage: (v: string) => void;
  // Checkout selections that must survive navigation between /checkout and /payment.
  addrId: number;
  setAddrId: (v: number) => void;
  coupon: string;
  setCoupon: (v: string) => void;
  applied: boolean;
  setApplied: (v: boolean) => void;
  discount: number;
  setDiscount: (v: number) => void;
  clearAll: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [gift, setGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [addrId, setAddrId] = useState(1);
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState(false);
  const [discount, setDiscount] = useState(0);

  const setQty = useCallback((id: string, qty: number, name?: string, price?: number, img?: string) => {
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
        };
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => { setCart({}); setGift(false); setGiftMessage(''); setCoupon(''); setApplied(false); setDiscount(0); }, []);

  const count = Object.values(cart).reduce((s, e) => s + e.qty, 0);
  const total = Object.values(cart).reduce((s, e) => s + e.price * e.qty, 0);

  return (
    <CartContext.Provider value={{ cart, count, total, setQty, gift, setGift, giftMessage, setGiftMessage, addrId, setAddrId, coupon, setCoupon, applied, setApplied, discount, setDiscount, clearAll }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
