'use client';
import { CalendarRange } from 'lucide-react';
import { todayStr, daysAgoStr } from './format';
import { card, inp } from './ui';

export interface DateRange { from: string; to: string }

/**
 * The date-range control: quick presets plus two date inputs, in IST.
 *
 * Shared by Overview and Traffic, so "30 days" means the same days on both — they sit a tab apart
 * and are read against each other.
 */
export default function PeriodBar({ range, setRange }: {
  range: DateRange;
  setRange: React.Dispatch<React.SetStateAction<DateRange>>;
}) {
  return (
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
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <input type="date" value={range.to} min={range.from} max={todayStr()} onChange={e => e.target.value && setRange(r => ({ ...r, to: e.target.value }))} style={{ ...inp, width: 'auto', padding: '7px 10px', cursor: 'pointer' }} />
      </div>
    </div>
  );
}
