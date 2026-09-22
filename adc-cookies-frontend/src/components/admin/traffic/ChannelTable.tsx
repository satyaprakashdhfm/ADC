'use client';
import type { AdminTraffic } from '@/lib/api';
import { Table, td, Empty } from '../shared/ui';
import { Labelled } from './TrafficParts';
import { num, rupees, pct } from './trafficFormat';

/**
 * Where people came from, and what that turned into — one row per source.
 *
 * Visitors and visits are Google Analytics'; paid orders and revenue are ours. They sit on the
 * same row because the backend sorts both into the same list of sources, which is the whole point:
 * "Instagram brought 300 visitors and 2 orders, the ads brought 90 and 6" is the sentence this
 * table exists to let someone say.
 */
export default function ChannelTable({ report }: { report: AdminTraffic }) {
  const g = report.google.connected;
  const rows = report.channels;
  if (!rows.length) return <Empty text="Nobody visited and nothing was ordered in this period." />;
  return (
    <Table head={['Where from', 'Visitors', 'Visits', 'Paid orders', 'Revenue', 'Visits that ordered']}>
      {rows.map(r => (
        <tr key={r.key}>
          <td style={td}><Labelled label={r.label} hint={r.hint} /></td>
          <td style={td}>{g ? num(r.visitors) : '—'}</td>
          <td style={td}>{g ? num(r.visits) : '—'}</td>
          <td style={{ ...td, fontWeight: 800, color: r.orders ? 'var(--text-strong)' : 'var(--text-subtle)' }}>{num(r.orders)}</td>
          <td style={td}>{r.orders ? rupees(r.revenue) : '—'}</td>
          <td style={td}>{g && r.visits ? pct(r.orders, r.visits) : '—'}</td>
        </tr>
      ))}
    </Table>
  );
}
