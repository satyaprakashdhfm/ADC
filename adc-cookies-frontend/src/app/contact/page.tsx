import Link from 'next/link';
import { Mail, MapPin, Phone, ShoppingBag, Wheat, Clock, Truck, HeartHandshake } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/SocialIcons';
import Footer from '@/components/storefront/Footer';
import OrderCta from '@/components/storefront/OrderCta';
import SiteHeader from '@/components/storefront/SiteHeader';
import ContactForm from '@/components/storefront/ContactForm';
import PointMap from '@/components/storefront/PointMap';
import { STORES } from '@/lib/stores';
import { SITE_EMAIL, SITE_PHONE, whatsappLink, COMPANY_NAME, HEAD_OFFICE } from '@/lib/site';

export const metadata = {
  title: `Contact Us | ${COMPANY_NAME} (a dough cookie)`,
  description: `Contact ${COMPANY_NAME}, the company behind a dough cookie. Head office in Jayanagar, Bengaluru, with shops across Bengaluru and Chennai.`,
};

const BLR_STORE_COUNT = STORES.filter((s) => s.city === 'Bengaluru').length;

/* Written as things a customer can verify on an order they actually placed, rather than adjectives.
   "Real ingredients" is checkable; "premium quality" is not. */
const COMMITMENTS = [
  { icon: Wheat, title: 'Real ingredients, named', text: 'Président butter, couverture chocolate, and genuine Nutella and Lotus Biscoff. No compound coatings and no vegetable-fat “chocolate”. If we cannot get the real thing, we do not bake the cookie that day.' },
  { icon: Clock, title: 'Baked the day you get it', text: 'Small trays through the day at every shop rather than one batch each morning. Nothing is baked from frozen and nothing sits waiting for you.' },
  { icon: Truck, title: 'An honest delivery promise', text: 'The arrival time and the delivery fee are worked out from your actual address and the shop that will dispatch it, and both are shown before you pay. We would rather say no to an address than quietly turn a same-day order into a three-day parcel.' },
  { icon: HeartHandshake, title: 'A real person answers', text: 'Call, WhatsApp or email and you reach the team, not a queue. If an order arrives wrong, tell us and we will put it right. That is the whole policy.' },
];

export default function ContactPage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <section style={{ padding: '36px var(--gutter) 48px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>Contact Us</p>
          <h1 style={{ font: '900 clamp(3rem,2.2rem + 4vw,6rem)/.9 var(--font-display)', letterSpacing: '-.02em', marginBottom: 22 }}>Talk to the people who bake them.</h1>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.75, maxWidth: 760, color: 'var(--text-body)' }}>a dough cookie is run by {COMPANY_NAME}, from a head office in Jayanagar, Bengaluru. Whether it is a bulk order for an office, a gifting request with a deadline, a franchise enquiry, or something that went wrong with an order, this is where it reaches us, and a person will answer.</p>
          {/* Plain feature tags — not buttons (no card/pill background) */}
          <div style={{ display: 'flex', gap: 'clamp(14px,3vw,28px)', flexWrap: 'wrap', marginTop: 22, color: 'var(--text-body)' }}>
            {['Store pickup', 'Bulk gifting', 'Fresh delivery', 'Custom notes'].map((item) => (
              <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-secondary)', flex: 'none' }} />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Head office, on its own. This page used to open with all four shopfronts, which put the
          question "where do I write to you" behind four answers to a different question. The shops
          have their own page; this one leads with the company. */}
      <section style={{ padding: '0 var(--gutter) 72px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr minmax(320px,460px)', gap: 28, alignItems: 'start' }} className="contact-layout contact-stores">
          <article style={{ background: 'var(--panel-86)', border: '1px solid var(--border-default)', borderRadius: 20, padding: 'clamp(20px,2.6vw,30px)', boxShadow: 'var(--shadow-sm)' }}>
            <p style={{ fontSize: 'var(--text-2xs)', fontWeight: 900, color: 'var(--brand-secondary)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Head office</p>
            <h2 style={{ font: '900 var(--text-h3)/1.15 var(--font-display)', marginBottom: 6 }}>{COMPANY_NAME}</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 14 }}>The company behind a dough cookie.</p>
            <p style={{ display: 'flex', gap: 9, color: 'var(--text-body)', lineHeight: 1.65, marginBottom: 16 }}>
              <MapPin size={17} style={{ flex: 'none', marginTop: 3, color: 'var(--brand-secondary)' }} />
              <span>{HEAD_OFFICE.address}</span>
            </p>
            <div style={{ display: 'grid', gap: 9, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 18 }}>
              <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'inherit' }}><Phone size={15} /> {SITE_PHONE}</a>
              <a href={`mailto:${SITE_EMAIL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'inherit' }}><Mail size={15} /> {SITE_EMAIL}</a>
            </div>
            {/* The map itself rather than a link to one. "Open in Google Maps" asked the reader to
                leave the page to find out where we are, which is the one question this card exists
                to answer. The link still lives in the pin's popup, for directions. */}
            <div style={{ height: 300, marginBottom: 12 }}>
              <PointMap
                lat={HEAD_OFFICE.lat}
                lng={HEAD_OFFICE.lng}
                label={COMPANY_NAME}
                address={HEAD_OFFICE.address}
                mapUrl={HEAD_OFFICE.map}
              />
            </div>
            <Link href={HEAD_OFFICE.map} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 'var(--text-sm)' }}>
              <MapPin size={16} /> Get directions
            </Link>
          </article>

          {/* The shops get a mention and a door out to them, not a directory reprinted here. */}
          <aside style={{ background: 'var(--panel-90)', border: '1px solid var(--border-default)', borderRadius: 20, padding: 'clamp(20px,2.6vw,30px)', boxShadow: 'var(--shadow-md)' }}>
            <h2 style={{ fontSize: 'var(--text-h4)', marginBottom: 10 }}>Come and see us</h2>
            <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.75, color: 'var(--text-body)', marginBottom: 14 }}>
              We bake at {BLR_STORE_COUNT} shops across Bengaluru, in Jayanagar, S.G. Palya and
              Electronic City, and one in Chennai at Besant Nagar. Every one of them bakes its own
              trays through the day, so there is no wrong time to walk in.
            </p>
            <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.75, color: 'var(--text-body)', marginBottom: 18 }}>
              Ordering online works the same way: your order goes to whichever shop is nearest your
              address, not to one central kitchen, which is what makes same-day delivery in about an
              hour possible.
            </p>
            <Link href="/locations" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 26px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 900, fontSize: 'var(--text-sm)', boxShadow: 'var(--shadow-brand)' }}>
              <MapPin size={17} /> All store locations
            </Link>
          </aside>
        </div>
      </section>

      {/* What we hold ourselves to — the things a customer can actually check us on. */}
      <section style={{ padding: '0 var(--gutter) 88px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>Our commitment</p>
          <h2 style={{ font: '900 clamp(2rem,1.5rem + 2.4vw,3rem)/1.05 var(--font-display)', letterSpacing: '-.02em', marginBottom: 14 }}>What we promise, and what to hold us to.</h2>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.75, color: 'var(--text-body)', maxWidth: 780, marginBottom: 30 }}>
            These are not slogans. Each one is something you can check on any order, and something
            worth telling us about if we get it wrong.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'clamp(14px,2vw,20px)' }}>
            {COMMITMENTS.map((c) => (
              <article key={c.title} style={{ background: 'var(--panel-86)', border: '1px solid var(--border-default)', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--gradient-warm)', color: 'var(--white)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                  <c.icon size={21} />
                </span>
                <h3 style={{ font: '900 var(--text-base)/1.25 var(--font-display)', marginBottom: 8 }}>{c.title}</h3>
                <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, color: 'var(--text-body)', margin: 0 }}>{c.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="get-in-touch" style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr minmax(320px,460px)', gap: 28, alignItems: 'start' }} className="contact-layout">
          <div>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>Get in Touch</p>
            <h2 style={{ font: '900 clamp(2.2rem,1.6rem + 3vw,3.4rem)/1 var(--font-display)', letterSpacing: '-.02em', marginBottom: 16 }}>Leave your details and we&apos;ll reach out.</h2>
            <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.75, color: 'var(--text-body)', marginBottom: 18 }}>Have a bulk order, a gifting request, or a question about our cookies? Share your details and our team will get back to you.</p>
            <div style={{ display: 'grid', gap: 10, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--whatsapp-green)', fontWeight: 800 }}><WhatsAppIcon size={17} /> WhatsApp us</a>
              <a href={`mailto:${SITE_EMAIL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'inherit' }}><Mail size={16} /> {SITE_EMAIL}</a>
              <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'inherit' }}><Phone size={16} /> {SITE_PHONE}</a>
            </div>
          </div>
          <ContactForm />
        </div>
      </section>

      <OrderCta
        title="Need cookies delivered?"
        body="Order online or contact the nearest A Dough Cookie store for bulk and gifting requests."
        href="/order"
      />

      <Footer />
    </main>
  );
}
