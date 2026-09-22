'use client';
import { BookOpen } from 'lucide-react';
import { card } from '../shared/ui';

/*
 * Every word on this tab, in plain terms.
 *
 * Written for someone who runs the shop, not for someone who runs ads. Grouped the way the tab is
 * read: people on the site, where they came from, then what the ads cost.
 */
const GROUPS: { heading: string; terms: [string, string][] }[] = [
  {
    heading: 'People on the site',
    terms: [
      ['Visitor', 'One person, counted once, however many times they came. It is really one phone or computer: the same person on their phone and their laptop counts as two.'],
      ['New visitor', 'Someone opening the site for the first time.'],
      ['Visit', 'Each time someone opens the site. One person coming today and again tomorrow is 1 visitor and 2 visits.'],
      ['Pages viewed', 'Every page opened, across all visits.'],
      ['Time per visit', 'How long a visit lasts on average, while the site is on screen.'],
      ['Landing page', 'The first page a visit opened: the home page, the menu, or wherever a link pointed.'],
    ],
  },
  {
    heading: 'Where they came from',
    terms: [
      ['Meta ads', 'They tapped one of our paid ads on Instagram or Facebook.'],
      ['Instagram / Facebook (not an ad)', 'They came from our profile, a post, a story or the bio link. Free, not paid.'],
      ['Direct', 'They typed the address, used a bookmark, or tapped a link inside an app that hides where it came from. WhatsApp often does this, so some WhatsApp shares land here.'],
      ['Search', 'They searched on Google or Bing and tapped our result (not an ad).'],
      ['Other websites', 'They followed a link on some other site.'],
      ['Visits that ordered', 'Out of every 100 visits from that place, how many ended in a paid order.'],
    ],
  },
  {
    heading: 'Ads and money',
    terms: [
      ['Campaign · Ad set · Ad', 'Meta’s three levels. A campaign is one goal with its budget. An ad set is who sees it (area, age, interests). An ad is the actual picture or video.'],
      ['Spent', 'What Meta charged for the ads in this period.'],
      ['Times shown (impressions)', 'How many times the ads appeared on someone’s screen. One person can see an ad several times.'],
      ['People reached', 'How many different people saw an ad at least once.'],
      ['Link clicks', 'How many times people tapped through from an ad to the site.'],
      ['Cost per click', 'Spent ÷ link clicks.'],
      ['Paid orders', 'Orders in OUR records that were paid, from customers who arrived that way. The most reliable number here.'],
      ['Cost per order', 'Spent ÷ paid orders from the ads. If this is more than you make on an order, the ad is losing money.'],
      ['Return on ad spend', 'Rupees of orders for every ₹1 spent. 3.0× means ₹300 of orders for ₹100 of ads.'],
    ],
  },
];

export default function Glossary() {
  return (
    <details open style={{ ...card, padding: 20 }}>
      <summary style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 800, fontSize: 'var(--text-h4)', color: 'var(--text-strong)', listStyle: 'none' }}>
        <BookOpen size={18} /> What these words mean
      </summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 22, marginTop: 16 }}>
        {GROUPS.map(g => (
          <div key={g.heading}>
            <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>{g.heading}</div>
            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {g.terms.map(([term, meaning]) => (
                <div key={term}>
                  <dt style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{term}</dt>
                  <dd style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>{meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--border-default)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        <b style={{ color: 'var(--text-strong)' }}>Why Google, Meta and our orders never quite agree.</b> Our paid orders are exact. Google counts a little under the real number of visitors, because some people block tracking. Meta counts generously: it also credits people who only saw an ad and came back later on their own. So judge an ad by <b>cost per order</b>, which uses our orders.
      </div>
    </details>
  );
}
