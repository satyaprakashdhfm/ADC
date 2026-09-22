import type { Metadata } from 'next';
import SeoPage from '@/components/seo/SeoPage';
import { cookieTins } from '@/lib/seo/pages/cookieTins';
import { getMenu } from '@/lib/seo/menu';
import { seoMetadata } from '@/lib/seo/meta';

// Content lives in lib/seo/pages/cookieTins.ts; the layout is shared by every search page.
export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata(cookieTins, await getMenu());
}

export default async function CookieTinsPage() {
  return <SeoPage page={cookieTins} menu={await getMenu()} />;
}
