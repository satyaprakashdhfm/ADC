import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Phone, ArrowRight, Truck, Clock } from 'lucide-react';
import RichText from './RichText';
import { STORES } from '@/lib/stores';
import { fillPrices, rupees, tinsOf, type MenuItem } from '@/lib/seo/menu';
import { pageCard } from '@/lib/seo/pages';

/*
 * The pieces every search page is built from. Server components only: nothing here needs the
 * browser, so the pages ship as plain HTML and stay fast on a phone.
 */

export const seoStyles = {
  h2: { font: '900 clamp(1.6rem,1.15rem + 1.9vw,2.4rem)/1.1 var(--font-display)', letterSpacing: '-.02em', color: 'var(--text-strong)', margin: '0 0 14px' } as React.CSSProperties,
  h3: { font: '900 var(--text-lg)/1.25 var(--font-display)', color: 'var(--text-strong)', margin: '26px 0 8px' } as React.CSSProperties,
  para: { fontSize: 'var(--text-base)', lineHeight: 1.85, color: 'var(--text-body)', margin: '0 0 18px' } as React.CSSProperties,
  card: { background: 'var(--vanilla)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' } as React.CSSProperties,
  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 30px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 900, boxShadow: 'var(--shadow-brand)' } as React.CSSProperties,
  secondaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 30px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-strong)', color: 'var(--text-strong)', fontWeight: 800 } as React.CSSProperties,
};

/** JSON-LD as a script tag. `<` is escaped because JSON.stringify does not, and this lands in HTML. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export function Breadcrumbs({ trail }: { trail: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 16 }}>
      {trail.map((c, i) => (
        <span key={c.name}>
          {i > 0 && <span aria-hidden="true"> › </span>}
          {c.href ? <Link href={c.href} style={{ color: 'var(--text-link)', fontWeight: 700 }}>{c.name}</Link> : <span>{c.name}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Buttons({ primary, secondary }: { primary: { label: string; href: string }; secondary?: { label: string; href: string } }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '6px 0 18px' }}>
      <Link href={primary.href} style={seoStyles.primaryBtn}>{primary.label} <ArrowRight size={17} /></Link>
      {secondary && <Link href={secondary.href} style={seoStyles.secondaryBtn}>{secondary.label}</Link>}
    </div>
  );
}

/**
 * Gift tins from the live menu. Each card links to the tin on the menu (`/?q=`) rather than to
 * /order, which robots.txt disallows, so the link also counts for the page it points at.
 */
export function TinGrid({ menu, ids }: { menu: MenuItem[]; ids?: number[] }) {
  const tins = ids ? ids.map(id => menu.find(m => m.id === id)).filter((m): m is MenuItem => !!m) : tinsOf(menu);
  if (!tins.length) return null;
  return (
    // 160px columns: two tins side by side on a phone instead of four full-width cards in a row.
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'clamp(10px,1.8vw,18px)', margin: '8px 0 22px' }}>
      {tins.map(t => (
        <Link key={t.id} href={`/?q=${encodeURIComponent(t.name)}`} style={{ ...seoStyles.card, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: 'var(--surface-sunken)' }}>
            <Image src={t.image} alt={`${t.name} from a dough cookie`} fill sizes="(max-width: 760px) 50vw, 260px" style={{ objectFit: 'cover' }} />
          </div>
          <div style={{ padding: 'clamp(12px,1.6vw,16px)', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <h3 style={{ font: '900 var(--text-base)/1.25 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>{t.name}</h3>
            <span style={{ fontWeight: 900, color: 'var(--brand-secondary)' }}>{rupees(t.price)}</span>
            <p style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>{t.description}</p>
            <span style={{ marginTop: 'auto', paddingTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-2xs)', fontWeight: 800, color: t.ships ? 'var(--green-success, #1a7f4b)' : 'var(--brand-secondary)' }}>
              {t.ships ? <Truck size={13} /> : <Clock size={13} />}
              {t.ships ? 'Ships across India' : 'Same day in Bengaluru & Chennai only'}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function StoreGrid({ city }: { city: 'Bengaluru' | 'Chennai' }) {
  const stores = STORES.filter(s => s.city === city);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'clamp(12px,1.8vw,20px)', margin: '8px 0 22px' }}>
      {stores.map(s => (
        <article key={s.pincode} style={{ ...seoStyles.card, display: 'flex', flexDirection: 'column' }}>
          {s.image && (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: 'var(--surface-sunken)' }}>
              <Image src={s.image} alt={`${s.name} store front`} fill sizes="(max-width: 760px) 100vw, 340px" style={{ objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            <h3 style={{ font: '900 var(--text-lg)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>{s.name.replace('A Dough Cookie, ', '')}</h3>
            <p style={{ display: 'flex', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.6, margin: 0 }}>
              <MapPin size={16} style={{ flex: 'none', marginTop: 2, color: 'var(--brand-secondary)' }} />
              <span>{s.address}</span>
            </p>
            <p style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--text-sm)', margin: 0 }}>
              <Phone size={16} style={{ flex: 'none', color: 'var(--brand-secondary)' }} />
              <a href={`tel:${s.phone.replace(/\s/g, '')}`} style={{ color: 'var(--text-link)', fontWeight: 700 }}>{s.phone}</a>
            </p>
            <a href={s.map} target="_blank" rel="noopener noreferrer" style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--brand-secondary)' }}>
              Get directions <ArrowRight size={15} />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

/** The visible half of the FAQPage schema: the same questions, the same answers. */
export function FaqList({ faqs, menu }: { faqs: { q: string; a: string }[]; menu: MenuItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 860 }}>
      {faqs.map(f => (
        <details key={f.q} style={{ padding: '18px 20px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-default)', background: 'var(--vanilla)' }}>
          <summary style={{ font: '800 var(--text-base)/1.4 var(--font-body)', color: 'var(--text-strong)', cursor: 'pointer' }}>{f.q}</summary>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.8, color: 'var(--text-body)', margin: '12px 0 0' }}><RichText text={fillPrices(f.a, menu)} /></p>
        </details>
      ))}
    </div>
  );
}

export function RelatedPages({ paths, title = 'Keep reading' }: { paths: string[]; title?: string }) {
  const cards = paths.map(pageCard).filter(c => !!c);
  if (!cards.length) return null;
  return (
    <div>
      <h2 style={seoStyles.h2}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'clamp(12px,1.8vw,18px)', marginTop: 18 }}>
        {cards.map(c => (
          <Link key={c.path} href={c.path} style={{ ...seoStyles.card, display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: 'var(--surface-sunken)' }}>
              <Image src={c.image.src} alt={c.image.alt} fill sizes="(max-width: 760px) 100vw, 280px" style={{ objectFit: 'cover' }} />
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <h3 style={{ font: '900 var(--text-base)/1.25 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>{c.name}</h3>
              <p style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>{c.excerpt}</p>
              <span style={{ marginTop: 'auto', paddingTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--brand-secondary)' }}>Read <ArrowRight size={14} /></span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
