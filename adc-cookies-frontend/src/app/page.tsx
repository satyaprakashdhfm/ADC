'use client';
import { useState } from 'react';
import AnnouncementBar from '@/components/storefront/AnnouncementBar';
import HomeHero from '@/components/storefront/HomeHero';
import StoresAbout from '@/components/storefront/StoresAbout';
import Reviews from '@/components/storefront/Reviews';
import Footer from '@/components/storefront/Footer';
import MenuDrawer from '@/components/storefront/MenuDrawer';
import LoginModal from '@/components/ordering/LoginModal';
import WhatsAppButton from '@/components/storefront/WhatsAppButton';
import PromoPopup from '@/components/storefront/PromoPopup';

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onLoginOpen={() => setLoginOpen(true)} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />

      <AnnouncementBar />
      <HomeHero onMenuOpen={() => setMenuOpen(true)} onLoginOpen={() => setLoginOpen(true)} />
      <StoresAbout />
      <Reviews />
      <Footer />

      <WhatsAppButton />
      <PromoPopup />
    </main>
  );
}
