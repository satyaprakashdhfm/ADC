'use client';
import { Users, UserPlus, FileText, Clock } from 'lucide-react';
import type { AdminTraffic } from '@/lib/api';
import type { useAdminTraffic } from '@/hooks/admin/useAdminTraffic';
import { fmtDate } from '../shared/format';
import { StatCard, Empty } from '../shared/ui';
import PeriodBar from '../shared/PeriodBar';
import { BarRows } from '../overview/OverviewCharts';
import { Section, Notice } from './TrafficParts';
import ConnectionStatus from './ConnectionStatus';
import LiveNow from './LiveNow';
import VisitorsChart from './VisitorsChart';
import ChannelTable from './ChannelTable';
import MetaAdsSection from './MetaAdsSection';
import Funnel from './Funnel';
import SignIns from './SignIns';
import Glossary from './Glossary';
import { num, duration } from './trafficFormat';

type Props = ReturnType<typeof useAdminTraffic>;

/*
 * What a Google-Analytics-only section shows when it has nothing: not connected, or connected but
 * that one report failed. Never an empty chart, which would read as "nobody came".
 */
function googleEmpty(g: AdminTraffic['google']) {
  return <Empty text={g.connected ? 'This report could not load — see the note at the top.' : 'Shows once Google Analytics is connected.'} />;
}

function Breakdown({ title, hint, g, rows, color, unit = 'visitor' }: {
  title: string; hint: string; g: AdminTraffic['google'];
  rows: { label: string; visitors: number; visits?: number }[] | null | undefined; color: string; unit?: 'visitor' | 'visit';
}) {
  return (
    <Section title={title} hint={hint}>
      {!rows ? googleEmpty(g)
        : !rows.length ? <Empty text="Nothing recorded in this period." />
        : <BarRows color={color} items={rows.map(r => {
            const n = unit === 'visit' ? r.visits ?? 0 : r.visitors;
            return { label: r.label, value: n, sub: `${num(n)} ${unit}${n === 1 ? '' : 's'}` };
          })} />}
    </Section>
  );
}

/**
 * The admin "Traffic & ads" tab: who visited, where from, what the ads cost, and what it all turned
 * into — in words the shop uses. Laid out like Overview: "right now" above the date filter,
 * everything scoped to the period below it.
 */
export default function TrafficTab({ report, live, range, setRange, error, refreshing, refresh }: Props) {
  const loading = !report && !error;
  const g = report?.google;
  const s = g?.summary;
  const periodLabel = range.from === range.to ? fmtDate(range.from) : `${fmtDate(range.from)} – ${fmtDate(range.to)}`;
  const orders = report?.orders;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ConnectionStatus report={report} refreshing={refreshing} onRefresh={refresh} />

      <LiveNow live={live} />

      <PeriodBar range={range} setRange={setRange} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: -6 }}>
        <h3 style={{ fontSize: 'var(--text-h4)', color: 'var(--text-strong)' }}>In this period</h3>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', fontWeight: 700 }}>{periodLabel}</span>
      </div>

      {error ? <Notice tone="error" title="Traffic could not load">{error}</Notice>
        : loading || !report || !g ? <Empty text="Loading traffic…" />
        : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14 }}>
              <StatCard icon={<Users size={20} />} label="Visitors" value={num(s?.visitors)} sub="different people" />
              <StatCard icon={<UserPlus size={20} />} label="New visitors" value={num(s?.newVisitors)} sub="first time on the site" />
              <StatCard icon={<FileText size={20} />} label="Pages viewed" value={num(s?.pageViews)} sub={s?.visits ? `${(s.pageViews / s.visits).toFixed(1)} per visit` : ''} />
              <StatCard icon={<Clock size={20} />} label="Time per visit" value={s ? duration(s.avgVisitSeconds) : '—'} sub="on average" />
            </div>

            <Section title="Visitors per day" hint="How many different people opened the site each day. Hover a bar for the exact number.">
              {g.byDay ? <VisitorsChart days={g.byDay} from={report.from} to={report.to} /> : googleEmpty(g)}
            </Section>

            <Section title="Where people come from"
              hint="Every place a visit came from: our Meta ads, Instagram, WhatsApp, Google and so on. Visitors are from Google Analytics; paid orders are from our own records.">
              <ChannelTable report={report} />
            </Section>

            <MetaAdsSection report={report} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
              <Section title="From visit to payment" hint="How far people got. The biggest drop between two steps is where the site loses the most customers.">
                {g.funnel ? <Funnel steps={g.funnel} paidOrders={orders?.paid ?? 0} /> : googleEmpty(g)}
              </Section>
              <Section title="Sign-ins" hint="Customers signing in on the site, and new accounts being made.">
                {g.signIns ? <SignIns data={g.signIns} /> : googleEmpty(g)}
              </Section>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
              <Breakdown title="First page they saw" hint="Where visits started. An ad pointing at a page shows up here." g={g} rows={g.landingPages} color="var(--orange-600)" unit="visit" />
              <Breakdown title="Phone or computer" hint="What people browsed on." g={g} rows={g.devices} color="var(--google-blue)" />
              <Breakdown title="Cities" hint="Where visitors were, as Google estimates it from their connection." g={g} rows={g.cities} color="var(--google-green)" />
              <Breakdown title="New or returning" hint="First-time visitors against people who had been before." g={g} rows={g.newVsReturning} color="var(--brand-secondary)" />
            </div>
          </>
        )}

      <Glossary />
    </div>
  );
}
