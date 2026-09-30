import Link from 'next/link';
import Image from 'next/image';
import { Award, LifeBuoy, MapPin, TrendingUp, Mail, Phone, ArrowRight, MessageCircle, FileText, Store, Hammer, Rocket, ChevronDown } from 'lucide-react';
import Footer from '@/components/storefront/Footer';
import SiteHeader from '@/components/storefront/SiteHeader';
import EnquiryForm from '@/components/storefront/EnquiryForm';
import LiveCookiesSold from '@/components/storefront/LiveCookiesSold';
import { SITE_EMAIL, SITE_PHONE, whatsappLink } from '@/lib/site';
import { STORES } from '@/lib/stores';

export const metadata = {
  title: 'Cookie Franchise | Open an A Dough Cookie Store | a dough cookie',
  description: 'Open an A Dough Cookie franchise in your city. Fresh-baked, 100% eggless cookies, with recipes, supply and training from our team. Send an enquiry.',
  alternates: { canonical: '/franchise' },
};

/*
 * The franchise page, laid out the way franchise enquirers expect to read one: who we are, why us,
 * how it works, where we already are, the questions everyone asks, and the form.
 *
 * In our own colours: the warm orange of the header for the two bands that carry the pitch, cream
 * and amber for the rest. The cookies-sold figure is the same live counter as the footer.
 *
 * Every other number comes from something we can point to. The store and city counts are read off
 * STORES, so opening a store updates the page without anyone remembering to. Costs are never
 * stated: they depend on the city and the site, and a figure printed here would be quoted back to
 * us as a promise.
 */

const cities = new Set(STORES.map(s => s.city));
const STATS = [
  { value: String(STORES.length), label: 'Stores' },
  { value: String(cities.size), label: 'Cities' },
  { value: '100%', label: 'Eggless' },
  { value: 'India', label: 'Ships across' },
];

const WHY = [
  { icon: <Award size={22} />, title: 'A brand people come back to', body: 'Fresh-baked, soft-centre cookies and gift tins that customers reorder week after week.' },
  { icon: <LifeBuoy size={22} />, title: 'Support from day one', body: 'Recipes, supply, training and marketing. You run the store with our team behind you.' },
  { icon: <MapPin size={22} />, title: 'Help with the site', body: 'We help you find a busy spot in your city and fit it out to our standard.' },
  { icon: <TrendingUp size={22} />, title: 'Busy all year', body: 'Everyday cravings, festivals and corporate gifting keep orders coming in every season.' },
];

const STEPS = [
  { icon: <FileText size={18} />, t: 'Send your enquiry', d: 'Fill in the form with a little about you and the city you have in mind.' },
  { icon: <MessageCircle size={18} />, t: 'We call you', d: 'We talk you through the model, the numbers for your city and your questions.' },
  { icon: <Hammer size={18} />, t: 'Site and set-up', d: 'We help you pick the site, fit it out, set up supply and train your staff.' },
  { icon: <Rocket size={18} />, t: 'Open your doors', d: 'Your store starts baking and serving, with our team on call while you settle in.' },
];

const FAQ = [
  { q: 'What does a franchise cost?', a: 'It depends on the city, the site and the size of the store. Send the form, or call us, and we will share the numbers for your location.' },
  { q: 'What do I need to get started?', a: 'A site in a busy area (or the budget to find one with our help), the investment for the fit-out, and someone to run the store day to day.' },
  { q: 'Do I need experience in food or retail?', a: 'It helps, but it is not required. We train you and your team on the recipes, the baking and running the counter before you open.' },
  { q: 'How long does it take to open?', a: 'It depends mostly on finding the site and the fit-out. We give you a timeline for your location on the first call.' },
  { q: 'Are the cookies eggless?', a: 'Yes. Everything on our menu is 100% eggless, and franchise stores bake the same menu we do.' },
];

const eyebrow: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' };
const h2: React.CSSProperties = { font: '900 clamp(1.6rem,1.2rem + 1.8vw,2.4rem)/1.08 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 12px', color: 'var(--text-strong)' };
const wrap: React.CSSProperties = { maxWidth: 1160, margin: '0 auto' };
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 'clamp(24px,4vw,48px)', alignItems: 'center' };
const section = (background: string): React.CSSProperties => ({ padding: 'clamp(40px,6vw,76px) var(--gutter)', background });
const center: React.CSSProperties = { textAlign: 'center', marginBottom: 'clamp(22px,3vw,36px)' };
const card: React.CSSProperties = { background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)' };

export default function FranchisePage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />

      {/* Hero: the pitch and the live count on the left, the form on the right, so someone who
          already knows why they came can enquire without scrolling. */}
      <section style={section('var(--gradient-warm)')}>
        <div style={{ ...wrap, ...twoCol, alignItems: 'stretch' }}>
          <div style={{ border: '1.5px solid rgba(255,255,255,.45)', borderRadius: 28, padding: 'clamp(24px,4vw,44px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(255,255,255,.08)' }}>
            <p style={{ ...eyebrow, color: 'var(--white)', opacity: 0.92 }}>Cookie franchise</p>
            <h1 style={{ font: '900 clamp(2.1rem,1.4rem + 3.4vw,3.8rem)/1.02 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 16px', color: 'var(--white)' }}>
              Bring A Dough Cookie to <span style={{ color: 'var(--ink-900)' }}>your city</span>
            </h1>
            <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 18 }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--white)' }} />)}
              <span style={{ width: 110, height: 4, borderRadius: 4, background: 'var(--white)' }} />
            </div>
            <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.6, color: 'var(--white)', margin: '0 0 28px', maxWidth: 520 }}>
              Fresh-baked, 100% eggless cookies from Bengaluru. We bring the recipes, the supply and the training; you bring the store.
            </p>
            <LiveCookiesSold color="var(--white)" labelColor="var(--ink-900)" />
          </div>

          <div id="enquire" style={{ background: 'var(--surface-page)', color: 'var(--text-body)', borderRadius: 28, padding: 'clamp(22px,3.5vw,36px)', scrollMarginTop: 90, boxShadow: 'var(--shadow-xl)' }}>
            <h2 style={{ ...h2, fontSize: 'clamp(1.4rem,1.1rem + 1.2vw,1.9rem)' }}>Request franchise details</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.55 }}>
              Tell us about you and your city. Our franchise team will call you back.
            </p>
            <EnquiryForm variant="franchise" bare />
          </div>
        </div>
      </section>

      {/* Who we are */}
      <section style={section('transparent')}>
        <div style={{ ...wrap, maxWidth: 900, textAlign: 'center' }}>
          <p style={eyebrow}>About us</p>
          <h2 style={h2}>Who we are</h2>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.7, color: 'var(--text-body)', margin: '0 0 14px' }}>
            A Dough Cookie is an eggless cookie bakery from Bengaluru, with stores in{' '}
            {[...cities].join(' and ')}. Every cookie is baked fresh in our stores, and our gift tins ship
            across India.
          </p>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.7, color: 'var(--text-body)', margin: '0 0 clamp(28px,4vw,40px)' }}>
            Customers order at the counter, on our website with same-day delivery in the cities we bake in,
            and in bulk for corporate gifting.
          </p>
          {/* Two by two on a phone, one row of four from tablet up, never three and an orphan. */}
          <style>{`
            .franchise-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            @media (min-width: 720px) { .franchise-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
          `}</style>
          <div className="franchise-stats" style={{ display: 'grid', gap: 16 }}>
            {STATS.map(s => (
              <div key={s.label} style={{ ...card, padding: '20px 12px' }}>
                <div style={{ font: '900 clamp(1.8rem,1.3rem + 1.6vw,2.6rem)/1 var(--font-display)', color: 'var(--brand-secondary)' }}>{s.value}</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-strong)', marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section style={section('var(--amber-100)')}>
        <div style={{ ...wrap, ...twoCol }}>
          <div style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: 24, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
            <Image src="/assets/gallery/ADC3.jpeg" alt="Inside an A Dough Cookie store" fill sizes="(max-width: 900px) 100vw, 560px" style={{ objectFit: 'cover' }} />
          </div>
          <div>
            <p style={eyebrow}>Why partner</p>
            <h2 style={h2}>Why choose us?</h2>
            <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.7, color: 'var(--text-body)', margin: '0 0 26px' }}>
              You start with a menu people already love and a team that has opened and run these stores itself.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 22 }}>
              {WHY.map(w => (
                <div key={w.title}>
                  <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gradient-warm)', color: 'var(--white)', display: 'grid', placeItems: 'center', marginBottom: 12, boxShadow: 'var(--shadow-sm)' }}>{w.icon}</span>
                  <h3 style={{ font: 'var(--weight-bold) var(--text-lg)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>{w.title}</h3>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works: the model and the steps to open, in one place. The model is the arrangement,
          the steps are how you get into it, and reading them apart made people scroll back. */}
      <section style={section('transparent')}>
        <div style={wrap}>
          <div style={center}>
            <p style={eyebrow}>How it works</p>
            <h2 style={h2}>From enquiry to launch</h2>
          </div>
          <div style={{ ...card, borderRadius: 28, padding: 'clamp(22px,3.5vw,40px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))', gap: 'clamp(24px,4vw,48px)' }}>
            {/* The model */}
            <div style={{ background: 'var(--amber-50)', borderRadius: 20, padding: 'clamp(20px,3vw,30px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--gradient-warm)', color: 'var(--white)', display: 'grid', placeItems: 'center' }}><Store size={24} /></span>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--brand-secondary)' }}>Franchise model</div>
              <h3 style={{ font: '900 var(--text-h4)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>
                FOFO: franchise owned, franchise operated
              </h3>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-body)', lineHeight: 1.65, margin: 0 }}>
                You own the store and run it day to day. We license you the A Dough Cookie name and give you the
                recipes, the supply of ingredients and packaging, training for your team, and marketing support,
                for an agreed franchise fee and term.
              </p>
              <a href="#enquire" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 'auto', padding: '11px 20px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 800, fontSize: 'var(--text-sm)', textDecoration: 'none' }}>
                Start with step 1 <ArrowRight size={15} />
              </a>
            </div>

            {/* The steps, as a timeline: one line down the left joining the numbered markers. */}
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
              <span aria-hidden style={{ position: 'absolute', left: 21, top: 22, bottom: 22, width: 2, background: 'var(--amber-200)' }} />
              {STEPS.map((s, i) => (
                <li key={s.t} style={{ position: 'relative', display: 'flex', gap: 16, paddingBottom: i === STEPS.length - 1 ? 0 : 24 }}>
                  <span style={{ width: 44, height: 44, flex: 'none', borderRadius: '50%', background: 'var(--surface-card)', border: '2px solid var(--brand-secondary)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', position: 'relative', zIndex: 1 }}>{s.icon}</span>
                  <div style={{ paddingTop: 2 }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--brand-secondary)' }}>Step {i + 1}</div>
                    <h3 style={{ font: 'var(--weight-bold) var(--text-lg)/1.25 var(--font-display)', color: 'var(--text-strong)', margin: '2px 0 4px' }}>{s.t}</h3>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Where we are today */}
      <section style={section('var(--gradient-warm)')}>
        <div style={wrap}>
          <div style={center}>
            <h2 style={{ ...h2, color: 'var(--white)' }}>Where we are <span style={{ color: 'var(--ink-900)' }}>today</span></h2>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--white)', margin: 0 }}>
              Your city could be next. Tell us where you want to open in the form.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18 }}>
            {STORES.map(s => (
              <a key={s.name} href={s.map} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', background: 'var(--surface-page)', borderRadius: 20, overflow: 'hidden', textDecoration: 'none', color: 'var(--text-body)', boxShadow: 'var(--shadow-md)' }}>
                {s.image && (
                  <div style={{ position: 'relative', aspectRatio: '4 / 3' }}>
                    <Image src={s.image} alt={s.name} fill sizes="(max-width: 700px) 100vw, 280px" style={{ objectFit: 'cover', objectPosition: 'center 70%' }} />
                  </div>
                )}
                <div style={{ padding: '14px 16px 16px' }}>
                  <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-base)' }}>{s.name.replace('A Dough Cookie, ', '')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 3 }}><MapPin size={13} /> {s.city}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ: <details> opens and closes without any script, so this stays a server component. */}
      <section style={section('transparent')}>
        <div style={{ ...wrap, maxWidth: 900 }}>
          <div style={center}>
            <p style={eyebrow}>Questions</p>
            <h2 style={h2}>FAQ</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQ.map((f, i) => (
              <details key={f.q} open={i === 0} className="franchise-faq" style={{ ...card, borderRadius: 18, padding: '0 clamp(16px,2.5vw,24px)' }}>
                <summary style={{ listStyle: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '17px 0', color: 'var(--text-strong)', fontWeight: 800, fontSize: 'var(--text-base)' }}>
                  <span style={{ flex: 1 }}>{f.q}</span>
                  <span className="franchise-faq-chevron" style={{ width: 30, height: 30, flex: 'none', borderRadius: '50%', background: 'var(--amber-50)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', transition: 'transform .2s' }}><ChevronDown size={17} /></span>
                </summary>
                <p style={{ margin: 0, padding: '0 0 18px', color: 'var(--text-body)', fontSize: 'var(--text-base)', lineHeight: 1.65 }}>{f.a}</p>
              </details>
            ))}
          </div>
          <style>{`
            .franchise-faq summary::-webkit-details-marker { display: none; }
            .franchise-faq[open] { border-color: var(--brand-secondary); }
            .franchise-faq[open] .franchise-faq-chevron { transform: rotate(180deg); }
          `}</style>
        </div>
      </section>

      {/* Close: back to the form, or a person. */}
      <section style={{ ...section('transparent'), paddingTop: 0 }}>
        <div style={{ ...wrap, maxWidth: 760, textAlign: 'center', borderRadius: 28, padding: 'clamp(26px,4vw,44px)', background: 'var(--amber-100)' }}>
          <h2 style={h2}>Ready to talk?</h2>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-body)', lineHeight: 1.6, margin: '0 0 22px' }}>
            Send the form and our franchise team will call you, or reach us directly.
          </p>
          <a href="#enquire" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 26px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 800, textDecoration: 'none' }}>
            Request franchise details <ArrowRight size={16} />
          </a>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 22 }}>
            <a href={whatsappLink('Hi! I’m interested in an A Dough Cookie franchise.')} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--whatsapp-green)', fontWeight: 800, fontSize: 'var(--text-sm)' }}><MessageCircle size={15} /> WhatsApp us</a>
            <a href={`mailto:${SITE_EMAIL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)' }}><Mail size={15} /> {SITE_EMAIL}</a>
            <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)' }}><Phone size={15} /> {SITE_PHONE}</a>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '18px 0 0' }}>
            Looking for a large one-off order instead? <Link href="/corporate" style={{ color: 'var(--brand-secondary)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Corporate &amp; bulk gifting <ArrowRight size={14} /></Link>
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
