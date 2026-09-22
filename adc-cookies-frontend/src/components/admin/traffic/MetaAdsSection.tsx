'use client';
import { IndianRupee, Users, MousePointerClick, ShoppingBag, Target, TrendingUp } from 'lucide-react';
import type { AdminTraffic } from '@/lib/api';
import { StatCard, Table, td, Empty } from '../shared/ui';
import { Section, Notice, Labelled } from './TrafficParts';
import { num, rupees, costPer, returnOn } from './trafficFormat';

/* The URL parameters every ad needs. Without them an ad's visitors land under "Instagram (not an
   ad)" and nothing below can see it — so the exact line is on the screen, ready to copy. */
const AD_URL_TAGS = 'utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}';

/**
 * Meta ads that send people to the website, followed from the tap to the payment: what Meta charged
 * and how many taps reached the site (Meta), who arrived (Google Analytics), and who paid (our
 * orders). Reach and times shown are left out on purpose: they say nothing about the shop.
 *
 * Campaigns that send people somewhere else (Instagram DMs) are dropped by the backend and only
 * named in one line, so their spend cannot drag down cost per order.
 *
 * Cost per order and return on spend use OUR paid orders, never Meta's own purchase count.
 */
export default function MetaAdsSection({ report }: { report: AdminTraffic }) {
  const t = report.meta.totals;
  const fromAds = report.channels.find(c => c.key === 'meta_ads');
  const adOrders = fromAds?.orders ?? 0;
  const adRevenue = fromAds?.revenue ?? 0;
  const spend = t?.spend ?? null;
  const leftOut = report.meta.leftOut ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section title="Meta ads that bring people to the website"
        hint="Only ads that link to the website. Spend and clicks come from Meta, visitors from Google Analytics, and paid orders from our own records (orders whose customer arrived by tapping one of these ads).">
        {!report.meta.connected && (
          <div style={{ marginBottom: 14 }}>
            <Notice tone="waiting" title="Spend and clicks appear once Meta Ads is connected">Visitors and orders from each campaign already show in the tables below.</Notice>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
          <StatCard icon={<IndianRupee size={20} />} label="Spent" value={rupees(spend)} sub="what Meta charged" />
          <StatCard icon={<MousePointerClick size={20} />} label="Clicks to the website" value={num(t?.clicks)} sub={`cost per click ${costPer(spend, t?.clicks ?? 0)}`} />
          <StatCard icon={<Users size={20} />} label="Visitors from ads" value={report.google.connected ? num(fromAds?.visitors) : '—'} sub="actually opened the site" />
          <StatCard icon={<ShoppingBag size={20} />} label="Paid orders from ads" value={num(adOrders)} sub={adOrders ? rupees(adRevenue) : 'our records'} accent={adOrders > 0} />
          <StatCard icon={<Target size={20} />} label="Cost per order" value={costPer(spend, adOrders)} sub="spent ÷ paid orders" />
          <StatCard icon={<TrendingUp size={20} />} label="Return on ad spend" value={returnOn(adRevenue, spend)} sub="₹ of orders per ₹1 spent" />
        </div>
        {!!leftOut.length && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '12px 0 0', lineHeight: 1.6 }}>
            Not counted here, because {leftOut.length === 1 ? 'it sends' : 'they send'} nobody to the website: {leftOut.map(c => `${c.name} (${rupees(c.spend)})`).join(', ')}.
          </p>
        )}
      </Section>

      <Section title="By campaign" hint="A campaign is one ad goal with its own budget. Each row joins Meta's figures, Google's visitors and our paid orders by the campaign's name.">
        {!report.campaigns.length
          ? <Empty text="No website ad campaigns in this period. Once an ad runs with the link tags below, its campaign appears here." />
          : (
            <Table head={['Campaign', 'Spent', 'Clicks to site', 'Visitors', 'Paid orders', 'Revenue', 'Cost per order', 'Return']}>
              {report.campaigns.map(c => (
                <tr key={c.name}>
                  <td style={td}><Labelled label={c.name} /></td>
                  <td style={td}>{rupees(c.spend)}</td>
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
            <Table head={['Ad', 'Spent', 'Clicks to site', 'Visitors', 'Paid orders', 'Revenue', 'Cost per order']}>
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
