import Link from 'next/link';
import { Award, LifeBuoy, MapPin, TrendingUp, Mail, Phone, ArrowRight } from 'lucide-react';
import Footer from '@/components/storefront/Footer';
import SiteHeader from '@/components/storefront/SiteHeader';
import ContactForm from '@/components/storefront/ContactForm';
import { SITE_EMAIL, SITE_PHONE } from '@/lib/site';

export const metadata = {
  title: 'Partner With Us — Franchise & Bulk Orders | a dough cookie',
  description: 'Open an A Dough Cookie franchise or place a corporate / bulk order — start your enquiry with a dough cookie.',
};

const WHY = [
  { icon: <Award size={20} />, title: 'A brand people love', body: 'Fresh-baked, soft-centre cookies and gift tins customers come back for, week after week.' },
  { icon: <LifeBuoy size={20} />, title: 'Turnkey support', body: 'Recipes, supply, training and marketing — set up and run with our team beside you.' },
  { icon: <MapPin size={20} />, title: 'Prime locations', body: 'We help you find and fit out high-footfall spots in your city.' },
  { icon: <TrendingUp size={20} />, title: 'Year-round demand', body: 'Everyday cravings, gift tins, festivals and corporate gifting keep it busy all year.' },
];

const STEPS = [
  { n: '1', t: 'Send your enquiry', d: 'Fill the form below with a little about you and your city.' },
  { n: '2', t: 'We reach out', d: 'Our team calls to understand your goals and answer questions.' },
  { n: '3', t: 'Plan & set up', d: 'We help with location, fit-out, supply and training.' },
  { n: '4', t: 'Launch 🍪', d: 'Open your doors and start serving warm cookies.' },
];

const eyebrow: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' };
const h2: React.CSSProperties = { font: '900 clamp(1.4rem,1.1rem + 1.4vw,2rem)/1.05 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 10px', color: 'var(--text-strong)' };

export default function FranchisePage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />

      {/* Hero */}
      <section style={{ padding: 'clamp(28px,4vw,52px) var(--gutter) clamp(20px,3vw,32px)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <p style={eyebrow}>Partner with us</p>
          <h1 style={{ font: '900 clamp(1.9rem,1.3rem + 3vw,3.2rem)/1 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 12px' }}>Bring a dough cookie to your city.</h1>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.6, color: 'var(--text-body)', margin: 0 }}>
            Join a growing network of fresh-baked cookie stores. Whether you want to open an A Dough Cookie franchise or place a large corporate / bulk order, we&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Why partner */}
      <section style={{ padding: 'clamp(28px,4vw,52px) 0', background: 'var(--cream-100)', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 var(--gutter)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(20px,3vw,32px)' }}>
            <p style={eyebrow}>Why partner</p>
            <h2 style={h2}>Why choose A Dough Cookie</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 'clamp(14px,2vw,22px)' }}>
            {WHY.map(w => (
              <div key={w.title} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--amber-50)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', marginBottom: 12 }}>{w.icon}</span>
                <h3 style={{ font: 'var(--weight-bold) var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>{w.title}</h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: 'clamp(28px,4vw,52px) 0', background: 'var(--amber-50)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 var(--gutter)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(20px,3vw,32px)' }}>
            <p style={eyebrow}>How it works</p>
            <h2 style={h2}>From enquiry to launch</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 'clamp(14px,2vw,22px)' }}>
            {STEPS.map(s => (
              <div key={s.n} style={{ textAlign: 'center' }}>
                <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gradient-warm)', color: 'var(--white)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', fontWeight: 900, fontSize: 'var(--text-lg)', fontFamily: 'var(--font-display)' }}>{s.n}</span>
                <h3 style={{ font: 'var(--weight-bold) var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px' }}>{s.t}</h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Get in touch / enquiry form */}
      <section style={{ padding: 'clamp(32px,4.5vw,60px) var(--gutter)' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <p style={eyebrow}>Get in touch</p>
          <h2 style={h2}>Start your enquiry</h2>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-body)', lineHeight: 1.6, margin: '0 0 20px' }}>
            Fill the form and our team will reach out. Prefer to talk? Email{' '}
            <a href={`mailto:${SITE_EMAIL}`} style={{ color: 'var(--brand-secondary)', fontWeight: 700 }}>{SITE_EMAIL}</a> or call{' '}
            <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ color: 'var(--brand-secondary)', fontWeight: 700 }}>{SITE_PHONE}</a>.
          </p>
          <div style={{ textAlign: 'left' }}>
            <ContactForm />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 20 }}>
            <a href={`mailto:${SITE_EMAIL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)' }}><Mail size={15} /> {SITE_EMAIL}</a>
            <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)' }}><Phone size={15} /> {SITE_PHONE}</a>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '18px 0 0' }}>
            Looking for a large one-off order instead? <Link href="/order?cat=corporate" style={{ color: 'var(--brand-secondary)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Corporate &amp; bulk gifting <ArrowRight size={14} /></Link>
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
