import AdminDashboard from '@/components/admin/AdminDashboard';

export const metadata = {
  title: 'Admin Dashboard - a dough cookie',
  description: 'Manage orders, products, coupons, customers and messages.',
};

export default function AdminRoute() {
  return <AdminDashboard />;
}
