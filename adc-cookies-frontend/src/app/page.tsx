import AnnouncementBar from '@/components/storefront/AnnouncementBar';
import HomeHero from '@/components/storefront/HomeHero';
import HomeProducts from '@/components/storefront/HomeProducts';
import StoresAbout from '@/components/storefront/StoresAbout';
import Reviews from '@/components/storefront/Reviews';
import Footer from '@/components/storefront/Footer';

/*
 * The hero banner, fetched on the SERVER so it is in the first paint.
 *
 * It used to be fetched only in the browser, after hydration, which meant every visit painted the
 * shipped photograph first and swapped to the banner a moment later. That was tolerable while the
 * banner was only ever a different backdrop behind the same headline. It stopped being tolerable
 * with "show the image on its own": the swap now removes the wordmark, the headline and both
 * buttons, so the flash is a visibly different page rather than a change of photo.
 *
 * revalidate 60 rather than baked in at build: the image URLs are signed and expire (seven days),
 * so a signature captured at build time would die on a deploy that sits for a week — on the one
 * image every visitor sees first. A minute old is fine; HomeHero still re-fetches on mount, so a
 * banner switched on in admin appears immediately rather than waiting out the window.
 *
 * Never throws. If the API is unreachable — including during a build that runs before the backend
 * is up — this is null and the page renders exactly as it did before: shipped photo, full headline.
 */
async function loadHeroBanner() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/products/hero-banner`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function Home() {
  const heroBanner = await loadHeroBanner();
  return (
    <main className="adc-pattern-page home-page" style={{ minHeight: '100vh' }}>
      <AnnouncementBar />
      <HomeHero initialBanner={heroBanner} />
      <HomeProducts />
      <StoresAbout />
      <Reviews />
      <Footer />
    </main>
  );
}
