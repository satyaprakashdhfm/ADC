'use client';
import { useState } from 'react';
import { Package, RefreshCw, Truck, CheckCircle2, X, ChevronRight } from 'lucide-react';
import { whenLabel } from '@/lib/orderFormat';

/**
 * Where an order has got to, at two depths.
 *
 * The compact one is four marks in a row with the line between them filled in as far as the order
 * has travelled — readable in the half-second someone spends checking. The detailed one is behind
 * "Track status" and groups every event under the stage it belongs to, so "delivery partner
 * assigned" sits inside Processing rather than floating in a flat list of timestamps.
 *
 * That split is the point. A flat timeline of a dozen carrier scans answers "what happened" but
 * makes you read all of it to answer "where is my order", which is the only question most people
 * open the page to ask. Two views, one for each question.
 *
 * No tracking URL. Handing someone off to a carrier's own page to find out about an order they
 * placed with us is us saying we do not know — and the carrier's page will not know about the
 * baking, the store accepting it, or the payment, which are half the story.
 */

export interface ProgressEvent { status: string; remarks?: string | null; createdAt: string }

/* The four stages a customer thinks in. Our internal statuses are finer-grained than this on
   purpose — PREPARING and PACKED are different things to a kitchen — but a customer wants to know
   whether it is being made, on its way, or here. */
const STAGES = [
  { key: 'placed', label: 'Order Placed', Icon: Package },
  { key: 'processing', label: 'Order Processing', Icon: RefreshCw },
  { key: 'shipped', label: 'Order Shipped', Icon: Truck },
  { key: 'delivered', label: 'Delivered', Icon: CheckCircle2 },
] as const;

/** Which stage does a raw status line belong under? Matched on words rather than an exact list,
 *  because carrier statuses are free text and a new one must land somewhere sensible, not vanish. */
export function stageOfEvent(status: string, remarks?: string | null): number {
  const t = `${status} ${remarks || ''}`.toLowerCase();
  /* Cancellations and refusals first, and they belong to Processing, not to Placed. Without this
     "DELHIVERY booking 57064410000173 cancelled" matched none of the tests below and fell through
     to the default — filing an event about a courier under the moment the basket was submitted, an
     hour before that courier existed. Processing is where a booking lives, so it is where losing
     one belongs. */
  if (/cancel|refus|failed|reject|not picked/.test(t)) return 1;
  if (/deliver(ed)?\b/.test(t) && !/out for|undeliver|attempt/.test(t)) return 3;
  if (/out for delivery|in transit|picked ?up|dispatch|shipped|rider|on the way/.test(t)) return 2;
  /* "waybill", "booking" and "ready for pickup" are in here because they were the other three that
     fell to the default. Anything naming a courier or a collection is the order being got ready,
     never the moment it was placed. */
  if (/prepar|packed|packing|pickup|ready|accept|confirm|paid|payment|store|kitchen|awaiting|assigned|created|manifest|baking|waybill|booking|tracking/.test(t)) return 1;
  return 0;
}

const niceStatus = (s: string) =>
  s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function OrderProgress({ events, cancelled, eta }: {
  events: ProgressEvent[];
  cancelled?: boolean;
  /** "Arriving by today, 3 PM" — shown above the marks, which is where the eye goes first. */
  eta?: string | null;
}) {
  const [open, setOpen] = useState(false);

  const reached = cancelled ? -1 : events.reduce((m, e) => Math.max(m, stageOfEvent(e.status, e.remarks)), 0);
  const headline = cancelled ? 'Cancelled' : STAGES[Math.max(reached, 0)].label.replace('Order ', '');

  if (cancelled) {
    return (
      <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-card)', background: 'var(--red-wash)', border: '1px solid var(--status-error)' }}>
        <strong style={{ color: 'var(--status-error)', fontSize: 'var(--text-sm)' }}>Cancelled</strong>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Any payment is refunded to source.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--border-soft)', background: 'var(--surface-card)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 4px' }}>
          <strong style={{ font: 'var(--weight-extra) var(--text-lg)/1.2 var(--font-display)', color: 'var(--text-strong)' }}>{headline}</strong>
          {eta && <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{eta}</p>}
        </div>

        {/* The row of marks. The connector is drawn between the icons rather than under them, so a
            filled line reads as distance covered instead of a highlighted label. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 10px 16px' }}>
          {STAGES.map(({ key, label, Icon }, i) => {
            const done = i <= reached;
            return (
              <div key={key} style={{ display: 'contents' }}>
                {i > 0 && (
                  <span aria-hidden style={{ flex: 1, height: 2, marginTop: 15, background: i <= reached ? 'var(--brand-secondary)' : 'var(--border-default)', borderRadius: 2 }} />
                )}
                <div style={{ flex: 'none', width: 78, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <Icon size={22} strokeWidth={2.2} style={{ color: done ? 'var(--brand-secondary)' : 'var(--text-subtle)' }} />
                  <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, lineHeight: 1.25, textAlign: 'center', color: done ? 'var(--text-strong)' : 'var(--text-subtle)' }}>{label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={() => setOpen(true)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', border: 'none', borderTop: '1px solid var(--border-soft)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--text-link)' }}>
          Track status <ChevronRight size={17} style={{ marginLeft: 'auto' }} />
        </button>
      </div>

      {open && <TrackSheet events={events} reached={reached} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The detail, grouped by stage — the second screen, not a second copy of the first. */
function TrackSheet({ events, reached, onClose }: { events: ProgressEvent[]; reached: number; onClose: () => void }) {
  const byStage = STAGES.map((_, i) =>
    events
      .filter(e => stageOfEvent(e.status, e.remarks) === i)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)));

  return (
    <div onClick={onClose} className="track-scrim">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Track status" className="track-sheet">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <strong style={{ font: 'var(--weight-extra) var(--text-lg)/1 var(--font-display)', color: 'var(--text-strong)' }}>Track status</strong>
          <button onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-link)', display: 'grid', placeItems: 'center' }}>
            <X size={20} />
          </button>
        </div>

        {STAGES.map(({ key, label, Icon }, i) => {
          const rows = byStage[i];
          const done = i <= reached;
          const isLast = i === STAGES.length - 1;
          return (
            <div key={key} style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                <Icon size={20} strokeWidth={2.2} style={{ color: done ? 'var(--brand-secondary)' : 'var(--text-subtle)' }} />
                {/* The rail runs the height of whatever the stage contains, so a stage with four
                    events is visibly longer than one with none — the shape carries information. */}
                {!isLast && <span style={{ width: 2, flex: 1, minHeight: 26, marginTop: 4, background: i < reached ? 'var(--brand-secondary)' : 'var(--border-default)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 20 }}>
                <div style={{ fontWeight: 900, fontSize: 'var(--text-sm)', color: done ? 'var(--text-strong)' : 'var(--text-subtle)' }}>{label}</div>
                {rows.length === 0 ? (
                  <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
                    {done ? '—' : 'Not yet'}
                  </p>
                ) : rows.map((e, j) => (
                  <div key={j} style={{ marginTop: j ? 9 : 4 }}>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.4 }}>
                      {e.remarks || niceStatus(e.status)}
                    </div>
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginTop: 1 }}>{whenLabel(e.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
