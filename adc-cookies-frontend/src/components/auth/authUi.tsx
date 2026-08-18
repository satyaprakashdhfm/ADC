'use client';

/*
 * Shared chrome for the sign-in surfaces.
 *
 * These used to live inside LoginModal, which was fine while it was the only place anyone signed
 * in. The Spin & Win wheel now signs people in inside its own popup, and the two have to look
 * identical — a second, separately-styled phone field would read as a different site. Everything
 * here is presentational; the flow itself lives in AuthPanel.
 */

export function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0' }}>
      <span style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
    </div>
  );
}

export function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path style={{ fill: 'var(--google-blue)' }} d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path style={{ fill: 'var(--google-green)' }} d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path style={{ fill: 'var(--google-yellow)' }} d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" />
      <path style={{ fill: 'var(--google-red)' }} d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export const authInput = (desktop: boolean): React.CSSProperties => ({
  width: '100%', boxSizing: 'border-box', padding: desktop ? '14px 16px' : '11px 14px',
  borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)',
  fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)',
  background: 'var(--surface-raised)', outline: 'none', marginBottom: desktop ? 12 : 8,
});

export const authLabel: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700,
  color: 'var(--text-muted)', letterSpacing: '.02em', margin: '0 0 5px 2px',
};

export const authPrimaryBtn = (desktop: boolean, enabled: boolean): React.CSSProperties => ({
  width: '100%', padding: desktop ? '15px' : '12px', borderRadius: 'var(--radius-button)', border: 'none',
  background: enabled ? 'var(--gradient-warm)' : 'var(--border-default)',
  color: enabled ? 'var(--white)' : 'var(--text-subtle)',
  fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)',
  cursor: enabled ? 'pointer' : 'not-allowed',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
});

export const authLinkBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, color: 'var(--orange-brown)',
  fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)',
};

export const authErrorBox: React.CSSProperties = {
  marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
  background: 'var(--status-error-bg)', color: 'var(--status-error)',
  fontSize: 'var(--text-sm)', textAlign: 'center',
};
