'use client';
import { useState } from 'react';
import { ShieldAlert, Send } from 'lucide-react';
import {
  adminRequestCancelCode, adminCancelAndRefund, adminGetRefundInfo, adminRequestRefundCode, adminRefund,
  type Order, type RefundInfo, type RefundReason,
} from '@/lib/api';
import { card, inp, addBtn } from '../shared/ui';

/**
 * Refund an order, in full or in part, and cancel it when that is the reason. Behind a code sent to
 * the admin's own phone.
 *
 * The reason is picked first, because it decides everything else: only "Order cancelled" stops the
 * order and refunds whatever is left; the rest (damaged, missing, wrong item, late) are money back
 * on an order that carries on, usually part of it. The customer is shown the sentence for the reason
 * picked, and the preview here is that sentence, so nobody sends a refund without reading what the
 * customer will read.
 *
 * The code is asked for AFTER the amount and note are written, and it approves exactly those: the
 * server fixes them when it sends the code. Changing anything means asking for a new one.
 */
export default function CancelRefundPanel({ order, onDone, setErr }: {
  order: Order;
  onDone: () => void;
  setErr: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<RefundInfo | null>(null);
  const [reasonCode, setReasonCode] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<{ phoneHint: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ cancelled: boolean; refunded: boolean; notes: string[] } | null>(null);

  const paid = order.paymentStatus === 'PAID';
  const isCancelled = order.orderStatus === 'CANCELLED';
  const canCancel = !isCancelled && order.orderStatus !== 'DELIVERED';
  const refundable = info?.refundable ?? 0;

  const reasons = (info?.reasons || []).filter(r =>
    // Unpaid: there is nothing to refund, so cancelling is the only thing to do.
    !paid ? r.cancels
    // Delivered: it cannot be cancelled any more.
    : r.cancels ? canCancel || isCancelled
    : true);
  const reason: RefundReason | undefined = reasons.find(r => r.code === reasonCode);
  // Cancelling a live order goes through the cancel route (carrier, POS, then the money). Every other
  // choice, including "order cancelled" on an order that is already cancelled, only moves money.
  const cancelPath = !!reason?.cancels && canCancel;
  const fixedAmount = !!reason?.cancels;
  const amountNum = fixedAmount ? refundable : Number(amount) || 0;
  const full = paid && amountNum >= refundable && refundable > 0;

  const openPanel = async () => {
    setOpen(true); setErr('');
    try { setInfo(await adminGetRefundInfo(order.id)); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not read the payment from Razorpay.'); setOpen(false); }
  };

  const reset = () => { setOpen(false); setReasonCode(''); setAmount(''); setNote(''); setCode(''); setSent(null); };

  const problem = !reason ? 'Pick a reason'
    : !reason.customerLine && !note.trim() ? 'Write a line for the customer'
    : paid && !cancelPath && (amountNum < 1 || amountNum > refundable) ? `Enter an amount between ₹1 and ${money(refundable)}`
    : '';

  const requestCode = async () => {
    if (problem || !reason) return;
    setBusy(true); setErr('');
    try {
      const r = cancelPath
        ? await adminRequestCancelCode(order.id)
        : await adminRequestRefundCode(order.id, { reasonCode: reason.code, amount: amountNum, note: note.trim() });
      setSent({ phoneHint: r.phoneHint });
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not send the code.'); }
    setBusy(false);
  };

  const confirm = async () => {
    if (!reason) return;
    setBusy(true); setErr('');
    try {
      const r = cancelPath
        ? await adminCancelAndRefund(order.id, note.trim() || reason.customerLine, code.trim())
        : await adminRefund(order.id, code.trim());
      setResult({ cancelled: r.cancelled, refunded: r.refunded, notes: r.notes || [] });
      reset();
      onDone();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'That did not go through.'); }
    setBusy(false);
  };

  if (result) {
    return (
      <div style={{ ...card, padding: 14, marginBottom: 14, borderColor: 'var(--status-success)' }}>
        <div style={{ fontWeight: 800, color: 'var(--status-success)', fontSize: 'var(--text-sm)', marginBottom: 6 }}>
          {result.cancelled ? `Order cancelled${result.refunded ? ' and refunded' : ''}` : 'Refund issued'}
        </div>
        {result.notes.map((n, i) => (
          <p key={i} style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: n.startsWith('⚠') ? 'var(--status-error)' : 'var(--text-muted)', lineHeight: 1.5 }}>{n}</p>
        ))}
      </div>
    );
  }

  // Nothing to cancel and nothing that could be refunded.
  if (!canCancel && !paid) return null;

  const title = canCancel ? (paid ? 'Refund or cancel this order' : 'Cancel this order') : 'Refund this order';
  const locked = !!sent;

  return (
    <div style={{ ...card, padding: 14, marginBottom: 14, borderColor: open ? 'var(--status-error)' : undefined }}>
      {!open ? (
        <button onClick={openPanel}
          style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--status-error)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <ShieldAlert size={15} /> {title}
        </button>
      ) : !info ? (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Checking the payment with Razorpay…</p>
      ) : paid && refundable <= 0 && !canCancel ? (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          This payment is already fully refunded ({money(info.refunded)}). There is nothing left to send back.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, color: 'var(--status-error)', fontSize: 'var(--text-sm)', marginBottom: 10 }}>
            <ShieldAlert size={15} /> {title}
          </div>

          {/* Who gets the money and the message, and how much is left to give. */}
          <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div>
              <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>Customer:</span>{' '}
              {[order.account?.name, order.account?.phone].filter(Boolean).join(' · ') || '—'}
              {order.account?.email && <> · {order.account.email}</>}
            </div>
            {paid && (
              <div>
                Paid {money(info.paid)}
                {info.refunded > 0 && <> · already refunded {money(info.refunded)}</>}
                {' '}· <strong style={{ color: 'var(--text-strong)' }}>{money(refundable)} left to refund</strong>
              </div>
            )}
          </div>

          <label style={labelStyle}>Why</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 7, marginBottom: 12 }}>
            {reasons.map(r => {
              const on = r.code === reasonCode;
              const stops = r.cancels && canCancel;
              return (
                <button key={r.code} disabled={locked}
                  onClick={() => { setReasonCode(r.code); if (r.cancels) setAmount(''); }}
                  style={{
                    textAlign: 'left', padding: '9px 11px', borderRadius: 10, cursor: locked ? 'default' : 'pointer',
                    border: `1.5px solid ${on ? 'var(--status-error)' : 'var(--border-default)'}`,
                    background: on ? 'var(--status-danger-bg, #FCEBEA)' : 'var(--surface-card)',
                    opacity: locked && !on ? 0.5 : 1, fontFamily: 'var(--font-body)',
                  }}>
                  <div style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{r.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: stops ? 'var(--status-error)' : 'var(--text-subtle)' }}>
                    {stops ? 'Cancels the order' : r.cancels ? 'Already cancelled' : 'Order stays as it is'}
                  </div>
                </button>
              );
            })}
          </div>

          {reason && (
            <>
              {paid && (
                <>
                  <label style={labelStyle}>Refund amount</label>
                  {fixedAmount ? (
                    <p style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                      <strong>{money(refundable)}</strong>, everything that is left. A cancelled order is refunded in full.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>₹</span>
                      <input
                        value={amount} disabled={locked} inputMode="decimal" placeholder="0"
                        onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                        style={{ ...inp, width: 110, fontWeight: 800 }}
                      />
                      <button disabled={locked} onClick={() => setAmount(String(refundable))}
                        style={{ padding: '7px 12px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: locked ? 'default' : 'pointer' }}>
                        All of it ({money(refundable)})
                      </button>
                    </div>
                  )}
                </>
              )}

              <label style={labelStyle}>
                {reason.customerLine ? 'Add a line for the customer (optional)' : 'Tell the customer why (required)'}
              </label>
              <textarea
                value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={300} disabled={locked}
                placeholder={reason.code === 'DAMAGED' ? 'e.g. The Nutella cookies were crushed in transit.' : 'e.g. Sorry, your address is beyond how far our riders can travel today.'}
                style={{ ...inp, width: '100%', resize: 'vertical', lineHeight: 1.5, opacity: locked ? 0.6 : 1 }}
              />

              {/* What the customer will read, built from the same pieces the email is. */}
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, border: '1px dashed var(--border-default)', fontSize: 'var(--text-xs)', color: 'var(--text-body)', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.05em', fontSize: 10.5, marginBottom: 3 }}>
                  The customer is told
                </div>
                {cancelPath ? (
                  <>Your order {order.orderNumber} has been cancelled. Why: {note.trim() || reason.customerLine}
                    {paid && refundable > 0 && <> {money(refundable)} has been refunded in full to the account you paid from.</>}</>
                ) : (
                  <>{[reason.customerLine, note.trim()].filter(Boolean).join(' ')} We are sorry, and we have refunded {full ? 'your' : 'part of your'} order {order.orderNumber}.
                    {amountNum > 0 && <> Refunded: {money(amountNum)}{full ? '' : ` of the ${money(info.paid)} you paid`}.</>}</>
                )}
              </div>

              {!sent ? (
                <div style={{ display: 'flex', gap: 9, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={requestCode} disabled={busy || !!problem}
                    style={{ ...addBtn, background: 'var(--status-error)', opacity: busy || problem ? 0.5 : 1 }}>
                    <Send size={14} /> {busy ? 'Sending…' : 'Send me a code'}
                  </button>
                  <button onClick={reset} style={ghostBtn}>Never mind</button>
                  {problem && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>{problem}</span>}
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 7px' }}>
                    Code sent to <strong style={{ color: 'var(--text-strong)' }}>{sent.phoneHint}</strong>. It expires in 5 minutes.
                    It approves exactly what is above; to change anything, start again.
                  </p>
                  <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    <input
                      value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                      inputMode="numeric" autoComplete="one-time-code" placeholder="Code"
                      style={{ ...inp, width: 120, letterSpacing: '.25em', fontWeight: 800 }}
                    />
                    <button onClick={confirm} disabled={busy || code.length < 4}
                      style={{ ...addBtn, background: 'var(--status-error)', opacity: busy || code.length < 4 ? 0.5 : 1 }}>
                      {busy ? 'Working…'
                        : cancelPath ? (paid && refundable > 0 ? `Cancel and refund ${money(refundable)}` : 'Cancel order')
                        : `Refund ${money(amountNum)}`}
                    </button>
                    <button onClick={() => { setSent(null); setCode(''); }} style={ghostBtn}>Start again</button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

const money = (v?: number | null) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-strong)', marginBottom: 5 };
const ghostBtn: React.CSSProperties = { padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' };
