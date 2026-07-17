'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, Gift, MessageCircle, Copy, Check, LogIn, ArrowRight, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import LoginModal from '@/components/ordering/LoginModal';
import { getActiveCoupons, claimSpin, type ActiveCoupon } from '@/lib/api';
import { INSTAGRAM_URL, YOUTUBE_URL, LINKEDIN_URL, whatsappLink } from '@/lib/site';
import { type ActiveReward, CLAIM_WINDOW_HOURS, savePending, formatRemaining } from '@/lib/spinReward';

// lucide in this build has no Instagram/YouTube glyphs — use inline brand SVGs (as the footer does).
const IgIcon = () => (<svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>);
const YtIcon = () => (<svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>);
const LiIcon = () => (<svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>);

interface Prize {
  label: string; code: string; win: boolean; weight: number;
  discountType?: string; discountValue?: number;
  minimumOrderAmount?: number | null; maximumDiscount?: number | null; terms?: string;
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
  }));
  const totalWinWeight = wins.reduce((s, w) => s + (w.weight || 0), 0);
  const noReward: Prize = {
    label: 'Better luck next time!', code: '', win: false,
    weight: wins.length ? Math.max(1, 100 - totalWinWeight) : 100,
    terms: 'No reward this spin — but fresh cookies are always worth ordering! Come back for another spin.',
  };
  return wins.length ? [...wins, noReward] : [noReward];
}

// Weighted random pick — visually the wedges are equal-sized, but WHICH one the pointer lands
// on is chosen here first (then the wheel just rotates to match), so a 5%-weight prize really
// does land about 1 spin in 20, not 1 in N-wedges.
function weightedPick(prizes: Prize[]): number {
  const total = prizes.reduce((s, p) => s + (p.weight || 0), 0) || 1;
  let r = Math.random() * total;
  for (let i = 0; i < prizes.length; i++) {
    r -= prizes[i].weight || 0;
    if (r <= 0) return i;
  }
  return prizes.length - 1;
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
}

export default function SpinWheel({ open, onClose, activeReward, setActiveReward, checkingReward, now }: SpinWheelProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Prize | null>(null);
  const [copied, setCopied] = useState(false);
  const [prizes, setPrizes] = useState<Prize[] | null>(null); // null until the admin's active coupons load
  const [showTerms, setShowTerms] = useState(false);
  const [termsIndex, setTermsIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRewardRef = useRef<ActiveReward | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // The reward prop is cleared (claimed elsewhere, or its window ran out) the moment it disappears
  // from a real reward — drop any stale in-session result so the idle "spin" state reappears.
  useEffect(() => {
    if (prevRewardRef.current && !activeReward) setResult(null);
    prevRewardRef.current = activeReward;
  }, [activeReward]);

  // Load the wheel's offers once the modal opens.
  useEffect(() => {
    if (!open || prizes !== null) return;
    let cancelled = false;
    getActiveCoupons()
      .then(cs => { if (!cancelled) setPrizes(buildPrizes(cs)); })
      .catch(() => { if (!cancelled) setPrizes(buildPrizes([])); });
    return () => { cancelled = true; };
  }, [open, prizes]);

  const displayPrizes = prizes ?? DECOR_PRIZES;
  const N = displayPrizes.length;
  const SEG = 360 / N;
  const WHEEL_BG = wheelBg(displayPrizes);
  const offersLoaded = prizes !== null;

  const close = onClose;

  const spin = () => {
    if (spinning || result || activeReward || !prizes) return;
    setSpinning(true);
    const idx = weightedPick(prizes);
    // Bring segment idx's centre under the top pointer, after 5 full turns.
    const target = 360 * 5 - (idx * SEG + SEG / 2);
    setRot(target);
    timer.current = setTimeout(async () => {
      const p = prizes[idx];
      setResult(p);
      setSpinning(false);
      if (!p.win) return;
      const expiresAtMs = Date.now() + CLAIM_WINDOW_HOURS * 3600_000;
      if (user) {
        try {
          const claimed = await claimSpin(p.code);
          setActiveReward({ code: claimed.code, label: claimed.label, discountType: claimed.discountType, discountValue: claimed.discountValue, minimumOrderAmount: claimed.minimumOrderAmount, maximumDiscount: claimed.maximumDiscount, terms: claimed.terms, expiresAtMs: new Date(claimed.expiresAt).getTime(), claimed: true });
        } catch { /* leave the result showing even if the claim call failed — they can retry via login prompt */ }
      } else {
        const pending: ActiveReward = { code: p.code, label: p.label, discountType: p.discountType, discountValue: p.discountValue, minimumOrderAmount: p.minimumOrderAmount, maximumDiscount: p.maximumDiscount, terms: p.terms, expiresAtMs, claimed: false };
        savePending(pending);
        setActiveReward(pending);
      }
    }, 4300);
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  // Closing after a MISS resets the in-session result so reopening lets them spin again
  // (a WIN keeps its state via activeReward, so it can't be re-rolled).
  const handleClose = () => {
    if (result && !result.win) setResult(null);
    close();
  };

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
          style={{ position: 'relative', width: 'min(400px,94vw)', maxHeight: '92vh', overflowY: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: '26px 24px 20px', textAlign: 'center', animation: 'riseIn .4s var(--ease-spring) both' }}
          className="hide-sb">

          <button onClick={handleClose} aria-label="Close" style={{ position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center', zIndex: 2 }}>
            <X size={17} />
          </button>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-50)', color: 'var(--brand-secondary)', fontSize: 'var(--text-2xs)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            <Gift size={14} /> Spin &amp; win
          </div>
          <h2 style={{ font: '900 var(--text-h3)/1.05 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 5px', letterSpacing: '-.02em' }}>
            {activeReward ? (activeReward.claimed ? 'You won! 🎉' : 'You won! Sign in to claim 🎉') : result ? (result.win ? 'You won! 🎉' : 'So close!') : 'Spin & win a treat!'}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 auto 16px', maxWidth: 300, lineHeight: 1.5 }}>
            {activeReward
              ? (activeReward.claimed ? 'Here’s your exclusive discount — use it at checkout.' : `Log in within ${formatRemaining(activeReward.expiresAtMs - now)} to claim this reward before it expires.`)
              : result
                ? (result.win ? 'Here’s your exclusive discount — use it at checkout.' : 'No prize this time, but treats are always fresh. Order away!')
                : 'Give the wheel a spin for an exclusive discount, straight to your cart.'}
          </p>

          {/* Wheel */}
          <div style={{ position: 'relative', width: 'clamp(230px,72vw,286px)', margin: '0 auto 18px', aspectRatio: '1' }}>
            {/* Pointer */}
            <div aria-hidden style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', zIndex: 3, width: 0, height: 0, borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderTop: '18px solid var(--ink-900)', filter: 'drop-shadow(0 2px 3px var(--black-28))' }} />
            {/* Disc */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%', background: WHEEL_BG,
              border: '7px solid var(--white)', boxShadow: '0 12px 30px var(--espresso-30), inset 0 0 0 2px var(--amber-600)',
              transform: `rotate(${rot}deg)`, transition: 'transform 4.2s cubic-bezier(.15,.86,.24,1)',
            }}>
              {displayPrizes.map((p, i) => (
                <div key={i} style={{ position: 'absolute', inset: 0, transform: `rotate(${i * SEG + SEG / 2}deg)` }}>
                  <span style={{ position: 'absolute', top: '9%', left: '50%', transform: 'translateX(-50%)', width: 66, textAlign: 'center', fontSize: 11, fontWeight: 800, lineHeight: 1.1, color: 'var(--white)', textShadow: '0 1px 2px var(--black-45)', fontFamily: 'var(--font-body)' }}>{p.label}</span>
                </div>
              ))}
            </div>
            {/* Hub — brand logo */}
            <div aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 60, height: 60, borderRadius: '50%', background: 'var(--white)', boxShadow: '0 3px 10px var(--espresso-30)', display: 'grid', placeItems: 'center', zIndex: 2, padding: 8 }}>
              <Image src="/assets/adc-logo.png" width={48} height={35} alt="" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
            </div>
          </div>

          {/* Action area */}
          {activeReward ? (
            <div>
              <button onClick={() => copyCode(activeReward.code)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, margin: '0 auto 8px', padding: '11px 18px', borderRadius: 'var(--radius-button)', border: '2px dashed var(--brand-secondary)', background: 'var(--amber-50)', cursor: 'pointer' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'var(--text-lg)', letterSpacing: '.08em', color: 'var(--brand-secondary)' }}>{activeReward.code}</span>
                {copied ? <Check size={16} color="var(--status-success)" /> : <Copy size={16} color="var(--text-muted)" />}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginBottom: 12 }}>
                <Clock size={13} /> {activeReward.claimed ? `Valid for ${formatRemaining(activeReward.expiresAtMs - now)}` : `Expires in ${formatRemaining(activeReward.expiresAtMs - now)}`}
              </div>
              {activeReward.claimed ? (
                <button onClick={() => { close(); router.push('/'); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', boxShadow: 'var(--shadow-brand)' }}>
                  Order now <ArrowRight size={18} />
                </button>
              ) : (
                <button onClick={() => setLoginOpen(true)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', boxShadow: 'var(--shadow-brand)' }}>
                  <LogIn size={18} /> Log in to claim
                </button>
              )}
            </div>
          ) : result ? (
            <button onClick={() => { close(); router.push('/'); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', boxShadow: 'var(--shadow-brand)' }}>
              Order now <ArrowRight size={18} />
            </button>
          ) : (
            <button onClick={spin} disabled={spinning || !offersLoaded || checkingReward}
              style={{ width: '100%', padding: '15px', borderRadius: 'var(--radius-button)', border: 'none', background: (spinning || !offersLoaded || checkingReward) ? 'var(--border-default)' : 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: 'var(--text-base)', letterSpacing: '.04em', cursor: spinning ? 'wait' : (!offersLoaded || checkingReward) ? 'default' : 'pointer', boxShadow: (spinning || !offersLoaded || checkingReward) ? 'none' : 'var(--shadow-brand)' }}>
              {checkingReward || !offersLoaded ? 'Loading…' : spinning ? 'Spinning…' : 'SPIN THE WHEEL'}
            </button>
          )}

          {/* Cancel */}
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', marginTop: 12, padding: 6 }}>
            No thanks, maybe later
          </button>

          {/* Terms & conditions */}
          {offersLoaded && (
            <button onClick={() => { setTermsIndex(0); setShowTerms(true); }} style={{ display: 'block', margin: '4px auto 0', background: 'none', border: 'none', color: 'var(--text-subtle)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-2xs)', textDecoration: 'underline', cursor: 'pointer', padding: 4 }}>
              Terms &amp; conditions apply
            </button>
          )}

          {/* Social links */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700, margin: '0 0 10px' }}>Follow us for fresh drops &amp; offers</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              {socialBtn(INSTAGRAM_URL, 'Instagram', <IgIcon />)}
              {socialBtn(YOUTUBE_URL, 'YouTube', <YtIcon />)}
              {socialBtn(LINKEDIN_URL, 'LinkedIn', <LiIcon />)}
              {socialBtn(whatsappLink(), 'WhatsApp', <MessageCircle size={18} />)}
            </div>
          </div>
        </div>
      </div>

      {/* Terms & Conditions — a small pager explaining every wheel offer, one at a time */}
      {showTerms && prizes && (
        <div onClick={() => setShowTerms(false)} style={{ position: 'fixed', inset: 0, zIndex: 97, background: 'var(--espresso-55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'loaderFadeIn .2s ease both' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(360px,92vw)', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: '22px 22px 18px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <h3 style={{ flex: 1, fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-strong)', textAlign: 'left' }}>Spin & Win — Terms</h3>
              <button onClick={() => setShowTerms(false)} aria-label="Close" style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={15} /></button>
            </div>
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', fontWeight: 700, margin: '0 0 12px' }}>Offer {termsIndex + 1} of {prizes.length}</p>
            <div style={{ minHeight: 130 }}>
              <h4 style={{ font: '900 var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>{prizes[termsIndex].label}</h4>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--brand-secondary)', margin: '0 0 10px' }}>{valueSummary(prizes[termsIndex])}</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>{prizes[termsIndex].terms || 'No additional terms.'}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <button onClick={() => setTermsIndex(i => Math.max(0, i - 1))} disabled={termsIndex === 0} aria-label="Previous offer" style={{ width: 38, height: 38, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: termsIndex === 0 ? 'default' : 'pointer', opacity: termsIndex === 0 ? 0.4 : 1, display: 'grid', placeItems: 'center' }}><ChevronLeft size={18} /></button>
              <div style={{ display: 'flex', gap: 5 }}>
                {prizes.map((_, i) => <span key={i} aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: i === termsIndex ? 'var(--brand-secondary)' : 'var(--border-default)' }} />)}
              </div>
              <button onClick={() => setTermsIndex(i => Math.min(prizes.length - 1, i + 1))} disabled={termsIndex === prizes.length - 1} aria-label="Next offer" style={{ width: 38, height: 38, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: termsIndex === prizes.length - 1 ? 'default' : 'pointer', opacity: termsIndex === prizes.length - 1 ? 0.4 : 1, display: 'grid', placeItems: 'center' }}><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>
      )}

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
