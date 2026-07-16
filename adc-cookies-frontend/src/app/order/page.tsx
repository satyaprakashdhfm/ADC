'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The standalone order page is retired for now — products live on the home page (#products).
// Redirect any /order?cat=&q= links to home, preserving the query so the home grid can
// pre-select the category / search term. (Checkout & payment still use OrderingApp.)
export default function OrderPage() {
  const router = useRouter();
  useEffect(() => {
    const qs = window.location.search;
    router.replace(qs ? `/${qs}` : '/');
  }, [router]);
  return null;
}
