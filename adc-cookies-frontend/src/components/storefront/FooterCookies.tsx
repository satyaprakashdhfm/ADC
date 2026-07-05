'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProducts, type Product } from '@/lib/api';

const linkStyle: React.CSSProperties = { color: 'rgba(255,248,241,.5)', textDecoration: 'none', fontSize: 'var(--text-sm)' };

/** Footer "Our Cookies" column — lists real cookie products, each linking straight to that
 *  cookie on the order page. Replaces the standalone homepage cookies section. */
export default function FooterCookies() {
  const [cookies, setCookies] = useState<Product[]>([]);

  useEffect(() => {
    getProducts()
      .then(ps => setCookies((ps || []).filter(p => p.category === 'COOKIES' && p.isAvailable)))
      .catch(() => {});
  }, []);

  return (
    <div>
      <div style={{ fontWeight: 700, color: '#fff', marginBottom: 10, fontSize: 'var(--text-xs)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Our Cookies</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cookies.map(c => (
          <Link key={c.id} href={`/order?q=${encodeURIComponent(c.name)}`} style={linkStyle}>{c.name}</Link>
        ))}
        <Link href="/order?cat=cookies" style={linkStyle}>All cookies</Link>
      </div>
    </div>
  );
}
