/*
 * The shape of a search page's content. Each page in lib/seo/pages is one of these, and
 * components/seo/SeoPage draws all of them, so the SEO parts (title, canonical, schema, Open Graph,
 * breadcrumbs, FAQ markup) are written once and every page gets them the same way.
 *
 * Copy can carry two small conventions:
 *   [label](/path)   a link; a path starting with / is internal, anything else opens in a new tab
 *   {price:12}       a live menu price (see fillPrices in ./menu), so no page quotes a stale number
 */

export interface SeoImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'list'; items: string[] }
  /** The gift tins from the live menu, as cards. `ids` limits and orders them. */
  | { kind: 'tins'; ids?: number[] }
  /** Our shops in one city, with address, phone and directions. */
  | { kind: 'stores'; city: 'Bengaluru' | 'Chennai' }
  | { kind: 'note'; title: string; text: string }
  | { kind: 'image'; image: SeoImage; caption?: string }
  | { kind: 'buttons'; primary: { label: string; href: string }; secondary?: { label: string; href: string } };

export interface Section {
  h2: string;
  blocks: Block[];
}

export interface SeoPageContent {
  /** The URL path, which is also the canonical. */
  path: string;
  /** A landing page answers a buying search; an article is a guide that sits under /blogs. */
  kind: 'landing' | 'article';
  /** <title>, kept to about 60 characters so Google does not cut it. */
  title: string;
  /** Meta description, about 150 characters. */
  description: string;
  h1: string;
  /** Short name used in the breadcrumb, the blog card and related links. */
  name: string;
  /** One or two lines for the card on the blog page. */
  excerpt: string;
  hero: SeoImage;
  /** 1200x630 image for WhatsApp, Facebook and X previews. */
  ogImage: string;
  published: string;
  updated: string;
  /** Opening paragraphs. The first one carries the primary keyword. */
  intro: string[];
  /** A short, direct answer near the top, the kind a search result can quote. */
  answer?: { title: string; text: string };
  sections: Section[];
  faqs: { q: string; a: string }[];
  /** Paths of other search pages to link at the foot of this one. */
  related: string[];
  /** Adds our shops in this city to the structured data. */
  city?: 'Bengaluru' | 'Chennai';
  /** Adds the gift tins to the structured data as products with prices. */
  listsTins?: boolean;
  cta: { title: string; body: string; label: string; href: string };
}
