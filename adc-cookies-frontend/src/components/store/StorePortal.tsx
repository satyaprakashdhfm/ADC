'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Store, LogOut, RefreshCw, Check, Package, Truck, Phone, MapPin, Receipt,
  AlertTriangle, BookOpen, ClipboardList, KeyRound, X, Bike, ExternalLink,
} from 'lucide-react';
import StoreSignIn from './StoreSignIn';
import {
  storeMe, storeOrders, storeTrack, storeMenu,
  storeAcceptOrder, storeMarkReady, storeSetPosBill, storeChangePassword,
  getStoreToken, clearStoreToken, StoreAuthError,
  type StoreSession, type StoreOrder, type StoreTrack, type StoreMenuItem,
} from '@/lib/storeApi';

/*
 * The screen a shop counter works from.
 *
 * Built for a tablet propped next to the oven, not a desk: big targets, one obvious next action per
 * order, and an alert that cannot be missed from across a kitchen. It shows this store's orders and
 * nothing else — no takings, no other stores, no customer records, no way to cancel anything. A
 * cancel calls off a rider and refunds money, so it stays in /admin where one person owns it.
 *
 * The flow a store actually walks:
 *   NEW  →  Accept  →  (bill it on the POS)  →  Ready for pickup  →  rider collects
 *
 * Everywhere except Begur that middle step is manual: this store's Petpooja terminal is not the one
 * wired to our API, so staff key the order in and type the bill number back here. That number is the
 * only link between the money Razorpay settled and the bill their kitchen printed.
 */

const POLL_MS = 15_000;

const wrap: React.CSSProperties = { background: 'var(--surface-card, #fff)', border: '1px solid var(--border-default, #e5e0d5)', borderRadius: 14 };
const money = (v: number) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
const clock = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
};
/** Minutes since the order was paid for — the number that actually matters on a same-day promise. */
function minutesSince(iso: string): number {
  const t = new Date(iso).getTime();
  return isNaN(t) ? 0 : Math.max(0, Math.round((Date.now() - t) / 60000));
}

const btn = (kind: 'primary' | 'ghost' | 'danger' = 'ghost', big = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: big ? '14px 22px' : '9px 14px', borderRadius: 10, cursor: 'pointer',
  fontSize: big ? 16 : 14, fontWeight: 800, lineHeight: 1.2,
  border: '1px solid ' + (kind === 'primary' ? 'transparent' : 'var(--border-default, #e5e0d5)'),
  background: kind === 'primary' ? 'var(--brand-orange, #e8641c)' : kind === 'danger' ? '#fdecec' : 'var(--surface-card, #fff)',
  color: kind === 'primary' ? '#fff' : kind === 'danger' ? '#a4231d' : 'var(--text-strong, #2b2118)',
});

const input: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: 10, fontSize: 16,
  border: '1px solid var(--border-default, #e5e0d5)', background: 'var(--surface-card, #fff)',
  color: 'var(--text-strong, #2b2118)',
};

function Chip({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'ok' | 'warn' | 'bad' }) {
  const c = { neutral: ['#eef1f4', '#41566b'], ok: ['#e7f6ec', '#1c7a3d'], warn: ['#fff3e0', '#9a5a00'], bad: ['#fdecec', '#a4231d'] }[tone];
  return <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: c[0], color: c[1], fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{text}</span>;
}

/* ------------------------------------------------------------------ */
/* Order card                                                          */
/* ------------------------------------------------------------------ */

function OrderCard({
  order, manual, onAccept, onReady, onBill, onTrack, track, busy,
}: {
  order: StoreOrder; manual: boolean; busy: boolean;
  onAccept: () => void; onReady: () => void; onBill: (n: string) => void; onTrack: () => void;
  track: StoreTrack | null;
}) {
  const [billDraft, setBillDraft] = useState('');
  const isNew = !order.workflow.acceptedAt && order.status !== 'CANCELLED';
  const age = minutesSince(order.placedAt);

  return (
    <article style={{
      ...wrap, padding: 18,
      borderLeft: `5px solid ${isNew ? '#e8641c' : order.workflow.readyAt ? '#1c7a3d' : '#c9bda9'}`,
      background: isNew ? '#fffaf4' : 'var(--surface-card, #fff)',
    }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <strong style={{ fontSize: 19, fontWeight: 900 }}>{order.orderNumber}</strong>
        <span style={{ fontSize: 13, color: 'var(--text-muted, #7b6a58)' }}>
          {clock(order.placedAt)} · {age < 60 ? `${age} min ago` : `${Math.floor(age / 60)} h ago`}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 19, fontWeight: 900 }}>{money(order.totalAmount)}</span>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {isNew && <Chip text="NEW — not accepted" tone="bad" />}
        {order.workflow.acceptedAt && !order.workflow.readyAt && <Chip text={`Accepted ${clock(order.workflow.acceptedAt)}`} tone="warn" />}
        {order.workflow.readyAt && <Chip text={`Ready ${clock(order.workflow.readyAt)}`} tone="ok" />}
        {manual
          ? (order.pos.billNo
              ? <Chip text={`POS bill ${order.pos.billNo}`} tone="ok" />
              : <Chip text="Not billed on your POS" tone="warn" />)
          : (order.pos.relayed ? <Chip text="Sent to Petpooja" tone="ok" /> : <Chip text="Not on Petpooja yet" tone="warn" />)}
        {order.status === 'CANCELLED' && <Chip text="CANCELLED — do not make" tone="bad" />}
      </div>

      {/* What to bake. The whole reason this screen exists, so it comes before everything else. */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
        <tbody>
          {order.items.map(i => (
            <tr key={i.id} style={{ borderBottom: '1px solid var(--border-soft, #f0ebe1)' }}>
              <td style={{ padding: '9px 0', fontSize: 17, fontWeight: 800, width: 46 }}>{i.quantity}×</td>
              <td style={{ padding: '9px 0', fontSize: 16 }}>
                {i.name}
                {i.posVariation && <span style={{ color: 'var(--text-muted, #7b6a58)' }}> — {i.posVariation}</span>}
                {i.specialNotes && <div style={{ fontSize: 13, color: '#9a5a00', fontWeight: 700, marginTop: 2 }}>Note: {i.specialNotes}</div>}
                {manual && i.posItemId && (
                  <div style={{ fontSize: 11, color: 'var(--text-subtle, #a4988a)', fontFamily: 'monospace', marginTop: 2 }}>POS code {i.posItemId}</div>
                )}
              </td>
              <td style={{ padding: '9px 0', textAlign: 'right', fontSize: 15, whiteSpace: 'nowrap' }}>{money(i.totalPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(order.discountAmount > 0 || order.deliveryFee > 0) && (
        <p style={{ fontSize: 13, color: 'var(--text-muted, #7b6a58)', margin: '0 0 12px' }}>
          Items {money(order.subtotal)}
          {order.discountAmount > 0 && ` · less ${money(order.discountAmount)}${order.couponCode ? ` (${order.couponCode})` : ''}`}
          {order.deliveryFee > 0 && ` · delivery ${money(order.deliveryFee)}`}
        </p>
      )}

      {/* Who it goes to. The rider phones this number, so it must be one tap to call. */}
      {order.customer && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', fontSize: 14, marginBottom: 12 }}>
          <span style={{ fontWeight: 800 }}>{order.customer.name}</span>
          <a href={`tel:${order.customer.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-link, #1558b0)', fontWeight: 800 }}>
            <Phone size={15} /> {order.customer.phone}
          </a>
          {order.address && (
            <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 6, color: 'var(--text-muted, #7b6a58)' }}>
              <MapPin size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              {[order.address.line1, order.address.line2, order.address.city, order.address.pincode].filter(Boolean).join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Rider / courier. A store cannot fix a failed booking, but being told one failed is the
          difference between waiting for a rider and asking someone why none is coming. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 14, marginBottom: 14 }}>
        <Truck size={16} style={{ color: 'var(--text-muted, #7b6a58)' }} />
        {order.delivery.carrier ? (
          <>
            <span style={{ fontWeight: 800 }}>{order.delivery.carrier}</span>
            <span>{order.delivery.shipmentStatus || 'booked'}</span>
            {order.delivery.waybill && <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{order.delivery.waybill}</span>}
            <button onClick={onTrack} style={btn()}><RefreshCw size={14} /> Check rider</button>
            {order.delivery.trackingUrl && (
              <a href={order.delivery.trackingUrl} target="_blank" rel="noreferrer" style={{ ...btn(), textDecoration: 'none' }}>
                <ExternalLink size={14} /> Track
              </a>
            )}
          </>
        ) : (
          <span style={{ color: '#a4231d', fontWeight: 800 }}>
            No rider booked{order.delivery.shipmentError ? ' — the office has been alerted' : ' yet'}
          </span>
        )}
      </div>

      {track && (
        <div style={{ background: 'var(--surface-sunken, #f7f2e9)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 14 }}>
          {track.ok ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <Bike size={16} />
                <strong>{track.status || 'No status yet'}</strong>
                {track.courier && <span style={{ color: 'var(--text-muted, #7b6a58)' }}>{track.courier}</span>}
              </div>
              {track.rider?.name ? (
                <p style={{ margin: '8px 0 0' }}>
                  Rider <strong>{track.rider.name}</strong>
                  {track.rider.phone && <> · <a href={`tel:${track.rider.phone}`} style={{ color: 'var(--text-link, #1558b0)', fontWeight: 800 }}>{track.rider.phone}</a></>}
                </p>
              ) : (
                <p style={{ margin: '8px 0 0', color: 'var(--text-muted, #7b6a58)' }}>
                  No rider allocated yet — they are still searching. Keep the order packed and ready.
                </p>
              )}
            </>
          ) : (
            <span style={{ color: 'var(--text-muted, #7b6a58)' }}>Could not reach the courier just now ({track.reason}).</span>
          )}
        </div>
      )}

      {/* Manual POS billing. Only shown where it applies, and only once the order is accepted —
          before that the next action is Accept and nothing should compete with it. */}
      {manual && order.workflow.acceptedAt && !order.pos.billNo && order.status !== 'CANCELLED' && (
        <div style={{ background: '#fff8ec', border: '1px solid #f0d9ae', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={16} /> Bill this on your Petpooja terminal, then type the bill number here
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={billDraft} onChange={e => setBillDraft(e.target.value)} placeholder="Bill number"
              style={{ ...input, width: 'auto', flex: '1 1 180px' }} />
            <button disabled={!billDraft.trim() || busy} onClick={() => { onBill(billDraft.trim()); setBillDraft(''); }}
              style={{ ...btn('primary'), opacity: !billDraft.trim() || busy ? 0.6 : 1 }}>Save</button>
          </div>
        </div>
      )}

      {/* Exactly one obvious next action. */}
      {order.status !== 'CANCELLED' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {!order.workflow.acceptedAt && (
            <button disabled={busy} onClick={onAccept} style={{ ...btn('primary', true), flex: '1 1 200px', opacity: busy ? 0.6 : 1 }}>
              <Check size={19} /> Accept this order
            </button>
          )}
          {order.workflow.acceptedAt && !order.workflow.readyAt && (
            <button disabled={busy} onClick={onReady} style={{ ...btn('primary', true), flex: '1 1 200px', opacity: busy ? 0.6 : 1 }}>
              <Package size={19} /> Ready for pickup
            </button>
          )}
          {order.workflow.readyAt && (
            <span style={{ fontSize: 14, color: 'var(--text-muted, #7b6a58)', alignSelf: 'center' }}>
              Packed and waiting for the rider. The courier closes it off from here.
            </span>
          )}
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Portal                                                              */
/* ------------------------------------------------------------------ */

export default function StorePortal({ code }: { code: string }) {
  const [session, setSession] = useState<StoreSession | null>(null);
  const [booting, setBooting] = useState(true);
  const [orders, setOrders] = useState<StoreOrder[] | null>(null);
  const [menu, setMenu] = useState<StoreMenuItem[] | null>(null);
  const [view, setView] = useState<'orders' | 'menu'>('orders');
  const [tracks, setTracks] = useState<Record<number, StoreTrack>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [alerting, setAlerting] = useState<StoreOrder[]>([]);
  const [pwOpen, setPwOpen] = useState(false);

  // Ids we have already announced. A ref, not state: it must not trigger a re-render, and the
  // polling closure has to read the CURRENT value rather than the one captured when it was created.
  const announced = useRef<Set<number> | null>(null);
  const audio = useRef<AudioContext | null>(null);

  /* A short two-note chime, synthesised rather than loaded — a kitchen tablet may be offline from
     everything except our own API, and an <audio src> that 404s alerts nobody. Browsers only allow
     audio after a user gesture, so the context is created on the sign-in click and reused. */
  const chime = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      audio.current ??= new Ctx();
      const ctx = audio.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      [0, 0.18].forEach((offset, n) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.frequency.value = n === 0 ? 880 : 1175;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.16);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + 0.18);
      });
    } catch { /* audio is a nicety; the banner is the guarantee */ }
  }, []);

  const signOut = useCallback(() => { clearStoreToken(code); setSession(null); setOrders(null); }, [code]);

  /* Pull the board. `announce` is false on the very first load: staff opening the portal to a queue
     of waiting orders should see the NEW list, not be alarmed at orders that arrived hours ago. */
  const refresh = useCallback(async (announce = true) => {
    try {
      const r = await storeOrders(code);
      setOrders(r.orders);
      const waiting = r.orders.filter(o => !o.workflow.acceptedAt && o.status !== 'CANCELLED');
      const ids = new Set(waiting.map(o => o.id));
      if (announce && announced.current) {
        const fresh = waiting.filter(o => !announced.current!.has(o.id));
        if (fresh.length) { setAlerting(fresh); chime(); }
      }
      announced.current = ids;
      setErr('');
    } catch (e: unknown) {
      if (e instanceof StoreAuthError) { signOut(); return; }
      setErr(e instanceof Error ? e.message : 'Could not load orders');
    }
  }, [code, chime, signOut]);

  // Restore an existing session on load — a tablet is signed in once and left that way.
  useEffect(() => {
    if (!getStoreToken(code)) { setBooting(false); return; }
    storeMe(code)
      .then(setSession)
      .catch(() => clearStoreToken(code))
      .finally(() => setBooting(false));
  }, [code]);

  useEffect(() => {
    if (!session) return;
    refresh(false);
    const t = setInterval(() => refresh(true), POLL_MS);
    // Also refresh the moment the tablet is picked up again — a screen that slept for an hour
    // should not show an hour-old board while it waits for the next tick.
    const onFocus = () => refresh(true);
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [session, refresh]);

  useEffect(() => { if (view === 'menu' && menu === null) storeMenu(code).then(setMenu).catch(() => setMenu([])); }, [view, menu, code]);

  // Unaccepted orders in the tab title, so an alert is visible on a tablet parked on another app.
  const waitingCount = (orders || []).filter(o => !o.workflow.acceptedAt && o.status !== 'CANCELLED').length;
  useEffect(() => {
    document.title = waitingCount ? `(${waitingCount}) New orders — ${code}` : `Store — ${code}`;
  }, [waitingCount, code]);

  const act = async (id: number, fn: () => Promise<unknown>) => {
    setBusyId(id); setErr('');
    try { await fn(); await refresh(false); }
    catch (e: unknown) {
      if (e instanceof StoreAuthError) { signOut(); return; }
      setErr(e instanceof Error ? e.message : 'That did not work');
    } finally { setBusyId(null); }
  };

  const doTrack = async (id: number) => {
    try {
      const t = await storeTrack(code, id);
      setTracks(prev => ({ ...prev, [id]: t }));
    } catch { /* the card keeps showing our stored status */ }
  };

  if (booting) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><p>Loading…</p></main>;
  // Signing in is the user gesture that lets the browser play sound at all — prime the audio
  // context here or the first new-order chime is silently dropped by the autoplay policy.
  if (!session) return <StoreSignIn code={code} onSignedIn={(s) => { setSession(s); chime(); }} />;

  const manual = !session.store.relaysToPos;
  const list = orders || [];
  const waiting = list.filter(o => !o.workflow.acceptedAt && o.status !== 'CANCELLED');
  const working = list.filter(o => o.workflow.acceptedAt && !o.workflow.readyAt && o.status !== 'CANCELLED');
  const done = list.filter(o => o.workflow.readyAt || o.status === 'CANCELLED');

  const section = (title: string, rows: StoreOrder[], empty: string) => (
    <section style={{ marginBottom: 30 }}>
      <h2 style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted, #7b6a58)', margin: '0 0 12px' }}>
        {title} {rows.length > 0 && `(${rows.length})`}
      </h2>
      {rows.length === 0
        ? <p style={{ fontSize: 14, color: 'var(--text-muted, #7b6a58)', margin: 0 }}>{empty}</p>
        : <div style={{ display: 'grid', gap: 14 }}>
            {rows.map(o => (
              <OrderCard key={o.id} order={o} manual={manual} busy={busyId === o.id} track={tracks[o.id] || null}
                onAccept={() => act(o.id, () => storeAcceptOrder(code, o.id))}
                onReady={() => act(o.id, () => storeMarkReady(code, o.id))}
                onBill={(n) => act(o.id, () => storeSetPosBill(code, o.id, n))}
                onTrack={() => doTrack(o.id)} />
            ))}
          </div>}
    </section>
  );

  return (
    <main style={{ minHeight: '100vh', background: 'var(--cream-bg, #fdf7ee)', color: 'var(--text-strong, #2b2118)' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--surface-card, #fff)', borderBottom: '1px solid var(--border-default, #e5e0d5)', padding: '12px 18px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Store size={20} />
          <div style={{ marginRight: 'auto' }}>
            <strong style={{ fontSize: 17, fontWeight: 900 }}>{session.store.name}</strong>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #7b6a58)' }}>
              {session.username}{manual ? ' · you bill on your own POS' : ' · orders go to Petpooja automatically'}
            </div>
          </div>
          <button onClick={() => setView(view === 'orders' ? 'menu' : 'orders')} style={btn()}>
            {view === 'orders' ? <><BookOpen size={15} /> Menu</> : <><ClipboardList size={15} /> Orders</>}
          </button>
          <button onClick={() => refresh(false)} style={btn()} title="Refresh"><RefreshCw size={15} /></button>
          <button onClick={() => setPwOpen(true)} style={btn()} title="Change password"><KeyRound size={15} /></button>
          <button onClick={signOut} style={btn()}><LogOut size={15} /></button>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '22px 18px 70px' }}>
        {err && (
          <p style={{ ...wrap, background: '#fdecec', borderColor: '#f3c9c6', color: '#a4231d', padding: 14, fontWeight: 700, marginBottom: 18 }}>
            <AlertTriangle size={16} style={{ verticalAlign: -3, marginRight: 8 }} />{err}
          </p>
        )}

        {view === 'menu' ? (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 6px' }}>Menu</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted, #7b6a58)', margin: '0 0 18px' }}>
              What the website sells and what each item costs there. {manual && 'The POS code is from the main outlet — use it to find the item, but check the name and price match on your own terminal.'}
            </p>
            {menu === null ? <p>Loading…</p> : (
              <div style={{ ...wrap, overflow: 'hidden' }}>
                {menu.map((m, i) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i ? '1px solid var(--border-soft, #f0ebe1)' : 'none' }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: 15 }}>{m.name}</strong>
                      {m.posItemId && <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-subtle, #a4988a)' }}>POS code {m.posItemId}</div>}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{money(m.price)}</span>
                    {m.available ? <Chip text="On sale" tone="ok" /> : <Chip text="Off" tone="bad" />}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : orders === null ? <p>Loading orders…</p> : (
          <>
            {section('New — accept these', waiting, 'Nothing waiting. New orders appear here the moment they are paid for.')}
            {section('Being made', working, 'Nothing in the oven.')}
            {section('Done today', done, 'Nothing finished yet.')}
          </>
        )}
      </div>

      {/* The alert. A full-screen sheet rather than a toast: this has to be noticed from the far
          side of a kitchen, and dismissing it must be deliberate. */}
      {alerting.length > 0 && (
        <div role="alertdialog" aria-label="New order" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,12,4,.6)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={{ ...wrap, padding: 26, width: 'min(460px, 100%)', textAlign: 'center' }}>
            <div style={{ fontSize: 42, marginBottom: 6 }}>🍪</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px' }}>
              {alerting.length === 1 ? 'New order' : `${alerting.length} new orders`}
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-muted, #7b6a58)', margin: '0 0 18px' }}>
              {alerting.map(o => o.orderNumber).join(', ')}
            </p>
            <div style={{ textAlign: 'left', marginBottom: 20 }}>
              {alerting.flatMap(o => o.items).map((i, n) => (
                <div key={n} style={{ fontSize: 16, padding: '5px 0' }}><strong>{i.quantity}×</strong> {i.name}</div>
              ))}
            </div>
            <button onClick={() => setAlerting([])} style={{ ...btn('primary', true), width: '100%' }}>Got it</button>
          </div>
        </div>
      )}

      {pwOpen && <PasswordModal code={code} onClose={() => setPwOpen(false)} />}
    </main>
  );
}

function PasswordModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true); setMsg('');
    try { await storeChangePassword(code, current, next); setMsg('Password changed.'); setCurrent(''); setNext(''); }
    catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Could not change it'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,12,4,.55)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ ...wrap, padding: 24, width: 'min(400px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, flex: 1 }}>Change password</h2>
          <button onClick={onClose} style={btn()}><X size={15} /></button>
        </div>
        <input type="password" placeholder="Current password" value={current} onChange={e => setCurrent(e.target.value)} style={{ ...input, marginBottom: 12 }} />
        <input type="password" placeholder="New password (8+ characters)" value={next} onChange={e => setNext(e.target.value)} style={{ ...input, marginBottom: 16 }} />
        {msg && <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>{msg}</p>}
        <button disabled={busy || next.length < 8 || !current} onClick={save}
          style={{ ...btn('primary'), width: '100%', opacity: busy || next.length < 8 || !current ? 0.6 : 1 }}>Save</button>
      </div>
    </div>
  );
}
