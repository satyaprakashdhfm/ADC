'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, Gift, MessageCircle, Copy, Check, LogIn, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import LoginModal from '@/components/ordering/LoginModal';
import { INSTAGRAM_URL, FACEBOOK_URL, whatsappLink } from '@/lib/site';

// lucide in this build has no Instagram/Facebook glyphs — use inline brand SVGs (as the footer does).
const IgIcon = () => (<svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>);
const FbIcon = () => (<svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>);

interface Prize { label: string; code: string; win: boolean }

// Wheel prizes — mostly wins, one "next time" so it's not obviously rigged.
const PRIZES: Prize[] = [
  { label: '10% OFF', code: 'SPIN10', win: true },
  { label: 'Free cookie', code: 'FREEBITE', win: true },
  { label: '15% OFF', code: 'SPIN15', win: true },
  { label: '5% OFF', code: 'SPIN5', win: true },
  { label: '20% OFF', code: 'SPIN20', win: true },
  { label: 'Next time!', code: '', win: false },
  { label: '10% OFF', code: 'SPIN10', win: true },
  { label: '5% OFF', code: 'SPIN5', win: true },
];
const N = PRIZES.length;
const SEG = 360 / N;

// Alternating brand wedges — amber / orange, straight from the theme.
const WHEEL_BG = `conic-gradient(${PRIZES.map((_, i) => {
  const c = i % 2 === 0 ? 'var(--amber-400)' : 'var(--orange-500)';
  return `${c} ${i * SEG}deg ${(i + 1) * SEG}deg`;
}).join(',')})`;

export default function SpinWheel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Prize | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const close = onClose;

  const spin = () => {
    if (spinning || result) return;
    setSpinning(true);
    const idx = Math.floor(Math.random() * N);
    // Bring segment idx's centre under the top pointer, after 5 full turns.
    const target = 360 * 5 - (idx * SEG + SEG / 2);
    setRot(target);
    timer.current = setTimeout(() => { setResult(PRIZES[idx]); setSpinning(false); }, 4300);
  };

  const copyCode = async () => {
    if (!result?.code) return;
    try { await navigator.clipboard.writeText(result.code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
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
      <div onClick={close}
        style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'var(--espresso-55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'loaderFadeIn .28s ease both' }}>
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'relative', width: 'min(400px,94vw)', maxHeight: '92vh', overflowY: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: '26px 24px 20px', textAlign: 'center', animation: 'riseIn .4s var(--ease-spring) both' }}
          className="hide-sb">

          <button onClick={close} aria-label="Close" style={{ position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center', zIndex: 2 }}>
            <X size={17} />
          </button>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-50)', color: 'var(--brand-secondary)', fontSize: 'var(--text-2xs)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            <Gift size={14} /> Spin &amp; win
          </div>
          <h2 style={{ font: '900 var(--text-h3)/1.05 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 5px', letterSpacing: '-.02em' }}>
            {result ? (result.win ? 'You won! 🎉' : 'So close!') : 'Spin & win a treat!'}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 auto 16px', maxWidth: 300, lineHeight: 1.5 }}>
            {result
              ? (result.win ? 'Here’s your exclusive discount — use it at checkout.' : 'No prize this time, but treats are always fresh. Order away!')
              : 'Give the wheel a spin for an exclusive discount on your first order.'}
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
              {PRIZES.map((p, i) => (
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

          {/* Action area — depends on auth + spin state */}
          {result ? (
            <div>
              {result.win && result.code && (
                <button onClick={copyCode}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 10, margin: '0 auto 12px', padding: '11px 18px', borderRadius: 'var(--radius-button)', border: '2px dashed var(--brand-secondary)', background: 'var(--amber-50)', cursor: 'pointer' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'var(--text-lg)', letterSpacing: '.08em', color: 'var(--brand-secondary)' }}>{result.code}</span>
                  {copied ? <Check size={16} color="var(--status-success)" /> : <Copy size={16} color="var(--text-muted)" />}
                </button>
              )}
              <button onClick={() => { close(); router.push('/order?cat=cookies'); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', boxShadow: 'var(--shadow-brand)' }}>
                Order now <ArrowRight size={18} />
              </button>
            </div>
          ) : user ? (
            <button onClick={spin} disabled={spinning}
              style={{ width: '100%', padding: '15px', borderRadius: 'var(--radius-button)', border: 'none', background: spinning ? 'var(--border-default)' : 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: 'var(--text-base)', letterSpacing: '.04em', cursor: spinning ? 'wait' : 'pointer', boxShadow: spinning ? 'none' : 'var(--shadow-brand)' }}>
              {spinning ? 'Spinning…' : 'SPIN THE WHEEL'}
            </button>
          ) : (
            <>
              <button onClick={() => setLoginOpen(true)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '15px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', boxShadow: 'var(--shadow-brand)' }}>
                <LogIn size={18} /> Log in to spin
              </button>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', margin: '9px 0 0' }}>Quick sign-in with Google or phone — then spin to win.</p>
            </>
          )}

          {/* Cancel */}
          <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', marginTop: 12, padding: 6 }}>
            No thanks, maybe later
          </button>

          {/* Social links */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700, margin: '0 0 10px' }}>Follow us for fresh drops &amp; offers</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              {socialBtn(INSTAGRAM_URL, 'Instagram', <IgIcon />)}
              {socialBtn(FACEBOOK_URL, 'Facebook', <FbIcon />)}
              {socialBtn(whatsappLink(), 'WhatsApp', <MessageCircle size={18} />)}
            </div>
          </div>
        </div>
      </div>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
