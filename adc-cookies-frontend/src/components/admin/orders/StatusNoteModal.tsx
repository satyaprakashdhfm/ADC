'use client';
import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { card, actionBtn } from '../shared/ui';

/*
 * What the customer is told when a person moves their order by hand.
 *
 * Until now a manual status change said nothing. An order delivered by our own team after
 * Shiprocket failed to find a rider showed the customer a bare "Delivered" and no explanation for
 * the hours before it — the one moment they most want a sentence, and the only one a fixed template
 * cannot write, because only the person who carried the box knows what happened.
 *
 * The note is already plumbed end to end: PATCH /admin/orders/:id/status stores it on the order
 * timeline, the tracking sheet renders it through customerLine(), and it now goes into the delivery
 * email too. The single missing piece was anybody being asked for it.
 *
 * Deliberately not window.prompt(): this is used on a tablet, prompt() cannot be styled, cannot
 * show a default worth keeping, and on some mobile browsers does not appear at all.
 */

/*
 * A starting sentence per status, not a fixed one — every field here is editable.
 *
 * Written to be true on the customer's screen with no context around them, and to explain rather
 * than apologise.
 *
 * CANCELLED deliberately promises NOTHING about money. This endpoint calls cancelDownstream, which
 * calls off the POS ticket and the courier booking and stops there — it does not refund, and it
 * does not send the cancellation email. Those belong to the Cancel-and-refund flow on the order
 * itself. A default of "your payment is being refunded" here would have put a promise on the
 * customer's tracking page that nothing in this request keeps.
 */
const SUGGESTED: Record<string, string> = {
  DELIVERED: 'Delivered by our own team — thank you for your patience.',
  OUT_FOR_DELIVERY: 'On its way to you now.',
  CANCELLED: 'We were unable to complete this order.',
};

/* Statuses where saying nothing is the honest default. A customer does not need telling that a
   box moved from PREPARING to PACKED in our kitchen, and an empty note simply writes no line. */
const OPTIONAL_FOR = ['CONFIRMED', 'PREPARING', 'PACKED', 'PLACED'];

export default function StatusNoteModal({ orderNumber, status, onCancel, onConfirm }: {
  orderNumber: string;
  status: string;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState(SUGGESTED[status] ?? '');
  const quiet = OPTIONAL_FOR.includes(status);

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: 'min(460px,96vw)', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <MessageSquare size={17} style={{ color: 'var(--brand-secondary)' }} />
          <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-strong)' }}>What should the customer be told?</strong>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.55 }}>
          {orderNumber} → <strong style={{ color: 'var(--text-strong)' }}>{status}</strong>.
          {' '}They will see this on their order page{status === 'DELIVERED' || status === 'OUT_FOR_DELIVERY' ? ' and in the email we send them' : ''}.
          {quiet && ' Leave it empty if there is nothing worth saying.'}
        </p>

        {/* The one status where the obvious reading of "cancel" is wrong. This route stops the POS
            ticket and the courier booking; the money is a separate, deliberate act. */}
        {status === 'CANCELLED' && (
          <p style={{ fontSize: 'var(--text-xs)', lineHeight: 1.55, margin: '0 0 14px', padding: '10px 12px', borderRadius: 10, background: 'var(--amber-50, #fff6e9)', border: '1px solid var(--border-default)', color: 'var(--text-body)' }}>
            <strong>This does not refund the customer.</strong> It calls off the POS ticket and the
            courier booking only. If they are owed money, use <strong>Cancel and refund</strong> on
            the order instead — that one refunds and emails them.
          </p>
        )}

        <textarea
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 300))}
          rows={3}
          autoFocus
          placeholder={quiet ? 'Optional' : 'Tell them what happened, in one sentence'}
          style={{ width: '100%', boxSizing: 'border-box', resize: 'none', padding: '11px 13px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', lineHeight: 1.5, color: 'var(--text-strong)', outline: 'none' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 14 }}>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>Written to the customer, not an internal note.</span>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>{note.length}/300</span>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={actionBtn(false)}><X size={13} /> Don&rsquo;t change it</button>
          <button onClick={() => onConfirm(note.trim())} style={{ ...actionBtn(true), fontWeight: 800 }}>
            Set {status}
          </button>
        </div>
      </div>
    </div>
  );
}
