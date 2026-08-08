import StoreSignIn from '@/components/store/StoreSignIn';

export const metadata = {
  title: 'Store sign in - a dough cookie',
  description: 'Sign in to your store order board.',
  robots: { index: false, follow: false },
};

/**
 * /store — the address staff can be told once and remember. Signing in sends them to their own
 * store's board, so nobody has to know their store's code.
 */
export default function StoreIndexRoute() {
  return <StoreSignIn />;
}
