'use client';
import Image from 'next/image';
import Link from 'next/link';
import FooterCookies from './FooterCookies';
import CookiesSoldCounter from './CookiesSoldCounter';
import { footerHeadingStyle, footerLinkStyle } from './footerStyles';
import { INSTAGRAM_URL, YOUTUBE_URL, LINKEDIN_URL, SITE_EMAIL, SITE_PHONE, whatsappLink, COMPANY_NAME } from '@/lib/site';
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
        /* Bottom padding clears the floating cart bar, which is fixed at bottom:20 and ~52 tall and
           was sitting straight over the copyright. Nothing here is allowed to end up underneath it. */
        padding: '72px 0 118px',
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
            {/* Under the secondary mark rather than squeezed between the payment marks and the
                copyright, where it was competing with small print for attention in the busiest strip
                of the footer. This column had the room, and the number is worth more than a gap. */}
            <CookiesSoldCounter />
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
              ['Returns', '/shipping-policy'],
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

          {/* A word from us, rather than a fifth stack of links. Four columns of navigation in a row
              gave the footer nothing but wayfinding; this is the one place the brand gets to speak.
              Copy is deliberately ours, not the reference's — swap the wording freely. */}
          <div className="footer-note" style={{ flex: '1 1 260px', maxWidth: 340 }}>
            <div style={footerHeadingStyle}>Hey there, let&apos;s treat you!</div>
            <p style={{ color: 'var(--white-72)', lineHeight: 1.65, fontSize: 'var(--text-sm)', margin: 0 }}>
              Every cookie is handmade in small batches and baked through the day — never pulled from
              a freezer, never sitting around waiting for you.
            </p>
            {/* The same-day promise used to be stated flat, with no mention that it only holds where
                we actually bake — which read as a broken promise to every outstation customer. Both
                cases are named here, and neither is described as the lesser one. */}
            <p style={{ color: 'var(--white-72)', lineHeight: 1.65, fontSize: 'var(--text-sm)', margin: '14px 0 0' }}>
              In the cities we bake in, order in the morning and it reaches you the same day, still
              warm. Everywhere else in India the same fresh batch travels by courier, so allow it a
              day or two.
            </p>
            <p style={{ color: 'var(--white-72)', lineHeight: 1.65, fontSize: 'var(--text-sm)', margin: '14px 0 0' }}>
              Checkout tells you which applies to your address. That&apos;s the whole idea behind the
              Aroma of Freshness.
            </p>
          </div>
        </div>
        </div>

        {/* Social sits under the columns, centred — as on the reference. As glyphs, not words: the
            names carried nothing the icons don't, and a fifth column of text links read as yet more
            site navigation rather than a way out to our channels.
            aria-label carries the name for anyone not seeing the glyph. */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, flexWrap: 'wrap', padding: '38px var(--gutter) 0' }}>
          {([
            ['WhatsApp', whatsappLink(), <WhatsAppIcon key="w" size={23} />],
            ['Instagram', INSTAGRAM_URL, <InstagramIcon key="i" size={23} />],
            ['YouTube', YOUTUBE_URL, <YouTubeIcon key="y" size={23} />],
            ['LinkedIn', LINKEDIN_URL, <LinkedInIcon key="l" size={23} />],
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

        {/* Baseline band — last child, so it sits at the bottom while the columns absorb the slack.
            Payments and the copyright are centred in their own strip below a full-width rule, as on
            the reference, rather than sharing a row with the contact details. */}
        <div className="footer-baseline" style={{ marginTop: 34, paddingTop: 26, borderTop: '1px solid var(--white-16)' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 var(--gutter)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><PaymentMarks /></div>
            {/* The policies belong at the very bottom, where people look for them, and they have to
                be real pages rather than anchors on Contact — a payment provider checks that these
                URLs exist, and a customer looking for the refund terms is usually already unhappy
                and should not have to hunt. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px 18px', flexWrap: 'wrap' }}>
              {([['Terms of Service', '/terms'], ['Refund Policy', '/refund-policy'], ['Shipping Policy', '/shipping-policy'], ['Privacy Policy', '/privacy'], ['Contact', '/contact']] as [string, string][]).map(([label, href]) => (
                <Link key={href} href={href} className="footer-link" style={{ ...footerLinkStyle, fontSize: 'var(--text-xs)' }}>{label}</Link>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px 16px', color: 'var(--white-60)', fontSize: 'var(--text-xs)', flexWrap: 'wrap' }}>
              <span>© 2026 {COMPANY_NAME}. All rights reserved.</span>
              {/* Real tel:/mailto: links, not text. On a phone the number was something you had to
                  select and copy; now it dials. Spaces stripped from the href only — the visible
                  number keeps them, since that is the readable form. */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                <a href={`mailto:${SITE_EMAIL}`} className="footer-link" style={{ ...footerLinkStyle, fontSize: 'var(--text-xs)' }}>{SITE_EMAIL}</a>
                <span aria-hidden>·</span>
                <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} className="footer-link" style={{ ...footerLinkStyle, fontSize: 'var(--text-xs)' }}>{SITE_PHONE}</a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
