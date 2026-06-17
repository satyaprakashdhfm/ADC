'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, ArrowRight } from 'lucide-react';

/**
 * Home-page promo popup shown to visitors (e.g. arriving from an Instagram/social link).
 * Dummy content for now — designed so the admin can later drive `PROMO` (title, image, CTA)
 * from the dashboard/backend. Shows once per browser session; closing returns to the normal page.
 */
const PROMO = {
  badge: 'Bestseller',
  title: 'Festive Gift Tins',
  subtitle: 'Premium filled-cookie tins — ribbon-wrapped and ready to gift. Our most-loved pick right now.',
  image: '/assets/products/m-and-m.jpg',
  ctaLabel: 'Shop Gift Tins',
  ctaHref: '/order?cat=tins',
};

export default function PromoPopup() {
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { if (sessionStorage.getItem('adc_promo_seen')) return; } catch {}
    const t = setTimeout(() => setShow(true), 700);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setShow(false);
    try { sessionStorage.setItem('adc_promo_seen', '1'); } catch {}
  };

  if (!show) return null;

  return (
    <div
      onClick={close}
      style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(20,12,4,.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'loaderFadeIn .25s ease both' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: 'min(400px,92vw)', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', animation: 'riseIn .3s var(--ease-spring) both' }}
      >
        <button onClick={close} aria-label="Close" style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.9)', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <X size={18} color="var(--text-strong)" />
        </button>

        <div style={{ position: 'relative', width: '100%', height: 196 }}>
          <Image src={PROMO.image} alt={PROMO.title} fill sizes="400px" style={{ objectFit: 'cover' }} />
        </div>

        <div style={{ padding: '20px 22px 24px', textAlign: 'center' }}>
          <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>{PROMO.badge}</span>
          <h2 style={{ font: '900 clamp(1.4rem,1.1rem + 1.2vw,1.9rem)/1.05 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 8px', letterSpacing: '-.02em' }}>{PROMO.title}</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.55, margin: '0 0 18px' }}>{PROMO.subtitle}</p>
          <button
            onClick={() => { close(); router.push(PROMO.ctaHref); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 26px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', boxShadow: 'var(--shadow-brand)' }}
          >
            {PROMO.ctaLabel} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
