'use client';
import { PackageCheck, Check, Bike, Home, Tag } from 'lucide-react';
import SiteHeader from '@/components/storefront/SiteHeader';
import Footer from '@/components/storefront/Footer';

export default function OrderSuccessPage({ show, total, orderId, eta, summary, pendingPayment, onBackToMenu, onViewOrder }: {
  show: boolean; total: number; orderId: string; eta: string;
  summary: { items: { name: string; qty: number }[]; couponCode: string | null } | null;
  pendingPayment?: boolean;
  onBackToMenu: () => void; onViewOrder: () => void;
}) {
  const steps = [
    { icon: <Check size={18} />, label: 'Placed', done: true },
    { icon: <span style={{ fontSize: 14 }}>🧑‍🍳</span>, label: 'Baking', done: false },
    { icon: <Bike size={18} />, label: 'On way', done: false },
    { icon: <Home size={18} />, label: 'Delivered', done: false },
  ];
  return (
    <div className="adc-pattern-page" style={{ position: 'fixed', inset: 0, zIndex: 72, transform: show ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .38s cubic-bezier(.4,0,.2,1)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Same header and footer as every other page — a customer who has just paid should still
          have the nav. This screen is a fixed overlay, so the chrome lives inside it. */}
      <SiteHeader />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', boxShadow: '0 20px 60px var(--amber-500-38)', animation: 'riseIn .5s var(--ease-spring) both', marginBottom: 28 }}>
          <Check size={62} strokeWidth={3} style={{ color: 'var(--white)' }} />
        </div>
        <div style={{ display: 'inline-block', background: 'var(--green-wash)', color: 'var(--green-success)', fontWeight: 800, fontSize: 'var(--text-sm)', padding: '5px 14px', borderRadius: 'var(--radius-pill)', marginBottom: 16 }}>{pendingPayment ? 'Order Confirmed' : 'Payment Successful'}</div>
        <h1 style={{ font: 'var(--weight-extra) var(--text-h1)/1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 10px' }}>Order Placed!</h1>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', margin: '0 0 6px' }}>{pendingPayment ? 'Pay when you collect at the stall, see you soon!' : 'Your cookies are being baked fresh.'}</p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)', margin: '0 0 24px' }}>Order <strong style={{ color: 'var(--text-strong)' }}>{orderId}</strong> · ₹{total}</p>
        {summary && summary.items.length > 0 && (
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', padding: '16px 18px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-subtle)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Order summary</div>
            {summary.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 'var(--text-sm)', color: 'var(--text-body)', padding: '4px 0' }}>
                <span>{it.name}</span>
                <span style={{ color: 'var(--text-muted)', flex: 'none' }}>× {it.qty}</span>
              </div>
            ))}
            {summary.couponCode && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-default)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--brand-secondary)' }}>
                <Tag size={13} /> Coupon applied: {summary.couponCode}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)', marginBottom: 36 }}>
          <Bike size={22} color="var(--brand-secondary)" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-base)' }}>{eta}</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Estimated delivery</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 16 }}>
          {steps.map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 64 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: step.done ? 'var(--gradient-warm)' : 'var(--surface-sunken)', boxShadow: step.done ? '0 6px 20px var(--amber-500-35)' : 'none', color: step.done ? 'var(--white)' : 'var(--text-subtle)' }}>{step.icon}</div>
                <span style={{ fontSize: 'var(--text-2xs)', color: step.done ? 'var(--text-strong)' : 'var(--text-subtle)', fontWeight: step.done ? 800 : 500, whiteSpace: 'nowrap' }}>{step.label}</span>
              </div>
              {i < steps.length - 1 && <div style={{ height: 2, width: 24, background: 'var(--border-strong)', marginTop: 19, flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-card)', borderTop: '1px solid var(--border-soft)' }}>
        <button onClick={onViewOrder} style={{ width: '100%', padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><PackageCheck size={18} /> See your order &amp; status</button>
        <button onClick={onBackToMenu} style={{ width: '100%', padding: '16px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer' }}>Order more cookies</button>
      </div>
      <Footer />
    </div>
  );
}

/* ---- Corporate Gifting — bulk packages + request-a-quote ---- */
