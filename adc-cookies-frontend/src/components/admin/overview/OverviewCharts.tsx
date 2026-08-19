'use client';
import { useState, useRef, useLayoutEffect } from 'react';
import { money } from '../shared/format';

/* ---------- Charts (lightweight inline SVG/CSS — no external deps) ---------- */

/** Fallback series colours, for breakdowns whose labels we don't recognise. */
export const PIE = ['var(--orange-600)', 'var(--green-success)', 'var(--google-blue)', 'var(--purple)', 'var(--orange-dark)', 'var(--gray)'];

/*
 * A payment or shipment state's colour, by meaning rather than by position in the list.
 *
 * These donuts used to take their colours from PIE by array index, so PAID was green only until a
 * quiet week reordered the rows and "cancelled" inherited the green. A status colour that moves is
 * worse than no colour at all — this is the one chart where the legend is the point.
 */
const STATE_COLOR: Record<string, string> = {
  PAID: 'var(--green-success)',
  DELIVERED: 'var(--green-success)',
  PENDING: 'var(--amber-500)',
  CANCELLED: 'var(--red-danger)',
  FAILED: 'var(--red-danger)',
  REFUNDED: 'var(--purple)',
  NOT_CREATED: 'var(--gray)',
  CREATED: 'var(--google-blue)',
};
export function stateColor(label: string, fallbackIndex = 0): string {
  const key = String(label || '').toUpperCase().replace(/[\s-]+/g, '_');
  return STATE_COLOR[key] || PIE[fallbackIndex % PIE.length];
}

/**
 * The element's live pixel width.
 *
 * The charts here are drawn at real pixel dimensions rather than stretched from a fixed viewBox.
 * The stretched version needed non-scaling-stroke on every line and could not hold a round dot or a
 * readable axis label — a `<text>` inside a non-uniformly scaled SVG comes out squashed, which is
 * why the old chart had no y-axis at all. Measuring costs one layout pass and buys real typography.
 *
 * Returns 0 until measured, so both the server and the first client render agree on the skeleton.
 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setWidth(el.clientWidth);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Round an axis maximum up to something a human would have picked (1/2/2.5/5 × a power of ten). */
function niceMax(raw: number): number {
  if (!(raw > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** ₹ on an axis, shortened — 1.2k / 3.4L — because "₹1,240,000" does not fit in a 46px gutter. */
function axisMoney(v: number): string {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v % 1e7 ? 1 : 0)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v % 1e5 ? 1 : 0)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(v % 1e3 ? 1 : 0)}k`;
  return `₹${v}`;
}

export interface SalesDay { day: string; revenue: number; paid: number; orders: number; cancelled?: number }

/**
 * Fill every calendar day in [from, to] so the chart has no gaps, and fold the separate
 * cancelled-per-day series in alongside. Capped at 370 points (for very long ranges the start is
 * clamped) to keep the SVG light.
 */
export function fillDays(
  rows: { day: string; revenue: number; orders: number; paid: number }[],
  from: string,
  to: string,
  cancelled: { day: string; orders: number }[] = [],
): SalesDay[] {
  const byDay = new Map(rows.map(r => [r.day, r]));
  const cancelledByDay = new Map(cancelled.map(r => [r.day, r.orders]));
  const out: SalesDay[] = [];
  const end = new Date(`${to}T00:00:00Z`);
  let start = new Date(`${from}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return rows.map(r => ({ ...r, cancelled: cancelledByDay.get(r.day) ?? 0 }));
  }
  const maxStart = new Date(end); maxStart.setUTCDate(end.getUTCDate() - 369);
  if (start < maxStart) start = maxStart;
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const r = byDay.get(key);
    out.push({
      day: key,
      revenue: r?.revenue ?? 0,
      orders: r?.orders ?? 0,
      paid: r?.paid ?? 0,
      cancelled: cancelledByDay.get(key) ?? 0,
    });
  }
  return out;
}

const fmtDay = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtDayLong = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Revenue and orders per day.
 *
 * Two scales on purpose: revenue is money and reads on the left axis; order count is a handful of
 * units and would be an invisible flat line against it, so it sits behind as faint bars on its own
 * scale. Paid revenue is a second line rather than a stacked band — the gap between "billed" and
 * "settled" is the thing worth seeing, and stacking hides it.
 *
 * Everything is drawn to measured pixels, so the axis labels are real text and the hover marker is
 * a real circle.
 */
export function SalesChart({ data }: { data: SalesDay[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverRaw, setHover] = useState<number | null>(null);
  const n = data.length;
  /* Clamped during render rather than reset in an effect: when the date range shrinks under a live
     hover, the stored index can point past the end of the new series. Deriving it here means there
     is never a frame where it does, and no extra render to correct one. */
  const hover = hoverRaw != null && hoverRaw < n ? hoverRaw : null;

  const H = 232;              // plot + axis strip
  const PAD = { l: 50, r: 14, t: 16, b: 26 };
  const plotW = Math.max(0, width - PAD.l - PAD.r);
  const plotH = H - PAD.t - PAD.b;

  if (!n) {
    return <div style={{ height: H, display: 'grid', placeItems: 'center', color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>No data for this period.</div>;
  }

  const peakRevenue = Math.max(...data.map(d => d.revenue));
  const totalOrders = data.reduce((s, d) => s + d.orders, 0);

  /* Nothing sold in this window. The chart used to draw a flat line pinned to the axis under the
     words "Peak ₹0", which reads as a broken chart rather than a quiet week — the shape of "no
     data" and the shape of "no sales" were identical. */
  if (peakRevenue <= 0 && totalOrders <= 0) {
    return (
      <div ref={ref} style={{ height: H, display: 'grid', placeItems: 'center', textAlign: 'center', gap: 3 }}>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-muted)' }}>No sales in this period</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 3 }}>{fmtDay(data[0].day)} – {fmtDay(data[n - 1].day)}</div>
        </div>
      </div>
    );
  }

  const yMax = niceMax(peakRevenue);
  const ordersMax = niceMax(Math.max(1, ...data.map(d => d.orders)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * yMax);

  const x = (i: number) => (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => plotH - (v / yMax) * plotH;
  const barW = Math.max(1.5, Math.min(18, (plotW / Math.max(1, n)) * 0.55));

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.revenue).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${plotH} L ${x(0).toFixed(1)} ${plotH} Z`;
  const paidLine = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.paid).toFixed(1)}`).join(' ');

  // Roughly six date labels, whatever the range length, always including the last day.
  const labelStep = Math.max(1, Math.round(n / 6));
  const showLabel = (i: number) => i === n - 1 || (i % labelStep === 0 && i < n - labelStep * 0.6);

  const active = hover != null ? data[hover] : null;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (plotW <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - PAD.l;
    const i = n <= 1 ? 0 : Math.round((px / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ position: 'relative', width: '100%', height: H, cursor: 'crosshair' }}
      >
        {width > 0 && (
          <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
              <linearGradient id="salesfill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--orange-600)" stopOpacity="0.26" />
                <stop offset="100%" stopColor="var(--orange-600)" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Gridlines + the money each one is worth. Without the labels the height of the line
                means nothing, which is what the previous chart amounted to. */}
            <g transform={`translate(${PAD.l},${PAD.t})`}>
              {ticks.map((t, i) => (
                <g key={t}>
                  <line x1={0} x2={plotW} y1={y(t)} y2={y(t)}
                    stroke={i === 0 ? 'var(--border-default)' : 'var(--border-soft)'} strokeWidth={1} />
                  <text x={-8} y={y(t)} textAnchor="end" dominantBaseline="middle"
                    style={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-subtle)', fontFamily: 'var(--font-body)' }}>
                    {axisMoney(Math.round(t))}
                  </text>
                </g>
              ))}

              {/* Order count, on its own scale, behind the revenue line. */}
              {data.map((d, i) => {
                const h = d.orders > 0 ? Math.max(2, (d.orders / ordersMax) * plotH * 0.62) : 0;
                if (!h) return null;
                return <rect key={d.day} x={x(i) - barW / 2} y={plotH - h} width={barW} height={h} rx={Math.min(3, barW / 2)}
                  fill="var(--amber-300)" opacity={hover === i ? 0.85 : 0.45} />;
              })}

              <path d={area} fill="url(#salesfill)" />
              <path d={line} fill="none" stroke="var(--orange-600)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
              {/* Only worth drawing when it differs from the billed line. */}
              {data.some(d => d.paid !== d.revenue) && (
                <path d={paidLine} fill="none" stroke="var(--green-success)" strokeWidth={1.75} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />
              )}

              {/* A day that took no money but lost orders still deserves a mark, or a run of
                  abandoned checkouts is completely invisible on this chart. */}
              {data.map((d, i) => (d.cancelled ? (
                <circle key={`c${d.day}`} cx={x(i)} cy={plotH} r={2.5} fill="var(--red-danger)" opacity={0.8} />
              ) : null))}

              {active && (
                <g>
                  <line x1={x(hover as number)} x2={x(hover as number)} y1={0} y2={plotH} stroke="var(--text-subtle)" strokeWidth={1} strokeDasharray="3 3" />
                  <circle cx={x(hover as number)} cy={y(active.revenue)} r={4.5} fill="var(--orange-600)" stroke="var(--surface-card)" strokeWidth={2} />
                  {active.paid !== active.revenue && (
                    <circle cx={x(hover as number)} cy={y(active.paid)} r={3.5} fill="var(--green-success)" stroke="var(--surface-card)" strokeWidth={2} />
                  )}
                </g>
              )}

              {/* Date ticks */}
              {data.map((d, i) => (showLabel(i) ? (
                <text key={`l${d.day}`} x={x(i)} y={plotH + 16} textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
                  style={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-subtle)', fontFamily: 'var(--font-body)' }}>
                  {fmtDay(d.day)}
                </text>
              ) : null))}
            </g>
          </svg>
        )}

        {/* Tooltip in HTML, not SVG — it needs to wrap, sit above everything, and use the same type
            scale as the rest of the panel. Flipped to the left of the cursor near the right edge so
            it never runs off the card. */}
        {active && width > 0 && (
          <div style={{
            position: 'absolute',
            left: PAD.l + x(hover as number) + (x(hover as number) > plotW - 130 ? -140 : 12),
            top: PAD.t,
            pointerEvents: 'none',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-strong)',
            borderRadius: 10, padding: '8px 11px', minWidth: 124,
            boxShadow: 'var(--shadow-md)', zIndex: 2,
          }}>
            <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-muted)', marginBottom: 5 }}>{fmtDayLong(active.day)}</div>
            <TipRow color="var(--orange-600)" label="Revenue" value={money(active.revenue)} />
            {active.paid !== active.revenue && <TipRow color="var(--green-success)" label="Paid" value={money(active.paid)} />}
            <TipRow color="var(--amber-300)" label="Orders" value={String(active.orders)} />
            {!!active.cancelled && <TipRow color="var(--red-danger)" label="Cancelled" value={String(active.cancelled)} />}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, paddingLeft: PAD.l, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 700 }}>
        <LegendKey color="var(--orange-600)" label="Revenue" />
        {data.some(d => d.paid !== d.revenue) && <LegendKey color="var(--green-success)" label="Paid" dashed />}
        <LegendKey color="var(--amber-300)" label="Orders" square />
        {data.some(d => d.cancelled) && <LegendKey color="var(--red-danger)" label="Cancelled" />}
        <span style={{ marginLeft: 'auto', color: 'var(--text-subtle)' }}>Peak {money(peakRevenue)}</span>
      </div>
    </div>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--text-2xs)', lineHeight: 1.7 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: 'none' }} />
      <span style={{ flex: 1, color: 'var(--text-muted)' }}>{label}</span>
      <strong style={{ color: 'var(--text-strong)' }}>{value}</strong>
    </div>
  );
}

function LegendKey({ color, label, dashed, square }: { color: string; label: string; dashed?: boolean; square?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: square ? 9 : 14, height: square ? 9 : 3, borderRadius: square ? 2 : 99, flex: 'none',
        background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : color,
      }} />
      {label}
    </span>
  );
}

export function BarRows({ items, color = 'var(--orange-600)' }: { items: { label: string; value: number; sub?: string }[]; color?: string }) {
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
  /* Each arc's start is the sum of the ones before it. Accumulated up front rather than by mutating
     a `let` inside the map below — a variable reassigned while rendering is not safe under the React
     compiler, and this says the same thing without the mutation. */
  const arcs = segments.map((s, i) => ({
    ...s,
    dash: (s.value / total) * c,
    offset: segments.slice(0, i).reduce((acc, prev) => acc + (prev.value / total) * c, 0),
  }));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 130, height: 130, flex: 'none' }}>
        <svg viewBox="0 0 130 130" width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="65" cy="65" r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={sw} />
          {arcs.map(s => (
            <circle key={s.label} cx="65" cy="65" r={r} fill="none" strokeWidth={sw}
              strokeDasharray={`${s.dash} ${c - s.dash}`} strokeDashoffset={-s.offset} style={{ stroke: s.color }} />
          ))}
        </svg>
        {center && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}><div><div style={{ fontWeight: 900, fontSize: 'var(--text-h4)', color: 'var(--text-strong)' }}>{center}</div>{centerSub && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{centerSub}</div>}</div></div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 120 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flex: 'none' }} />
            <span style={{ flex: 1, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{s.value}</span>
            <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-2xs)', flex: 'none', width: 34, textAlign: 'right' }}>{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
