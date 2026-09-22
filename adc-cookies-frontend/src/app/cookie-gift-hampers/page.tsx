import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, EggOff, PenLine, Truck, MessageCircle, Gift } from 'lucide-react';
import SiteHeader from '@/components/storefront/SiteHeader';
import Footer from '@/components/storefront/Footer';
import OrderCta from '@/components/storefront/OrderCta';
import RichText from '@/components/seo/RichText';
import { Breadcrumbs, FaqList, JsonLd, RelatedPages, TinGrid, seoStyles } from '@/components/seo/SeoParts';
import { giftHampers as page } from '@/lib/seo/pages/giftHampers';
import { EIGHT_PACK, fillPrices, getMenu, rupees } from '@/lib/seo/menu';
import { seoJsonLd, seoMetadata } from '@/lib/seo/meta';
import { whatsappLink } from '@/lib/site';

/*
 * The gifting page: every cookie tin, the box of eight, and bulk hampers, in one place. The festival
 * and gift guides link here, and it is reached from the blog, never from the main navigation.
 *
 * Photos: every image on this page is listed in IMAGES below. To change one, replace the file at
 * that path with a new photo of the same name, or point the entry at a new file. Tin photos come
 * from the menu itself (admin → Products), so a new tin photo there shows up here too.
 */
const IMAGES = {
  hero: page.hero,
  hampers: { src: '/assets/seo/corporate-cookie-gift-hampers.jpg', alt: 'Cookie gift hampers packed for a corporate order', width: 1400, height: 212 },
  occasions: {
    ganesh: { src: '/assets/seo/ganesh-chaturthi-cookie-gifts.jpg', alt: 'Cookies set out for a festival' },
    diwali: { src: '/assets/seo/nutella-chocolate-cookie-tin.jpg', alt: 'Nutella cookie tin for Diwali gifting' },
    birthday: { src: '/assets/seo/cookie-tin-gift-red-velvet.jpg', alt: 'Red velvet cookie tin for a birthday' },
    thanks: { src: '/assets/seo/chocolate-chip-cookie-tin.jpg', alt: 'Chocolate chip cookie tin as a thank-you gift' },
    wedding: { src: '/assets/seo/cookie-tins-a-dough-cookie.jpg', alt: 'Four cookie tins for a wedding or function' },
    office: { src: '/assets/seo/og/corporate-cookie-gift-hampers.jpg', alt: 'Branded cookie hampers for office gifting' },
  },
};

const OCCASIONS: { key: keyof typeof IMAGES.occasions; title: string; text: string; href: string; link: string }[] = [
  { key: 'ganesh', title: 'Ganesh Chaturthi', text: 'Eggless tins to carry on family visits, and boxes for pandal teams.', href: '/blog/ganesh-chaturthi-cookie-gifts', link: 'Read the festival guide' },
  { key: 'diwali', title: 'Diwali', text: 'Tins for family and friends, and hampers for clients and staff.', href: '#hampers', link: 'Plan Diwali hampers' },
  { key: 'birthday', title: 'Birthdays', text: 'A Red Velvet or Biscoff tin, with your message on a handwritten card.', href: '/blog/cookie-tins-for-gifts', link: 'Pick a birthday tin' },
  { key: 'thanks', title: 'Thank-yous', text: 'A Chocolate Chip tin for a neighbour or a teacher.', href: '/cookie-tins', link: 'See the tins' },
  { key: 'wedding', title: 'Weddings and functions', text: 'Return gifts and dessert tables, ordered in bulk for one date.', href: '/corporate', link: 'Ask about bulk orders' },
  { key: 'office', title: 'Office gifting', text: 'Branded boxes for clients and teams, all delivered on the same day.', href: '/corporate', link: 'Corporate gifting' },
];

const STEPS = [
  { n: '01', title: 'Choose a tin or a box', text: 'Add it to your cart from the menu.' },
  { n: '02', title: 'Add your message', text: 'Turn on "Send this as a gift" at checkout. We add gift wrap and a handwritten card, and you can tag the occasion.' },
  { n: '03', title: 'Send it to them', text: "Enter their address and phone number. In Bengaluru and Chennai it arrives the same day; elsewhere, the courier's date shows at checkout." },
];

const wrap: React.CSSProperties = { maxWidth: 1120, margin: '0 auto', padding: '0 var(--gutter)' };
const band: React.CSSProperties = { background: 'var(--gold)', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' };
const section: React.CSSProperties = { padding: 'clamp(40px,5vw,68px) 0' };
const eyebrow: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 10px' };

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata(page, await getMenu());
}

export default async function CookieGiftHampersPage() {
  const menu = await getMenu();
  const box = menu.find(m => m.id === EIGHT_PACK);

  return (
    <main style={{ background: 'var(--surface-page)' }}>
      <JsonLd data={seoJsonLd(page, menu)} />
      <SiteHeader />

      {/* ---- Hero ---- */}
      <section style={{ padding: 'clamp(28px,4vw,48px) 0 clamp(40px,5vw,64px)' }}>
        <div style={wrap}>
          <Breadcrumbs trail={[{ name: 'Home', href: '/' }, { name: page.name }]} />
          <div className="product-doc-hero" style={{ display: 'grid', gridTemplateColumns: '1fr minmax(300px, 520px)', gap: 'clamp(24px,4vw,56px)', alignItems: 'center' }}>
            <div>
              <p style={eyebrow}>Gifting</p>
              <h1 style={{ font: '900 clamp(2.2rem,1.6rem + 3vw,4rem)/1 var(--font-display)', letterSpacing: '-.03em', color: 'var(--text-strong)', margin: '0 0 18px' }}>{page.h1}</h1>
              <p style={{ ...seoStyles.para, fontSize: 'var(--text-lg)', maxWidth: 580 }}>{page.intro[0]}</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '8px 0 22px' }}>
                <Link href="/order" style={seoStyles.primaryBtn}><Gift size={18} /> Order a gift tin</Link>
                <a href="#hampers" style={seoStyles.secondaryBtn}>Bulk hampers</a>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { icon: EggOff, text: 'Every cookie eggless' },
                  { icon: PenLine, text: 'Handwritten message card' },
                  { icon: Truck, text: 'Courier across India' },
                ].map(c => (
                  <span key={c.text} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 'var(--radius-pill)', background: 'var(--vanilla)', border: '1px solid var(--border-default)', fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-strong)' }}>
                    <c.icon size={15} style={{ color: 'var(--brand-secondary)' }} /> {c.text}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: 28, overflow: 'hidden', boxShadow: 'var(--shadow-md)', background: 'var(--surface-sunken)' }}>
              <Image src={IMAGES.hero.src} alt={IMAGES.hero.alt} fill priority sizes="(max-width: 900px) 100vw, 520px" style={{ objectFit: 'cover' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ---- Tins ---- */}
      <section id="tins" style={{ ...section, ...band }}>
        <div style={wrap}>
          <p style={eyebrow}>From {fillPrices('{tins:from}', menu)}</p>
          <h2 style={seoStyles.h2}>Cookie gift tins</h2>
          <p style={{ ...seoStyles.para, maxWidth: 760 }}>
            Each tin is one large cookie in a round tin, cut into slices, with a lid that keeps it fresh on the way.
            Three of the four travel by courier across India. The Red Velvet tin has a cream cheese layer, so it goes
            the same day, in Bengaluru and Chennai only.
          </p>
          <TinGrid menu={menu} />
          <p style={{ ...seoStyles.para, fontSize: 'var(--text-sm)', marginBottom: 0 }}>
            <RichText text="Not sure which to pick? Our guide to [cookie tins as gifts](/blog/cookie-tins-for-gifts) matches each flavour to a person." />
          </p>
        </div>
      </section>

      {/* ---- Box of eight ---- */}
      {box && (
        <section id="box" style={section}>
          <div style={wrap}>
            <div className="product-doc-hero" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 460px) 1fr', gap: 'clamp(24px,4vw,56px)', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', background: 'var(--surface-sunken)' }}>
                <Image src={box.image} alt="A box of eight a dough cookie cookies in mixed flavours" fill sizes="(max-width: 900px) 100vw, 460px" style={{ objectFit: 'cover' }} />
              </div>
              <div>
                <p style={eyebrow}>{rupees(box.price)}</p>
                <h2 style={seoStyles.h2}>A box of eight cookies</h2>
                <p style={seoStyles.para}>
                  Pick any eight cookies from the menu and mix the flavours as you like. The box is made fresh for same-day
                  delivery in Bengaluru and Chennai, and it can carry the same gift wrap and handwritten card as a tin.
                </p>
                <Link href={`/?q=${encodeURIComponent(box.name)}`} style={seoStyles.primaryBtn}>Build your box <ArrowRight size={17} /></Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---- Bulk hampers ---- */}
      <section id="hampers" style={{ ...section, ...band }}>
        <div style={wrap}>
          <p style={eyebrow}>Festivals, weddings and offices</p>
          <h2 style={seoStyles.h2}>Cookie hampers in bulk</h2>
          <div style={{ position: 'relative', width: '100%', aspectRatio: `${IMAGES.hampers.width} / ${IMAGES.hampers.height}`, minHeight: 120, borderRadius: 'var(--radius-card)', overflow: 'hidden', margin: '6px 0 22px', background: 'var(--surface-sunken)' }}>
            <Image src={IMAGES.hampers.src} alt={IMAGES.hampers.alt} fill sizes="(max-width: 1120px) 100vw, 1120px" style={{ objectFit: 'cover' }} />
          </div>
          <p style={{ ...seoStyles.para, maxWidth: 780 }}>
            For a festival, a wedding or a company, we put together hampers from our tins and cookies to fit your budget,
            with your logo on the sleeves and notes if you want it. Tell us how many you need and the date, and we will send
            a quote within one working day. GST invoices are available on request.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/corporate#quote" style={seoStyles.primaryBtn}>Ask for a quote <ArrowRight size={17} /></Link>
            <a href={whatsappLink("Hi a dough cookie! I'd like a quote for cookie gift hampers.")} target="_blank" rel="noopener noreferrer" style={seoStyles.secondaryBtn}>
              <MessageCircle size={17} /> Message us on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ---- Occasions ---- */}
      <section id="occasions" style={section}>
        <div style={wrap}>
          <h2 style={seoStyles.h2}>Gifts for every occasion</h2>
          {/* Six cards: three across on a desktop (not four and two), one per row on a phone. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 'clamp(14px,2vw,20px)', marginTop: 20 }}>
            {OCCASIONS.map(o => {
              const img = IMAGES.occasions[o.key];
              return (
                <Link key={o.key} href={o.href} style={{ ...seoStyles.card, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: 'var(--surface-sunken)' }}>
                    <Image src={img.src} alt={img.alt} fill sizes="(max-width: 760px) 100vw, 360px" style={{ objectFit: 'cover' }} />
                  </div>
                  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <h3 style={{ font: '900 var(--text-lg)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>{o.title}</h3>
                    <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.65, color: 'var(--text-body)', margin: 0 }}>{o.text}</p>
                    <span style={{ marginTop: 'auto', paddingTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--brand-secondary)' }}>{o.link} <ArrowRight size={14} /></span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section id="how" style={{ ...section, ...band }}>
        <div style={wrap}>
          <h2 style={seoStyles.h2}>How gifting works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'clamp(14px,2vw,20px)', marginTop: 20 }}>
            {STEPS.map(s => (
              <div key={s.n} style={{ padding: 22, borderRadius: 'var(--radius-card)', background: 'var(--vanilla)', border: '1px solid var(--border-default)' }}>
                <span style={{ font: '900 var(--text-h3)/1 var(--font-display)', color: 'var(--brand-secondary)' }}>{s.n}</span>
                <h3 style={{ font: '900 var(--text-base)/1.3 var(--font-display)', color: 'var(--text-strong)', margin: '12px 0 6px' }}>{s.title}</h3>
                <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, color: 'var(--text-body)', margin: 0 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Questions ---- */}
      <section id="questions" style={section}>
        <div style={wrap}>
          <h2 style={seoStyles.h2}>Questions</h2>
          <FaqList faqs={page.faqs} menu={menu} />
        </div>
      </section>

      <section style={{ padding: '0 0 clamp(48px,6vw,72px)' }}>
        <div style={wrap}>
          <RelatedPages paths={page.related} title="Gift guides" />
        </div>
      </section>

      <OrderCta title={page.cta.title} body={page.cta.body} href={page.cta.href} cta={page.cta.label} />
      <Footer />
    </main>
  );
}
