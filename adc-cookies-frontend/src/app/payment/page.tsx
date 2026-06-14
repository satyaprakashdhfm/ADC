import OrderingApp from '@/components/ordering/OrderingApp';

export const metadata = {
  title: 'Payment - a dough cookie',
  description: 'Choose a payment method and place your order.',
};

// OrderingApp reads the pathname and renders the payment step on this route.
export default function PaymentRoute() {
  return <OrderingApp />;
}
