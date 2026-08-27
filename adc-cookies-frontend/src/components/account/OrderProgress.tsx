'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  /* Separators flattened first. Our own statuses are SCREAMING_SNAKE and the carriers' are spaced
     words, and every test below was written for the spaced spelling — so "OUT_FOR_DELIVERY" matched
     none of them and fell all the way through to the default, filing the moment the rider left
     under the moment the basket was submitted. */
  const t = `${status} ${remarks || ''}`.toLowerCase().replace(/[_-]+/g, ' ');
  /* Cancellations and refusals first, and they belong to Processing, not to Placed. Without this
     "DELHIVERY booking 57064410000173 cancelled" matched none of the tests below and fell through
     to the default — filing an event about a courier under the moment the basket was submitted, an
     hour before that courier existed. Processing is where a booking lives, so it is where losing
     one belongs. */
  if (/cancel|refus|failed|reject|not picked/.test(t)) return 1;
  if (/deliver(ed)?\b/.test(t) && !/out for|undeliver|attempt/.test(t)) return 3;
  if (/out for deliver|in transit|picked ?up|dispatch|shipped|rider|on the way/.test(t)) return 2;
  /* "waybill", "booking" and "ready for pickup" are in here because they were the other three that
     fell to the default. Anything naming a courier or a collection is the order being got ready,
     never the moment it was placed. */
  if (/prepar|packed|packing|pickup|ready|accept|confirm|paid|payment|store|kitchen|awaiting|assigned|created|manifest|baking|waybill|booking|tracking/.test(t)) return 1;
  return 0;
}

const niceStatus = (s: string) =>
  s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/*
 * What a customer is told, as opposed to what we recorded.
 *
 * The timeline is our own operational log, and some of it is addressed to us: which till rang the
 * order up, which terminal it was billed on, which of our stores bills by hand. "Billed on the A
 * Dough Cookie — Jayanagar Petpooja terminal — bill 5084 (entered by jayanagar)" is a true and
 * useful sentence for the shop and means nothing to the person waiting for cookies.
 *
 * Returning null drops the event from the customer's view entirely; the admin and store portals
 * read the same rows unfiltered, so nothing is lost where it is wanted.
 */
function customerLine(e: ProgressEvent): string | null {
  const s = (e.status || '').toUpperCase();
  const raw = e.remarks || '';

  // Pure routing bookkeeping — which POS a store uses is not the customer's business.
  if (s === 'POS_MANUAL' || s === 'POS_SKIPPED') return null;
  if (s === 'POS_BILLED_MANUALLY' || s === 'POS_RELAYED') return 'Your order has been rung up at the store';
  // Internal courier bookkeeping the customer cannot act on.
  if (s === 'FULFILLED_THEN_REFUNDED') return null;

  // Strip the courier's shouty prefix and our own bill/waybill references from anything remaining.
  const cleaned = raw
    .replace(/^Shiprocket:\s*/i, '')
    .replace(/^Delhivery:\s*/i, '')
    .replace(/\s*\(entered by [^)]+\)/i, '')
    .trim();
  return cleaned || niceStatus(e.status);
}

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
      /* Just the headline. The sentence underneath used to live here too, which meant a cancelled
         order said "Any payment is refunded to source" twice on one screen — once in this box and
         again in the OrderNextStep line directly below it. That line now names the actual amount
         and date, so this box says what it is and leaves the explaining to the one place that can
         do it properly. */
      <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-card)', background: 'var(--red-wash)', border: '1px solid var(--status-error)' }}>
        <strong style={{ color: 'var(--status-error)', fontSize: 'var(--text-sm)' }}>Cancelled</strong>
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
                {/* Allowed to SHRINK below 78px, never to grow past it.
                    `flex:'none'` with a fixed 78 made four stages plus the padding a 332px floor
                    that nothing could reduce — and because a grid column cannot size below its
                    content, that floor travelled outward through the card's padding to 400px and
                    pushed the whole account page wider than a phone screen. The wrapper's
                    overflow:hidden hid the symptom on this box while the width still escaped it.
                    `0 1 78px` keeps the desktop layout identical (no growth) and lets a narrow
                    screen compress the marks instead of the page. */}
                <div style={{ flex: '0 1 78px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
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
  /*
   * Rendered into <body>, and the page behind it is frozen while it is open.
   *
   * As a child of the order card it was subject to whatever the account page did around it, and the
   * page kept scrolling underneath: scrolling the sheet chained to the body once its own list hit
   * the end, so the footer slid up behind a half-transparent scrim and read as the sheet overlapping
   * it. A portal takes it out of that tree entirely, and locking the body makes the sheet the only
   * thing that moves.
   */
  const [host, setHost] = useState<HTMLElement | null>(null);

  /* Body lock with NO dependencies, so it runs once per open and unwinds once on close. Keying it
     on onClose as well would re-run it on every parent render — onClose is an inline arrow, a new
     reference each time — releasing and re-taking the lock underneath the open sheet. */
  useEffect(() => {
    setHost(document.body);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      // Restore rather than clear: something else may have set it, and this is the one style whose
      // loss leaves the whole site unscrollable.
      document.body.style.overflow = prev;
    };
  }, []);

  // Separate, because this one genuinely does depend on the current onClose.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const byStage = STAGES.map((_, i) =>
    events
      .filter(e => stageOfEvent(e.status, e.remarks) === i)
      .map(e => ({ ...e, line: customerLine(e) }))
      .filter(e => e.line)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)));

  if (!host) return null;

  return createPortal(
    <div onClick={onClose} className="track-scrim">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Track status" className="track-sheet">
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
                ) : (
                  /* Each event is its own tick on a rail of its own, so a stage reads as a checklist
                     rather than a paragraph of timestamps: within "Order Processing" you can see
                     that payment landed, the store accepted, and it was packed, in that order and
                     each one visibly done. Every event listed here HAS happened — it exists because
                     it was recorded — so they are all filled; the rail's job is sequence, not doubt. */
                  <div style={{ marginTop: 6 }}>
                    {rows.map((e, j) => (
                      <div key={j} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', alignSelf: 'stretch' }}>
                          <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, background: 'var(--brand-secondary)', flex: 'none' }} />
                          {j < rows.length - 1 && <span aria-hidden style={{ width: 2, flex: 1, minHeight: 12, background: 'var(--brand-secondary)', opacity: 0.35 }} />}
                        </div>
                        <div style={{ minWidth: 0, paddingBottom: j < rows.length - 1 ? 9 : 0 }}>
                          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.4 }}>{e.line}</div>
                          <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginTop: 1 }}>{whenLabel(e.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    host
  );
}
