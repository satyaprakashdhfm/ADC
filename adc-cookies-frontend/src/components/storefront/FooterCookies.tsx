'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProducts, type Product } from '@/lib/api';
import { footerHeadingStyle, footerLinkStyle as linkStyle } from './footerStyles';

/** Footer "Our Cookies" column — lists real cookie products, each linking straight to that
 *  cookie on the order page. Replaces the standalone homepage cookies section. */
export default function FooterCookies() {
  const [cookies, setCookies] = useState<Product[]>([]);

  useEffect(() => {
    getProducts()
      .then(ps => setCookies((ps || []).filter(p => p.category === 'COOKIES' && p.isAvailable && !/sundae/i.test(p.name))))
      .catch(() => {});
  }, []);

  return (
    <div>
      <div style={footerHeadingStyle}>Our Cookies</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cookies.slice(0, 6).map(c => (
          <Link key={c.id} href={`/order?q=${encodeURIComponent(c.name)}`} className="footer-link" style={linkStyle}>{c.name}</Link>
        ))}
        <Link href="/order?cat=cookies" className="footer-link" style={linkStyle}>All cookies</Link>
      </div>
    </div>
  );
}
