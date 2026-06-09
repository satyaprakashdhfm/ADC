'use client';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import OrderingApp from '@/components/ordering/OrderingApp';

export default function OrderPage() {
  return (
    <AuthProvider>
      <CartProvider>
        <OrderingApp />
      </CartProvider>
    </AuthProvider>
  );
}
