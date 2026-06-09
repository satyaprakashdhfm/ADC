'use client';
import { useState, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Hero from '@/components/storefront/Hero';
import Products from '@/components/storefront/Products';
import Footer from '@/components/storefront/Footer';
import MenuDrawer from '@/components/storefront/MenuDrawer';
import LoginModal from '@/components/ordering/LoginModal';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';

function HomeInner() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn, { passive: true });
    fn();
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div style={{ overflow: 'hidden' }}>
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onLoginOpen={() => setLoginOpen(true)} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />

      <Hero onMenuOpen={() => setMenuOpen(true)} />
      <Products />
      <Footer />

      {/* Sticky Order CTA */}
      <button
        onClick={() => router.push('/order')}
        style={{
          position: 'fixed', right: 28, bottom: 28, zIndex: 70, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, padding: '16px 28px',
          background: 'var(--gradient-warm)', color: '#fff', borderRadius: 'var(--radius-pill)',
          boxShadow: '0 16px 36px rgba(239,117,7,.42)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)',
          transform: scrolled ? 'translateY(0) scale(1)' : 'translateY(160%) scale(.85)',
          opacity: scrolled ? 1 : 0,
          transition: 'all .5s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        <ShoppingBag size={20} /> Order Now
      </button>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <CartProvider>
        <HomeInner />
      </CartProvider>
    </AuthProvider>
  );
}
