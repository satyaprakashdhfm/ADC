import type { Metadata } from 'next';
import SeoPage from '@/components/seo/SeoPage';
import { bestCookiesChennai } from '@/lib/seo/pages/bestCookiesChennai';
import { getMenu } from '@/lib/seo/menu';
import { seoMetadata } from '@/lib/seo/meta';

// Content lives in lib/seo/pages/bestCookiesChennai.ts; the layout is shared by every search page.
export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata(bestCookiesChennai, await getMenu());
}

export default async function BestCookiesChennaiPage() {
  return <SeoPage page={bestCookiesChennai} menu={await getMenu()} />;
}
