import type { MetadataRoute } from 'next';
import { PRODUCT_DOCS } from '@/lib/products';

const SITE_URL = 'https://www.adoughcookie.com';

// Only the real, public marketing + product pages — account/checkout/admin/order/payment are
// private or user-specific, so they're excluded here (and disallowed in robots.ts) rather than
// indexed.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '', changeFrequency: 'daily', priority: 1 },
    { path: '/about', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/locations', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/franchise', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/gallery', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/blogs', changeFrequency: 'weekly', priority: 0.5 },
    ...PRODUCT_DOCS.map(p => ({ path: `/products/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.7 })),
  ];
  return pages.map(p => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
