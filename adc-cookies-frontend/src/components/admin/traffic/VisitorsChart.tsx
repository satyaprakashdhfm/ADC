'use client';
import type { AdminTraffic } from '@/lib/api';
import { fmtDate } from '../shared/format';
import { Empty } from '../shared/ui';

type Day = NonNullable<AdminTraffic['google']['byDay']>[number];

/**
 * Visitors per day, as bars. Days with nobody are drawn as empty slots rather than skipped, so a
 * quiet Tuesday reads as a quiet Tuesday and not as a chart that ends early.
 */
export default function VisitorsChart({ days, from, to }: { days: Day[]; from: string; to: string }) {
  const byDay = new Map(days.map(d => [d.day, d]));
  const all: Day[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 864e5) {
    const day = new Date(t).toISOString().slice(0, 10);
    all.push(byDay.get(day) || { day, visitors: 0, visits: 0 });
  }
  if (!all.some(d => d.visitors)) return <Empty text="No visitors recorded in this period." />;
  const max = Math.max(1, ...all.map(d => d.visitors));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: all.length > 60 ? 1 : 3, height: 130 }}>
        {all.map(d => (
          <div key={d.day} title={`${fmtDate(d.day)}: ${d.visitors} visitor${d.visitors === 1 ? '' : 's'}, ${d.visits} visit${d.visits === 1 ? '' : 's'}`}
            style={{ flex: 1, minWidth: 1, height: `${Math.max(d.visitors ? 4 : 1, (d.visitors / max) * 100)}%`, background: d.visitors ? 'var(--google-blue)' : 'var(--surface-sunken)', borderRadius: '3px 3px 0 0' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', fontWeight: 700, marginTop: 6 }}>
        <span>{fmtDate(from)}</span>
        <span>busiest day: {max} visitor{max === 1 ? '' : 's'}</span>
        <span>{fmtDate(to)}</span>
      </div>
    </div>
  );
}
