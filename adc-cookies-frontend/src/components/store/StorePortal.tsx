'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Store, LogOut, RefreshCw, Check, Package, Truck, Phone, MapPin, Receipt,
  AlertTriangle, BookOpen, ClipboardList, KeyRound, X, Bike, ExternalLink, Volume2,
} from 'lucide-react';
import StoreSignIn from './StoreSignIn';
import StoreMenuBoard from './StoreMenuBoard';
import {
  storeMe, storeOrders, storeTrack,
  storeAcceptOrder, storeMarkReady, storeSetPosBill, storeChangePassword,
  getStoreToken, clearStoreToken, StoreAuthError,
  type StoreSession, type StoreOrder, type StoreTrack, type StoreOrdersResponse,
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

/*
 * The stored shipment status, said in words a counter can act on.
 *
 * Carrier statuses are written for a logistics dashboard ("NEW", "PICKED UP"), and the only thing
 * the person holding the bag needs from them is whether to keep holding it. Anything unrecognised
 * is passed through rather than swallowed — a status we have not seen before is still information,
 * and hiding it would be how a new state becomes invisible.
 */
function riderLabel(status?: string | null): string {
  const s = (status || '').toLowerCase().replace(/[_-]+/g, ' ');
  if (!s || s === 'new') return 'Booked — waiting for a rider to accept.';
  if (/deliver(ed)?\b/.test(s) && !/out for/.test(s)) return 'Delivered — nothing left to do.';
  if (/out for|in transit|picked ?up/.test(s)) return 'Picked up — the rider has it.';
  if (/reached drop/.test(s)) return 'Rider has reached the customer.';
  if (/reached pickup|arrived/.test(s)) return 'Rider is at the store — hand the order over.';
  if (/assigned|scheduled/.test(s)) return 'Rider assigned — keep the order packed and ready.';
  if (/cancel/.test(s)) return 'Booking cancelled — do not wait on a rider.';
  if (/search/.test(s)) return 'Searching for a rider — keep the order packed and ready.';
  return status as string;
}

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

      {/* Rider / courier. Refreshes on its own (see refresh() in the parent) the moment a booking
          exists — nobody has to remember to tap anything to find out whether a rider is coming. A
          store cannot fix a failed booking, but being told one failed is the difference between
          waiting for a rider and asking someone why none is coming. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 14, marginBottom: 8 }}>
        <Truck size={16} style={{ color: 'var(--text-muted, #7b6a58)' }} />
        {order.delivery.carrier ? (
          <>
            <span style={{ fontWeight: 800 }}>{order.delivery.carrier} order created</span>
            {order.delivery.shipmentId && <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted, #7b6a58)' }}>#{order.delivery.shipmentId}</span>}
            <button onClick={onTrack} style={btn()} title="Refresh now"><RefreshCw size={14} /></button>
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

      {/* Live rider status — the whole point of showing this card is answering "is someone coming".
          Three states: searching (booked, no rider yet), assigned (name + a tappable phone number),
          or unreachable (courier API hiccup — the stored waybill/shipment id above still stands). */}
      {order.delivery.carrier && (
        <div style={{ background: track?.rider?.name ? '#eef8f0' : 'var(--surface-sunken, #f7f2e9)', border: track?.rider?.name ? '1px solid #bfe3c8' : 'none', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 14 }}>
          {/* Before the live call answers — and if it never answers — say what the ORDER says.
              This branch used to read "Checking for a rider…", which is a loading state wearing a
              status label: when the call failed it stayed there permanently, so a delivered order
              sat on the counter's screen claiming nobody had been found yet. The order row already
              knows — the webhook and the background poll keep shipment_status current — so the
              stored answer is shown immediately and the live call only ever adds the rider to it. */}
          {!track ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', color: 'var(--text-muted, #7b6a58)' }}>
              <Bike size={16} />
              <span>{riderLabel(order.delivery.shipmentStatus)}</span>
            </div>
          ) : track.ok ? (
            track.rider?.name ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <Bike size={18} style={{ color: '#1c7a3d' }} />
                <span>Rider <strong>{track.rider.name}</strong> is assigned{track.status ? ` — ${track.status}` : ''}</span>
                {track.rider.phone && <a href={`tel:${track.rider.phone}`} style={{ ...btn('primary'), textDecoration: 'none' }}><Phone size={13} /> {track.rider.phone}</a>}
              </div>
            ) : order.delivery.shipmentError ? (
              /* The carrier refused the booking — an empty Shiprocket wallet is the usual reason.
                 "Searching for a rider" here was a lie the counter had no way to see through: they
                 kept a bag packed for a rider nobody had successfully called. Say what actually
                 happened, and that it needs the office rather than more waiting. */
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start', color: 'var(--red-danger, #b3261e)' }}>
                <Bike size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>No rider could be booked.</strong> {order.delivery.shipmentError}
                  <br />The office has been alerted — do not wait on a rider for this one.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', color: 'var(--text-muted, #7b6a58)' }}>
                <Bike size={16} />
                <span>{track.status || 'Searching for a rider'} — keep the order packed and ready.</span>
              </div>
            )
          ) : (
            /* The live call failed. That is a fact about the courier's API, not about the order —
               so fall back to what the order itself says rather than leaving the counter with only
               an error to read. */
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', color: 'var(--text-muted, #7b6a58)' }}>
              <Bike size={16} />
              <span>{riderLabel(order.delivery.shipmentStatus)}</span>
            </div>
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

      {/* Accepting is the one action that matters — it is what starts baking and, for a MANUAL
          store, what triggers the Shiprocket booking above. "Ready for pickup" affects nothing
          downstream (the rider comes whether it is tapped or not), so once accepted the real
          status to show is the live carrier/rider block above; this is just an optional prep-done
          marker for the store's own bookkeeping, sized down so it doesn't compete with that. */}
      {order.status !== 'CANCELLED' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {!order.workflow.acceptedAt && (
            <button disabled={busy} onClick={onAccept} style={{ ...btn('primary', true), flex: '1 1 200px', opacity: busy ? 0.6 : 1 }}>
              <Check size={19} /> Accept this order
            </button>
          )}
          {order.workflow.acceptedAt && !order.workflow.readyAt && (
            <button disabled={busy} onClick={onReady} style={{ ...btn(), opacity: busy ? 0.6 : 1 }}>
              <Package size={14} /> Mark packed &amp; ready
            </button>
          )}
          {order.workflow.readyAt && (
            <span style={{ fontSize: 14, color: 'var(--text-muted, #7b6a58)', alignSelf: 'center' }}>
              Packed — the courier above closes this out.
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
  const [view, setView] = useState<'orders' | 'menu'>('orders');
  const [tracks, setTracks] = useState<Record<number, StoreTrack>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [alerting, setAlerting] = useState<StoreOrder[]>([]);
  // After accepting from the alert, a manual-POS store still has to key the order into Petpooja and
  // type the bill number back — these are the orders waiting for that number.
  const [billFor, setBillFor] = useState<StoreOrder[]>([]);
  const [billDrafts, setBillDrafts] = useState<Record<number, string>>({});
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  // Rides along with every poll — see the note on the /store/orders payload.
  const [wallet, setWallet] = useState<StoreOrdersResponse['wallet']>(undefined);

  // Ids we have already announced. A ref, not state: it must not trigger a re-render, and the
  // polling closure has to read the CURRENT value rather than the one captured when it was created.
  const announced = useRef<Set<number> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  // True when the browser will not let us make a sound yet. Shown on screen, because a shop that
  // believes it has an audible alarm and does not is worse off than one that knows it is silent.
  const [soundBlocked, setSoundBlocked] = useState(false);
  // A RESTORED session (the normal case — a tablet signed in once and left that way) involves no
  // click at all, so soundBlocked can be true the instant the board first renders with nothing on
  // screen yet having asked for a tap. A banner further down the page does not help if nobody looks
  // at the screen before backgrounding the tab — this makes the one required tap impossible to miss,
  // once, per fresh load. Dismissible either way so it can never trap someone on a browser that
  // genuinely cannot grant audio (rare, but real).
  const [soundGateDismissed, setSoundGateDismissed] = useState(false);

  /*
   * The alert tone, synthesised rather than loaded — a kitchen tablet may be offline from
   * everything except our own API, and an <audio src> that 404s alerts nobody.
   *
   * Browsers refuse to run an AudioContext until the page has had a user gesture. Priming it on the
   * sign-in click alone was not enough and was the bug: a tablet left signed in restores its session
   * from storage and never clicks anything, so the context was first created at alert time, arrived
   * `suspended`, and the notes were scheduled against a clock that was not running. Silent, exactly
   * when it mattered.
   *
   * So: ANY tap or key anywhere unlocks it, we re-check the state on every alert, and if it is still
   * blocked we say so on screen rather than pretending the shop has a working alarm.
   */
  const ensureAudio = useCallback(async () => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audio.current ??= new Ctx();
      const ctx = audio.current;
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      setSoundBlocked(ctx.state !== 'running');
      return ctx.state === 'running' ? ctx : null;
    } catch { return null; }
  }, []);

  // Capture phase, so a tap anywhere counts even when a child stops propagation.
  useEffect(() => {
    const unlock = () => { void ensureAudio(); };
    const opts = { capture: true } as const;
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, unlock, opts);
    void ensureAudio();   // may well fail on a restored session; that is what the banner is for
    return () => { for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.removeEventListener(ev, unlock, opts); };
  }, [ensureAudio]);

  /*
   * The alarm RINGS UNTIL SOMEONE ACCEPTS. A single ~1s blip is missed in a kitchen with an oven
   * running and a mixer going, so bursts repeat on an interval and only stop when staff actually
   * accept the order in the alert (or the safety cap below trips, so a tablet nobody is standing
   * at doesn't ring for the rest of the day).
   */
  const alarmTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmCap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alarmNodes = useRef<OscillatorNode[]>([]);
  const ALARM_CAP_MS = 120_000;

  // Bumped every time an alarm STARTS. A one-off test chime schedules its own stop a moment later —
  // without this, a real order landing inside that window would start its own alarm and then have it
  // killed early by the test chime's stale stop, which is silent exactly when it must not be.
  // stopAlarm() itself does not check this: it always means "silence right now" and is also what an
  // unmount and a genuine accept rely on.
  const alarmSession = useRef(0);

  const stopAlarm = useCallback(() => {
    if (alarmTimer.current) { clearInterval(alarmTimer.current); alarmTimer.current = null; }
    if (alarmCap.current) { clearTimeout(alarmCap.current); alarmCap.current = null; }
    for (const osc of alarmNodes.current) { try { osc.stop(); } catch { /* already ended */ } }
    alarmNodes.current = [];
  }, []);

  const startAlarm = useCallback(async () => {
    const ctx = await ensureAudio();
    const mySession = ++alarmSession.current;
    stopAlarm();
    // No audio (blocked, or a browser without WebAudio) — buzz on a loop instead where that exists.
    // A phone or tablet in an apron pocket is felt even when the room is loud.
    if (!ctx) {
      const buzz = () => { try { navigator.vibrate?.([300, 150, 300]); } catch { /* not supported */ } };
      buzz();
      alarmTimer.current = setInterval(buzz, 1500);
      alarmCap.current = setTimeout(stopAlarm, ALARM_CAP_MS);
      return mySession;
    }
    // Three rising pairs per burst (~1.3s), repeated every 1.5s for a continuous alarm.
    const burst = () => {
      const start = ctx.currentTime + 0.05;
      [880, 1175, 880, 1175, 880, 1175].forEach((freq, i) => {
        const t0 = start + i * 0.22;
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.6, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t0); osc.stop(t0 + 0.22);
        alarmNodes.current.push(osc);
        osc.onended = () => { alarmNodes.current = alarmNodes.current.filter(n => n !== osc); };
      });
      try { navigator.vibrate?.([120, 60, 120]); } catch { /* not supported */ }
    };
    burst();
    alarmTimer.current = setInterval(burst, 1500);
    alarmCap.current = setTimeout(stopAlarm, ALARM_CAP_MS);
    return mySession;
  }, [ensureAudio, stopAlarm]);

  // Never leave an alarm ringing behind a closed/navigated-away board.
  useEffect(() => stopAlarm, [stopAlarm]);

  // One burst only — for the "test the sound" / "turn the sound on" buttons, which should confirm
  // audio works without starting the full until-accepted alarm.
  const chime = useCallback(async () => {
    const mySession = await startAlarm();
    // Only stop if nothing newer has started an alarm since — a real order landing inside this
    // window must keep ringing, not be silenced by this one-off test/prime chime finishing up.
    setTimeout(() => { if (alarmSession.current === mySession) stopAlarm(); }, 1500);
  }, [startAlarm, stopAlarm]);

  const signOut = useCallback(() => { clearStoreToken(code); setSession(null); setOrders(null); }, [code]);

  const doTrack = useCallback(async (id: number) => {
    try {
      const t = await storeTrack(code, id);
      setTracks(prev => ({ ...prev, [id]: t }));
    } catch { /* the card keeps showing our stored status */ }
  }, [code]);

  /* Pull the board. `announce` is false on the very first load: staff opening the portal to a queue
     of waiting orders should see the NEW list, not be alarmed at orders that arrived hours ago. */
  const refresh = useCallback(async (announce = true) => {
    try {
      const r = await storeOrders(code);
      setOrders(r.orders);
      setWallet(r.wallet);
      const waiting = r.orders.filter(o => !o.workflow.acceptedAt && o.status !== 'CANCELLED');
      const ids = new Set(waiting.map(o => o.id));
      if (announce && announced.current) {
        const fresh = waiting.filter(o => !announced.current!.has(o.id));
        if (fresh.length) { setAlerting(fresh); void startAlarm(); }
      }
      announced.current = ids;
      // Live carrier/rider status, automatically — nobody should have to remember to tap "Check
      // rider" to find out whether one has even been booked yet. Every order that has a booking
      // and is not yet finished gets refreshed on the same cadence the board already polls at.
      for (const o of r.orders) {
        if (o.delivery.carrier && o.status !== 'CANCELLED' && o.status !== 'DELIVERED') void doTrack(o.id);
      }
      setErr('');
    } catch (e: unknown) {
      if (e instanceof StoreAuthError) { signOut(); return; }
      setErr(e instanceof Error ? e.message : 'Could not load orders');
    }
  }, [code, startAlarm, signOut, doTrack]);

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

  if (booting) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><p>Loading…</p></main>;
  // Signing in is the user gesture that lets the browser play sound at all — prime the audio
  // context here or the first new-order chime is silently dropped by the autoplay policy.
  if (!session) return <StoreSignIn code={code} onSignedIn={(s) => { setSession(s); chime(); }} />;

  const manual = !session.store.relaysToPos;

  /* Accept straight from the alert — that IS the acknowledgement, so the alarm stops here rather
     than on a separate "got it". A manual-POS store is then asked for the bill number, which is the
     only link between the money Razorpay settled and the bill their kitchen printed. */
  const acceptAlerted = async () => {
    setAcceptBusy(true); setErr('');
    const accepted = alerting;
    try {
      for (const o of accepted) await storeAcceptOrder(code, o.id);
      stopAlarm();
      setAlerting([]);
      setBillFor(manual ? accepted : []);
      await refresh(false);
    } catch (e: unknown) {
      if (e instanceof StoreAuthError) { signOut(); return; }
      setErr(e instanceof Error ? e.message : 'Could not accept the order');
    } finally { setAcceptBusy(false); }
  };

  const saveBill = async (orderId: number, no: string) => {
    setAcceptBusy(true); setErr('');
    try {
      await storeSetPosBill(code, orderId, no);
      setBillFor(prev => prev.filter(o => o.id !== orderId));
      await refresh(false);
    } catch (e: unknown) {
      if (e instanceof StoreAuthError) { signOut(); return; }
      setErr(e instanceof Error ? e.message : 'Could not save the bill number');
    } finally { setAcceptBusy(false); }
  };

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
              {/* Always visible, quietly. The red banner below only appears once it is low, and by
                  then it is news; this is so the number is a thing staff have seen before. */}
              {wallet?.ok && wallet.balance != null && (
                <> · <span style={{ fontWeight: 800, color: wallet.low ? '#a4231d' : 'inherit' }}>rider wallet ₹{wallet.balance}</span></>
              )}
            </div>
          </div>
          <button onClick={() => setView(view === 'orders' ? 'menu' : 'orders')} style={btn()}>
            {view === 'orders' ? <><BookOpen size={15} /> Menu &amp; stock</> : <><ClipboardList size={15} /> Orders</>}
          </button>
          <button onClick={() => refresh(false)} style={btn()} title="Refresh"><RefreshCw size={15} /></button>
          {/* Lets staff confirm the alarm actually works, at the start of a shift, without waiting
              for a real order to find out that it doesn't. */}
          <button onClick={() => void chime()} style={btn()} title="Test the new-order sound"><Volume2 size={15} /></button>
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

        {/* A quiet fallback for after the gate below has been dismissed once but sound is still
            blocked — never leave a counter believing it will be alerted when it will not be. */}
        {soundBlocked && soundGateDismissed && (
          <div style={{ ...wrap, background: '#fff8ec', borderColor: '#f0d9ae', padding: 14, marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <AlertTriangle size={18} style={{ color: '#9a5a00', flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, flex: 1, minWidth: 200 }}>
              New orders will show on screen but make no sound until you tap once.
            </span>
            <button onClick={() => void chime()} style={btn('primary')}>Turn the sound on</button>
          </div>
        )}

        {/* Accepting an order is what books the rider, and it is booked against a company wallet
            this counter cannot top up. So the warning is written for someone who can only pick up a
            phone: what will happen, and who to call. Shown only when it is low — a healthy balance
            is not news, and a tablet that warns every day is a tablet nobody reads. */}
        {wallet?.ok && wallet.low && (
          <div style={{ ...wrap, background: '#fdecec', borderColor: '#f3c9c6', padding: 14, marginBottom: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{ color: '#a4231d', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>
              <strong style={{ display: 'block', color: '#a4231d', fontWeight: 900 }}>Delivery wallet is low — ₹{wallet.balance} left</strong>
              <span style={{ fontWeight: 600 }}>
                Riders are booked from this balance. Keep baking and accepting as normal, but tell head
                office now — if it runs out, an accepted order can end up with no rider coming for it.
              </span>
            </div>
          </div>
        )}

        {view === 'menu' ? (
          /* Its own component now, because it stopped being a read-only list: it holds the shop's
             open/closed switch and a per-item on/off, each with its own loading and error state.
             Keeping that inside this file would have added a third set of them to a component that
             already owns the order board and the new-order alarm. */
          <StoreMenuBoard code={code} storeName={session.store.name} manual={manual} onAuthError={signOut} />
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
          <div className="hide-sb" style={{ ...wrap, padding: 24, width: 'min(560px, 100%)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 4 }}>🍪</div>
              <h2 style={{ fontSize: 23, fontWeight: 900, margin: '0 0 14px' }}>
                {alerting.length === 1 ? 'New order' : `${alerting.length} new orders`}
              </h2>
            </div>

            {/* Everything the kitchen needs to key this in — items, notes, customer and address —
                so nobody has to dismiss the alert and hunt for the order on the board. */}
            {alerting.map(o => (
              <div key={o.id} style={{ textAlign: 'left', border: '1px solid var(--border-default, #e7dccd)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <strong style={{ fontSize: 16 }}>{o.orderNumber}</strong>
                  <span style={{ fontSize: 16, fontWeight: 900 }}>{money(o.totalAmount)}</span>
                </div>
                {o.items.map((i, n) => (
                  <div key={n} style={{ fontSize: 15, padding: '4px 0', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span><strong>{i.quantity}×</strong> {i.name}
                      {i.specialNotes && <em style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #7b6a58)' }}>Note: {i.specialNotes}</em>}
                    </span>
                    <span style={{ flex: 'none' }}>{money(i.totalPrice)}</span>
                  </div>
                ))}
                {o.customer && (
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted, #7b6a58)' }}>
                    {o.customer.name}{o.customer.phone ? ` · ${o.customer.phone}` : ''}
                  </div>
                )}
                {o.address && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted, #7b6a58)' }}>
                    {[o.address.line1, o.address.line2, o.address.city, o.address.pincode].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            ))}

            <button disabled={acceptBusy} onClick={acceptAlerted} style={{ ...btn('primary', true), width: '100%', opacity: acceptBusy ? 0.6 : 1 }}>
              <Check size={19} /> {acceptBusy ? 'Accepting…' : alerting.length === 1 ? 'Accept order' : `Accept ${alerting.length} orders`}
            </button>
          </div>
        </div>
      )}

      {/* Straight after accepting: the bill number from their own Petpooja terminal. */}
      {billFor.length > 0 && (
        <div role="dialog" aria-label="Bill number" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,12,4,.6)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div className="hide-sb" style={{ ...wrap, padding: 24, width: 'min(460px, 100%)', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 6px' }}>Accepted — now bill it</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted, #7b6a58)', margin: '0 0 16px' }}>
              Key the order into your Petpooja terminal, then type the bill number here.
            </p>
            {billFor.map(o => (
              <div key={o.id} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{o.orderNumber} · {money(o.totalAmount)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={billDrafts[o.id] || ''} onChange={e => setBillDrafts(d => ({ ...d, [o.id]: e.target.value }))} placeholder="Bill number"
                    style={{ flex: 1, minWidth: 0, padding: '11px 13px', borderRadius: 12, border: '1.5px solid var(--border-default, #e7dccd)', fontSize: 15 }} />
                  <button disabled={!(billDrafts[o.id] || '').trim() || acceptBusy} onClick={() => saveBill(o.id, (billDrafts[o.id] || '').trim())}
                    style={{ ...btn('primary'), opacity: !(billDrafts[o.id] || '').trim() || acceptBusy ? 0.6 : 1 }}>Save</button>
                </div>
              </div>
            ))}
            <button onClick={() => setBillFor([])} style={{ ...btn(), width: '100%', marginTop: 4 }}>I&apos;ll do it later</button>
          </div>
        </div>
      )}

      {pwOpen && <PasswordModal code={code} onClose={() => setPwOpen(false)} />}

      {/* One mandatory tap before the board is usable, shown only when sound genuinely is not
          working yet. Skipped while an order alert or bill prompt is already on screen — tapping
          either of THOSE also satisfies the browser's gesture requirement, so stacking this gate on
          top of an order someone needs to act on right now would only be in the way. */}
      {session && soundBlocked && !soundGateDismissed && !alerting.length && !billFor.length && (
        <div role="dialog" aria-label="Enable order alerts" style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,12,4,.75)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={{ ...wrap, padding: 28, width: 'min(420px, 100%)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔔</div>
            <h2 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 10px' }}>Turn on order alerts</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted, #7b6a58)', margin: '0 0 22px', lineHeight: 1.5 }}>
              Your browser only allows sound after a tap. Tap below once at the start of your shift —
              every new order then rings until it is accepted, even while this tab sits in the background.
            </p>
            <button onClick={() => { void chime(); setSoundGateDismissed(true); }} style={{ ...btn('primary', true), width: '100%', marginBottom: 10 }}>
              <Volume2 size={19} /> Enable sound
            </button>
            <button onClick={() => setSoundGateDismissed(true)} style={{ ...btn(), width: '100%' }}>Continue without sound</button>
          </div>
        </div>
      )}
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
