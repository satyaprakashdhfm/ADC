import Link from 'next/link';
import type { ReactNode } from 'react';

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const linkStyle: React.CSSProperties = { color: 'var(--text-link)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 };

/**
 * Page copy with its [label](href) links made real. An internal path becomes a Next <Link>; an
 * outside address opens in a new tab with noopener, and keeps normal (followed) link equity, since
 * every outbound link on these pages is one we chose because it helps the reader.
 */
export default function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const [whole, label, href] = m;
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      href!.startsWith('/')
        ? <Link key={m.index} href={href!} style={linkStyle}>{label}</Link>
        : <a key={m.index} href={href} target="_blank" rel="noopener" style={linkStyle}>{label}</a>,
    );
    last = m.index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
