'use client';
import { Check } from 'lucide-react';

export function CheckoutStepper({ current, inline = false }: { current: 'review' | 'pay'; inline?: boolean }) {
  const steps = ['Cart', 'Checkout', 'Payment'];
  const activeIndex = current === 'pay' ? 2 : 1; // by the time we're here, the cart step is behind us
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: inline ? 0 : '0 var(--gutter) 12px' }}>
      {steps.map((label, i) => {
        const done = i < activeIndex;
        const isCurrent = i === activeIndex;
        const on = done || isCurrent;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 'clamp(76px,22vw,104px)' }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, flex: 'none', background: on ? 'var(--gradient-warm)' : 'transparent', color: on ? 'var(--white)' : 'var(--text-subtle)', border: on ? 'none' : '2px solid var(--border-strong)', boxShadow: isCurrent ? 'var(--shadow-brand)' : 'none' }}>
                {done ? <Check size={15} strokeWidth={3} /> : i + 1}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: isCurrent ? 800 : 600, color: isCurrent ? 'var(--text-strong)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < steps.length - 1 && <div style={{ width: 'clamp(24px,8vw,56px)', height: 2, marginTop: 13, borderRadius: 2, flexShrink: 0, background: i < activeIndex ? 'var(--gradient-warm)' : 'var(--border-strong)' }} />}
          </div>
        );
      })}
    </div>
  );
}

export function Dot({ on }: { on: boolean }) {
  return <span style={{ width: 22, height: 22, borderRadius: '50%', border: on ? '6px solid var(--brand-secondary)' : '2px solid var(--border-strong)', flex: 'none', transition: 'border .15s' }} />;
}

export function Dash() {
  return <div style={{ height: 1, background: 'repeating-linear-gradient(90deg,var(--border-strong) 0,var(--border-strong) 6px,transparent 6px,transparent 12px)', margin: '6px 0 8px' }} />;
}

/* ---- Thumbnail ---- */
