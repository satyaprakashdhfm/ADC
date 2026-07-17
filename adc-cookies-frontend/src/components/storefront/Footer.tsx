import Image from 'next/image';
import Link from 'next/link';
import FooterCookies from './FooterCookies';
import { footerHeadingStyle, footerLinkStyle } from './footerStyles';
import { INSTAGRAM_URL, YOUTUBE_URL, LINKEDIN_URL, SITE_EMAIL, SITE_PHONE } from '@/lib/site';

export default function Footer() {
  return (
    <footer
      className="site-footer"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--footer-bg)',
        color: 'var(--white)',
        borderRadius: '30px 30px 0 0',
        padding: '40px 0 18px',
      }}
    >
      {/* Giant ghosted brand mark — the ADC logo shape filled with the warm gradient, centred
          in the footer box (both axes). Uses a CSS mask so the gradient shows through the
          logo's own silhouette instead of a flat faded colour. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'clamp(260px, 34vw, 520px)',
          height: 'clamp(190px, 25vw, 380px)',
          background: 'var(--gradient-warm)',
          WebkitMaskImage: 'url(/assets/adc-logo.png)',
          maskImage: 'url(/assets/adc-logo.png)',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          opacity: 0.16,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
        }}
      />

      {/* Waving cookie mascot — bottom-left, near the logo/social where there's open space */}
      <Image
        aria-hidden
        src="/assets/mascots/mascot-4.png"
        alt=""
        width={170}
        height={210}
        className="footer-mascot"
        style={{
          position: 'absolute',
          left: 'clamp(0px, 2vw, 40px)',
          bottom: 0,
          width: 'clamp(120px, 15vw, 190px)',
          height: 'auto',
          opacity: 0.5,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 2 }}>
        <div
          className="footer-grid"
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '0 var(--gutter)',
            display: 'grid',
            gridTemplateColumns: '1.6fr repeat(3,1fr)',
            gap: 26,
          }}
        >
          {/* Brand column */}
          <div>
            <Image
              src="/assets/adc-logo.png"
              height={50}
              width={84}
              alt="a dough cookie"
              style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            />
            <p
              style={{
                color: 'var(--white-72)',
                maxWidth: 250,
                lineHeight: 1.55,
                fontSize: 'var(--text-sm)',
                margin: '14px 0 16px',
              }}
            >
              Handcrafted cookies, baked fresh daily. Aroma of Freshness, delivered warm.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { key: 'ig', label: 'Instagram', href: INSTAGRAM_URL, icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg> },
                { key: 'yt', label: 'YouTube', href: YOUTUBE_URL, icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
                { key: 'li', label: 'LinkedIn', href: LINKEDIN_URL, icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
              ].map(s => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'var(--white-16)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    color: 'var(--white)',
                  }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          <FooterCookies />

          {([
            ['Company', [
              ['Our Story', '/about'],
              ['Blog', '/blogs'],
              ['Order Online', '/#products'],
            ]],
            ['Help', [
              ['Track Order', '/account'],
              ['FAQs', '/contact'],
              ['Contact', '/contact'],
              ['Returns', '/contact'],
            ]],
          ] as [string, [string, string][]][]).map(([h, items]) => (
            <div key={h}>
              <div style={footerHeadingStyle}>{h}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {items.map(([it, href]) => (
                  <Link key={it} href={href} className="footer-link" style={footerLinkStyle}>{it}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Baseline bar — left-aligned so the corner stays clear for the mascot */}
        <div
          style={{
            maxWidth: 1180,
            margin: '30px auto 0',
            padding: '15px var(--gutter) 0',
            borderTop: '1px solid var(--white-16)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px 16px',
            color: 'var(--white-60)',
            fontSize: 'var(--text-xs)',
            flexWrap: 'wrap',
          }}
        >
          <span>© 2026 a dough cookie. All rights reserved.</span>
          <span>{SITE_EMAIL} · {SITE_PHONE}</span>
        </div>
      </div>
    </footer>
  );
}
