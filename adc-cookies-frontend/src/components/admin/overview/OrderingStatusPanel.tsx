'use client';
import { useState } from 'react';
import { Store, AlertTriangle } from 'lucide-react';
import { inp, addBtn, Panel } from '../shared/ui';

/**
 * The switch that decides whether the shop can take money — first thing on the dashboard, because
 * it is the first thing anyone opening this page wants to know.
 *
 * Underneath, the message IS the switch: the server stores one value, and a row existing is the
 * pause. That is a good data model — you cannot be paused with nothing to say, or go live still
 * carrying last week's notice — but it made a poor control. The old panel was a text box and a
 * Save button, so going live meant "clear the box and save" and nothing on screen said which
 * state you were in until you read the title.
 *
 * So: a real toggle. Going LIVE is one click, because that is the safe direction and should never
 * be fiddly. Pausing asks for the sentence customers will read first, since pausing without
 * telling anyone why is the actual mistake worth preventing.
 */

const DEFAULT_PAUSE_MESSAGE =
  'We are not taking online orders right now. Message us on WhatsApp and we will sort you out.';

export default function OrderingStatusPanel({
  orderingPaused, orderingPausedBusy, orderingLoaded, changeOrderingPaused, saveOrderingPaused,
}: {
  orderingPaused: string;
  orderingPausedBusy: boolean;
  orderingLoaded: boolean;
  changeOrderingPaused: (v: string) => void;
  saveOrderingPaused: (override?: string) => Promise<boolean>;
}) {
  const paused = !!orderingPaused.trim();
  /* Composing a pause that has not been saved yet. Separate from `paused` so the panel can show
     the message editor while the shop is still genuinely live — nothing changes until confirmed. */
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');

  const live = orderingLoaded && !paused;

  const startPausing = () => { setDraft(orderingPaused || DEFAULT_PAUSE_MESSAGE); setComposing(true); };
  const confirmPause = async () => {
    const text = draft.trim() || DEFAULT_PAUSE_MESSAGE;
    if (await saveOrderingPaused(text)) setComposing(false);
  };
  const goLive = async () => { if (await saveOrderingPaused('')) setComposing(false); };

  const dot = (colour: string) => (
    <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: colour, flex: 'none', boxShadow: `0 0 0 4px ${colour}33` }} />
  );

  return (
    <Panel title="Online ordering">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: '1 1 260px' }}>
          {!orderingLoaded
            ? dot('var(--text-subtle)')
            : dot(live ? 'var(--green-success)' : 'var(--red-danger)')}
          <div style={{ minWidth: 0 }}>
            <div style={{ font: 'var(--weight-extra) var(--text-lg)/1.15 var(--font-display)', color: 'var(--text-strong)' }}>
              {!orderingLoaded ? 'Checking…' : live ? 'Live' : 'Paused'}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>
              {!orderingLoaded
                ? 'Reading the current setting'
                : live
                  ? 'Customers can order and pay as normal.'
                  : 'Customers can browse and fill a basket, but cannot pay.'}
            </div>
          </div>
        </div>

        {/* The switch. Disabled until loaded, so it can never be flipped from a guessed state. */}
        <button
          onClick={live ? startPausing : goLive}
          disabled={!orderingLoaded || orderingPausedBusy || (composing && live)}
          role="switch"
          aria-checked={live}
          aria-label={live ? 'Pause online ordering' : 'Resume online ordering'}
          style={{
            flex: 'none', position: 'relative', width: 62, height: 34, borderRadius: 'var(--radius-pill)',
            border: 'none', padding: 0,
            cursor: !orderingLoaded || orderingPausedBusy ? 'default' : 'pointer',
            background: live ? 'var(--green-success)' : 'var(--border-default)',
            opacity: !orderingLoaded || orderingPausedBusy ? 0.55 : 1,
            transition: 'background .2s ease, opacity .2s ease',
          }}
        >
          <span aria-hidden style={{
            position: 'absolute', top: 4, left: live ? 32 : 4, width: 26, height: 26, borderRadius: '50%',
            background: 'var(--white)', boxShadow: 'var(--shadow-sm)', transition: 'left .2s var(--ease-out)',
          }} />
        </button>

        <span style={{ flex: 'none', fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-muted)', minWidth: 74 }}>
          {orderingPausedBusy ? 'Saving…' : live ? 'Switch off to pause' : 'Switch on to go live'}
        </span>
      </div>

      {/* Composing a pause — the shop is still live until this is confirmed. */}
      {composing && live && (
        <div style={{ marginTop: 14, padding: '13px 15px', borderRadius: 'var(--radius-card)', background: 'var(--amber-50)', border: '1px solid var(--border-brand)' }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 10 }}>
            <AlertTriangle size={16} style={{ color: 'var(--brand-secondary)', flex: 'none', marginTop: 2 }} />
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-body)', lineHeight: 1.55 }}>
              What should customers see instead of the payment step? They will get this with WhatsApp
              and call buttons. <strong>Ordering stays live until you confirm.</strong>
            </div>
          </div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={2}
            placeholder={DEFAULT_PAUSE_MESSAGE}
            style={{ ...inp, width: '100%', resize: 'vertical', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', gap: 9, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={confirmPause} disabled={orderingPausedBusy}
              style={{ ...addBtn, background: 'var(--red-danger)' }}>
              {orderingPausedBusy ? 'Pausing…' : 'Pause ordering'}
            </button>
            <button onClick={() => setComposing(false)}
              style={{ padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Paused — show the exact sentence on the site, and let it be reworded without going live. */}
      {orderingLoaded && paused && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-muted)', marginBottom: 6 }}>
            <Store size={14} /> What customers see at checkout
          </div>
          <textarea
            value={orderingPaused}
            onChange={e => changeOrderingPaused(e.target.value)}
            rows={2}
            style={{ ...inp, width: '100%', resize: 'vertical', lineHeight: 1.5 }}
          />
          <button onClick={() => saveOrderingPaused()} disabled={orderingPausedBusy}
            style={{ ...addBtn, marginTop: 9 }}>
            {orderingPausedBusy ? 'Saving…' : 'Save message'}
          </button>
        </div>
      )}
    </Panel>
  );
}
