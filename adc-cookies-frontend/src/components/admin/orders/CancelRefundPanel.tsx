'use client';
import { useState } from 'react';
import { ShieldAlert, Send } from 'lucide-react';
import { adminRequestCancelCode, adminCancelAndRefund, type Order } from '@/lib/api';
import { card, inp, addBtn } from '../shared/ui';

/**
 * Cancel an order and refund it, behind a code sent to the admin's own phone.
 *
 * The two steps are deliberately not collapsible into one. A refund cannot be recalled, so the
 * reason is written BEFORE the code is requested — by the time the code arrives the decision is
 * already on the screen in the admin's own words, and the code confirms that decision rather than
 * being the first moment anyone thinks about it.
 *
 * The server sends the code to the number on the admin's user row and never to one supplied here,
 * so this component cannot influence where it lands. It only carries the digits back.
 */
export default function CancelRefundPanel({ order, onDone, setErr }: {
  order: Order;
  onDone: () => void;
  setErr: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<{ phoneHint: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ refunded: boolean; notes: string[] } | null>(null);

  const paid = order.paymentStatus === 'PAID';
  const gone = order.orderStatus === 'CANCELLED' || order.orderStatus === 'DELIVERED';

  const requestCode = async () => {
    if (!reason.trim()) { setErr('Write the reason first — the customer is shown it.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await adminRequestCancelCode(order.id);
      setSent({ phoneHint: r.phoneHint });
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not send the code.'); }
    setBusy(false);
  };

  const confirm = async () => {
    setBusy(true); setErr('');
    try {
      const r = await adminCancelAndRefund(order.id, reason.trim(), code.trim());
      setResult({ refunded: r.refunded, notes: r.notes || [] });
      setSent(null); setCode('');
      onDone();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not cancel the order.'); }
    setBusy(false);
  };

  if (result) {
    return (
      <div style={{ ...card, padding: 14, marginBottom: 14, borderColor: 'var(--status-success)' }}>
        <div style={{ fontWeight: 800, color: 'var(--status-success)', fontSize: 'var(--text-sm)', marginBottom: 6 }}>
          Order cancelled{result.refunded ? ' and refunded' : ''}
        </div>
        {result.notes.map((n, i) => (
          <p key={i} style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: n.startsWith('⚠') ? 'var(--status-error)' : 'var(--text-muted)', lineHeight: 1.5 }}>{n}</p>
        ))}
      </div>
    );
  }

  if (gone) return null;

  return (
    <div style={{ ...card, padding: 14, marginBottom: 14, borderColor: open ? 'var(--status-error)' : undefined }}>
      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--status-error)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <ShieldAlert size={15} /> Cancel {paid ? 'and refund' : ''} this order
        </button>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, color: 'var(--status-error)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>
            <ShieldAlert size={15} /> Cancel {paid ? `and refund ${money(order.totalAmount)}` : 'this order'}
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
            {paid
              ? 'The courier booking and any POS ticket are cancelled first, then the full amount goes back to the card or account it came from. A refund cannot be undone.'
              : 'Nothing was captured for this order, so there is nothing to refund. The booking and POS ticket are cancelled and the customer is told why.'}
          </p>

          <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-strong)', marginBottom: 4 }}>
            Reason — the customer reads this
          </label>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={300}
            placeholder="e.g. Sorry — your address is beyond how far our riders can travel today."
            disabled={!!sent}
            style={{ ...inp, width: '100%', resize: 'vertical', lineHeight: 1.5, opacity: sent ? 0.6 : 1 }}
          />

          {!sent ? (
            <div style={{ display: 'flex', gap: 9, marginTop: 10, flexWrap: 'wrap' }}>
              <button onClick={requestCode} disabled={busy || !reason.trim()}
                style={{ ...addBtn, background: 'var(--status-error)', opacity: busy || !reason.trim() ? 0.5 : 1 }}>
                <Send size={14} /> {busy ? 'Sending…' : 'Send me a code'}
              </button>
              <button onClick={() => { setOpen(false); setReason(''); }}
                style={{ padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                Never mind
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 7px' }}>
                Code sent to <strong style={{ color: 'var(--text-strong)' }}>{sent.phoneHint}</strong>. It expires in 5 minutes.
              </p>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                <input
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric" autoComplete="one-time-code" placeholder="Code"
                  style={{ ...inp, width: 120, letterSpacing: '.25em', fontWeight: 800 }}
                />
                <button onClick={confirm} disabled={busy || code.length < 4}
                  style={{ ...addBtn, background: 'var(--status-error)', opacity: busy || code.length < 4 ? 0.5 : 1 }}>
                  {busy ? 'Cancelling…' : paid ? 'Cancel and refund' : 'Cancel order'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const money = (v?: number | null) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
