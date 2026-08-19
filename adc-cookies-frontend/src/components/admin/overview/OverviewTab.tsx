'use client';
import { Users, ShoppingBag, Package, MessageSquare, IndianRupee, CalendarRange, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { type AdminStats, type AdminAnalytics } from '@/lib/api';
import { money, todayStr, daysAgoStr } from '../shared/format';
import { card, inp, iconBtn, StatCard, Empty } from '../shared/ui';
import { fillDays, SalesChart, BarRows, Donut, stateColor } from './OverviewCharts';
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

export default function OverviewTab({ stats, analytics, analyticsError, onReloadAnalytics, range, setRange, onOpenUsers, onOpenCancelled, ordering }: Props) {
  const loading = !analytics && !analyticsError;
  const series = analytics
    ? fillDays(analytics.salesByDay, analytics.from || range.from, analytics.to || range.to, analytics.cancelledByDay || [])
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Whether the shop can take money, above everything else. It used to live among the product
          settings, two tabs away, which is the wrong place for the one control that decides
          whether the site is trading. */}
      <OrderingStatusPanel {...ordering} />

      {/* Date-range filter — scopes the analytics charts below */}
      <div style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}><CalendarRange size={16} /> Period</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([['7 days', 7], ['30 days', 30], ['90 days', 90], ['1 year', 365]] as const).map(([lbl, d]) => {
            const active = range.from === daysAgoStr(d - 1) && range.to === todayStr();
            return (
              <button key={lbl} onClick={() => setRange({ from: daysAgoStr(d - 1), to: todayStr() })}
                style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-xs)', border: active ? 'none' : '1.5px solid var(--border-default)', background: active ? 'var(--gradient-warm)' : 'var(--surface-card)', color: active ? 'var(--white)' : 'var(--text-body)' }}>{lbl}</button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <input type="date" value={range.from} max={range.to} onChange={e => e.target.value && setRange(r => ({ ...r, from: e.target.value }))} style={{ ...inp, width: 'auto', padding: '7px 10px', cursor: 'pointer' }} />
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <input type="date" value={range.to} min={range.from} max={todayStr()} onChange={e => e.target.value && setRange(r => ({ ...r, to: e.target.value }))} style={{ ...inp, width: 'auto', padding: '7px 10px', cursor: 'pointer' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        <StatCard icon={<Users size={20} />} label="Customers" value={stats ? String(stats.totalUsers) : '—'} onClick={onOpenUsers} />
        <StatCard icon={<ShoppingBag size={20} />} label="Orders" value={stats ? String(stats.totalOrders) : '—'} sub="Cancelled excluded" />
        <StatCard icon={<IndianRupee size={20} />} label="Revenue" value={stats ? money(stats.totalRevenue) : '—'} sub={stats ? `${money(stats.paidRevenue)} paid` : ''} />
        {/* Its own card rather than a bar among the live statuses: an abandoned checkout is not a
            stage an order passes through, it is the order not happening. */}
        <StatCard icon={<XCircle size={20} />} label="Cancelled / failed" value={stats ? String(stats.cancelledOrders) : '—'} onClick={onOpenCancelled} accent={!!stats?.cancelledOrders} />
        <StatCard icon={<Package size={20} />} label="Products" value={stats ? String(stats.totalProducts) : '—'} sub={stats && stats.unavailableProducts ? `${stats.unavailableProducts} unavailable` : 'all available'} />
        <StatCard icon={<MessageSquare size={20} />} label="New messages" value={stats ? String(stats.newMessages) : '—'} accent={!!stats?.newMessages} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        <div style={{ ...card, padding: 20 }}>
          <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 14 }}>Orders by status</h3>
          {stats && Object.keys(stats.ordersByStatus || {}).length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(stats.ordersByStatus || {}).map(([s, n]) => {
                const pct = stats.totalOrders ? Math.round((n / stats.totalOrders) * 100) : 0;
                return (
                  <div key={s}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4 }}><span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{s}</span><span style={{ color: 'var(--text-muted)' }}>{n}</span></div>
                    <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-sunken)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--gradient-warm)' }} /></div>
                  </div>
                );
              })}
            </div>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No orders yet.</p>}
        </div>

        <div style={{ ...card, padding: 20 }}>
          <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 14 }}>Top products</h3>
          {stats && (stats.topProducts || []).length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(stats.topProducts || []).map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 12, fontWeight: 900, display: 'grid', placeItems: 'center', flex: 'none' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{p.name}</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{p.qty} sold · {money(p.revenue)}</span>
                </div>
              ))}
            </div>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No sales yet.</p>}
        </div>
      </div>

      {/* Sales over the chosen period */}
      <ChartCard
        title="Sales over time"
        error={analyticsError}
        onRetry={onReloadAnalytics}
        right={analytics && (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 700 }}>
            {money(analytics.salesByDay.reduce((s, d) => s + d.revenue, 0))} · {analytics.salesByDay.reduce((s, d) => s + d.orders, 0)} orders
          </span>
        )}
      >
        {loading
          ? <div style={{ height: 232, display: 'grid', placeItems: 'center', color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>Loading…</div>
          : <SalesChart data={series} />}
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
        <ChartCard title="Orders by city" error={analyticsError} onRetry={onReloadAnalytics} empty={!!analytics && !analytics.ordersByArea.length}>
          {analytics
            ? <BarRows items={analytics.ordersByArea.map(a => ({ label: a.city, value: a.orders, sub: `${a.orders} order${a.orders === 1 ? '' : 's'} · ${money(a.revenue)}` }))} />
            : <Empty text="Loading…" />}
        </ChartCard>

        <ChartCard title="Customers by city" error={analyticsError} onRetry={onReloadAnalytics} empty={!!analytics && !analytics.usersByCity.length}>
          {analytics
            ? <BarRows color="var(--google-blue)" items={analytics.usersByCity.map(u => ({ label: u.city, value: u.users, sub: `${u.users} customer${u.users === 1 ? '' : 's'}` }))} />
            : <Empty text="Loading…" />}
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
        <ChartCard title="Payments" error={analyticsError} onRetry={onReloadAnalytics} empty={!!analytics && !analytics.paymentBreakdown.length}>
          {analytics
            ? <Donut
                segments={analytics.paymentBreakdown.map((p, i) => ({ label: p.status, value: p.count, color: stateColor(p.status, i) }))}
                center={`${analytics.paymentBreakdown.reduce((s, p) => s + p.count, 0)}`} centerSub="orders" />
            : <Empty text="Loading…" />}
        </ChartCard>
        <ChartCard title="Shipments" error={analyticsError} onRetry={onReloadAnalytics} empty={!!analytics && !analytics.shipmentByStatus.length}>
          {analytics
            ? <Donut
                segments={analytics.shipmentByStatus.map((s, i) => ({ label: s.status, value: s.count, color: stateColor(s.status, i) }))}
                center={`${analytics.shipmentByStatus.reduce((s, x) => s + x.count, 0)}`} centerSub="orders" />
            : <Empty text="Loading…" />}
        </ChartCard>
      </div>
    </div>
  );
}
