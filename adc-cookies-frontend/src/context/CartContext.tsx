'use client';
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { addToCart, updateCartItem, removeCartItem, clearCart } from '@/lib/api';

export interface CartEntry { id: string; name: string; price: number; qty: number; img?: string; }

interface CartContextType {
  cart: Record<string, CartEntry>;
  count: number;
  total: number;
  setQty: (id: string, qty: number, name?: string, price?: number, img?: string) => void;
  clearAll: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Record<string, CartEntry>>({});

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

  const clearAll = useCallback(() => setCart({}), []);

  const count = Object.values(cart).reduce((s, e) => s + e.qty, 0);
  const total = Object.values(cart).reduce((s, e) => s + e.price * e.qty, 0);

  return (
    <CartContext.Provider value={{ cart, count, total, setQty, clearAll }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
