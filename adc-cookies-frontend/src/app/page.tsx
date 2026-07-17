import AnnouncementBar from '@/components/storefront/AnnouncementBar';
import HomeHero from '@/components/storefront/HomeHero';
import TodaysStall from '@/components/storefront/TodaysStall';
import HomeProducts from '@/components/storefront/HomeProducts';
import StoresAbout from '@/components/storefront/StoresAbout';
import Reviews from '@/components/storefront/Reviews';
import Footer from '@/components/storefront/Footer';
import FloatingDock from '@/components/storefront/FloatingDock';

export default function Home() {
  return (
    <main className="adc-pattern-page home-page" style={{ minHeight: '100vh' }}>
      <AnnouncementBar />
      <HomeHero />
      <TodaysStall />
      <HomeProducts />
      <StoresAbout />
      <Reviews />
      <Footer />

      <FloatingDock />
    </main>
  );
}
