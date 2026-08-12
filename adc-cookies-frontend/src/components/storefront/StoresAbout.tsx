'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, ShoppingBag, Mail, Phone, MessageCircle, ChevronDown } from 'lucide-react';
import { STORES } from '@/lib/stores';
import ContactForm from './ContactForm';
import AboutVideo from './AboutVideo';
import InstagramReels from './InstagramReels';
import IngredientsCarousel from './IngredientsCarousel';
import { SITE_EMAIL, SITE_PHONE, whatsappLink } from '@/lib/site';

// Loaded on the client only, same as the locations page does it: Leaflet needs a window, and this
// keeps its CSS and bundle off the homepage's first paint.
const StoreMap = dynamic(() => import('./StoreMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Loading map…</div>
  ),
});

const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' };
const heading: React.CSSProperties = { font: '900 clamp(1.5rem,1.1rem + 1.7vw,2.25rem)/1.08 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 12px', color: 'var(--text-strong)' };
const subhead: React.CSSProperties = { font: '900 clamp(1.3rem,1rem + 1.3vw,1.85rem)/1.1 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 10px', color: 'var(--text-strong)' };
const body: React.CSSProperties = { fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--text-body)', margin: '0 0 16px', maxWidth: 600 };
const link: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 'var(--text-sm)' };

const band = (bg: string, extra?: React.CSSProperties): React.CSSProperties => ({ padding: 'clamp(26px,4.5vw,72px) 0', background: bg, ...extra });
const inner: React.CSSProperties = { maxWidth: 1680, margin: '0 auto', padding: '0 var(--gutter)' };
const split: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px,4vw,56px)', alignItems: 'center' };
const col: React.CSSProperties = { flex: '1 1 320px', minWidth: 0 };
const imgWrap: React.CSSProperties = { position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' };
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 12, color: 'var(--text-strong)', fontWeight: 700, fontSize: 'var(--text-sm)' };
const chipIcon: React.CSSProperties = { width: 38, height: 38, borderRadius: 11, background: 'var(--surface-card)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none', border: '1px solid var(--border-default)' };

// What goes into every cookie — shown between About Us and Our Stores.
// img → public/assets/ingredients/<slug>.jpg (4:3). Optional — a branded number tile shows until
// the photo is dropped in, so the section never renders a broken image.
const INGREDIENTS = [
  { n: '01', title: 'Président Butter', img: '/assets/ingredients/president-butter.jpg', text: 'We use Président Butter, a premium French butter with a higher fat content that gives our cookies their signature gooey centre and soft, melt-in-your-mouth texture.' },
  { n: '02', title: 'Couverture Chocolate', img: '/assets/ingredients/couverture-chocolate.jpg', text: 'Made with imported Couverture Chocolate — known for its high cocoa content and silky finish. This rich, decadent chocolate delivers an intense cocoa flavour in every bite, elevating each cookie to gourmet status.' },
  { n: '03', title: 'Artisanal Flour Blend', img: '/assets/ingredients/artisanal-flour.jpg', text: 'A curated blend of artisanal flours gives the perfect cookie structure and a nuanced, complex flavour profile — the kind of taste and texture only premium flour can deliver.' },
  { n: '04', title: 'Premium Fillings', img: '/assets/ingredients/premium-fillings.jpg', text: 'No compromises, just the best. Stuffed with only 100% real Nutella, Lotus Biscoff, Reese’s Cups and homemade peanut butter — our fillings are never substitutes, they’re the real deal.' },
  { n: '05', title: 'Handcrafted in Small Batches', img: '/assets/ingredients/small-batches.jpg', text: 'Every cookie is handmade in small batches and baked fresh through the day, so each one reaches you warm, soft-centred and never mass-produced.' },
];

function useIsMobile(bp = 760) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const f = () => setM(mq.matches); f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [bp]);
  return m;
}

/** Home page "About Us" — alternating full-width bands: story · finest ingredients · our stores · get in touch.
 *  Desktop keeps the roomy two-column layout; mobile collapses About (small) and Get in Touch (dropdown). */
export default function StoresAbout() {
  const isMobile = useIsMobile();
  const [gtOpen, setGtOpen] = useState(false);

  const contactLinks = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={chip}>
        <span style={{ ...chipIcon, background: 'var(--whatsapp-green)', color: 'var(--white)', border: 'none' }}><MessageCircle size={17} /></span>
        WhatsApp us
      </a>
      <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={chip}>
        <span style={chipIcon}><Phone size={16} /></span>
        {SITE_PHONE}
      </a>
      <a href={`mailto:${SITE_EMAIL}`} style={chip}>
        <span style={chipIcon}><Mail size={16} /></span>
        {SITE_EMAIL}
      </a>
    </div>
  );

  return (
    <>
      {/* ── About us — salmon band ── */}
      <section id="about" style={band('var(--band-ivory)', { borderTop: '1px solid var(--border-default)' })}>
        <div style={inner}>
          {isMobile ? (
            /* Mobile: compact — heading, a small image, a short line, and a link to the full story */
            <div>
              <p style={eyebrow}>About Us</p>
              <h2 style={{ ...heading, marginBottom: 12 }}>A Dough Cookie — baked fresh, served warm.</h2>
              <AboutVideo
                sizes="100vw"
                style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-md)', marginBottom: 12 }}
              />
              <p style={{ ...body, marginBottom: 12 }}>Warm, soft-centre cookies with premium fillings and gift-ready packaging — baked in small batches so every centre stays soft.</p>
              <Link href="/about" style={link}>Read our full story <ArrowRight size={15} /></Link>
            </div>
          ) : (
            <div style={split}>
              <div style={col}>
                <p style={eyebrow}>About Us</p>
                <h2 style={heading}>A Dough Cookie — baked fresh, served warm.</h2>
                <p style={body}>
                  Warm, soft-centre cookies with premium fillings and gift-ready packaging — baked small in small batches so every centre stays soft and every bite smells like the oven.
                </p>
                <p style={body}>
                  From our first kitchen to stores across Bengaluru and Chennai, the idea hasn&apos;t changed — real ingredients, no shortcuts. We bake with Président butter, couverture chocolate and 100% real fillings like Nutella and Lotus Biscoff, in small batches through the day, so what reaches you is warm, soft-centred and never mass-produced.
                </p>
                <p style={body}>
                  Whether it&apos;s a treat for yourself, a gift box for someone you love, or a bulk order for your team, we bake it fresh and deliver it with care.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                  {['Baked fresh daily', 'Premium fillings', 'Gift-ready tins', 'Bulk & corporate'].map(t => (
                    <span key={t} style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-card)', border: '1px solid var(--border-default)', color: 'var(--orange-800)', fontWeight: 700, fontSize: 'var(--text-xs)' }}>{t}</span>
                  ))}
                </div>
                <Link href="/about" style={link}>Read our full story <ArrowRight size={15} /></Link>
              </div>
              <div style={col}>
                <AboutVideo style={{ ...imgWrap, aspectRatio: '16 / 9', maxWidth: 560, marginInline: 'auto' }} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Freshly Baked — the finest ingredients (apricot band) ── */}
      <section id="ingredients" style={band('var(--gold)')}>
        <div style={inner}>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto clamp(22px,3vw,40px)' }}>
            <p style={eyebrow}>Freshly Baked</p>
            <h3 style={heading}>The Finest Ingredients</h3>
            <p style={{ ...body, maxWidth: '100%', margin: 0 }}>Crafted from the best — because extraordinary cookies deserve nothing less.</p>
          </div>
          {/* Sideways auto-scrolling marquee (same as the reviews strip) instead of a tall grid. */}
          <IngredientsCarousel items={INGREDIENTS} />
        </div>
      </section>

      {/* ── ADC on Instagram — reel strip, ivory band ── */}
      <InstagramReels />

      {/* ── Our stores — cream band · image left, details right ── */}
      <section id="stores" style={band('var(--gold)')}>
        <div style={inner}>
          <div style={split}>
            <div style={col}>
              {/* A map, not a photograph of one shop. The heading says "across India" and the list
                  beside it names four places in two cities — a single interior shot answers none of
                  that, while a map showing where they actually are answers all of it at a glance.
                  It frames itself to the pins, so the view is the South India footprint rather than
                  a hardcoded region that would go wrong the day a shop opens elsewhere. */}
              <div style={{ ...imgWrap, background: 'var(--surface-sunken)' }}>
                <StoreMap withHeadOffice />
              </div>
            </div>
            <div style={col}>
              <p style={eyebrow}>Our Stores</p>
              <h3 style={subhead}>Find A Dough Cookie across India</h3>
              <p style={{ ...body, marginBottom: 14 }}>Walk in for warm cookies, or order online for delivery from your nearest store.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {STORES.map(s => (
                  /* Cards in the light-orange the home page alternates its bands with, on the cream
                     band — the same pair Customer Love uses, so both sections read as one rhythm.
                     A peach-400 edge gives the card definition without a grey line. Text darkens
                     to ink: --text-muted was tuned for a near-white card and goes faint here. */
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--peach-400)', borderRadius: 'var(--radius-image)', background: 'var(--peach-300)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-2xs)', fontWeight: 900, color: 'var(--orange-800)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 1px' }}>{s.city}</p>
                      <h4 style={{ font: 'var(--weight-bold) var(--text-sm)/1.2 var(--font-display)', color: 'var(--ink-900)', margin: '0 0 2px' }}>{s.name}</h4>
                      <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-700)', margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address}</p>
                    </div>
                    <Link href={`/locations#store-${s.pincode}`} aria-label={`See ${s.name}`} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 800, fontSize: 'var(--text-2xs)' }}><ShoppingBag size={12} /> View</Link>
                  </div>
                ))}
              </div>
              <Link href="/locations" style={link}>View all locations <ArrowRight size={15} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Get in touch — salmon band · full split on desktop, dropdown on mobile ── */}
      <section id="get-in-touch" style={band('var(--band-ivory)', { borderBottom: '1px solid var(--border-default)' })}>
        <div style={inner}>
          {isMobile ? (
            <div>
              <button
                onClick={() => setGtOpen(o => !o)}
                aria-expanded={gtOpen}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ flex: 1 }}>
                  <span style={{ ...eyebrow, display: 'block', margin: 0 }}>Get in Touch</span>
                  <span style={{ display: 'block', font: 'var(--weight-extra) var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', marginTop: 2 }}>Bulk orders, gifting or a question?</span>
                </span>
                <ChevronDown size={20} color="var(--brand-secondary)" style={{ flex: 'none', transform: gtOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {gtOpen && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {contactLinks}
                  <ContactForm />
                </div>
              )}
            </div>
          ) : (
            <div style={split}>
              <div style={col}>
                <p style={eyebrow}>Get in Touch</p>
                <h3 style={subhead}>Bulk orders, gifting or a question?</h3>
                <p style={{ ...body, marginBottom: 18 }}>Drop your details and our team will get back to you — fast. Or reach us directly:</p>
                {contactLinks}
              </div>
              <div style={col}>
                <ContactForm />
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
