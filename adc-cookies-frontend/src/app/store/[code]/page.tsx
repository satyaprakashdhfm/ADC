import StorePortal from '@/components/store/StorePortal';

export const metadata = {
  title: 'Store portal - a dough cookie',
  description: 'Order board for store staff.',
  // A shop terminal, not a page anyone should find in a search result.
  robots: { index: false, follow: false },
};

export default async function StoreRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // Lower-cased, not validated against the store list: the list lives in the backend, and an
  // unknown code simply fails to sign in. Checking it here would only duplicate that.
  return <StorePortal code={code.toLowerCase()} />;
}
