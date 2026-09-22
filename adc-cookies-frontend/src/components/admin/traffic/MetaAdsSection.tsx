'use client';
import { IndianRupee, Users, Eye, MousePointerClick, ShoppingBag, Target, TrendingUp } from 'lucide-react';
import type { AdminTraffic } from '@/lib/api';
import { StatCard, Table, td, Empty } from '../shared/ui';
import { Section, Notice, Labelled } from './TrafficParts';
import { num, rupees, costPer, returnOn } from './trafficFormat';

/* The URL parameters every ad needs. Without them an ad's visitors land under "Instagram (not an
   ad)" and nothing below can see it — so the exact line is on the screen, ready to copy. */
const AD_URL_TAGS = 'utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}';

/**
 * Meta ads, as three systems see them: what Meta charged and how far the ads reached (Meta), who
 * came to the site from them (Google Analytics), and who paid (our orders).
 *
 * Cost per order and return on spend use OUR paid orders, never Meta's own purchase count. Meta
 * also credits people who only saw an ad and came back later by themselves, which is why its number
 * is shown separately and labelled as Meta's.
 */
export default function MetaAdsSection({ report }: { report: AdminTraffic }) {
  const t = report.meta.totals;
  const fromAds = report.channels.find(c => c.key === 'meta_ads');
  const adOrders = fromAds?.orders ?? 0;
  const adRevenue = fromAds?.revenue ?? 0;
  const spend = t?.spend ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section title="Meta ads (Instagram & Facebook)"
        hint="Spend and reach come from Meta. Visitors come from Google Analytics. Paid orders come from our own records — only orders whose customer arrived by tapping one of our ads.">
        {!report.meta.connected && (
          <div style={{ marginBottom: 14 }}>
            <Notice tone="waiting" title="Spend and reach appear once Meta Ads is connected">Visitors and orders from each campaign already show in the tables below.</Notice>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
          <StatCard icon={<IndianRupee size={20} />} label="Spent" value={rupees(spend)} sub="what Meta charged" />
          <StatCard icon={<Users size={20} />} label="People reached" value={num(t?.reach)} sub="saw an ad at least once" />
          <StatCard icon={<Eye size={20} />} label="Times shown" value={num(t?.impressions)} sub="one person can see it often" />
          <StatCard icon={<MousePointerClick size={20} />} label="Link clicks" value={num(t?.linkClicks)} sub={`cost per click ${costPer(spend, t?.linkClicks ?? 0)}`} />
          <StatCard icon={<ShoppingBag size={20} />} label="Paid orders from ads" value={num(adOrders)} sub={adOrders ? rupees(adRevenue) : 'our records'} accent={adOrders > 0} />
          <StatCard icon={<Target size={20} />} label="Cost per order" value={costPer(spend, adOrders)} sub="spent ÷ paid orders" />
          <StatCard icon={<TrendingUp size={20} />} label="Return on ad spend" value={returnOn(adRevenue, spend)} sub="₹ of orders per ₹1 spent" />
        </div>
        {t && t.metaPurchases > 0 && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '12px 0 0', lineHeight: 1.6 }}>
            Meta itself counts <b>{num(t.metaPurchases)}</b> purchase{t.metaPurchases === 1 ? '' : 's'} worth {rupees(t.metaPurchaseValue)}. That is usually more than our paid orders above, because Meta also credits people who only <i>saw</i> an ad and ordered later on their own.
          </p>
        )}
      </Section>

      <Section title="By campaign" hint="A campaign is one ad goal with its own budget. Each row joins Meta's figures, Google's visitors and our paid orders by the campaign's name.">
        {!report.campaigns.length
          ? <Empty text="No Meta ad campaigns in this period. Once an ad runs with the link tags below, its campaign appears here." />
          : (
            <Table head={['Campaign', 'Spent', 'Reached', 'Link clicks', 'Visitors', 'Paid orders', 'Revenue', 'Cost per order', 'Return']}>
              {report.campaigns.map(c => (
                <tr key={c.name}>
                  <td style={td}><Labelled label={c.name} /></td>
                  <td style={td}>{rupees(c.spend)}</td>
                  <td style={td}>{num(c.reach)}</td>
                  <td style={td}>{num(c.clicks)}</td>
                  <td style={td}>{report.google.connected ? num(c.visitors) : '—'}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{num(c.orders)}</td>
                  <td style={td}>{c.orders ? rupees(c.revenue) : '—'}</td>
                  <td style={td}>{costPer(c.spend, c.orders)}</td>
                  <td style={td}>{returnOn(c.revenue, c.spend)}</td>
                </tr>
              ))}
            </Table>
          )}
      </Section>

      <Section title="By ad" hint="The actual picture or video people saw. The ad set is who it was shown to. Use this to see which ad brings visitors who buy, not just visitors.">
        {!report.ads.length
          ? <Empty text="No individual ads to show yet." />
          : (
            <Table head={['Ad', 'Spent', 'Link clicks', 'Visitors', 'Paid orders', 'Revenue', 'Cost per order']}>
              {report.ads.map(a => (
                <tr key={`${a.campaign}|${a.ad}`}>
                  <td style={td}><Labelled label={a.ad} hint={[a.campaign, a.adset].filter(Boolean).join(' · ')} /></td>
                  <td style={td}>{rupees(a.spend)}</td>
                  <td style={td}>{num(a.clicks)}</td>
                  <td style={td}>{report.google.connected ? num(a.visitors) : '—'}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{num(a.orders)}</td>
                  <td style={td}>{a.orders ? rupees(a.revenue) : '—'}</td>
                  <td style={td}>{costPer(a.spend, a.orders)}</td>
                </tr>
              ))}
            </Table>
          )}
        <div style={{ marginTop: 14 }}>
          <Notice title="Every ad needs these link tags">
            In Ads Manager, paste this into each ad&apos;s <b>URL parameters</b>. Without it, the ad&apos;s visitors are counted as ordinary Instagram visitors and none of the tables above can see them.
            <code style={{ display: 'block', marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-card)', border: '1px solid var(--border-default)', fontSize: 'var(--text-2xs)', wordBreak: 'break-all', userSelect: 'all' }}>{AD_URL_TAGS}</code>
          </Notice>
        </div>
      </Section>
    </div>
  );
}
