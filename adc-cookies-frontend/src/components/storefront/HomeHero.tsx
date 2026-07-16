'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import SiteNav from './SiteNav';

const ctaPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 26px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', boxShadow: 'var(--shadow-brand)' };
const ctaGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 26px', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--surface-card)', border: '1.5px solid var(--border-strong)', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)' };

export default function HomeHero() {
  const router = useRouter();
  const scrollToProducts = () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      {/* Full nav (with cart + account) is hidden at the top and slides in after the first scroll */}
      <SiteNav revealOnScroll />

      <section style={{ position: 'relative', minHeight: '78svh', overflow: 'hidden', display: 'grid', placeItems: 'center', padding: 'clamp(56px,8vw,96px) 0' }}>
        {/* Background photo — starts zoomed in, then eases out so the edge cookies drift into frame */}
        <motion.div aria-hidden
          initial={{ scale: 1.18 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <Image src="/assets/hero-cookies.jpg" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'center' }} />
        </motion.div>

        {/* Soft light wash in the centre so the text always reads over the marble */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'radial-gradient(58% 56% at 50% 46%, var(--cream-100-72) 0%, var(--cream-100-30) 52%, transparent 80%)' }} />

        {/* Center content */}
        <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'relative', zIndex: 3, textAlign: 'center', padding: '0 var(--gutter)', maxWidth: 720 }}>
          <Image src="/assets/adc-logo.png" width={360} height={260} alt="a dough cookie" priority style={{ width: 'clamp(160px,22vw,260px)', height: 'auto', margin: '0 auto 8px' }} />
          <h1 style={{ font: '900 clamp(1.9rem,1.4rem + 3.2vw,3.3rem)/1.03 var(--font-display)', letterSpacing: '-.03em', color: 'var(--text-strong)', margin: '0 0 14px', textWrap: 'balance' }}>
            Chunky, gooey cookies — baked fresh, delivered warm.
          </h1>
          <p style={{ fontSize: 'clamp(1rem,.9rem + .4vw,1.15rem)', color: 'var(--text-body)', lineHeight: 1.55, maxWidth: 500, margin: '0 auto 24px', fontWeight: 600 }}>
            Handcrafted in small batches with real butter, couverture chocolate &amp; 100% real fillings.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={scrollToProducts} style={ctaPrimary}>Order Cookies <ArrowRight size={18} /></button>
            <button onClick={() => router.push('/about')} style={ctaGhost}>Our Story</button>
          </div>
        </motion.div>

        {/* Scroll cue */}
        <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 4 }}>
          <motion.button onClick={scrollToProducts} aria-label="Scroll to cookies"
            animate={{ y: [0, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--brand-secondary)' }}>
            <ChevronDown size={22} />
          </motion.button>
        </div>
      </section>
    </>
  );
}
