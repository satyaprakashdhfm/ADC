import Link from 'next/link';
import Image from 'next/image';
import { Award, Users, MapPin, TrendingUp, Mail, Phone, ArrowRight, MessageCircle, FileText, Store, Hammer, Rocket, ChevronDown, Check, ChefHat, Package, GraduationCap, Megaphone } from 'lucide-react';
import Footer from '@/components/storefront/Footer';
import SiteHeader from '@/components/storefront/SiteHeader';
import EnquiryForm from '@/components/storefront/EnquiryForm';
import LiveCookiesSold from '@/components/storefront/LiveCookiesSold';
import { WhatsAppIcon } from '@/components/icons/SocialIcons';
import { SITE_EMAIL, SITE_PHONE, whatsappLink } from '@/lib/site';
import { STORES } from '@/lib/stores';

export const metadata = {
  title: 'Cookie Franchise | Open an A Dough Cookie Store | a dough cookie',
  description: 'Open an A Dough Cookie franchise in your city. Fresh-baked, 100% eggless cookies, with recipes, supply and training from our team. Send an enquiry.',
  alternates: { canonical: '/franchise' },
};

/*
 * The franchise page, on the home page's rhythm: full-width bands alternating the salmon
 * (--band-ivory) and the cream (--gold), peach cards on the cream, white cards on the salmon, and
 * no big orange blocks. Sections sit side by side so a wide screen is filled across, not scrolled.
 *
 * The cookies-sold figure is the same live counter as the footer. Every other number comes from
 * something we can point to: the store and city counts are read off STORES. Costs are never stated;
 * they depend on the city and the site, and a printed figure would be quoted back to us.
 */

const cities = [...new Set(STORES.map(s => s.city))];
const STATS = [
  { value: String(STORES.length), label: 'Stores' },
  { value: String(cities.length), label: 'Cities' },
  { value: '100%', label: 'Eggless' },
  { value: 'India', label: 'Ships across' },
];

const GET = [
  { icon: <ChefHat size={17} />, t: 'Our recipes and full menu' },
  { icon: <Package size={17} />, t: 'Ingredients and packaging, supplied by us' },
  { icon: <GraduationCap size={17} />, t: 'Training for you and your staff' },
  { icon: <Megaphone size={17} />, t: 'Marketing and launch support' },
];

const WHY = [
  { icon: <Award size={20} />, title: 'A menu people reorder', body: 'Soft-centre cookies and gift tins our customers keep coming back for.' },
  { icon: <Users size={20} />, title: 'A team that has done it', body: 'We opened and run our own stores, and we stay on call once yours opens.' },
  { icon: <MapPin size={20} />, title: 'Help with the site', body: 'We help you find a busy spot in your city and fit it out to our standard.' },
  { icon: <TrendingUp size={20} />, title: 'Orders all year', body: 'Everyday cravings, festival gifting and corporate orders keep stores busy through the year.' },
];

const STEPS = [
  { icon: <FileText size={18} />, t: 'Send your enquiry', d: 'Fill in the form with a little about you and the city you have in mind.' },
  { icon: <MessageCircle size={18} />, t: 'We call you', d: 'We talk you through the model, the numbers for your city and your questions.' },
  { icon: <Hammer size={18} />, t: 'Site and set-up', d: 'We help you pick the site, fit it out, set up supply and train your staff.' },
  { icon: <Rocket size={18} />, t: 'Open your doors', d: 'Your store starts baking and serving, with our team on call while you settle in.' },
];

const FAQ = [
  { q: 'What does a franchise cost?', a: 'It depends on the city, the site and the size of the store. Send the form or call us, and we’ll share the numbers for your location.' },
  { q: 'What do I need to get started?', a: 'A site in a busy area (or the budget to find one with our help), the investment for the fit-out, and someone to run the store day to day.' },
  { q: 'Do I need experience in food or retail?', a: 'It helps, but you don’t need it. We train you and your team on the recipes, the baking and running the counter before you open.' },
  { q: 'How long does it take to open?', a: 'Mostly it depends on finding the site and the fit-out. We give you a timeline for your location on the first call.' },
  { q: 'Are the cookies eggless?', a: 'Yes. Everything on our menu is 100% eggless, and franchise stores bake the same menu we do.' },
];

/* The home page's type and spacing (StoresAbout), so the two pages read as one site. */
const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' };
const heading: React.CSSProperties = { font: '900 clamp(1.5rem,1.1rem + 1.7vw,2.25rem)/1.08 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 12px', color: 'var(--text-strong)' };
const body: React.CSSProperties = { fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--text-body)', margin: '0 0 16px' };
const band = (bg: string, extra?: React.CSSProperties): React.CSSProperties => ({ padding: 'clamp(26px,4.5vw,64px) 0', background: bg, ...extra });
const inner: React.CSSProperties = { maxWidth: 1400, margin: '0 auto', padding: '0 var(--gutter)' };
const split: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 'clamp(22px,3.5vw,48px)', alignItems: 'stretch' };
const col = (basis = 360): React.CSSProperties => ({ flex: `1 1 ${basis}px`, minWidth: 0 });
/* Cards on the cream band: the peach the home page uses for its store and review cards. */
const peachCard: React.CSSProperties = { background: 'var(--peach-300)', border: '1px solid var(--peach-400)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)' };
/* Cards on the salmon band. */
const lightCard: React.CSSProperties = { background: 'var(--surface-page)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)' };
const iconDot = (size = 42): React.CSSProperties => ({ width: size, height: size, flex: 'none', borderRadius: '50%', background: 'var(--gradient-warm)', color: 'var(--white)', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-brand)' });
const pillBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 20px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 800, fontSize: 'var(--text-sm)', textDecoration: 'none', boxShadow: 'var(--shadow-brand)' };
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-card)', border: '1.5px solid var(--border-strong)', color: 'var(--text-strong)', fontWeight: 800, fontSize: 'var(--text-sm)', textDecoration: 'none' };

export default function FranchisePage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />

      {/* ── Hero · salmon band: the pitch and what you get on the left, the form on the right ── */}
      <section style={band('var(--band-ivory)', { borderBottom: '1px solid var(--border-default)' })}>
        <div style={inner}>
          <div style={split}>
            <div style={{ ...col(420), display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <p style={eyebrow}>Cookie franchise</p>
                <h1 style={{ font: '900 clamp(2rem,1.4rem + 3vw,3.4rem)/1.04 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 12px', color: 'var(--text-strong)' }}>
                  Bring A Dough Cookie to <span style={{ color: 'var(--brand-secondary)' }}>your city</span>
                </h1>
                <p style={{ ...body, fontSize: 'var(--text-lg)', maxWidth: 560, margin: 0 }}>
                  Fresh-baked, 100% eggless cookies from Bengaluru. We give you the recipes, the supply and the training, and you run the store.
                </p>
              </div>

              {/* The live count, with the four facts beside it rather than under it. */}
              <div style={{ ...lightCard, padding: '18px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px 28px' }}>
                <div style={{ flex: '1 1 240px' }}>
                  <LiveCookiesSold color="var(--brand-secondary)" labelColor="var(--text-strong)" />
                </div>
                <div style={{ flex: '1 1 220px', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
                  {STATS.map(s => (
                    <div key={s.label} style={{ background: 'var(--peach-100)', borderRadius: 12, padding: '8px 12px' }}>
                      <div style={{ font: '900 var(--text-lg)/1.1 var(--font-display)', color: 'var(--text-strong)' }}>{s.value}</div>
                      <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--orange-800)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ ...eyebrow, marginBottom: 10 }}>What you get</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
                  {GET.map(g => (
                    <div key={g.t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>
                      <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: 'var(--surface-page)', border: '1px solid var(--border-default)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center' }}>{g.icon}</span>
                      {g.t}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href="#enquire" style={pillBtn}>Request franchise details <ArrowRight size={15} /></a>
                <a href={whatsappLink('Hi A Dough Cookie! I’m interested in a franchise.')} target="_blank" rel="noopener noreferrer" style={ghostBtn}>
                  <WhatsAppIcon size={16} /> WhatsApp us
                </a>
              </div>
            </div>

            <div id="enquire" style={{ ...col(380), ...lightCard, borderRadius: 24, padding: 'clamp(20px,3vw,32px)', scrollMarginTop: 90 }}>
              <h2 style={{ ...heading, fontSize: 'clamp(1.3rem,1.1rem + 1vw,1.75rem)', marginBottom: 6 }}>Request franchise details</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.55 }}>
                Tell us about you and your city. Our franchise team will call you back.
              </p>
              <EnquiryForm variant="franchise" bare />
            </div>
          </div>
        </div>
      </section>

      {/* ── Who we are + why us · cream band: photos left, story and reasons right ── */}
      <section style={band('var(--gold)')}>
        <div style={inner}>
          <div style={{ ...split, alignItems: 'center' }}>
            <div style={{ ...col(380), display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
              <div style={{ position: 'relative', aspectRatio: '4 / 5', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
                <Image src="/assets/gallery/ADC3.jpeg" alt="Inside an A Dough Cookie store" fill sizes="(max-width: 800px) 60vw, 380px" style={{ objectFit: 'cover' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateRows: '1fr auto', gap: 12 }}>
                <div style={{ position: 'relative', minHeight: 120, borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
                  <Image src="/assets/gallery/ADC1.jpeg" alt="The front of an A Dough Cookie store" fill sizes="(max-width: 800px) 40vw, 250px" style={{ objectFit: 'cover' }} />
                </div>
                <div style={{ ...peachCard, padding: '14px 12px', textAlign: 'center', display: 'grid', placeItems: 'center' }}>
                  <div>
                    <div style={{ font: '900 clamp(1.6rem,1.2rem + 1.2vw,2.2rem)/1 var(--font-display)', color: 'var(--orange-800)' }}>100%</div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--ink-900)', marginTop: 4 }}>Eggless, every cookie</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={col(420)}>
              <p style={eyebrow}>About us</p>
              <h2 style={heading}>Who we are</h2>
              <p style={body}>
                A Dough Cookie is an eggless cookie bakery from Bengaluru, with stores in {cities.join(' and ')}.
                We bake every cookie fresh in our stores, and our gift tins ship across India. People order at the
                counter, on our website with same-day delivery in the cities we bake in, and in bulk for corporate gifting.
              </p>
              <h3 style={{ font: '900 var(--text-h4)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '6px 0 12px' }}>Why choose us?</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
                {WHY.map(w => (
                  <div key={w.title} style={{ ...peachCard, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={iconDot(40)}>{w.icon}</span>
                    <div>
                      <h4 style={{ font: 'var(--weight-bold) var(--text-base)/1.25 var(--font-display)', color: 'var(--ink-900)', margin: '0 0 3px' }}>{w.title}</h4>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-700)', lineHeight: 1.5, margin: 0 }}>{w.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works · salmon band: the model beside the four steps ── */}
      <section style={band('var(--band-ivory)', { borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' })}>
        <div style={inner}>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto clamp(20px,3vw,32px)' }}>
            <p style={eyebrow}>How it works</p>
            <h2 style={{ ...heading, margin: 0 }}>From enquiry to launch</h2>
          </div>
          <div style={split}>
            <div style={{ ...col(320), ...lightCard, padding: 'clamp(18px,2.5vw,26px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={iconDot(50)}><Store size={22} /></span>
              <div style={{ ...eyebrow, margin: 0 }}>Franchise model</div>
              <h3 style={{ font: '900 var(--text-h4)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>FOFO: franchise owned, franchise operated</h3>
              <p style={{ ...body, margin: 0 }}>
                You own the store and run it day to day. We license you the A Dough Cookie name and give you the
                recipes, the supply of ingredients and packaging, training for your team, and marketing support,
                for an agreed franchise fee and term.
              </p>
              <a href="#enquire" style={{ ...pillBtn, alignSelf: 'flex-start', marginTop: 'auto' }}>Start with step 1 <ArrowRight size={15} /></a>
            </div>
            {/* Two by two beside the model, one column on a phone; never three and an orphan. */}
            <style>{`
              .franchise-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              @media (max-width: 560px) { .franchise-steps { grid-template-columns: 1fr; } }
            `}</style>
            <div className="franchise-steps" style={{ ...col(520), display: 'grid', gap: 12 }}>
              {STEPS.map((s, i) => (
                <div key={s.t} style={{ ...lightCard, padding: 18, position: 'relative', overflow: 'hidden' }}>
                  {/* The step number, large and faint in the corner, so the order reads at a glance. */}
                  <span aria-hidden style={{ position: 'absolute', right: 12, top: 2, font: '900 64px/1 var(--font-display)', color: 'var(--peach-300)', opacity: 0.8 }}>{i + 1}</span>
                  <span style={{ ...iconDot(40), position: 'relative' }}>{s.icon}</span>
                  <div style={{ ...eyebrow, margin: '12px 0 2px', position: 'relative' }}>Step {i + 1}</div>
                  <h4 style={{ font: 'var(--weight-bold) var(--text-lg)/1.25 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px', position: 'relative' }}>{s.t}</h4>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0, position: 'relative' }}>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stores + FAQ · cream band, side by side ── */}
      <section style={band('var(--gold)')}>
        <div style={inner}>
          <div style={split}>
            <div style={col(420)}>
              <p style={eyebrow}>Our stores</p>
              <h2 style={heading}>Where we are today</h2>
              <p style={{ ...body, marginBottom: 14 }}>Your city could be next. Tell us where you want to open in the form.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
                {STORES.map(s => (
                  <a key={s.name} href={s.map} target="_blank" rel="noopener noreferrer"
                    style={{ ...peachCard, display: 'block', overflow: 'hidden', textDecoration: 'none' }}>
                    {s.image && (
                      <div style={{ position: 'relative', aspectRatio: '16 / 10' }}>
                        <Image src={s.image} alt={s.name} fill sizes="(max-width: 700px) 50vw, 260px" style={{ objectFit: 'cover', objectPosition: 'center 72%' }} />
                      </div>
                    )}
                    <div style={{ padding: '9px 12px 11px' }}>
                      <p style={{ fontSize: 'var(--text-2xs)', fontWeight: 900, color: 'var(--orange-800)', textTransform: 'uppercase', letterSpacing: '.08em', margin: 0 }}>{s.city}</p>
                      <div style={{ font: 'var(--weight-bold) var(--text-sm)/1.25 var(--font-display)', color: 'var(--ink-900)' }}>{s.name.replace('A Dough Cookie, ', '')}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div style={col(420)}>
              <p style={eyebrow}>Questions</p>
              <h2 style={heading}>FAQ</h2>
              {/* <details> opens and closes without any script, so this stays a server component. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {FAQ.map((f, i) => (
                  <details key={f.q} open={i === 0} className="franchise-faq" style={{ ...peachCard, padding: '0 16px' }}>
                    <summary style={{ listStyle: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', color: 'var(--ink-900)', fontWeight: 800, fontSize: 'var(--text-base)' }}>
                      <span style={{ flex: 1 }}>{f.q}</span>
                      <span className="franchise-faq-chevron" style={{ width: 28, height: 28, flex: 'none', borderRadius: '50%', background: 'var(--surface-page)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', transition: 'transform .2s' }}><ChevronDown size={16} /></span>
                    </summary>
                    <p style={{ margin: 0, padding: '0 0 14px', color: 'var(--ink-700)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>{f.a}</p>
                  </details>
                ))}
              </div>
              <style>{`
                .franchise-faq summary::-webkit-details-marker { display: none; }
                .franchise-faq[open] .franchise-faq-chevron { transform: rotate(180deg); }
              `}</style>
            </div>
          </div>
        </div>
      </section>

      {/* ── Close · salmon band, one row: the ask on the left, every way to reach us on the right ── */}
      <section style={band('var(--band-ivory)', { borderTop: '1px solid var(--border-default)' })}>
        <div style={inner}>
          <div style={{ ...split, alignItems: 'center' }}>
            <div style={col(360)}>
              <h2 style={{ ...heading, marginBottom: 6 }}>Ready to talk?</h2>
              <p style={{ ...body, margin: 0 }}>
                Send the form and our franchise team will call you, or reach us directly. Looking for a one-off
                bulk order instead? See <Link href="/corporate" style={{ color: 'var(--brand-secondary)', fontWeight: 800 }}>corporate gifting</Link>.
              </p>
            </div>
            <div style={{ ...col(420), display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
              <a href="#enquire" style={pillBtn}><Check size={15} /> Request details</a>
              <a href={whatsappLink('Hi A Dough Cookie! I’m interested in a franchise.')} target="_blank" rel="noopener noreferrer" style={ghostBtn}><WhatsAppIcon size={16} /> WhatsApp</a>
              <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={ghostBtn}><Phone size={15} /> {SITE_PHONE}</a>
              <a href={`mailto:${SITE_EMAIL}`} style={ghostBtn}><Mail size={15} /> Email us</a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
