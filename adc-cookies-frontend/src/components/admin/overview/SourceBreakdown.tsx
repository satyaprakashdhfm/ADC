'use client';
import { money } from '../shared/format';
import { Empty } from '../shared/ui';
import { BarRows } from './OverviewCharts';
import type { AdminAnalytics } from '@/lib/api';

const plural = (n: number) => `${n} order${n === 1 ? '' : 's'}`;

/**
 * "Orders by source": where this period's orders came from, out of our own order records.
 *
 * It will not match Ads Manager, and is not meant to. Meta also counts people who only saw an ad and
 * came back later on their own, and estimates part of the rest; this counts only orders whose
 * customer actually arrived through a tagged ad link. The gap between the two is itself worth
 * knowing.
 *
 * "Not tracked" is every order placed before this existed. It is kept as its own row rather than
 * folded into Direct, so the first weeks do not read as "nobody came from anywhere".
 */
export default function SourceBreakdown({ analytics }: { analytics: AdminAnalytics }) {
  const rows = analytics.ordersBySource;
  if (!rows) return <Empty text="Needs the latest backend — refresh once it has deployed." />;
  if (!rows.length) return <Empty text="No orders in this period." />;
  const campaigns = analytics.metaCampaigns || [];
  return (
    <>
      <BarRows items={rows.map(r => ({ label: r.source, value: r.orders, sub: `${plural(r.orders)} · ${money(r.revenue)}` }))} />
      {campaigns.length > 0 && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--border-default)' }}>
          <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-subtle)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Meta ads by campaign</div>
          <BarRows color="var(--brand-secondary)" items={campaigns.map(c => ({ label: c.campaign, value: c.orders, sub: `${plural(c.orders)} · ${money(c.revenue)}` }))} />
        </div>
      )}
    </>
  );
}
