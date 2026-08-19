'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, Gift, Copy, Check, Mail, ArrowRight, Clock } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/SocialIcons';
import { useAuth } from '@/context/AuthContext';
import AuthPanel from '@/components/auth/AuthPanel';
import { getActiveCoupons, claimSpin, spinDraw, getSpinCooldown, type ActiveCoupon } from '@/lib/api';
import { INSTAGRAM_URL, YOUTUBE_URL, LINKEDIN_URL, whatsappLink } from '@/lib/site';
import { type ActiveReward, CLAIM_WINDOW_HOURS, savePending, clearPending, formatRemaining } from '@/lib/spinReward';
import { useIsDesktop } from '@/lib/useIsDesktop';

// lucide in this build has no Instagram/YouTube glyphs — use inline brand SVGs (as the footer does).
const IgIcon = () => (<svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>);
const YtIcon = () => (<svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>);
const LiIcon = () => (<svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>);

interface Prize {
  label: string; code: string; win: boolean; weight: number;
  discountType?: string; discountValue?: number;
  minimumOrderAmount?: number | null; maximumDiscount?: number | null; terms?: string;
  isGift?: boolean;
}

// Decorative wheel shown only while offers are still loading — purely visual, not spin-able.
const DECOR_PRIZES: Prize[] = [
  { label: '🎁', code: '', win: false, weight: 1 }, { label: 'WIN', code: '', win: false, weight: 1 },
  { label: '🍪', code: '', win: false, weight: 1 }, { label: 'OFFER', code: '', win: false, weight: 1 },
  { label: '⭐', code: '', win: false, weight: 1 }, { label: 'ADC', code: '', win: false, weight: 1 },
];

// Build the real wheel from the admin's ACTIVE coupons + one "no reward" slot, whose weight is
// whatever's left after the real offers' odds — so the admin's weights (e.g. 5% for a rare
// prize) are honoured exactly, regardless of how many equal-sized wedges are drawn on screen.
function buildPrizes(coupons: ActiveCoupon[]): Prize[] {
  const wins: Prize[] = coupons.map(c => ({
    label: c.label, code: c.code, win: true, weight: c.weight,
    discountType: c.discountType, discountValue: c.discountValue,
    minimumOrderAmount: c.minimumOrderAmount, maximumDiscount: c.maximumDiscount, terms: c.terms,
    isGift: c.isGift,
  }));
  const totalWinWeight = wins.reduce((s, w) => s + (w.weight || 0), 0);
  const noReward: Prize = {
    label: 'Better luck next time!', code: '', win: false,
    weight: wins.length ? Math.max(1, 100 - totalWinWeight) : 100,
    terms: 'No reward this spin — but fresh cookies are always worth ordering! Come back for another spin.',
  };
  return wins.length ? [...wins, noReward] : [noReward];
}


// Alternating brand wedges — amber / orange, straight from the theme.
const wheelBg = (prizes: Prize[]) => {
  const seg = 360 / prizes.length;
  return `conic-gradient(${prizes.map((_, i) => {
    const c = i % 2 === 0 ? 'var(--amber-400)' : 'var(--orange-500)';
    return `${c} ${i * seg}deg ${(i + 1) * seg}deg`;
  }).join(',')})`;
};

function valueSummary(p: Prize): string {
  if (!p.win) return 'No reward this spin.';
  // A "free item" reward hands over an actual product — say that, not a "₹X off" figure,
  // which is really just the internal discount mechanics, not what the customer is getting.
  if (p.isGift || Number(p.discountValue || 0) === 0 || /^free\b/i.test(p.label)) {
    const min = p.minimumOrderAmount ? ` · min. order ₹${p.minimumOrderAmount}` : '';
    return `Free reward${min}`;
  }
  const base = p.discountType === 'PERCENTAGE' ? `${p.discountValue}% off` : `₹${p.discountValue} off`;
  const cap = p.discountType === 'PERCENTAGE' && p.maximumDiscount ? `, capped at ₹${p.maximumDiscount}` : '';
  const min = p.minimumOrderAmount ? ` · min. order ₹${p.minimumOrderAmount}` : '';
  return `${base}${cap}${min}`;
}

interface SpinWheelProps {
  open: boolean;
  onClose: () => void;
  activeReward: ActiveReward | null;
  setActiveReward: (r: ActiveReward | null) => void;
  checkingReward: boolean;
  now: number;
  refreshReward?: () => void | Promise<void>;
}

export default function SpinWheel({ open, onClose, activeReward, setActiveReward, checkingReward, now, refreshReward }: SpinWheelProps) {
  const router = useRouter();
  const { user, setAuthModalOpen } = useAuth();
  // Compact sizing is for mobile only — desktop gets the roomier layout back.
  const desktop = useIsDesktop();
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Prize | null>(null);
  const [copied, setCopied] = useState(false);
  const [prizes, setPrizes] = useState<Prize[] | null>(null); // null until the admin's active coupons load
  const [spinError, setSpinError] = useState('');
  const [drawExpiresAtMs, setDrawExpiresAtMs] = useState<number | null>(null); // when a MISS result stops being "locked in" (wins are governed by activeReward instead)
  const [showTerms, setShowTerms] = useState(false);
  // Claiming happens by signing in, right here in this popup. The old flow asked for a name and
  // an email instead, which created a second half-identity for anyone who already had an account
  // and meant the coupon only reached them if they later signed in with that exact address.
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimErr, setClaimErr] = useState('');
  // Raised by AuthPanel while its mandatory name/email step shows — the wheel must not close over it.
  const [authLocked, setAuthLocked] = useState(false);
  // One spin per device/account per day: once null (no active reward/result), check whether
  // they're still waiting out yesterday's cooldown before letting the idle spin button show.
  const [cooldown, setCooldown] = useState<{ completed: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRewardRef = useRef<ActiveReward | null>(null);
  // A local per-second tick while the modal is open, so every countdown in it (win reward AND a
  // miss's "try again in…") stays live — the prop `now` only ticks when a reward exists.
  const [localNow, setLocalNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setLocalNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);
  const nowMs = Math.max(now, localNow);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // The reward prop is cleared (claimed elsewhere, or its window ran out) the moment it disappears
  // from a real reward — drop any stale in-session result so the idle "spin" state reappears.
  useEffect(() => {
    if (prevRewardRef.current && !activeReward) setResult(null);
    prevRewardRef.current = activeReward;
  }, [activeReward]);

  // A MISS is locked in for the same window as a win (see spin_draws server-side) — re-spinning
  // before it expires would just replay the same result, so don't let the idle button reappear
  // until it genuinely has.
  useEffect(() => {
    if (!drawExpiresAtMs) return;
    const t = setTimeout(() => {
      setResult(null);
      setDrawExpiresAtMs(null);
    }, Math.max(0, drawExpiresAtMs - Date.now()));
    return () => clearTimeout(t);
  }, [drawExpiresAtMs]);

  // Read-only check (no side effect) so a returning shopper sees "come back at X" the moment the
  // wheel opens, instead of only finding out after tapping spin. Re-checked whenever the reward/
  // result clears, since that's exactly when the idle spin button would otherwise reappear.
  useEffect(() => {
    if (!open || activeReward || result) return;
    let cancelled = false;
    getSpinCooldown().then(c => { if (!cancelled) setCooldown(c.completed ? c : null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, activeReward, result]);



  // Load the wheel's real offers as soon as this component exists (FloatingDock mounts it on
  // every page, well before anyone opens the modal) — not gated on `open`. Waiting for `open`
  // meant the decorative placeholder wheel (generic emoji wedges) visibly flashed for however
  // long the fetch took every time someone clicked the launcher; prefetching in the background
  // means the real wheel is already loaded by the time they actually see it in the vast majority
  // of cases.
  useEffect(() => {
    if (prizes !== null) return;
    let cancelled = false;
    getActiveCoupons()
      .then(cs => { if (!cancelled) setPrizes(buildPrizes(cs)); })
      .catch(() => { if (!cancelled) setPrizes(buildPrizes([])); });
    return () => { cancelled = true; };
  }, [prizes]);

  const displayPrizes = prizes ?? DECOR_PRIZES;
  const N = displayPrizes.length;
  const SEG = 360 / N;
  const WHEEL_BG = wheelBg(displayPrizes);
  const offersLoaded = prizes !== null;

  // `rot` only ever gets set inside spin() — so a reward restored from the server/localStorage
  // on a fresh mount (reopening the wheel later, or on a different page) left the disc sitting
  // at its default position while the result text correctly showed the real prize. Whenever
  // there's an active reward but no in-progress/just-finished spin THIS session, derive the
  // rotation that actually brings its wedge under the pointer instead of trusting stale `rot`.
  const activeIdx = activeReward ? displayPrizes.findIndex(p => p.code === activeReward.code) : -1;
  const wheelRot = (spinning || result || activeIdx < 0) ? rot : 360 * 5 - (activeIdx * SEG + SEG / 2);

  const close = onClose;
  const wonPrize: Prize | null = activeReward
    ? {
        label: activeReward.label, code: activeReward.code, win: true, weight: 0,
        discountType: activeReward.discountType, discountValue: activeReward.discountValue,
        minimumOrderAmount: activeReward.minimumOrderAmount, maximumDiscount: activeReward.maximumDiscount,
        terms: activeReward.terms,
        isGift: activeReward.isGift,
      }
    : result?.win ? result : null;
  const guestWinNeedsLogin = !!result?.win && !user;
  const pendingCode = activeReward?.code || (result?.win ? result.code : '') || '';
  const needsClaim = (!!activeReward && !activeReward.claimed) || guestWinNeedsLogin;

  // ProfileGate is mounted globally and reacts to the same user/profileLoaded change that
  // AuthPanel's own name+email step does — without this it pops up over the wheel the instant an
  // OTP verifies, so two popups end up asking for the same thing.
  useEffect(() => {
    if (!open || !needsClaim || user) return;
    setAuthModalOpen(true);
    return () => setAuthModalOpen(false);
  }, [open, needsClaim, user, setAuthModalOpen]);

  const spin = async () => {
    if (spinning || result || activeReward || cooldown?.completed || !prizes) return;
    setSpinning(true);
    setSpinError('');
    // The server draws the outcome (a shuffled ticket pool — see POST /coupons/spin) so odds are
    // an exact ratio across every batch of spins, not just independent per-spin randomness. The
    // wheel here only animates to whatever it's told; it never decides the result itself.
    let code: string | null;
    let expiresAt: string;
    try {
      const drawn = await spinDraw();
      // The cooldown check above is read-only and can go slightly stale (e.g. two tabs open) —
      // the server is the real authority, so honour a `completed` reply here too instead of
      // animating a spin that never actually happened.
      if (drawn.completed) {
        setSpinning(false);
        setCooldown({ completed: true });
        return;
      }
      code = drawn.code;
      expiresAt = drawn.expiresAt!;
    } catch {
      setSpinning(false);
      setSpinError('Could not spin right now — please try again.');
      return;
    }
    const found = code ? prizes.findIndex(p => p.code === code) : prizes.findIndex(p => !p.win);
    const idx = found >= 0 ? found : prizes.length - 1;
    // Bring segment idx's centre under the top pointer, after 5 full turns.
    const target = 360 * 5 - (idx * SEG + SEG / 2);
    setRot(target);
    timer.current = setTimeout(async () => {
      const p = prizes[idx];
      setResult(p);
      setSpinning(false);
      if (!p.win) { setDrawExpiresAtMs(new Date(expiresAt).getTime()); return; }
      const expiresAtMs = Date.now() + CLAIM_WINDOW_HOURS * 3600_000;
      if (user) {
        try {
          const claimed = await claimSpin(p.code);
          setActiveReward({ code: claimed.code, label: claimed.label, discountType: claimed.discountType, discountValue: claimed.discountValue, minimumOrderAmount: claimed.minimumOrderAmount, maximumDiscount: claimed.maximumDiscount, terms: claimed.terms, isGift: claimed.isGift, expiresAtMs: new Date(claimed.expiresAt).getTime(), claimed: true });
        } catch { /* leave the result showing even if the claim call failed — they can retry via login prompt */ }
      } else {
        // Save the win and show it locked behind "Log in to claim" — the login popup itself only
        // opens when they tap that button, not automatically the moment the wheel stops.
        const pending: ActiveReward = { code: p.code, label: p.label, discountType: p.discountType, discountValue: p.discountValue, minimumOrderAmount: p.minimumOrderAmount, maximumDiscount: p.maximumDiscount, terms: p.terms, isGift: p.isGift, expiresAtMs, claimed: false };
        savePending(pending);
        setActiveReward(pending);
      }
    }, 4300);
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  // Attach the win to the signed-in account. Safe to call more than once: /claim-spin is
  // idempotent under a per-user advisory lock and replays the original claim rather than issuing
  // a second one, which is what lets the useActiveSpinReward resolver act as a backstop here.
  const claimForUser = async (code: string) => {
    if (claimBusy || !code) return;
    setClaimBusy(true); setClaimErr('');
    try {
      const claimed = await claimSpin(code);
      clearPending();
      setActiveReward({
        code: claimed.code, label: claimed.label, discountType: claimed.discountType, discountValue: claimed.discountValue,
        minimumOrderAmount: claimed.minimumOrderAmount, maximumDiscount: claimed.maximumDiscount, terms: claimed.terms,
        isGift: claimed.isGift, expiresAtMs: new Date(claimed.expiresAt).getTime(), claimed: true,
      });
    } catch (e) {
      setClaimErr(e instanceof Error ? e.message : 'Signed in, but the coupon could not be attached — reopen the wheel to retry.');
      void refreshReward?.();
    } finally { setClaimBusy(false); }
  };

  // Signed in from inside the wheel. Staff go to the admin instead of collecting a coupon.
  const handleAuthSuccess = (role: string) => {
    setAuthLocked(false);
    if (role === 'ADMIN') { close(); router.push('/admin'); return; }
    void claimForUser(activeReward?.code || (result?.win ? result.code : '') || '');
  };

  // A MISS used to reset here so reopening let them spin again — now both outcomes are locked
  // in server-side for the same window (see spin_draws), so closing just closes.
  // Blocked while AuthPanel is on its mandatory name/email step — closing there would leave a
  // signed-in account with no name or email on it.
  const handleClose = () => { if (!authLocked) close(); };

  if (!open) return null;

  const socialBtn = (href: string, label: string, icon: React.ReactNode) => (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
      style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-raised)', border: '1px solid var(--border-default)', display: 'grid', placeItems: 'center', color: 'var(--brand-secondary)' }}>
      {icon}
    </a>
  );

  return (
    <>
      <div onClick={handleClose}
        style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'var(--espresso-55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'loaderFadeIn .28s ease both' }}>
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'relative', width: desktop ? '460px' : 'min(380px,92vw)', maxHeight: desktop ? '90vh' : '88vh', overflowY: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: desktop ? '32px 32px 26px' : '18px 20px 14px', textAlign: 'center', animation: 'riseIn .4s var(--ease-spring) both' }}
          className="hide-sb">

          {!authLocked && (
          <button onClick={handleClose} aria-label="Close" style={{ position: 'absolute', top: desktop ? 16 : 10, right: desktop ? 16 : 10, width: desktop ? 36 : 30, height: desktop ? 36 : 30, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center', zIndex: 2 }}>
            <X size={desktop ? 18 : 15} />
          </button>
          )}

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: desktop ? '5px 13px' : '4px 11px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-50)', color: 'var(--brand-secondary)', fontSize: 'var(--text-2xs)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: desktop ? 10 : 6 }}>
            <Gift size={desktop ? 14 : 13} /> Spin &amp; win
          </div>
          <h2 style={{ font: `900 var(${desktop ? '--text-h3' : '--text-h4'})/1.05 var(--font-display)`, color: 'var(--text-strong)', margin: '0 0 5px', letterSpacing: '-.02em' }}>
            {(activeReward || result?.win) ? 'You won! 🎉' : result ? 'So close!' : cooldown?.completed ? 'Already spun' : 'Spin & win a treat!'}
          </h2>
          <p style={{ fontSize: desktop ? 'var(--text-sm)' : 'var(--text-xs)', color: 'var(--text-muted)', margin: `0 auto ${desktop ? 18 : 10}px`, maxWidth: desktop ? 320 : 290, lineHeight: 1.45 }}>
            {activeReward
              ? (activeReward.claimed ? 'Here’s your exclusive discount — apply it at checkout.' : 'Sign in to lock it in — it saves straight to your account.')
              : result
                  ? (result.win
                    ? (guestWinNeedsLogin ? 'Sign in to lock it in — it saves straight to your account.' : 'Here’s your exclusive discount — use it at checkout.')
                    : 'No prize this time — thanks for playing! It’s one spin per customer, so this wheel is done for now.')
                  : cooldown?.completed
                    ? "It's one spin per customer — you've already had yours. Keep an eye out for our next round!"
                    : 'Give the wheel a spin for an exclusive discount, straight to your cart.'}
          </p>

          {/* Wheel */}
          <div style={{ position: 'relative', width: desktop ? 'clamp(260px,26vw,320px)' : 'clamp(180px,54vw,220px)', margin: `0 auto ${desktop ? 20 : 12}px`, aspectRatio: '1' }}>
            {/* Pointer */}
            <div aria-hidden style={{ position: 'absolute', top: desktop ? -4 : -3, left: '50%', transform: 'translateX(-50%)', zIndex: 3, width: 0, height: 0, borderLeft: `${desktop ? 12 : 9}px solid transparent`, borderRight: `${desktop ? 12 : 9}px solid transparent`, borderTop: `${desktop ? 20 : 15}px solid var(--ink-900)`, filter: 'drop-shadow(0 2px 3px var(--black-28))' }} />
            {/* Disc */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%', background: WHEEL_BG,
              border: `${desktop ? 8 : 6}px solid var(--white)`, boxShadow: '0 12px 30px var(--espresso-30), inset 0 0 0 2px var(--amber-600)',
              transform: `rotate(${wheelRot}deg)`, transition: 'transform 4.2s cubic-bezier(.15,.86,.24,1)',
            }}>
              {displayPrizes.map((p, i) => (
                <div key={i} style={{ position: 'absolute', inset: 0, transform: `rotate(${i * SEG + SEG / 2}deg)` }}>
                  <span style={{ position: 'absolute', top: '9%', left: '50%', transform: 'translateX(-50%)', width: desktop ? 72 : 54, textAlign: 'center', fontSize: desktop ? 12.5 : 9.5, fontWeight: 800, lineHeight: 1.1, color: 'var(--white)', textShadow: '0 1px 2px var(--black-45)', fontFamily: 'var(--font-body)' }}>{p.label}</span>
                </div>
              ))}
            </div>
            {/* Hub — brand logo */}
            <div aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: desktop ? 66 : 46, height: desktop ? 66 : 46, borderRadius: '50%', background: 'var(--white)', boxShadow: '0 3px 10px var(--espresso-30)', display: 'grid', placeItems: 'center', zIndex: 2, padding: desktop ? 9 : 6 }}>
              <Image src="/assets/adc-logo.png" width={48} height={35} alt="" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
            </div>
          </div>

          {/* Expiry, stated once and stated always — for a reward that is claimed AND for one
              still waiting on a sign-in. It used to appear only after claiming, so a guest whose
              win holds for a full week had no way of knowing that. Sits above the action area so
              it is on screen whatever the shopper is being asked to do next. */}
          {activeReward && (
            <>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, flexWrap: 'wrap', margin: `0 auto ${desktop ? 16 : 11}px`, padding: desktop ? '9px 15px' : '7px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-50)', border: '1px solid var(--border-brand)', maxWidth: '100%' }}>
                <Clock size={desktop ? 15 : 13} color="var(--orange-600)" style={{ flex: 'none' }} />
                <span style={{ fontSize: desktop ? 'var(--text-sm)' : 'var(--text-xs)', color: 'var(--text-strong)', fontWeight: 700 }}>
                  Expires in <strong style={{ color: 'var(--orange-600)', fontWeight: 900 }}>{formatRemaining(activeReward.expiresAtMs - nowMs)}</strong>
                </span>
              </div>
              {/* Only while it is still unclaimed and nobody is signed in: the countdown alone does
                  not say what has to happen before it runs out. Once claimed, the coupon is theirs
                  and the deadline is just a deadline, so the ask would be noise. */}
              {!activeReward.claimed && !user && (
                <p style={{ fontSize: desktop ? 'var(--text-sm)' : 'var(--text-xs)', color: 'var(--text-body)', fontWeight: 700, margin: `-${desktop ? 6 : 4}px auto ${desktop ? 14 : 10}px`, maxWidth: 300, lineHeight: 1.45 }}>
                  Please sign in to claim it before it expires.
                </p>
              )}
            </>
          )}

          {/* Action area */}
          {activeReward?.claimed ? (
            <div>
              <button onClick={() => copyCode(activeReward.code)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, margin: '0 auto 6px', padding: '9px 16px', borderRadius: 'var(--radius-button)', border: '2px dashed var(--brand-secondary)', background: 'var(--amber-50)', cursor: 'pointer' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'var(--text-lg)', letterSpacing: '.08em', color: 'var(--brand-secondary)' }}>{activeReward.code}</span>
                {copied ? <Check size={16} color="var(--status-success)" /> : <Copy size={16} color="var(--text-muted)" />}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginBottom: 8 }}>
                <Mail size={13} /> Also emailed to you
              </div>
              <button onClick={() => { close(); router.push('/'); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: desktop ? '15px' : '12px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', boxShadow: 'var(--shadow-brand)' }}>
                Order now <ArrowRight size={18} />
              </button>
            </div>
          ) : needsClaim ? (
            /* Sign in right here — the same phone-then-Google order as the site's login popup, via
               the shared AuthPanel, so this is not a second sign-in design. No password field:
               a shopper mid-celebration will not go and remember one. */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {user ? (
                /* Signed in, but the win is not attached yet — the claim call failed, or they
                   signed in in another tab. One button, not a sign-in form they don't need. */
                <button onClick={() => claimForUser(pendingCode)} disabled={claimBusy}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: desktop ? '15px' : '12px', borderRadius: 'var(--radius-button)', border: 'none', background: claimBusy ? 'var(--border-default)' : 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: claimBusy ? 'wait' : 'pointer', boxShadow: claimBusy ? 'none' : 'var(--shadow-brand)' }}>
                  <Gift size={18} /> {claimBusy ? 'Claiming…' : 'Claim my coupon'}
                </button>
              ) : (
                <>
                  <AuthPanel compact resetKey={open} onSuccess={handleAuthSuccess} onLockChange={setAuthLocked} />
                  {claimBusy && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center' }}>Saving your coupon…</div>
                  )}
                </>
              )}
              {claimErr && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700, textAlign: 'left' }}>{claimErr}</div>}
            </div>
          ) : result ? (
            <button onClick={() => { close(); router.push('/'); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: desktop ? '15px' : '12px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', boxShadow: 'var(--shadow-brand)' }}>
              Order now <ArrowRight size={18} />
            </button>
          ) : cooldown?.completed ? (
            <div style={{ width: '100%', boxSizing: 'border-box', padding: desktop ? '16px' : '13px', borderRadius: 'var(--radius-button)', background: 'var(--surface-raised)', border: '1.5px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-subtle)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)' }}>
              <Clock size={18} /> One spin per customer
            </div>
          ) : (
            <button onClick={spin} disabled={spinning || !offersLoaded || checkingReward}
              style={{ width: '100%', padding: desktop ? '16px' : '13px', borderRadius: 'var(--radius-button)', border: 'none', background: (spinning || !offersLoaded || checkingReward) ? 'var(--border-default)' : 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: 'var(--text-base)', letterSpacing: '.04em', cursor: spinning ? 'wait' : (!offersLoaded || checkingReward) ? 'default' : 'pointer', boxShadow: (spinning || !offersLoaded || checkingReward) ? 'none' : 'var(--shadow-brand)' }}>
              {checkingReward || !offersLoaded ? 'Loading…' : spinning ? 'Spinning…' : 'SPIN THE WHEEL'}
            </button>
          )}
          {spinError && <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700, textAlign: 'center' }}>{spinError}</div>}

          {/* Cancel */}
          {!authLocked && (
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', marginTop: desktop ? 12 : 8, padding: 4 }}>
            No thanks, maybe later
          </button>
          )}

          {/* Just a link — the full terms are a wall of text in a modal that's already busy, so
              they open on demand as a plain list instead of being dumped inline. */}
          {wonPrize && (
            <button onClick={() => setShowTerms(true)} style={{ margin: `${desktop ? 10 : 6}px auto 0`, display: 'block', background: 'none', border: 'none', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)', textDecoration: 'underline', cursor: 'pointer', padding: 4 }}>
              Terms &amp; conditions
            </button>
          )}

          {/* Social links */}
          <div style={{ marginTop: desktop ? 16 : 10, paddingTop: desktop ? 16 : 10, borderTop: '1px solid var(--border-soft)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700, margin: '0 0 8px' }}>Follow us for fresh drops &amp; offers</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              {socialBtn(INSTAGRAM_URL, 'Instagram', <IgIcon />)}
              {socialBtn(YOUTUBE_URL, 'YouTube', <YtIcon />)}
              {socialBtn(LINKEDIN_URL, 'LinkedIn', <LiIcon />)}
              {socialBtn(whatsappLink(), 'WhatsApp', <WhatsAppIcon size={19} />)}
            </div>
          </div>
        </div>
      </div>

      {/* Terms & Conditions — only the exact coupon this shopper won. */}
      {showTerms && wonPrize && (
        <div onClick={() => setShowTerms(false)} style={{ position: 'fixed', inset: 0, zIndex: 97, background: 'var(--espresso-55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'loaderFadeIn .2s ease both' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(360px,92vw)', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: '22px 22px 18px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <h3 style={{ flex: 1, fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-strong)', textAlign: 'left' }}>Coupon Terms</h3>
              <button onClick={() => setShowTerms(false)} aria-label="Close" style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={15} /></button>
            </div>
            {/* One rule per row rather than a paragraph — the admin writes terms as a single
                sentence-run, which nobody reads. Split on sentence/bullet breaks and list them. */}
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ font: '900 var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px' }}>{wonPrize.label}</h4>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--brand-secondary)', margin: '0 0 12px' }}>{valueSummary(wonPrize)}</p>
              <div style={{ borderTop: '1px solid var(--border-default)' }}>
                {(() => {
                  const rules = [
                    wonPrize.minimumOrderAmount ? `Minimum order ₹${wonPrize.minimumOrderAmount}` : null,
                    wonPrize.discountType === 'PERCENTAGE' && wonPrize.maximumDiscount ? `Maximum discount ₹${wonPrize.maximumDiscount}` : null,
                    ...String(wonPrize.terms || '').split(/[.;•\n]+/).map(s => s.trim()).filter(Boolean),
                  ].filter(Boolean) as string[];
                  if (!rules.length) return <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', padding: '10px 0', margin: 0 }}>No additional terms.</p>;
                  return rules.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid var(--border-soft)' }}>
                      <span aria-hidden style={{ flex: 'none', width: 5, height: 5, borderRadius: '50%', background: 'var(--brand-secondary)', marginTop: 7 }} />
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.45 }}>{r}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
