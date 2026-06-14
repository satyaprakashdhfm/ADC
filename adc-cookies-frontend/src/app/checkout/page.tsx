import OrderingApp from '@/components/ordering/OrderingApp';

export const metadata = {
  title: 'Checkout - a dough cookie',
  description: 'Review your order and delivery details.',
};

// OrderingApp reads the pathname and renders the checkout (review) step on this route.
export default function CheckoutRoute() {
  return <OrderingApp />;
}
