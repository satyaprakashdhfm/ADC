'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, ArrowRight } from 'lucide-react';
import { getPromoProduct, firstImage, type Product } from '@/lib/api';

/**
 * Home-page promo popup for visitors (e.g. arriving from an Instagram/social link).
 * Full-bleed cookie photo with the offer overlaid. Dummy content for now — designed so
 * the admin can later drive `PROMO` (title, image, CTA). Shows once per browser session.
 */
const PROMO = {
  badge: 'Fresh batch · Trending',
  title: 'Cookies worth the hype.',
  subtitle: '20% off your first order with code FRESH20 — baked fresh, delivered warm.',
  image: '/assets/promo-cookies.jpg',
  ctaLabel: 'Grab the offer',
  ctaHref: '/order?cat=cookies',
};

export default function PromoPopup() {
  const [show, setShow] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { if (sessionStorage.getItem('adc_promo_seen')) return; } catch {}
    getPromoProduct().then(setProduct).catch(() => {});
    const t = setTimeout(() => setShow(true), 700);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setShow(false);
    try { sessionStorage.setItem('adc_promo_seen', '1'); } catch {}
  };

  // Use the admin-selected product when set; otherwise the default promo content.
  const view = product
    ? { badge: PROMO.badge, title: product.name, subtitle: product.description || PROMO.subtitle, image: firstImage(product.images), ctaLabel: PROMO.ctaLabel, ctaHref: `/order?q=${encodeURIComponent(product.name)}` }
    : PROMO;

  // Tapping the popup takes you straight to this product on the order page.
  const goToProduct = () => { close(); router.push(view.ctaHref); };

  if (!show) return null;

  return (
    <div
      onClick={close}
      style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'var(--espresso-55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'loaderFadeIn .25s ease both' }}
    >
      <div
        onClick={e => { e.stopPropagation(); goToProduct(); }}
        className="promo-card"
        style={{ position: 'relative', borderRadius: 'var(--radius-modal)', overflow: 'hidden', boxShadow: '0 40px 90px var(--black-50)', animation: 'riseIn .35s var(--ease-spring) both', cursor: 'pointer' }}
      >
        {/* Full-bleed cookie photo */}
        <Image src={view.image} alt="" fill priority sizes="(max-width:900px) 92vw, 640px" style={{ objectFit: 'cover' }} />

        {/* Warm-dark gradient so the text reads, image still shines at the top */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--espresso-95) 4%, var(--espresso-62) 38%, var(--espresso-10) 70%, var(--espresso-30) 100%)' }} />

        <button onClick={e => { e.stopPropagation(); close(); }} aria-label="Close" style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--black-42)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <X size={18} style={{ color: 'var(--white)' }} />
        </button>

        {/* Offer content, anchored to the bottom */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 'clamp(22px,3.5vw,36px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'clamp(9px,1.2vw,15px)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontSize: 'var(--text-2xs)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>🔥 {view.badge}</span>
          <h2 style={{ font: '900 clamp(1.7rem,1.2rem + 2.4vw,2.9rem)/1.02 var(--font-display)', color: 'var(--white)', margin: 0, letterSpacing: '-.02em', textShadow: '0 2px 16px var(--black-50)' }}>{view.title}</h2>
          <p style={{ fontSize: 'clamp(0.95rem,0.6rem + 0.9vw,1.2rem)', color: 'var(--ivory-92)', lineHeight: 1.5, margin: 0, maxWidth: 540, textShadow: '0 1px 10px var(--black-50)' }}>{view.subtitle}</p>
          <button
            onClick={e => { e.stopPropagation(); goToProduct(); }}
            style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 8, padding: 'clamp(12px,1.3vw,16px) clamp(24px,2.2vw,36px)', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', boxShadow: 'var(--shadow-brand)' }}
          >
            {view.ctaLabel} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
