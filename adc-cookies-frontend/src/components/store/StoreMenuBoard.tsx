'use client';
import { useState, useEffect, useCallback } from 'react';
import { ToggleLeft, ToggleRight, RotateCcw, AlertTriangle, Store as StoreIcon } from 'lucide-react';
import {
  storeMenu, storeAvailability, storeSetAvailability, storeSetItemAvailability,
  StoreAuthError, type StoreMenuItem,
} from '@/lib/storeApi';

/*
 * What this shop can sell right now, and the two switches for changing it.
 *
 * Until now this screen was read-only: it answered "do we have that" on the phone and helped staff
 * find an item on their own terminal, but a store that had run out of something had to call head
 * office to have it turned off — so in practice it kept taking orders it could not bake.
 *
 * Two switches, and the difference between them matters on a busy counter:
 *
 *   The shop — closed means this store stops being given new orders at all. Orders already accepted
 *              are unaffected; the customer is simply routed elsewhere, or told nobody nearby is
 *              open. It is the "our oven is down" switch and is written to read like one.
 *   One item — off here and only here. Everything else keeps selling.
 *
 * An item can also be off because of a rule set centrally (an intracity-only item restricted to
 * another city). That is shown differently and cannot be overridden into an "on" that would not
 * hold, because the storewide switch wins — so the portal says so rather than offering a button
 * that appears to work and doesn't.
 */

const wrap: React.CSSProperties = { background: 'var(--surface-card, #fff)', border: '1px solid var(--border-default, #e5e0d5)', borderRadius: 14 };
const money = (v: number) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;

const btn = (kind: 'primary' | 'ghost' | 'danger' = 'ghost'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 800, lineHeight: 1.2,
  border: '1px solid ' + (kind === 'primary' ? 'transparent' : kind === 'danger' ? '#e6b4ae' : 'var(--border-default, #e5e0d5)'),
  background: kind === 'primary' ? 'var(--brand-orange, #e8641c)' : kind === 'danger' ? '#fdecec' : 'var(--surface-card, #fff)',
  color: kind === 'primary' ? '#fff' : kind === 'danger' ? '#a4231d' : 'var(--text-strong, #2b2118)',
});

function Chip({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'ok' | 'warn' | 'bad' }) {
  const c = { neutral: ['#eef1f4', '#41566b'], ok: ['#e7f6ec', '#1c7a3d'], warn: ['#fff3e0', '#9a5a00'], bad: ['#fdecec', '#a4231d'] }[tone];
  return <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: c[0], color: c[1], fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{text}</span>;
}

export default function StoreMenuBoard({ code, storeName, manual, onAuthError }: {
  code: string;
  storeName: string;
  manual: boolean;
  onAuthError: () => void;
}) {
  const [menu, setMenu] = useState<StoreMenuItem[] | null>(null);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);   // 'shop' or a product id
  const [err, setErr] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);

  /*
   * One place to turn any failure into something the counter can read, plus the one distinction that
   * matters: a dead token drops the portal back to its sign-in rather than showing an error nobody
   * can act on. Used by the button handlers, where setting state synchronously is fine.
   */
  const guard = useCallback(async (fn: () => Promise<unknown>) => {
    try { await fn(); setErr(''); return true; }
    catch (e) {
      if (e instanceof StoreAuthError) { onAuthError(); return false; }
      setErr(e instanceof Error ? e.message : 'That did not work. Try again.');
      return false;
    }
  }, [onAuthError]);

  /* The first load, kept as a promise chain rather than routed through guard(): everything it sets
     then happens in a callback, never in the effect body itself. `alive` stops a tablet that
     navigated away mid-request from setting state on an unmounted screen. */
  useEffect(() => {
    let alive = true;
    Promise.all([storeMenu(code), storeAvailability(code)])
      .then(([items, avail]) => {
        if (!alive) return;
        setMenu(items);
        setIsActive(avail.isActive);
        setErr('');
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof StoreAuthError) onAuthError();
        else setErr(e instanceof Error ? e.message : 'Could not load the menu.');
      });
    return () => { alive = false; };
  }, [code, onAuthError]);

  const toggleShop = async (next: boolean) => {
    setBusy('shop');
    const ok = await guard(() => storeSetAvailability(code, next));
    if (ok) setIsActive(next);
    setBusy(null);
    setConfirmClose(false);
  };

  const setItem = async (productId: number, available: boolean | null) => {
    setBusy(String(productId));
    const ok = await guard(() => storeSetItemAvailability(code, productId, available));
    // Re-read rather than patching locally: clearing an override hands the item back to the central
    // rule, and only the server knows what that rule then says.
    if (ok) await guard(async () => setMenu(await storeMenu(code)));
    setBusy(null);
  };

  const offCount = (menu || []).filter(m => m.available && !m.availableHere).length;

  return (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 6px' }}>Menu &amp; availability</h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted, #7b6a58)', margin: '0 0 18px' }}>
        What the website sells, what it costs there, and what you can turn off when you run out.
        {manual && ' The POS code is from the main outlet — use it to find the item, but check the name and price match on your own terminal.'}
      </p>

      {err && (
        <p style={{ ...wrap, background: '#fdecec', borderColor: '#f3c9c6', color: '#a4231d', padding: 14, fontWeight: 700, marginBottom: 18 }}>
          <AlertTriangle size={16} style={{ verticalAlign: -3, marginRight: 8 }} />{err}
        </p>
      )}

      {/* ---- The shop itself ---- */}
      <section style={{ ...wrap, padding: 16, marginBottom: 18, borderLeft: `5px solid ${isActive === false ? '#a4231d' : '#1c7a3d'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <StoreIcon size={20} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <strong style={{ fontSize: 16, fontWeight: 900 }}>{storeName}</strong>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #7b6a58)', marginTop: 2 }}>
              {isActive === null ? 'Checking…'
                : isActive ? 'Open — new orders can come here.'
                : 'Closed — no new orders will be sent here. Orders you have already accepted are unaffected.'}
            </div>
          </div>
          {isActive !== null && (
            isActive
              ? <button onClick={() => setConfirmClose(true)} disabled={busy === 'shop'} style={btn('danger')}>
                  <ToggleRight size={16} /> Close the shop
                </button>
              : <button onClick={() => void toggleShop(true)} disabled={busy === 'shop'} style={btn('primary')}>
                  <ToggleLeft size={16} /> Open the shop
                </button>
          )}
        </div>

        {/* Closing turns away paying customers, so it asks once — but plainly, and it says exactly
            what happens rather than "are you sure?". */}
        {confirmClose && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-soft, #f0ebe1)' }}>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px', lineHeight: 1.5 }}>
              Close {storeName}? Customers nearby will be served from another store, or told nobody
              near them is open. Nothing you have already accepted changes. You can open it again
              from this screen at any time.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => void toggleShop(false)} disabled={busy === 'shop'} style={btn('danger')}>
                {busy === 'shop' ? 'Closing…' : 'Yes, close it'}
              </button>
              <button onClick={() => setConfirmClose(false)} style={btn()}>Keep it open</button>
            </div>
          </div>
        )}
      </section>

      {/* ---- The items ---- */}
      {menu === null ? <p>Loading…</p> : (
        <>
          {!!offCount && (
            <p style={{ fontSize: 13, color: '#9a5a00', fontWeight: 700, margin: '0 0 10px' }}>
              {offCount} item{offCount === 1 ? '' : 's'} not on sale here right now.
            </p>
          )}
          <div style={{ ...wrap, overflow: 'hidden' }}>
            {menu.map((m, i) => {
              const rowBusy = busy === String(m.id);
              /* Off because head office says so, not because this store turned it off. Offering an
                 On button for one of these would be offering a button that cannot work: the
                 storewide switch wins on the server. */
              const lockedOff = !m.available;
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', flexWrap: 'wrap', borderTop: i ? '1px solid var(--border-soft, #f0ebe1)' : 'none', opacity: rowBusy ? 0.5 : m.availableHere ? 1 : 0.72 }}>
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <strong style={{ fontSize: 15 }}>{m.name}</strong>
                    {m.posItemId && <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-subtle, #a4988a)' }}>POS code {m.posItemId}</div>}
                    {lockedOff && (
                      <div style={{ fontSize: 11, color: '#9a5a00', fontWeight: 700, marginTop: 2 }}>Off everywhere — head office has taken it off the menu</div>
                    )}
                    {!lockedOff && !m.automaticallyAvailable && (
                      <div style={{ fontSize: 11, color: '#9a5a00', fontWeight: 700, marginTop: 2 }}>Not normally carried here — it is restricted to another city</div>
                    )}
                    {m.isOverride && !lockedOff && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted, #7b6a58)', fontWeight: 700, marginTop: 2 }}>Set for this store</div>
                    )}
                  </div>

                  <span style={{ fontSize: 15, fontWeight: 800 }}>{money(m.price)}</span>

                  {lockedOff ? <Chip text="Off" tone="bad" /> : (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => void setItem(m.id, !m.availableHere)}
                        disabled={rowBusy}
                        title={m.availableHere ? 'Turn this off here — you have run out' : 'Put this back on sale here'}
                        style={{ ...btn(m.availableHere ? 'ghost' : 'primary'), padding: '7px 12px', fontSize: 13 }}>
                        {m.availableHere ? <><ToggleRight size={15} /> On sale</> : <><ToggleLeft size={15} /> Off</>}
                      </button>
                      {m.isOverride && (
                        <button onClick={() => void setItem(m.id, null)} disabled={rowBusy}
                          title="Go back to the default for this store" aria-label="Go back to the default"
                          style={{ ...btn(), padding: '7px 10px' }}>
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-subtle, #a4988a)', margin: '12px 0 0', lineHeight: 1.5 }}>
            Turning an item off here affects this store only, and takes effect on the website
            immediately. Use the <RotateCcw size={11} style={{ verticalAlign: -1 }} /> button to go back
            to whatever the default for this store was.
          </p>
        </>
      )}
    </>
  );
}
