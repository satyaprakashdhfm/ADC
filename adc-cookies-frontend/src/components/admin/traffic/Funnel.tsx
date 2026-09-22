'use client';
import type { AdminTraffic } from '@/lib/api';
import { Empty } from '../shared/ui';
import { num, pct } from './trafficFormat';

type Step = NonNullable<AdminTraffic['google']['funnel']>[number];

/**
 * From arriving to paying, as people rather than clicks: how many reached each step, and how many
 * of the step before made it this far. The biggest drop is where to look first.
 */
export default function Funnel({ steps, paidOrders }: { steps: Step[]; paidOrders: number }) {
  const top = steps[0]?.people || 0;
  if (!top) return <Empty text="No visits recorded in this period." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1]?.people ?? 0 : 0;
        return (
          <div key={s.step}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 'var(--text-sm)', marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{i + 1}. {s.label}</span>
              <span style={{ color: 'var(--text-muted)' }}>
                <b style={{ color: 'var(--text-strong)' }}>{num(s.people)}</b> {s.people === 1 ? 'person' : 'people'}
                {i > 0 && <> · {pct(s.people, prev)} of the step before</>}
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 99, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(s.people ? 2 : 0, (s.people / top) * 100)}%`, height: '100%', background: 'var(--gradient-warm)', borderRadius: 99 }} />
            </div>
          </div>
        );
      })}
      <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', lineHeight: 1.6, margin: '2px 0 0' }}>
        Our own records show <b>{num(paidOrders)}</b> paid order{paidOrders === 1 ? '' : 's'} in this period. Google&apos;s &ldquo;Paid&rdquo; is usually a little lower: people who block tracking in their browser still pay, but Google never sees them.
      </p>
    </div>
  );
}
