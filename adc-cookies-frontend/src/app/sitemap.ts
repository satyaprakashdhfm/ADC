import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.adoughcookie.com';

// The pages we actually want ranking, and nothing else. Account/checkout/admin/order/payment are
// private or user-specific, so they're excluded here (and disallowed in robots.ts) rather than
// indexed.
//
// A sitemap is a statement of priority, not an inventory — every low-value URL in it competes for
// the same crawl budget as the ones that matter. /gallery and /blogs are still live, still linked,
// and still perfectly indexable; they are simply not what we are asking Google to spend its
// attention on. The per-product pages are gone entirely (see the redirect in next.config.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '', changeFrequency: 'daily', priority: 1 },
    // The city landing page ranks second only to the homepage on purpose: it is the page aimed at
    // the highest-intent search we compete for, so it should be the one crawled most often after it.
    { path: '/best-cookies-in-bangalore', changeFrequency: 'weekly', priority: 0.9 },
    { path: '/about', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/locations', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/franchise', changeFrequency: 'monthly', priority: 0.6 },
  ];
  return pages.map(p => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
