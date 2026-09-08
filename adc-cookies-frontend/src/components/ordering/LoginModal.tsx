'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useIsDesktop } from '@/lib/useIsDesktop';
import AuthPanel from '@/components/auth/AuthPanel';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/*
 * The sign-in modal: phone OTP + Google, via AuthPanel (shared with the Spin & Win wheel).
 *
 * The email + password path that used to sit under the divider here is gone. Not disabled —
 * deleted, along with the /reset-password page and the reset mail it depended on. Every one of the
 * 67 accounts Supabase filed under its "email" provider turned out to be a synthetic
 * phone_<number>@phone.adccookies.app address we mint ourselves for the OTP bridge; not one real
 * person had ever set a password. Keeping it meant owning registration, password hashing,
 * reset-token issuance and expiry — the part of an auth system where mistakes cost accounts — to
 * serve nobody.
 *
 * What remains of this component is the modal chrome. AuthPanel owns the sign-in itself, which is
 * why the wheel can offer the same flow without stacking a second modal on top of its own.
 */
export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  // Raised by AuthPanel while its mandatory name/email step is showing — see `dismissible`.
  const [locked, setLocked] = useState(false);
  const { setAuthModalOpen } = useAuth();
  // Compact sizing is for mobile only — desktop gets the roomier layout back.
  const desktop = useIsDesktop();

  useEffect(() => {
    if (open) setLocked(false);
  }, [open]);

  // Tells ProfileGate (a separate, globally-mounted component) to stay quiet while this modal is
  // open — otherwise it can pop up at the same time as AuthPanel's own mandatory name+email step
  // (both react to the same user/profileLoaded change right after OTP verification), looking like
  // two stacked popups fighting over the same job.
  useEffect(() => {
    if (open) { setAuthModalOpen(true); return () => setAuthModalOpen(false); }
  }, [open, setAuthModalOpen]);

  /* No admin redirect. This modal signs customers in, full stop — the dashboard is reached only
     through its own phone-OTP sign-in at /admin. */
  const finishLogin = () => {
    onSuccess?.();
    onClose();
  };

  if (!open) return null;

  // Mandatory, no-skip: once AuthPanel is asking for the missing name/email, the modal can't be
  // dismissed via backdrop or the X — closing it any other way would let them in without either.
  const dismissible = !locked;
  const dismiss = () => { if (dismissible) onClose(); };

  return (
    <div onClick={dismiss} style={{
      position: 'fixed', inset: 0, zIndex: 120, background: 'var(--espresso-50)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        zIndex: 121, width: desktop ? '460px' : 'min(420px,92vw)', maxHeight: desktop ? '92vh' : '88vh', background: 'var(--surface-page)',
        borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        animation: 'riseIn .3s var(--ease-spring) both',
      }}>
        {/* Header — cookie photo kept faint in the background, big logo on top */}
        <div style={{ height: desktop ? 190 : 120, position: 'relative', overflow: 'hidden', background: 'var(--ink-950)', flex: 'none' }}>
          <Image src="/assets/login-bg.jpg" alt="" fill priority sizes="460px" style={{ objectFit: 'cover', opacity: 0.4 }} />
          {dismissible && (
          <button onClick={dismiss} style={{ position: 'absolute', top: desktop ? 14 : 10, right: desktop ? 14 : 10, zIndex: 2, width: desktop ? 38 : 32, height: desktop ? 38 : 32, borderRadius: '50%', border: 'none', background: 'var(--white-90)', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
            <X size={desktop ? 18 : 16} color="var(--text-strong)" />
          </button>
          )}
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <Image src="/assets/adc-logo.png" width={232} height={168} alt="a dough cookie" priority style={{ height: desktop ? 150 : 90, width: 'auto', maxWidth: '82%', objectFit: 'contain', filter: 'drop-shadow(0 4px 16px var(--black-55))' }} />
          </div>
        </div>

        <div className="hide-sb" style={{ padding: desktop ? '26px 28px 30px' : '16px 20px 18px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* While the panel is locked it owns the whole body — its own heading, and nothing else
              competing for the tap. */}
          {!locked && (
            <>
              <h2 style={{ font: `var(--weight-bold) var(${desktop ? '--text-h3' : '--text-h4'})/1.1 var(--font-display)`, color: 'var(--text-strong)', margin: '0 0 4px' }}>Log in or sign up</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: `0 0 ${desktop ? 20 : 12}px` }}>Order and track your fresh cookies.</p>
            </>
          )}

          <AuthPanel onSuccess={finishLogin} onLockChange={setLocked} resetKey={open} autoFocusPhone />
        </div>
      </div>
    </div>
  );
}
