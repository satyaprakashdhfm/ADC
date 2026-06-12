import OrderingApp from '@/components/ordering/OrderingApp';

// Auth + Cart providers live in the root layout, so this page just renders the app.
export default function OrderPage() {
  return <OrderingApp />;
}
