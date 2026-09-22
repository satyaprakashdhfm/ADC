import type { Metadata } from 'next';
import type { SeoPageContent } from './types';
import { fillPrices, tinsOf, type MenuItem } from './menu';
import { STORES } from '@/lib/stores';

export const SITE_URL = 'https://www.adoughcookie.com';

/** Copy with its [label](href) links reduced to the label, for places that take plain text. */
export const plainText = (text: string) => text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1');

/**
 * Title, description, canonical, robots and social cards for a search page.
 *
 * The canonical is the page's own URL, always, so a shared link with tracking parameters (?utm_…,
 * ?fbclid=…) is still counted as this page rather than as a copy of it.
 */
export function seoMetadata(page: SeoPageContent, menu: MenuItem[]): Metadata {
  const description = fillPrices(page.description, menu);
  const url = `${SITE_URL}${page.path}`;
  return {
    title: page.title,
    description,
    alternates: { canonical: page.path },
    robots: { index: true, follow: true },
    openGraph: {
      title: page.title,
      description,
      url,
      siteName: 'a dough cookie',
      locale: 'en_IN',
      type: page.kind === 'article' ? 'article' : 'website',
      images: [{ url: page.ogImage, width: 1200, height: 630, alt: page.hero.alt }],
      ...(page.kind === 'article' ? { publishedTime: page.published, modifiedTime: page.updated } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description,
      images: [page.ogImage],
    },
  };
}

const absolute = (src: string) => (src.startsWith('http') ? src : `${SITE_URL}${src}`);

/**
 * The page's structured data as one @graph: the page (a BlogPosting for articles), its breadcrumb
 * trail, its FAQ, and, where they apply, the gift tins as products with live prices and our shops in
 * the page's city. The shops point back to the brand-level Bakery the root layout publishes, rather
 * than declaring a second business.
 */
export function seoJsonLd(page: SeoPageContent, menu: MenuItem[]) {
  const url = `${SITE_URL}${page.path}`;
  const fill = (t: string) => plainText(fillPrices(t, menu));
  const brand = { '@type': 'Organization', name: 'a dough cookie', url: SITE_URL, logo: `${SITE_URL}/assets/adc-logo.png` };

  const crumbs = page.kind === 'article'
    ? [['Home', SITE_URL], ['Blog', `${SITE_URL}/blogs`], [page.name, url]]
    : [['Home', SITE_URL], [page.name, url]];

  const graph: Record<string, unknown>[] = [
    page.kind === 'article'
      ? {
          '@type': 'BlogPosting',
          '@id': `${url}#article`,
          headline: page.h1,
          description: fill(page.description),
          image: absolute(page.hero.src),
          datePublished: page.published,
          dateModified: page.updated,
          inLanguage: 'en-IN',
          author: brand,
          publisher: brand,
          mainEntityOfPage: url,
        }
      : {
          '@type': 'WebPage',
          '@id': `${url}#page`,
          url,
          name: page.title,
          description: fill(page.description),
          inLanguage: 'en-IN',
          isPartOf: { '@type': 'WebSite', url: SITE_URL, name: 'a dough cookie' },
          primaryImageOfPage: { '@type': 'ImageObject', url: absolute(page.hero.src) },
        },
    {
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
    },
  ];

  if (page.faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: page.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: fill(f.a) } })),
    });
  }

  if (page.listsTins) {
    graph.push({
      '@type': 'ItemList',
      name: 'Cookie tins',
      itemListElement: tinsOf(menu).map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: t.name,
          description: t.description,
          image: absolute(t.image),
          brand: { '@type': 'Brand', name: 'a dough cookie' },
          offers: {
            '@type': 'Offer',
            price: t.price,
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
            url: `${SITE_URL}/?q=${encodeURIComponent(t.name)}`,
          },
        },
      })),
    });
  }

  if (page.city) {
    const region = page.city === 'Chennai' ? 'Tamil Nadu' : 'Karnataka';
    for (const s of STORES.filter(st => st.city === page.city)) {
      graph.push({
        '@type': 'Bakery',
        '@id': `${url}#store-${s.pincode}`,
        name: s.name,
        image: s.image ? absolute(s.image) : absolute(page.hero.src),
        telephone: s.phone,
        email: s.email,
        url: `${SITE_URL}/locations`,
        priceRange: '₹₹',
        servesCuisine: 'Bakery, Desserts, Coffee',
        branchOf: { '@type': 'Bakery', name: 'a dough cookie', url: SITE_URL },
        address: { '@type': 'PostalAddress', streetAddress: s.address, addressLocality: s.city, addressRegion: region, postalCode: String(s.pincode), addressCountry: 'IN' },
        geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng },
        hasMap: s.map,
      });
    }
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
