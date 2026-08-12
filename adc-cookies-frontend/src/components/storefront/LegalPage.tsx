import Link from 'next/link';
import SiteHeader from './SiteHeader';
import Footer from './Footer';
import { COMPANY_NAME, HEAD_OFFICE, SITE_EMAIL, SITE_PHONE } from '@/lib/site';

/**
 * The shared frame for Terms, Refund Policy and Privacy Policy.
 *
 * These pages differ only in their words. Giving each its own layout would mean three copies of the
 * same heading sizes and the same contact block, drifting apart the first time one of them is
 * edited — and the one thing legal pages must not do is disagree with each other about who the
 * company is or how to reach it. So the frame lives here and each page supplies only prose.
 */
export interface LegalSection {
  heading: string;
  /** Paragraphs. A string[] entry inside becomes a bulleted list. */
  body: (string | string[])[];
}

export default function LegalPage({ title, intro, updated, sections }: {
  title: string;
  intro: string;
  /** Date this wording last changed, e.g. '12 August 2026'. Shown at the top — a policy with no
   *  date gives the reader no way to know whether it covers the order they placed. */
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />

      <section style={{ padding: '36px var(--gutter) 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <nav aria-label="Breadcrumb" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 16 }}>
            <Link href="/" style={{ color: 'var(--text-link)', fontWeight: 700 }}>Home</Link>
            <span aria-hidden="true"> › </span>
            <span>{title}</span>
          </nav>
          <h1 style={{ font: '900 clamp(2.2rem,1.6rem + 3vw,3.6rem)/1.02 var(--font-display)', letterSpacing: '-.02em', marginBottom: 14 }}>{title}</h1>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.75, color: 'var(--text-body)', marginBottom: 10 }}>{intro}</p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 700 }}>Last updated {updated}</p>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 72px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 30 }}>
          {sections.map((s) => (
            <article key={s.heading}>
              <h2 style={{ font: '900 clamp(1.3rem,1.05rem + 1vw,1.7rem)/1.2 var(--font-display)', color: 'var(--text-strong)', marginBottom: 12 }}>{s.heading}</h2>
              {s.body.map((block, i) =>
                Array.isArray(block) ? (
                  <ul key={i} style={{ margin: '0 0 14px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {block.map((li) => (
                      <li key={li} style={{ fontSize: 'var(--text-base)', lineHeight: 1.8, color: 'var(--text-body)' }}>{li}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={i} style={{ fontSize: 'var(--text-base)', lineHeight: 1.8, color: 'var(--text-body)', marginBottom: 14 }}>{block}</p>
                ),
              )}
            </article>
          ))}

          <article style={{ marginTop: 6, padding: 'clamp(20px,2.6vw,28px)', borderRadius: 18, background: 'var(--panel-86)', border: '1px solid var(--border-default)' }}>
            <h2 style={{ font: '900 var(--text-lg)/1.2 var(--font-display)', marginBottom: 12 }}>Who we are</h2>
            <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.8, color: 'var(--text-body)', margin: 0 }}>
              a dough cookie is operated by {COMPANY_NAME}, {HEAD_OFFICE.address}.<br />
              Email <a href={`mailto:${SITE_EMAIL}`} style={{ color: 'var(--text-link)', fontWeight: 700 }}>{SITE_EMAIL}</a>
              {' · '}Phone <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ color: 'var(--text-link)', fontWeight: 700 }}>{SITE_PHONE}</a>
            </p>
          </article>
        </div>
      </section>

      <Footer />
    </main>
  );
}
