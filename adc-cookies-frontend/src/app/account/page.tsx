import AccountPage from '@/components/account/AccountPage';

export const metadata = {
  title: 'My Account - a dough cookie',
  description: 'Manage your profile, orders, and delivery addresses.',
};

// Auth + Cart providers live in the root layout; this route just renders the account page.
export default function Account() {
  return <AccountPage />;
}
