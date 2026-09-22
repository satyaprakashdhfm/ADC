import type { Metadata } from 'next';
import SeoPage from '@/components/seo/SeoPage';
import { cookieTinsBangalore } from '@/lib/seo/pages/cookieTinsBangalore';
import { getMenu } from '@/lib/seo/menu';
import { seoMetadata } from '@/lib/seo/meta';

// Content lives in lib/seo/pages/cookieTinsBangalore.ts; the layout is shared by every search page.
export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata(cookieTinsBangalore, await getMenu());
}

export default async function CookieTinsBangalorePage() {
  return <SeoPage page={cookieTinsBangalore} menu={await getMenu()} />;
}
