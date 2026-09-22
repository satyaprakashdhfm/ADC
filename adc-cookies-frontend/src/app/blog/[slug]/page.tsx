import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SeoPage from '@/components/seo/SeoPage';
import { ARTICLES } from '@/lib/seo/pages';
import { getMenu } from '@/lib/seo/menu';
import { seoMetadata } from '@/lib/seo/meta';

/* The guides under /blog/<slug>. Only the articles in lib/seo/pages exist; any other slug is a 404
   rather than an empty page Google could index. */
export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map(a => ({ slug: a.path.replace('/blog/', '') }));
}

const find = (slug: string) => ARTICLES.find(a => a.path === `/blog/${slug}`);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = find((await params).slug);
  return page ? seoMetadata(page, await getMenu()) : {};
}

export default async function BlogArticle({ params }: { params: Promise<{ slug: string }> }) {
  const page = find((await params).slug);
  if (!page) notFound();
  return <SeoPage page={page} menu={await getMenu()} />;
}
