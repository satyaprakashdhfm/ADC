'use client';
import Image from 'next/image';
import Link from 'next/link';
import FooterCookies from './FooterCookies';
import CookiesSoldCounter from './CookiesSoldCounter';
import { footerHeadingStyle, footerLinkStyle } from './footerStyles';
import { INSTAGRAM_URL, YOUTUBE_URL, LINKEDIN_URL, SITE_EMAIL, SITE_PHONE, whatsappLink } from '@/lib/site';
import { openChatbot } from '@/lib/chatEvents';
import PaymentMarks from '@/components/icons/PaymentMarks';
import { WhatsAppIcon, InstagramIcon, YouTubeIcon, LinkedInIcon } from '@/components/icons/SocialIcons';

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
        padding: '72px 0 40px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Footer background is clean — the old ghosted-logo watermark + glow were removed per request. */}

      <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h2 style={srOnly}>a dough cookie</h2>

        {/* No nav strip here — it repeated the header link-for-link, which just read as the header
            printed twice. The footer's own columns below already carry the wayfinding. */}

        {/* The columns take whatever height is left over and sit centred in it, so the slack from
            the min-height above is shared above and below them rather than dumped in one block
            between the columns and the baseline. */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div
          className="footer-grid"
          style={{
            width: '100%',
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
            {/* The secondary mark — the round bitten-cookie badge — rather than the wordmark, which
                the navbar already carries at the top of every page.

                Same white treatment as before (crush to black, then invert), and this badge is built
                for it: the "adc" lettering and the stitched border are KNOCKED OUT of the artwork
                rather than painted white, so inverting turns the cookie white and lets the orange
                band read straight through the letters. Its own orange would be invisible here. */}
            <Image
              src="/assets/adc-logo-secondary.png"
              height={104}
              width={109}
              alt="a dough cookie"
              style={{ height: 104, width: 'auto', objectFit: 'contain', display: 'block', filter: 'brightness(0) invert(1)' }}
            />
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

          {/* Social as glyphs, not a fifth column of words. The names carried no information the
              icons don't — everyone recognises them — and four more text links made this column
              read as more site navigation rather than a way out to our channels.
              aria-label carries the name for anyone not seeing the glyph. */}
          <div>
            <div style={footerHeadingStyle}>Social</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {([
                ['WhatsApp', whatsappLink(), <WhatsAppIcon key="w" size={21} />],
                ['Instagram', INSTAGRAM_URL, <InstagramIcon key="i" size={21} />],
                ['YouTube', YOUTUBE_URL, <YouTubeIcon key="y" size={21} />],
                ['LinkedIn', LINKEDIN_URL, <LinkedInIcon key="l" size={21} />],
              ] as [string, string, React.ReactNode][]).map(([label, href, icon]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="footer-social"
                  style={{ color: 'var(--white-82)', display: 'grid', placeItems: 'center', transition: 'color .15s ease, transform .15s ease' }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>
        </div>
        </div>

        {/* Baseline bar — last child, so it sits at the bottom of the footer while the columns
            above absorb the slack. */}
        <div style={{ maxWidth: 1180, margin: '30px auto 0', padding: '15px var(--gutter) 0', borderTop: '1px solid var(--white-16)' }}>
          {/* Live cookies-sold count on its own line (left) so it reads clearly and never sits
              under the floating dock in the bottom-right corner. */}
          <div style={{ marginBottom: 10 }}><CookiesSoldCounter /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px 16px', color: 'var(--white-60)', fontSize: 'var(--text-xs)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px 16px', flexWrap: 'wrap' }}>
              <span>© 2026 a dough cookie. All rights reserved.</span>
              <span>{SITE_EMAIL} · {SITE_PHONE}</span>
            </div>
            <PaymentMarks />
          </div>
        </div>
      </div>
    </footer>
  );
}
