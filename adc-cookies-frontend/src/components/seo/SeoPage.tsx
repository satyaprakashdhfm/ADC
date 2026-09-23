import Image from 'next/image';
import SiteHeader from '@/components/storefront/SiteHeader';
import Footer from '@/components/storefront/Footer';
import OrderCta from '@/components/storefront/OrderCta';
import RichText from './RichText';
import { Breadcrumbs, Buttons, FaqList, JsonLd, RelatedPages, StoreGrid, TinGrid, seoStyles } from './SeoParts';
import { fillPrices, getCourierFee, type MenuItem } from '@/lib/seo/menu';
import { seoJsonLd } from '@/lib/seo/meta';
import type { Block, SeoPageContent } from '@/lib/seo/types';

/*
 * One layout for every search page in lib/seo/pages.
 *
 * A landing page (a buying search: "cookie tins near me") runs full width with alternating bands,
 * like /best-cookies-in-bangalore. An article (a guide under /blogs) is a single reading column,
 * because long text is easier to read at about 70 characters a line.
 *
 * Every heading level is fixed by the template: one H1 (the page's h1), an H2 per section, H3s
 * inside. Pages only supply words, so none of them can end up with two H1s or a skipped level.
 */

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

function readMinutes(page: SeoPageContent) {
  const words = [
    ...page.intro,
    ...page.sections.flatMap(s => [s.h2, ...s.blocks.flatMap(b => (b.kind === 'p' || b.kind === 'h3' ? [b.text] : b.kind === 'list' ? b.items : []))]),
    ...page.faqs.flatMap(f => [f.q, f.a]),
  ].join(' ').split(/\s+/).length;
  return Math.max(2, Math.round(words / 200));
}

function BlockView({ block, menu }: { block: Block; menu: MenuItem[] }) {
  const t = (s: string) => <RichText text={fillPrices(s, menu)} />;
  switch (block.kind) {
    case 'p':
      return <p style={seoStyles.para}>{t(block.text)}</p>;
    case 'h3':
      return <h3 style={seoStyles.h3}>{fillPrices(block.text, menu)}</h3>;
    case 'list':
      return (
        <ul style={{ ...seoStyles.para, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {block.items.map(item => <li key={item}>{t(item)}</li>)}
        </ul>
      );
    case 'tins':
      return <TinGrid menu={menu} ids={block.ids} />;
    case 'stores':
      return <StoreGrid city={block.city} />;
    case 'note':
      return (
        <div style={{ padding: 'clamp(16px,2.2vw,22px)', borderRadius: 'var(--radius-card)', background: 'var(--amber-50)', border: '1.5px solid var(--amber-300)', margin: '4px 0 20px' }}>
          <p style={{ font: '900 var(--text-base)/1.3 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>{block.title}</p>
          <p style={{ ...seoStyles.para, marginBottom: 0 }}>{t(block.text)}</p>
        </div>
      );
    case 'image':
      return (
        <figure style={{ margin: '6px 0 22px' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: `${block.image.width} / ${block.image.height}`, borderRadius: 'var(--radius-card)', overflow: 'hidden', background: 'var(--surface-sunken)' }}>
            <Image src={block.image.src} alt={block.image.alt} fill sizes="(max-width: 800px) 100vw, 760px" style={{ objectFit: 'cover' }} />
          </div>
          {block.caption && <figcaption style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 8 }}>{block.caption}</figcaption>}
        </figure>
      );
    case 'buttons':
      return <Buttons primary={block.primary} secondary={block.secondary} />;
  }
}

export default async function SeoPage({ page, menu }: { page: SeoPageContent; menu: MenuItem[] }) {
  // Only the product markup uses it, and only on a page that lists tins; cached for the hour like the menu.
  const courierFee = page.listsTins ? await getCourierFee() : undefined;
  const isArticle = page.kind === 'article';
  const width = isArticle ? 780 : 1080;
  const wrap: React.CSSProperties = { maxWidth: width, margin: '0 auto', padding: '0 var(--gutter)' };
  const band = (i: number): React.CSSProperties =>
    !isArticle && i % 2 === 0
      ? { background: 'var(--gold)', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }
      : {};
  const sectionPad = isArticle ? 'clamp(16px,2.4vw,28px) 0' : 'clamp(38px,5vw,64px) 0';

  return (
    <main style={{ background: 'var(--surface-page)' }}>
      <JsonLd data={seoJsonLd(page, menu, courierFee)} />
      <SiteHeader />

      <article>
        <header style={{ padding: 'clamp(28px,4vw,48px) 0 clamp(18px,2.6vw,30px)' }}>
          <div style={wrap}>
            <Breadcrumbs trail={isArticle ? [{ name: 'Home', href: '/' }, { name: 'Blog', href: '/blogs' }, { name: page.name }] : [{ name: 'Home', href: '/' }, { name: page.name }]} />
            {isArticle && (
              <p style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 12px' }}>
                <span style={{ color: 'var(--brand-secondary)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Guide</span>
                <span aria-hidden="true">·</span>
                <time dateTime={page.updated}>{longDate(page.updated)}</time>
                <span aria-hidden="true">·</span>
                <span>{readMinutes(page)} min read</span>
              </p>
            )}
            <h1 style={{ font: `900 ${isArticle ? 'clamp(1.9rem,1.3rem + 2.6vw,3rem)' : 'clamp(2rem,1.3rem + 3vw,3.4rem)'}/1.06 var(--font-display)`, letterSpacing: '-.03em', color: 'var(--text-strong)', margin: '0 0 18px', maxWidth: 900 }}>
              {page.h1}
            </h1>
            {page.intro.map(p => (
              <p key={p.slice(0, 40)} style={{ ...seoStyles.para, fontSize: 'var(--text-lg)', maxWidth: 800 }}><RichText text={fillPrices(p, menu)} /></p>
            ))}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--radius-card)', overflow: 'hidden', margin: '22px 0 26px', background: 'var(--surface-sunken)' }}>
              <Image src={page.hero.src} alt={page.hero.alt} fill priority sizes={`(max-width: ${width}px) 100vw, ${width}px`} style={{ objectFit: 'cover' }} />
            </div>
            {page.answer && (
              <div style={{ padding: 'clamp(18px,2.4vw,26px)', borderRadius: 'var(--radius-card)', background: 'var(--amber-50)', border: '1.5px solid var(--amber-300)' }}>
                <h2 style={{ font: '900 var(--text-lg)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 10px' }}>{page.answer.title}</h2>
                <p style={{ ...seoStyles.para, marginBottom: 0 }}><RichText text={fillPrices(page.answer.text, menu)} /></p>
              </div>
            )}
          </div>
        </header>

        {page.sections.map((s, i) => (
          <section key={s.h2} id={slug(s.h2)} style={{ padding: sectionPad, ...band(i) }}>
            <div style={wrap}>
              <h2 style={seoStyles.h2}>{fillPrices(s.h2, menu)}</h2>
              {s.blocks.map((b, j) => <BlockView key={j} block={b} menu={menu} />)}
            </div>
          </section>
        ))}

        {!!page.faqs.length && (
          <section id="questions" style={{ padding: 'clamp(38px,5vw,64px) 0 clamp(20px,3vw,32px)' }}>
            <div style={wrap}>
              <h2 style={seoStyles.h2}>Questions</h2>
              <FaqList faqs={page.faqs} menu={menu} />
            </div>
          </section>
        )}
      </article>

      <section style={{ padding: 'clamp(28px,4vw,48px) 0 clamp(48px,6vw,72px)' }}>
        <div style={{ ...wrap, maxWidth: 1080 }}>
          <RelatedPages paths={page.related} />
        </div>
      </section>

      <OrderCta title={page.cta.title} body={page.cta.body} href={page.cta.href} cta={page.cta.label} />
      <Footer />
    </main>
  );
}
