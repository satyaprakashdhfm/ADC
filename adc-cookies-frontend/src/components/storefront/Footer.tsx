'use client';
import Image from 'next/image';
import Link from 'next/link';
import FooterCookies from './FooterCookies';
import { footerHeadingStyle, footerLinkStyle } from './footerStyles';
import { INSTAGRAM_URL, YOUTUBE_URL, LINKEDIN_URL, SITE_EMAIL, SITE_PHONE, whatsappLink } from '@/lib/site';
import { openChatbot } from '@/lib/chatEvents';

const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

export default function Footer() {
  return (
    <footer
      className="site-footer"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--footer-bg)',
        color: 'var(--white)',
        padding: '72px 0 120px',
      }}
    >
      {/* Soft radial glow behind the watermark for depth (Swish-style: the background isn't flat,
          it brightens toward the mark). Sits below the watermark mask, above the base gradient. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '-15%',
          transform: 'translateX(-50%)',
          width: 'min(1400px, 140vw)',
          height: '75%',
          background: 'radial-gradient(ellipse 55% 60% at 50% 100%, var(--amber-500), transparent 70%)',
          opacity: 0.32,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
        }}
      />

      {/* Ghosted brand mark — the ADC logo, anchored to the bottom and bleeding off the base of
          the footer (Swish-style). White fill via a CSS mask so the wordmark shows through as a
          clean, faint watermark against the orange. Kept crisp (barely any blur) and low-opacity
          so it reads as an elegant brand texture, not a loud smear. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 'clamp(-24px, -1.5vw, -8px)',
          transform: 'translateX(-50%)',
          width: 'clamp(340px, 62vw, 620px)',
          height: 'clamp(190px, 30vw, 320px)',
          background: 'var(--white)',
          WebkitMaskImage: 'url(/assets/adc-logo.png)',
          maskImage: 'url(/assets/adc-logo.png)',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'bottom center',
          maskPosition: 'bottom center',
          opacity: 0.18,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
        }}
      />
      {/* Fade the bottom of the watermark into the footer's own background colour (Swish-style
          sink-into-the-page effect) — a plain gradient overlay is more reliable cross-browser
          than stacking a second CSS mask on top of the logo silhouette mask. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '42%',
          background: 'linear-gradient(to bottom, transparent, var(--orange-600) 96%)',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 1,
        }}
      />

      <div style={{ position: 'relative', zIndex: 2 }}>
        <h2 style={srOnly}>a dough cookie</h2>
        <div
          className="footer-grid"
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '0 var(--gutter)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: '32px 40px',
          }}
        >
          {/* Brand block — fills the left side so the link columns don't cluster in the right
              half with a dead gap. On phones this drops to full width above the columns. */}
          <div className="footer-brand" style={{ flex: '1 1 240px', maxWidth: 300 }}>
            {/* The real logo on a white chip. Previously `brightness(0) invert(1)` flattened it to
                a white silhouette, which lost the wordmark's detail against the orange band. */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 16px',
                borderRadius: 18,
                background: 'var(--white)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Image
                src="/assets/adc-logo.png"
                height={52}
                width={88}
                alt="a dough cookie"
                style={{ height: 52, width: 'auto', objectFit: 'contain', display: 'block' }}
              />
            </span>
            <p
              style={{
                color: 'var(--white-72)',
                maxWidth: 260,
                lineHeight: 1.55,
                fontSize: 'var(--text-sm)',
                margin: '14px 0 0',
              }}
            >
              Handcrafted cookies, baked fresh daily. Aroma of Freshness, delivered warm.
            </p>
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
                {items.map(([it, href]) => it === 'FAQs' ? (
                  <button key={it} onClick={openChatbot} className="footer-link" style={{ ...footerLinkStyle, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>{it}</button>
                ) : (
                  <Link key={it} href={href} className="footer-link" style={footerLinkStyle}>{it}</Link>
                ))}
              </div>
            </div>
          ))}

          <div>
            <div style={footerHeadingStyle}>Social</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="footer-link" style={footerLinkStyle}>WhatsApp</a>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="footer-link" style={footerLinkStyle}>Instagram</a>
              <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="footer-link" style={footerLinkStyle}>YouTube</a>
              <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className="footer-link" style={footerLinkStyle}>LinkedIn</a>
            </div>
          </div>
        </div>

        {/* Baseline bar */}
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
