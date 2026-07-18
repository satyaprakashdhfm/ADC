import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.adoughcookie.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Account/checkout/admin pages are user-specific or private — nothing for a crawler to index.
      disallow: ['/account', '/admin', '/checkout', '/order', '/payment', '/reset-password'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
