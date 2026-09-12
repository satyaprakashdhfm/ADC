'use client';
import { Users, UserPlus, ShoppingBag, Package, MessageSquare, IndianRupee, CalendarRange, XCircle, RefreshCw, AlertTriangle, Undo2 } from 'lucide-react';
import { type AdminStats, type AdminAnalytics } from '@/lib/api';
import { money, fmtDate, todayStr, daysAgoStr } from '../shared/format';
import { card, inp, iconBtn, StatCard, Empty } from '../shared/ui';
import { fillDays, SalesChart, BarRows } from './OverviewCharts';
import OrderingStatusPanel from './OrderingStatusPanel';

interface Props {
  stats: AdminStats | null;
  analytics: AdminAnalytics | null;
  analyticsError: string;
  onReloadAnalytics: () => void;
  range: { from: string; to: string };
  setRange: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>;
  onOpenUsers: () => void;
  onOpenCancelled: () => void;
  ordering: React.ComponentProps<typeof OrderingStatusPanel>;
}

/** A chart card that says what went wrong instead of claiming there is no data. */
function ChartCard({ title, right, error, onRetry, empty, children }: {
  title: string; right?: React.ReactNode; error?: string; onRetry?: () => void;
  empty?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 'var(--text-h4)' }}>{title}</h3>
        {right}
      </div>
      {error ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px', borderRadius: 'var(--radius-input)', background: 'var(--status-error-bg)', color: 'var(--status-error)' }}>
          <AlertTriangle size={17} style={{ flex: 'none', marginTop: 1 }} />
          <div style={{ flex: 1, fontSize: 'var(--text-sm)' }}>
            <strong style={{ display: 'block', marginBottom: 2 }}>This chart could not load.</strong>
            <span style={{ opacity: 0.85 }}>{error}</span>
          </div>
          {onRetry && <button onClick={onRetry} style={{ ...iconBtn, marginRight: 0, flex: 'none' }} title="Try again"><RefreshCw size={15} /></button>}
        </div>
      ) : empty ? <Empty text="No data for this period." /> : children}
    </div>
  );
}

/*
 * A heading for each half of this page.
 *
 * The page mixes two kinds of number - what the shop IS right now, and what it DID over a chosen
 * period - and they were interleaved under one date filter, so five all-time totals sat below the
 * Period control ignoring it. Position is what people actually read, so the fix is positional:
 * unfiltered above the filter, filtered below it. These labels say it in words as well.
 */
function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: -6 }}>
      <h3 style={{ fontSize: 'var(--text-h4)', color: 'var(--text-strong)' }}>{children}</h3>
      {hint && <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', fontWeight: 700 }}>{hint}</span>}
    </div>
  );
}

export default function OverviewTab({ stats, analytics, analyticsError, onReloadAnalytics, range, setRange, onOpenUsers, onOpenCancelled, ordering }: Props) {
  const loading = !analytics && !analyticsError;
  /* The period's own figures. Optional on the type because the frontend and the backend deploy
     separately: for the few minutes one is ahead of the other, every card reads an em dash instead
     of throwing on a field the old API never sent. */
  const T = analytics?.totals;
  /* The chosen range in words, next to the heading. A screenful of numbers under a date filter is
     only safe to read aloud if the dates are on the screen with them. */
  const periodLabel = range.from === range.to
    ? fmtDate(range.from)
    : `${fmtDate(range.from)} – ${fmtDate(range.to)}`;
  const series = analytics
    ? fillDays(analytics.salesByDay, analytics.from || range.from, analytics.to || range.to, analytics.cancelledByDay || [])
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Whether the shop can take money, above everything else. It used to live among the product
          settings, two tabs away, which is the wrong place for the one control that decides
          whether the site is trading. */}
      <OrderingStatusPanel {...ordering} />

      {/* ============ Not scoped to any period - kept ABOVE the filter on purpose ============ */}
      <SectionLabel hint="as it stands Â· the period filter below does not change these">The shop right now</SectionLabel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        <StatCard icon={<Users size={20} />} label="Customers" value={stats ? String(stats.totalUsers) : 'â'} sub="everyone registered" onClick={onOpenUsers} />
        <StatCard icon={<Package size={20} />} label="Products" value={stats ? String(stats.totalProducts) : 'â'} sub={stats && stats.unavailableProducts ? `${stats.unavailableProducts} unavailable` : 'all available'} />
        <StatCard icon={<MessageSquare size={20} />} label="New messages" value={stats ? String(stats.newMessages) : 'â'} sub="unread" accent={!!stats?.newMessages} />
      </div>

      {/* Who your customers are is a property of the customer base, not of a date range - which is
          why it lives up here now instead of under a filter it ignored. It replaces a "Customers by
          city" panel built on orders, which on a shop with nine customers and one completed order
          reported a single customer: a true answer to a question nobody was asking. */}
      <ChartCard title="Customers by state" right={<span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', fontWeight: 700 }}>every customer, all time</span>}>
        {!stats ? <Empty text="Loadingâ¦" />
          : !stats.customersByState?.length ? <Empty text="No customers yet." />
          : (() => {
              const rows = stats.customersByState;
              const shown = rows.slice(0, 10);
              const restStates = rows.length - shown.length;
              return (
                <>
                  <BarRows color="var(--google-blue)" items={shown.map(r => ({
                    label: r.state,
                    value: r.customers,
                    sub: `${r.customers} customer${r.customers === 1 ? '' : 's'}`,
                  }))} />
                  {/* Never silently truncate: if any state is off the bottom, say how many. */}
                  {restStates > 0 && (
                    <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: '10px 0 0', fontWeight: 700 }}>
                      +{restStates} more state{restStates === 1 ? '' : 's'}
                    </p>
                  )}
                </>
              );
            })()}
      </ChartCard>

      {/* ================ The filter. EVERYTHING below it is scoped to it. ================ */}
      <div style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}><CalendarRange size={16} /> Period</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Today is offered as a preset because it is the range somebody actually wants most
              mornings, and picking it by hand meant two date inputs and a chance to get one wrong. */}
          {([['Today', 1], ['7 days', 7], ['30 days', 30], ['90 days', 90], ['1 year', 365]] as const).map(([lbl, d]) => {
            const active = range.from === daysAgoStr(d - 1) && range.to === todayStr();
            return (
              <button key={lbl} onClick={() => setRange({ from: daysAgoStr(d - 1), to: todayStr() })}
                style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-xs)', border: active ? 'none' : '1.5px solid var(--border-default)', background: active ? 'var(--gradient-warm)' : 'var(--surface-card)', color: active ? 'var(--white)' : 'var(--text-body)' }}>{lbl}</button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <input type="date" value={range.from} max={range.to} onChange={e => e.target.value && setRange(r => ({ ...r, from: e.target.value }))} style={{ ...inp, width: 'auto', padding: '7px 10px', cursor: 'pointer' }} />
          <span style={{ color: 'var(--text-muted)' }}>â</span>
          <input type="date" value={range.to} min={range.from} max={todayStr()} onChange={e => e.target.value && setRange(r => ({ ...r, to: e.target.value }))} style={{ ...inp, width: 'auto', padding: '7px 10px', cursor: 'pointer' }} />
        </div>
      </div>

      <SectionLabel hint={periodLabel}>In this period</SectionLabel>

      {/*
        These five read from `analytics`, the endpoint that takes the date range. They used to read
        from `stats`, which counts the shop's whole history, while sitting under the filter - so
        choosing a single day left them untouched and they were read either as a broken filter or,
        worse, as that day's takings. A failure is reported rather than drawn as a zero: a card
        reading "0 orders" when the request died is a lie the same size as a wrong number.
      */}
      {analyticsError
        ? <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px', borderRadius: 'var(--radius-input)', background: 'var(--status-error-bg)', color: 'var(--status-error)' }}>
            <AlertTriangle size={17} style={{ flex: 'none', marginTop: 1 }} />
            <div style={{ flex: 1, fontSize: 'var(--text-sm)' }}>
              <strong style={{ display: 'block', marginBottom: 2 }}>These figures could not load.</strong>
              <span style={{ opacity: 0.85 }}>{analyticsError}</span>
            </div>
            <button onClick={onReloadAnalytics} style={{ ...iconBtn, marginRight: 0, flex: 'none' }} title="Try again"><RefreshCw size={15} /></button>
          </div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
            <StatCard icon={<ShoppingBag size={20} />} label="Orders" value={T ? String(T.orders) : 'â'} sub="Cancelled excluded" />
            <StatCard icon={<IndianRupee size={20} />} label="Revenue" value={T ? money(T.revenue) : 'â'} sub={T ? `${money(T.paidRevenue)} paid` : ''} />
            {/* The period's own customer number. The Customers card above counts everyone ever;
                this counts who joined while this range was running, which is the question somebody
                sets a date filter to ask. */}
            <StatCard icon={<UserPlus size={20} />} label="New signups" value={T ? String(T.newSignups) : 'â'} sub="registered in this period" onClick={onOpenUsers} />
            {/*
              Two cards, not one, because "cancelled or failed" covered two opposite situations.
              Someone closing the payment window costs nothing and needs nobody. A paid order that
              was then cancelled has a refund at the end of it. Averaging those into one number
              meant the one that needs acting on could not be seen.
            */}
            <StatCard icon={<XCircle size={20} />} label="Left at checkout" value={T ? String(T.cancelledUnpaid) : 'â'} sub="never paid â nothing owed" onClick={onOpenCancelled} />
            {/*
              The subtitle used to be decided by the count above it -- any cancelled-after-paying
              order read "refund owed", forever, including one refunded in full weeks ago. It said
              the opposite of what the same order said on the Orders tab. It now reports how many
              are actually unpaid, and the card only draws attention to itself while one of them is.
            */}
            <StatCard icon={<Undo2 size={20} />} label="Cancelled after paying" value={T ? String(T.cancelledAfterPayment) : 'â'}
              sub={!T ? '' : T.refundsOwed ? `${T.refundsOwed} refund${T.refundsOwed === 1 ? '' : 's'} owed` : T.cancelledAfterPayment ? 'all refunded â nothing owed' : 'none owed'}
              onClick={onOpenCancelled} accent={!!T?.refundsOwed} />
          </div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        <ChartCard title="Orders by status" error={analyticsError} onRetry={onReloadAnalytics}>
          {!analytics ? <Empty text="Loadingâ¦" />
            : !Object.keys(analytics.ordersByStatus || {}).length ? <Empty text="No orders in this period." />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(analytics.ordersByStatus || {}).map(([st, n]) => {
                  const pct = T && T.orders ? Math.round((n / T.orders) * 100) : 0;
                  return (
                    <div key={st}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4 }}><span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{st}</span><span style={{ color: 'var(--text-muted)' }}>{n}</span></div>
                      <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-sunken)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--gradient-warm)' }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
        </ChartCard>

        {/* Reads from `analytics` now, not `stats` - this panel used to rank the shop's all-time
            bestsellers while sitting under a date filter, so a record week and a dead one showed
            the identical list. */}
        <ChartCard title="Top products" error={analyticsError} onRetry={onReloadAnalytics}>
          {!analytics ? <Empty text="Loadingâ¦" />
            : !analytics.topProducts.length ? <Empty text="No sales in this period." />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {analytics.topProducts.map((pr, i) => (
                  <div key={pr.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 12, fontWeight: 900, display: 'grid', placeItems: 'center', flex: 'none' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{pr.name}</span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{pr.qty} sold Â· {money(pr.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
        </ChartCard>
      </div>

      <ChartCard
        title="Sales over time"
        error={analyticsError}
        onRetry={onReloadAnalytics}
        right={analytics && (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 700 }}>
            {money(analytics.salesByDay.reduce((s, d) => s + d.revenue, 0))} Â· {analytics.salesByDay.reduce((s, d) => s + d.orders, 0)} orders
          </span>
        )}
      >
        {loading
          ? <div style={{ height: 232, display: 'grid', placeItems: 'center', color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>Loadingâ¦</div>
          : <SalesChart data={series} />}
      </ChartCard>

      <ChartCard title="Orders by city" error={analyticsError} onRetry={onReloadAnalytics} empty={!!analytics && !analytics.ordersByArea.length}>
        {analytics
          ? <BarRows items={analytics.ordersByArea.map(a => ({ label: a.city, value: a.orders, sub: `${a.orders} order${a.orders === 1 ? '' : 's'} Â· ${money(a.revenue)}` }))} />
          : <Empty text="Loadingâ¦" />}
      </ChartCard>

      {/* The Payments and Shipments donuts are gone.
          Both counted every order in the range, cancelled included, so a quiet week rendered as
          "CANCELLED 50% Â· PAID 50%" and "NOT_CREATED 50% Â· Delivered 50%" - a pie chart of two
          slices, half of it an order that never happened. What they were being read for is answered
          properly elsewhere now: the two cancelled cards above, Orders by status for where the live
          ones are, and Needs attention for a paid order with no parcel. */}
    </div>
  );
}
