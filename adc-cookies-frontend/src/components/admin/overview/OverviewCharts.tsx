'use client';
import { money } from '../shared/format';

/* ---------- Charts (lightweight inline SVG/CSS — no external deps) ---------- */
export const PIE = ['var(--orange-cta)', 'var(--green-success)', 'var(--google-blue)', 'var(--purple)', 'var(--orange-dark)', 'var(--gray)'];

// Fill every calendar day in [from, to] so the line chart has no gaps. Capped at 370 points
// (for very long ranges the start is clamped) to keep the SVG light.
export function fillDays(rows: { day: string; revenue: number; orders: number; paid: number }[], from: string, to: string) {
  const byDay = new Map(rows.map(r => [r.day, r]));
  const out: { day: string; revenue: number; orders: number; paid: number }[] = [];
  const end = new Date(`${to}T00:00:00Z`);
  let start = new Date(`${from}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return rows;
  const maxStart = new Date(end); maxStart.setUTCDate(end.getUTCDate() - 369);
  if (start < maxStart) start = maxStart;
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const r = byDay.get(key);
    out.push({ day: key, revenue: r?.revenue ?? 0, orders: r?.orders ?? 0, paid: r?.paid ?? 0 });
  }
  return out;
}

export function SalesChart({ data }: { data: { day: string; revenue: number; paid: number }[] }) {
  const W = 760, H = 200, pl = 6, pr = 6, pt = 14, pb = 22;
  const n = data.length;
  const max = Math.max(1, ...data.map(d => d.revenue));
  const x = (i: number) => pl + (n <= 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1));
  const y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.revenue).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${(H - pb).toFixed(1)} L ${x(0).toFixed(1)} ${(H - pb).toFixed(1)} Z`;
  const peakI = data.reduce((bi, d, i) => (d.revenue > data[bi].revenue ? i : bi), 0);
  const fmtDay = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block', height: 200 }}>
        <defs>
          <linearGradient id="salesfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--orange-cta)' }} stopOpacity="0.35" />
            <stop offset="100%" style={{ stopColor: 'var(--orange-cta)' }} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(g => <line key={g} x1={pl} x2={W - pr} y1={pt + g * (H - pt - pb)} y2={pt + g * (H - pt - pb)} stroke="var(--border-soft)" strokeWidth="1" />)}
        <path d={area} fill="url(#salesfill)" />
        <path d={line} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: 'var(--orange-cta)' }} />
        {max > 1 && <circle cx={x(peakI)} cy={y(data[peakI].revenue)} r="4" strokeWidth="2" style={{ fill: 'var(--orange-cta)', stroke: 'var(--white)' }} />}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 2 }}>
        <span>{fmtDay(data[0].day)}</span>
        <span>Peak {money(data[peakI].revenue)} · {fmtDay(data[peakI].day)}</span>
        <span>{fmtDay(data[n - 1].day)}</span>
      </div>
    </div>
  );
}

export function BarRows({ items, color = 'var(--orange-cta)' }: { items: { label: string; value: number; sub?: string }[]; color?: string }) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {items.map(it => (
        <div key={it.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4, gap: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
            <span style={{ color: 'var(--text-muted)', flex: 'none' }}>{it.sub ?? it.value}</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(3, (it.value / max) * 100)}%`, height: '100%', background: color, borderRadius: 99 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Donut({ segments, center, centerSub }: { segments: { label: string; value: number; color: string }[]; center?: string; centerSub?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 52, sw = 18, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 130, height: 130, flex: 'none' }}>
        <svg viewBox="0 0 130 130" width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="65" cy="65" r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={sw} />
          {segments.map(s => {
            const frac = s.value / total;
            const dash = frac * c;
            const el = <circle key={s.label} cx="65" cy="65" r={r} fill="none" strokeWidth={sw} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} style={{ stroke: s.color }} />;
            offset += dash;
            return el;
          })}
        </svg>
        {center && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}><div><div style={{ fontWeight: 900, fontSize: 'var(--text-h4)', color: 'var(--text-strong)' }}>{center}</div>{centerSub && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{centerSub}</div>}</div></div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 120 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flex: 'none' }} />
            <span style={{ flex: 1, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
