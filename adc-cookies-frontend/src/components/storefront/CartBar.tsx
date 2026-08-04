'use client';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';

/**
 * The floating "N items · ₹X · Checkout" bar — mounted app-wide (in Providers) so it stays
 * consistent on EVERY page while there's something in the cart, not just the homepage. Hidden on
 * the checkout and payment pages themselves, where it would be redundant.
 */
export default function CartBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { count, total } = useCart();
  const hiddenHere = pathname === '/checkout' || pathname === '/payment';
  if (count <= 0 || hiddenHere) return null;
  return (
    <button
      onClick={() => router.push('/checkout')}
      className="home-cart-bar"
      style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 45, display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer', background: 'var(--surface-inverse)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', boxShadow: 'var(--shadow-xl)' }}
    >
      <ShoppingBag size={19} /> {count} item{count === 1 ? '' : 's'} · ₹{total}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, opacity: .95 }}>Checkout <ArrowRight size={17} /></span>
    </button>
  );
}
