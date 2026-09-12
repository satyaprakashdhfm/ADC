'use client';
import { useState } from 'react';
import { X, Truck, CheckCircle2, AlertTriangle } from 'lucide-react';

/*
 * Setting an order's status by hand, from the shop counter.
 *
 * This exists because the shop delivers its own orders. When Shiprocket finds no rider, or the
 * booking is cancelled, a manager takes the parcel out personally — and until now the status stayed
 * wherever the carrier left it, so the customer had no way to know and rang the shop to ask. This
 * is the screen that answers them.
 *
 * The whole list is offered rather than a couple of buttons, because a counter that has the parcel
 * in its hands knows more about where it is than we do. The two that matter most are pulled out
 * above the rest: OUT_FOR_DELIVERY and DELIVERED are the ones a manual delivery actually needs, and
 * making somebody hunt for them in a dropdown of seven is how the feature goes unused.
 */

const STATUSES = [
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery', hint: 'Someone from the shop is taking it now' },
  { value: 'DELIVERED', label: 'Delivered', hint: 'It reached the customer' },
  { value: 'PLACED', label: 'Placed', hint: 'Back to the very start' },
  { value: 'CONFIRMED', label: 'Confirmed', hint: 'Paid and accepted, not started' },
  { value: 'PREPARING', label: 'Preparing', hint: 'Being baked' },
  { value: 'PACKED', label: 'Packed', hint: 'Bagged and waiting' },
  { value: 'CANCELLED', label: 'Cancelled', hint: 'Calls off the POS ticket and the rider' },
] as const;

const PRIMARY = 2;   // how many of the list above are the everyday ones

export default function StatusPopup({
  orderNumber, current, busy, onClose, onSet,
}: {
  orderNumber: string;
  current: string;
  busy: boolean;
  onClose: () => void;
  onSet: (status: string, remarks: string) => void;
}) {
  const [picked, setPicked] = useState<string>('');
  const [note, setNote] = useState('');

  const chosen = STATUSES.find(s => s.value === picked);

  const row = (s: typeof STATUSES[number]) => {
    const isNow = s.value === current;
    const active = s.value === picked;
    return (
      <button
        key={s.value}
        disabled={isNow || busy}
        onClick={() => setPicked(s.value)}
        style={{
          width: '100%', textAlign: 'left', padding: '11px 13px', borderRadius: 10, marginBottom: 7,
          cursor: isNow ? 'default' : 'pointer', opacity: isNow ? 0.45 : 1,
          border: '1.5px solid ' + (active ? 'var(--brand-orange, #e8641c)' : 'var(--border-default, #e5e0d5)'),
          background: active ? '#fff6ef' : 'var(--surface-card, #fff)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
        {s.value === 'OUT_FOR_DELIVERY' ? <Truck size={17} /> : s.value === 'DELIVERED' ? <CheckCircle2 size={17} /> : null}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{s.label}</span>
          {isNow && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-subtle, #8a7f70)' }}> · current</span>}
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-subtle, #8a7f70)', marginTop: 1 }}>{s.hint}</span>
        </span>
      </button>
    );
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,14,8,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(460px, 96vw)', maxHeight: '88vh', overflowY: 'auto',
        background: 'var(--surface-page, #fffdf8)', borderRadius: 16, padding: 18,
        boxShadow: '0 20px 60px rgba(0,0,0,.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>Update status</h3>
            <div style={{ fontSize: 13, color: 'var(--text-subtle, #8a7f70)', marginTop: 2 }}>
              {orderNumber} · now <strong>{current}</strong>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Said once, plainly, so a counter knows what marking DELIVERED means here rather than
            discovering it from the admin list later. */}
        <p style={{ fontSize: 12.5, color: 'var(--text-muted, #6b6155)', lineHeight: 1.5, margin: '10px 0 14px' }}>
          Use this when the shop handles the delivery itself — no rider from Shiprocket, or you have
          arranged your own. Marking it <strong>Delivered</strong> records it as{' '}
          <strong>delivered by us</strong>, and the customer gets the same email they would have got
          from a courier.
        </p>

        {STATUSES.slice(0, PRIMARY).map(row)}

        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase',
                      color: 'var(--text-subtle, #8a7f70)', margin: '12px 0 7px' }}>
          Other statuses
        </div>
        {STATUSES.slice(PRIMARY).map(row)}

        {picked === 'CANCELLED' && (
          /* The one that does something a counter cannot undo. It calls off the POS ticket and the
             courier, and it does NOT refund — refunds are an admin action on their own screen. A
             cancellation is the only choice here that can leave a customer charged for nothing. */
          <div style={{ display: 'flex', gap: 9, padding: '11px 13px', borderRadius: 10, marginTop: 4,
                        background: '#fdecec', border: '1.5px solid #e9b4b1' }}>
            <AlertTriangle size={17} style={{ color: '#a4231d', flex: 'none', marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: '#7d1c17', lineHeight: 1.5 }}>
              This calls off the POS ticket and the rider, but it does <strong>not refund</strong> the
              customer. If they have paid, ask the office to refund from the admin dashboard.
            </div>
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, margin: '14px 0 5px' }}>
          Note for the customer <span style={{ fontWeight: 600, color: 'var(--text-subtle, #8a7f70)' }}>(optional)</span>
        </label>
        <input
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 200))}
          placeholder="e.g. our own rider is bringing it"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
            border: '1.5px solid var(--border-default, #e5e0d5)', fontSize: 14,
            background: 'var(--surface-card, #fff)',
          }}
        />
        <div style={{ fontSize: 11.5, color: 'var(--text-subtle, #8a7f70)', marginTop: 4 }}>
          Goes into the customer&rsquo;s email, so write it for them.
        </div>

        <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
          <button onClick={onClose} disabled={busy} style={{
            flex: '0 0 auto', padding: '12px 18px', borderRadius: 10, cursor: 'pointer', fontWeight: 800,
            border: '1px solid var(--border-default, #e5e0d5)', background: 'var(--surface-card, #fff)',
          }}>Cancel</button>
          <button
            disabled={!picked || busy}
            onClick={() => picked && onSet(picked, note.trim())}
            style={{
              flex: 1, padding: '12px 18px', borderRadius: 10, fontWeight: 800, border: 'none',
              cursor: !picked || busy ? 'not-allowed' : 'pointer',
              opacity: !picked || busy ? 0.55 : 1,
              background: picked === 'CANCELLED' ? '#a4231d' : 'var(--brand-orange, #e8641c)',
              color: '#fff',
            }}>
            {busy ? 'Saving…' : chosen ? `Mark ${chosen.label.toLowerCase()}` : 'Pick a status'}
          </button>
        </div>
      </div>
    </div>
  );
}
