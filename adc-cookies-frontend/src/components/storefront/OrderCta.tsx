import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';

/*
 * The closing "go and order" band, shared by /about, /blog and /contact.
 *
 * It was the same forty lines of markup pasted into all three, which is why it was a dark-brown
 * panel in three places at once: recolouring it meant finding every copy. Only the words and the
 * destination ever differed, so those are the props and nothing else is.
 *
 * Brand warm gradient rather than the near-black --surface-inverse it used to be. The button
 * inverts to white because the card is now the brand orange, and an orange gradient button on an
 * orange gradient card has nothing to stand against.
 */

interface OrderCtaProps {
  title: string;
  body: string;
  href: string;
  cta?: string;
}

export default function OrderCta({ title, body, href, cta = 'Order Now' }: OrderCtaProps) {
  return (
    <section style={{ padding: '0 var(--gutter) 96px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center', padding: '42px 28px', borderRadius: 28, background: 'var(--gradient-warm)', color: 'var(--white)', boxShadow: 'var(--shadow-brand)' }}>
        <h2 style={{ color: 'var(--white)', fontSize: 'var(--text-h2)', marginBottom: 12, textShadow: '0 2px 10px var(--espresso-30)' }}>{title}</h2>
        <p style={{ color: 'var(--cream-100)', marginBottom: 26 }}>{body}</p>
        {/* 18px at 900 so the orange label carries on white at this size — the same colour at the
            body size would be too light a pairing to sit on a button. */}
        <Link href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 34px', borderRadius: 'var(--radius-pill)', background: 'var(--white)', color: 'var(--orange-600)', fontWeight: 900, fontSize: 'var(--text-lg)', boxShadow: 'var(--shadow-md)' }}>
          <ShoppingBag size={19} /> {cta}
        </Link>
      </div>
    </section>
  );
}
