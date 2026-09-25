import type { ReactNode } from 'react';

/* Small helpers for the WhatsApp-style inbox. */

const AVATAR_COLOURS = ['#00a884', '#1a6fb3', '#b35c00', '#8e44ad', '#c0392b', '#16a085', '#d35400', '#2c3e50'];

export function avatarColour(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

export function initials(name: string) {
  const parts = name.replace(/^\+/, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (/^\d/.test(parts[0])) return '#';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

/* Today: 14:05. This week: Tuesday. Older: 21/09/2026. As the WhatsApp chat list shows it. */
export function listTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 1.5 && new Date(now.getTime() - 86_400_000).toDateString() === d.toDateString()) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' });
  return d.toLocaleDateString('en-IN');
}

export const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (new Date(now.getTime() - 86_400_000).toDateString() === d.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* WhatsApp's own markup, *bold* and _italic_, drawn as it would be on the phone. Plain text in,
   React nodes out: nothing from a customer is ever treated as HTML. */
export function waFormat(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*[^*\n]+\*|_[^_\n]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const inner = m[0].slice(1, -1);
    out.push(m[0][0] === '*' ? <strong key={k++}>{inner}</strong> : <em key={k++}>{inner}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
