'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LoginModal from '@/components/ordering/LoginModal';
import {
  adminDashboard, adminAnalytics, adminGetOrders, adminUpdateOrderStatus, adminGetProducts,
  adminCreateProduct, adminUpdateProduct, adminDeleteProduct, adminGetCoupons,
  adminToggleCoupon, adminGetUsers, adminGetMessages, adminMarkMessageHandled,
  adminGetWarehouses, adminCreateWarehouse, adminUpdateWarehouse, adminSetDefaultWarehouse,
  adminToggleWarehouse, adminGetShippingCost, adminCreateShipment, adminCancelShipment,
  adminTrackOrder, openLabel, adminCreatePickupRequest,
  type AdminStats, type AdminAnalytics, type AdminUser, type AdminCoupon, type AdminMessage,
  type Product, type Order, type ProductInput, type Warehouse, type WarehouseInput,
} from '@/lib/api';
import {
  LayoutDashboard, ShoppingBag, Package, Ticket, Users, MessageSquare,
  IndianRupee, AlertTriangle, Plus, Pencil, Trash2, Check, X, LogOut, Gift,
  Truck, Warehouse as WarehouseIcon, Star, ToggleLeft, ToggleRight, ExternalLink, RefreshCw, Download, Search, Filter, CalendarRange,
} from 'lucide-react';

const ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'coupons', label: 'Coupons', icon: Ticket },
  { id: 'users', label: 'Customers', icon: Users },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
] as const;
type TabId = typeof TABS[number]['id'];

const card: React.CSSProperties = { background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)' };
const money = (v: number) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const fmtDate = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', fontWeight: 800, borderBottom: '1px solid var(--border-default)' };
const td: React.CSSProperties = { padding: '12px', fontSize: 'var(--text-sm)', color: 'var(--text-body)', borderBottom: '1px solid var(--border-soft)', verticalAlign: 'middle' };

const EMPTY_PRODUCT: ProductInput = { name: '', category: 'COOKIES', description: '', price: 0, stockQuantity: 0, menuGroup: '', tag: '', featured: false, isAvailable: true, images: '' };

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState<TabId>('overview');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [range, setRange] = useState(() => ({ from: daysAgoStr(29), to: todayStr() }));
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [coupons, setCoupons] = useState<AdminCoupon[] | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [messages, setMessages] = useState<AdminMessage[] | null>(null);
  const [editing, setEditing] = useState<{ id?: number; data: ProductInput } | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [err, setErr] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

  // Orders filter state
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');

  // Delivery tab state
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [whForm, setWhForm] = useState<{ id?: number; data: WarehouseInput } | null>(null);
  const [costPin, setCostPin] = useState('');
  const [costWeight, setCostWeight] = useState('0.5');
  const [costResult, setCostResult] = useState<{ ok: boolean; data?: { total_amount: number; gross_amount: number; zone: string; charged_weight: number; charge_DL: number; tax_data: { SGST: number; CGST: number; IGST: number } }[]; reason?: string } | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [purDate, setPurDate] = useState('');
  const [purTime, setPurTime] = useState('10:00');
  const [purCount, setPurCount] = useState('1');
  const [purResult, setPurResult] = useState<string>('');
  const [shipmentBusy, setShipmentBusy] = useState<number | null>(null);
  const [trackResult, setTrackResult] = useState<Record<number, unknown>>({});
  const [shipmentWeights, setShipmentWeights] = useState<Record<number, string>>({});

  const EMPTY_WH: WarehouseInput = { name: '', registeredName: '', pickupLocation: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', returnPincode: '', phone: '', email: '', isDefault: false, skipDelhivery: false };

  const isAdmin = !!user && user.role === 'ADMIN';

  useEffect(() => { if (isAdmin) adminDashboard().then(setStats).catch(e => setErr(String(e.message || e))); }, [isAdmin]);
  useEffect(() => { if (isAdmin) adminAnalytics(range.from, range.to).then(setAnalytics).catch(() => {}); }, [isAdmin, range.from, range.to]);

  // Lazy-load each tab's data the first time it's opened.
  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'orders' && orders === null) adminGetOrders().then(setOrders).catch(() => setOrders([]));
    if (tab === 'products' && products === null) adminGetProducts().then(setProducts).catch(() => setProducts([]));
    if (tab === 'coupons' && coupons === null) adminGetCoupons().then(setCoupons).catch(() => setCoupons([]));
    if (tab === 'users' && users === null) adminGetUsers().then(setUsers).catch(() => setUsers([]));
    if (tab === 'messages' && messages === null) adminGetMessages().then(setMessages).catch(() => setMessages([]));
    if (tab === 'delivery') {
      if (warehouses === null) adminGetWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
      if (orders === null) adminGetOrders().then(setOrders).catch(() => setOrders([]));
    }
  }, [tab, isAdmin, orders, products, coupons, users, messages]);

  const refreshProducts = useCallback(() => { adminGetProducts().then(setProducts).catch(() => {}); adminDashboard().then(setStats).catch(() => {}); }, []);

  const changeOrderStatus = async (id: number, status: string) => {
    const updated = await adminUpdateOrderStatus(id, status).catch(() => null);
    if (updated) { setOrders(o => (o || []).map(x => x.id === id ? updated : x)); adminDashboard().then(setStats).catch(() => {}); }
  };
  const saveProduct = async () => {
    if (!editing) return;
    try {
      if (editing.id) await adminUpdateProduct(editing.id, editing.data);
      else await adminCreateProduct(editing.data);
      setEditing(null); refreshProducts();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Save failed'); }
  };
  const removeProduct = async (id: number) => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    await adminDeleteProduct(id).catch(() => {});
    refreshProducts();
  };
  const toggleCoupon = async (id: number) => {
    const updated = await adminToggleCoupon(id).catch(() => null);
    if (updated) setCoupons(c => (c || []).map(x => x.id === id ? updated : x));
  };
  const markHandled = async (id: number) => {
    await adminMarkMessageHandled(id).catch(() => {});
    setMessages(m => (m || []).map(x => x.id === id ? { ...x, handled: true } : x));
    adminDashboard().then(setStats).catch(() => {});
  };

  if (loading) return null;

  // Not an admin (or signed out) → show a clear sign-in gate instead of silently bouncing home.
  if (!isAdmin) {
    return (
      <main className="adc-pattern-page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ ...card, padding: '36px 30px', maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: '#fff', margin: '0 auto 18px' }}><LayoutDashboard size={26} /></div>
          <h1 style={{ fontSize: 'var(--text-h3)', marginBottom: 8 }}>Admin access</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 22 }}>
            {user
              ? <>You&apos;re signed in as <strong>{user.email}</strong>, which isn&apos;t an admin account. Log in with an admin account to manage the store.</>
              : <>Please sign in with an admin account to open the dashboard.</>}
          </p>
          <button onClick={() => setLoginOpen(true)} style={addBtn}>Log in as admin</button>
          {user && <div style={{ marginTop: 12 }}><button onClick={() => { logout(); }} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>Switch account</button></div>}
          <div style={{ marginTop: 18, fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>Demo admin: admin@adccookies.com / admin123</div>
        </div>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </main>
    );
  }

  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px var(--gutter)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: '#fff', flex: 'none' }}><LayoutDashboard size={20} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>ADC Admin</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{user.name} · {user.email}</div>
          </div>
          <button onClick={() => { logout(); router.push('/'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}><LogOut size={16} /> Log out</button>
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px var(--gutter) 64px' }}>
        {err && <div style={{ ...card, padding: '12px 16px', marginBottom: 16, color: 'var(--status-error)', borderColor: 'var(--status-error)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{err}</div>}

        {/* Tabs */}
        <div className="hide-sb" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 22, paddingBottom: 4 }}>
          {TABS.map(t => {
            const on = tab === t.id;
            const Icon = t.icon;
            const badge = t.id === 'messages' ? stats?.newMessages : undefined;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none', padding: '10px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', border: on ? 'none' : '1.5px solid var(--border-default)', background: on ? 'var(--gradient-warm)' : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                <Icon size={17} /> {t.label}
                {!!badge && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: on ? '#fff' : 'var(--brand-secondary)', color: on ? 'var(--brand-secondary)' : '#fff', fontSize: 11, fontWeight: 900, display: 'grid', placeItems: 'center' }}>{badge}</span>}
              </button>
            );
          })}
        </div>

        {/* ===== Overview ===== */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Date-range filter — scopes the analytics charts below */}
            <div style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}><CalendarRange size={16} /> Period</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([['7 days', 7], ['30 days', 30], ['90 days', 90], ['1 year', 365]] as const).map(([lbl, d]) => {
                  const active = range.from === daysAgoStr(d - 1) && range.to === todayStr();
                  return (
                    <button key={lbl} onClick={() => setRange({ from: daysAgoStr(d - 1), to: todayStr() })}
                      style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-xs)', border: active ? 'none' : '1.5px solid var(--border-default)', background: active ? 'var(--gradient-warm)' : 'var(--surface-card)', color: active ? '#fff' : 'var(--text-body)' }}>{lbl}</button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
                <input type="date" value={range.from} max={range.to} onChange={e => e.target.value && setRange(r => ({ ...r, from: e.target.value }))} style={{ ...inp, width: 'auto', padding: '7px 10px', cursor: 'pointer' }} />
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <input type="date" value={range.to} min={range.from} max={todayStr()} onChange={e => e.target.value && setRange(r => ({ ...r, to: e.target.value }))} style={{ ...inp, width: 'auto', padding: '7px 10px', cursor: 'pointer' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
              <StatCard icon={<Users size={20} />} label="Customers" value={stats ? String(stats.totalUsers) : '—'} />
              <StatCard icon={<ShoppingBag size={20} />} label="Total orders" value={stats ? String(stats.totalOrders) : '—'} />
              <StatCard icon={<IndianRupee size={20} />} label="Revenue" value={stats ? money(stats.totalRevenue) : '—'} sub={stats ? `${money(stats.paidRevenue)} paid` : ''} />
              <StatCard icon={<Package size={20} />} label="Products" value={stats ? String(stats.totalProducts) : '—'} />
              <StatCard icon={<MessageSquare size={20} />} label="New messages" value={stats ? String(stats.newMessages) : '—'} accent={!!stats?.newMessages} />
              <StatCard icon={<AlertTriangle size={20} />} label="Low stock (≤10)" value={stats ? String(stats.lowStock) : '—'} accent={!!stats?.lowStock} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
              <div style={{ ...card, padding: 20 }}>
                <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 14 }}>Orders by status</h3>
                {stats && Object.keys(stats.ordersByStatus || {}).length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Object.entries(stats.ordersByStatus || {}).map(([s, n]) => {
                      const pct = stats.totalOrders ? Math.round((n / stats.totalOrders) * 100) : 0;
                      return (
                        <div key={s}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4 }}><span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{s}</span><span style={{ color: 'var(--text-muted)' }}>{n}</span></div>
                          <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-sunken)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--gradient-warm)' }} /></div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No orders yet.</p>}
              </div>

              <div style={{ ...card, padding: 20 }}>
                <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 14 }}>Top products</h3>
                {stats && (stats.topProducts || []).length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(stats.topProducts || []).map((p, i) => (
                      <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 12, fontWeight: 900, display: 'grid', placeItems: 'center', flex: 'none' }}>{i + 1}</span>
                        <span style={{ flex: 1, fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{p.name}</span>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{p.qty} sold · {money(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No sales yet.</p>}
              </div>
            </div>

            {/* Sales — last 30 days */}
            <div style={{ ...card, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 'var(--text-h4)' }}>Sales over time</h3>
                {analytics && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 700 }}>{money(analytics.salesByDay.reduce((s, d) => s + d.revenue, 0))} · {analytics.salesByDay.reduce((s, d) => s + d.orders, 0)} orders</span>}
              </div>
              {analytics ? <SalesChart data={fillDays(analytics.salesByDay, analytics.from || range.from, analytics.to || range.to)} /> : <div style={{ height: 200, display: 'grid', placeItems: 'center', color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>Loading…</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
              <div style={{ ...card, padding: 20 }}>
                <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 14 }}>Orders by area</h3>
                {analytics?.ordersByArea.length ? <BarRows items={analytics.ordersByArea.map(a => ({ label: a.city, value: a.orders, sub: `${a.orders} · ${money(a.revenue)}` }))} /> : <Empty text="No area data yet." />}
              </div>
              <div style={{ ...card, padding: 20 }}>
                <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 14 }}>Customers by city</h3>
                {analytics?.usersByCity.length ? <BarRows items={analytics.usersByCity.map(c => ({ label: c.city, value: c.users, sub: `${c.users} customer${c.users === 1 ? '' : 's'}` }))} color="#1F8A5B" /> : <Empty text="No customer locations yet." />}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
              <div style={{ ...card, padding: 20 }}>
                <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 14 }}>Payments</h3>
                {analytics?.paymentBreakdown.length ? <Donut segments={analytics.paymentBreakdown.map((p, i) => ({ label: p.status, value: p.count, color: PIE[i % PIE.length] }))} center={`${analytics.paymentBreakdown.reduce((s, p) => s + p.count, 0)}`} centerSub="orders" /> : <Empty text="No payments yet." />}
              </div>
              <div style={{ ...card, padding: 20 }}>
                <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 14 }}>Shipments</h3>
                {analytics?.shipmentByStatus.length ? <Donut segments={analytics.shipmentByStatus.map((s, i) => ({ label: s.status, value: s.count, color: PIE[i % PIE.length] }))} center={`${analytics.shipmentByStatus.reduce((s, x) => s + x.count, 0)}`} centerSub="shipments" /> : <Empty text="No shipments yet." />}
              </div>
            </div>
          </div>
        )}

        {/* ===== Orders ===== */}
        {tab === 'orders' && (() => {
          const q = orderSearch.trim().toLowerCase();
          const filtered = (orders || []).filter(o => {
            if (orderStatusFilter && o.orderStatus !== orderStatusFilter) return false;
            if (!q) return true;
            return (
              o.orderNumber.toLowerCase().includes(q) ||
              (o.address?.fullName || '').toLowerCase().includes(q) ||
              (o.address?.city || '').toLowerCase().includes(q)
            );
          });
          return (
            <Panel title={`Orders${orders ? ` (${filtered.length}${filtered.length !== orders.length ? '/' + orders.length : ''})` : ''}`} loading={orders === null}
              action={<button onClick={() => adminGetOrders().then(setOrders).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input style={{ ...inp, paddingLeft: 34 }} placeholder="Search order #, customer, city…" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
                </div>
                <div style={{ position: 'relative', flex: '0 0 auto' }}>
                  <Filter size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <select value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value)} style={{ ...inp, paddingLeft: 30, width: 'auto', minWidth: 150, cursor: 'pointer' }}>
                    <option value="">All statuses</option>
                    {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {(orderSearch || orderStatusFilter) && <button onClick={() => { setOrderSearch(''); setOrderStatusFilter(''); }} style={{ ...iconBtn, width: 'auto', padding: '0 12px', fontSize: 'var(--text-xs)', fontWeight: 700 }}>Clear</button>}
              </div>
              <Table head={['Order', 'Customer', 'Total', 'Payment', 'Shipment', 'Status', 'Date']}>
                {filtered.map(o => (
                  <tr key={o.id} onClick={() => setViewOrder(o)} style={{ cursor: 'pointer' }}>
                    <td style={td}><strong style={{ color: 'var(--text-link)' }}>{o.orderNumber}</strong><br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-2xs)' }}>{(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''} · tap for details</span></td>
                    <td style={td}>{o.address?.fullName || '—'}<br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)' }}>{o.address?.city || ''}</span></td>
                    <td style={td}>{money(o.totalAmount)}</td>
                    <td style={td}><Badge text={o.paymentStatus} ok={o.paymentStatus === 'PAID'} /></td>
                    <td style={td}><Badge text={o.shipmentStatus || 'NOT_CREATED'} ok={o.shipmentStatus === 'CREATED' || o.shipmentStatus === 'DELIVERED'} /></td>
                    <td style={td} onClick={e => e.stopPropagation()}>
                      <select value={o.orderStatus} onChange={e => changeOrderStatus(o.id, e.target.value)} style={{ padding: '7px 10px', borderRadius: 10, border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)', cursor: 'pointer' }}>
                        {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={td}>{fmtDate(o.createdAt)}</td>
                  </tr>
                ))}
              </Table>
              {orders && !filtered.length && <Empty text={orders.length ? 'No orders match the filter.' : 'No orders yet.'} />}
            </Panel>
          );
        })()}

        {/* ===== Products ===== */}
        {tab === 'products' && (
          <Panel title="Products" loading={products === null} action={<button onClick={() => setEditing({ data: { ...EMPTY_PRODUCT } })} style={addBtn}><Plus size={16} /> Add product</button>}>
            <Table head={['Name', 'Category', 'Price', 'Stock', 'Tag', '']}>
              {(products || []).map(p => (
                <tr key={p.id}>
                  <td style={td}><strong>{p.name}</strong></td>
                  <td style={td}>{p.category}</td>
                  <td style={td}>{money(p.price)}</td>
                  <td style={td}><span style={{ color: p.stockQuantity <= 10 ? 'var(--status-error)' : 'var(--text-body)', fontWeight: p.stockQuantity <= 10 ? 800 : 400 }}>{p.stockQuantity}</span></td>
                  <td style={td}>{p.tag || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => setEditing({ id: p.id, data: { name: p.name, category: p.category, description: p.description, price: p.price, stockQuantity: p.stockQuantity, images: p.images, options: p.options, isAvailable: p.isAvailable, menuGroup: p.menuGroup, tag: p.tag, featured: p.featured } })} aria-label="Edit" style={iconBtn}><Pencil size={15} /></button>
                    <button onClick={() => removeProduct(p.id)} aria-label="Delete" style={{ ...iconBtn, color: 'var(--status-error)' }}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </Table>
            {products && !products.length && <Empty text="No products." />}
          </Panel>
        )}

        {/* ===== Delivery ===== */}
        {tab === 'delivery' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Warehouses */}
            <Panel title="Warehouses" loading={warehouses === null}
              action={<button onClick={() => setWhForm({ data: { ...EMPTY_WH } })} style={addBtn}><Plus size={16} /> Add warehouse</button>}>
              {warehouses && warehouses.length > 0 ? (
                <Table head={['Name', 'Location', 'Pincode', 'Status', 'Default', '']}>
                  {warehouses.map(w => (
                    <tr key={w.id}>
                      <td style={td}><strong>{w.name}</strong><br /><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{w.pickupLocation}</span></td>
                      <td style={td}>{[w.city, w.state].filter(Boolean).join(', ') || '—'}</td>
                      <td style={td}>{w.pincode}</td>
                      <td style={td}><Badge text={w.isActive ? 'Active' : 'Inactive'} ok={w.isActive} /></td>
                      <td style={td}>
                        {w.isDefault
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--brand-secondary)', fontWeight: 700, fontSize: 'var(--text-xs)' }}><Star size={13} fill="currentColor" /> Default</span>
                          : <button onClick={async () => { await adminSetDefaultWarehouse(w.id); adminGetWarehouses().then(setWarehouses).catch(() => {}); }} style={{ ...iconBtn, width: 'auto', padding: '4px 10px', fontSize: 'var(--text-xs)', fontWeight: 700 }}>Set default</button>}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button onClick={() => setWhForm({ id: w.id, data: { name: w.name, registeredName: w.registeredName || '', pickupLocation: w.pickupLocation, addressLine1: w.addressLine1 || '', addressLine2: w.addressLine2 || '', city: w.city || '', state: w.state || '', pincode: w.pincode, returnPincode: w.returnPincode || '', phone: w.phone || '', email: w.email || '' } })} style={iconBtn} aria-label="Edit"><Pencil size={15} /></button>
                        <button onClick={async () => { const u = await adminToggleWarehouse(w.id).catch(() => null); if (u) setWarehouses(p => (p || []).map(x => x.id === w.id ? u : x)); }} style={iconBtn} aria-label="Toggle active">
                          {w.isActive ? <ToggleRight size={15} color="var(--brand-secondary)" /> : <ToggleLeft size={15} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : warehouses !== null && <Empty text="No warehouses yet — add one to create shipments." />}
            </Panel>

            {/* Shipping cost calculator */}
            <Panel title="Shipping cost calculator (admin only — customer always pays ₹100)">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
                <Field label="Destination pincode">
                  <input style={{ ...inp, width: 140 }} value={costPin} onChange={e => setCostPin(e.target.value)} placeholder="560001" maxLength={6} />
                </Field>
                <Field label="Weight (kg)">
                  <input type="number" style={{ ...inp, width: 100 }} value={costWeight} onChange={e => setCostWeight(e.target.value)} min="0.1" step="0.1" />
                </Field>
                <button onClick={async () => { setCostLoading(true); setCostResult(null); const r = await adminGetShippingCost(costPin, Number(costWeight)).catch(e => ({ ok: false, reason: String(e.message || e) })); setCostResult(r as typeof costResult); setCostLoading(false); }} disabled={costPin.length !== 6 || costLoading} style={{ ...addBtn, opacity: costPin.length !== 6 ? 0.5 : 1 }}>
                  {costLoading ? 'Checking…' : 'Calculate'}
                </button>
              </div>
              {costResult && !costResult.ok && (
                <div style={{ marginTop: 10, color: 'var(--status-error)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>Error: {costResult.reason}</div>
              )}
              {costResult?.ok && costResult.data?.[0] && (() => {
                const d = costResult.data[0];
                const tax = (d.tax_data.SGST || 0) + (d.tax_data.CGST || 0) + (d.tax_data.IGST || 0);
                const rows: [string, string][] = [
                  ['Zone', d.zone],
                  ['Charged weight', `${d.charged_weight} kg`],
                  ['Delivery charge', `₹${d.charge_DL.toFixed(2)}`],
                  ['GST', `₹${tax.toFixed(2)}`],
                  ['Total (Delhivery)', `₹${d.total_amount.toFixed(2)}`],
                  ['Customer pays', '₹100.00'],
                ];
                return (
                  <div style={{ marginTop: 12, background: 'var(--surface-sunken)', borderRadius: 10, overflow: 'hidden' }}>
                    {rows.map(([label, value], i) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: i < rows.length - 1 ? '1px solid var(--border-default)' : 'none', fontSize: 'var(--text-sm)' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
                        <span style={{ fontWeight: label === 'Total (Delhivery)' || label === 'Customer pays' ? 800 : 600, color: label === 'Customer pays' ? 'var(--brand-secondary)' : 'var(--text-strong)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Panel>

            {/* Pickup request */}
            <Panel title="Create pickup request">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="Pickup date"><input type="date" style={{ ...inp, width: 160 }} value={purDate} onChange={e => setPurDate(e.target.value)} /></Field>
                <Field label="Pickup time"><input type="time" style={{ ...inp, width: 120 }} value={purTime} onChange={e => setPurTime(e.target.value)} /></Field>
                <Field label="Package count"><input type="number" style={{ ...inp, width: 80 }} value={purCount} onChange={e => setPurCount(e.target.value)} min="1" /></Field>
                <button onClick={async () => {
                  setPurResult('Submitting…');
                  const r = await adminCreatePickupRequest(purDate, purTime, Number(purCount)).catch(e => ({ ok: false, reason: String(e.message || e), data: undefined }));
                  setPurResult(r.ok ? `Pickup request created! ${JSON.stringify((r as { ok: boolean; data?: unknown }).data || {})}` : `Error: ${(r as { ok: boolean; reason?: string }).reason}`);
                }} disabled={!purDate || !purTime} style={{ ...addBtn, opacity: !purDate ? 0.5 : 1 }}>Request pickup</button>
              </div>
              {purResult && <div style={{ marginTop: 10, fontSize: 'var(--text-sm)', color: purResult.startsWith('Error') ? 'var(--status-error)' : 'var(--status-success)', fontWeight: 700 }}>{purResult}</div>}
            </Panel>

            {/* Orders with shipment actions */}
            <Panel title="Order shipments" loading={orders === null}
              action={orders === null ? undefined : <button onClick={() => adminGetOrders().then(setOrders).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
              {orders && (
                <Table head={['Order', 'Customer', 'Waybill', 'Shipment', 'Weight (kg)', 'Actions']}>
                  {(orders || []).map(o => {
                    const w = shipmentWeights[o.id] ?? '0.5';
                    const trackData = trackResult[o.id] as { status?: string; note?: string; scans?: { time: string; event: string }[] } | undefined;
                    return (
                      <tr key={o.id}>
                        <td style={td}><strong style={{ color: 'var(--text-link)' }}>{o.orderNumber}</strong><br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-2xs)' }}>{o.orderStatus}</span></td>
                        <td style={td}>{o.address?.fullName || '—'}<br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)' }}>{o.address?.pincode || ''}</span></td>
                        <td style={td}>
                          {o.delhiveryWaybill
                            ? <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>{o.delhiveryWaybill}</span>
                            : <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>—</span>}
                        </td>
                        <td style={td}><Badge text={o.shipmentStatus || 'NOT_CREATED'} ok={o.shipmentStatus === 'CREATED' || o.shipmentStatus === 'DELIVERED'} /></td>
                        <td style={td} onClick={e => e.stopPropagation()}>
                          {!o.delhiveryWaybill && (
                            <input type="number" value={w} min="0.1" step="0.1"
                              onChange={e => setShipmentWeights(p => ({ ...p, [o.id]: e.target.value }))}
                              style={{ ...inp, width: 80, padding: '6px 8px' }} />
                          )}
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          {!o.delhiveryWaybill ? (
                            <button disabled={shipmentBusy === o.id} onClick={async () => {
                              setShipmentBusy(o.id); setErr('');
                              const r = await adminCreateShipment(o.id, Number(w) || 0.5).catch(e => { setErr(String(e.message || e)); return null; });
                              if (r) setOrders(p => (p || []).map(x => x.id === o.id ? { ...x, delhiveryWaybill: r.delhiveryWaybill, shipmentStatus: r.shipmentStatus } : x));
                              setShipmentBusy(null);
                            }} style={{ ...addBtn, padding: '7px 12px', fontSize: 'var(--text-xs)', marginRight: 6 }}>
                              {shipmentBusy === o.id ? '…' : <><Truck size={13} /> Create</>}
                            </button>
                          ) : (
                            <>
                              <button onClick={() => openLabel(o.delhiveryWaybill!).catch(e => setErr(String(e.message || e)))} style={{ ...iconBtn, marginRight: 4 }} title="Download label"><Download size={14} /></button>
                              <button title="Track" onClick={async () => {
                                const r = await adminTrackOrder(o.id).catch(() => null);
                                if (r?.ok) {
                                  type ShipmentData = { ShipmentData?: { Shipment?: { Status?: { Status?: string; Instructions?: string }; Scans?: { ScanDetail?: { ScanDateTime?: string; Instructions?: string; Scan?: string } }[] } }[] };
                                  const shipment = (r.data as ShipmentData)?.ShipmentData?.[0]?.Shipment;
                                  const scans = (shipment?.Scans || []).map(s => ({ time: s.ScanDetail?.ScanDateTime || '', event: [s.ScanDetail?.Scan, s.ScanDetail?.Instructions].filter(Boolean).join(' — ') })).reverse();
                                  setTrackResult(p => ({ ...p, [o.id]: { status: shipment?.Status?.Status || 'No status', note: shipment?.Status?.Instructions || '', scans } }));
                                } else if (r) {
                                  setTrackResult(p => ({ ...p, [o.id]: { status: `Error: ${(r as { reason?: string }).reason || 'unknown'}` } }));
                                }
                              }} style={{ ...iconBtn, marginRight: 4 }}><ExternalLink size={14} /></button>
                              {o.shipmentStatus !== 'CANCELLED' && (
                                <button disabled={shipmentBusy === o.id} onClick={async () => {
                                  if (!confirm(`Cancel shipment ${o.delhiveryWaybill}?`)) return;
                                  setShipmentBusy(o.id); setErr('');
                                  await adminCancelShipment(o.id).catch(e => { setErr(String(e.message || e)); });
                                  setOrders(p => (p || []).map(x => x.id === o.id ? { ...x, shipmentStatus: 'CANCELLED' } : x));
                                  setShipmentBusy(null);
                                }} style={{ ...iconBtn, color: 'var(--status-error)', marginRight: 0 }} title="Cancel shipment"><X size={14} /></button>
                              )}
                            </>
                          )}
                          {trackData && (
                            <div style={{ marginTop: 6, background: 'var(--surface-sunken)', borderRadius: 8, padding: '8px 12px', maxWidth: 340, whiteSpace: 'normal' }}>
                              <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-xs)', marginBottom: 6 }}>{trackData.status}{trackData.note ? ` — ${trackData.note}` : ''}</div>
                              {trackData.scans && trackData.scans.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {trackData.scans.slice(0, 5).map((s, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                                      <span style={{ flex: 'none', color: 'var(--text-subtle)', minWidth: 110 }}>{s.time ? new Date(s.time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                      <span>{s.event}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Table>
              )}
              {orders !== null && !orders.length && <Empty text="No orders yet." />}
              {orders === null && <button onClick={() => adminGetOrders().then(setOrders).catch(() => setOrders([]))} style={addBtn}>Load orders</button>}
            </Panel>
          </div>
        )}

        {/* ===== Coupons ===== */}
        {tab === 'coupons' && (
          <Panel title="Coupons" loading={coupons === null}>
            <Table head={['Code', 'Type', 'Value', 'Min order', 'Active', '']}>
              {(coupons || []).map(c => (
                <tr key={c.id}>
                  <td style={td}><strong>{c.code}</strong></td>
                  <td style={td}>{c.discountType}</td>
                  <td style={td}>{c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : money(c.discountValue)}</td>
                  <td style={td}>{c.minimumOrderAmount ? money(c.minimumOrderAmount) : '—'}</td>
                  <td style={td}><Badge text={c.isActive ? 'Active' : 'Inactive'} ok={c.isActive} /></td>
                  <td style={td}><button onClick={() => toggleCoupon(c.id)} style={{ ...iconBtn, width: 'auto', padding: '6px 12px', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{c.isActive ? 'Disable' : 'Enable'}</button></td>
                </tr>
              ))}
            </Table>
            {coupons && !coupons.length && <Empty text="No coupons." />}
          </Panel>
        )}

        {/* ===== Users ===== */}
        {tab === 'users' && (
          <Panel title="Customers" loading={users === null}>
            <Table head={['Name', 'Email', 'Phone', 'Orders', 'Role', 'Joined']}>
              {(users || []).map(u => (
                <tr key={u.id}>
                  <td style={td}><strong>{u.name}</strong></td>
                  <td style={td}>{u.email}</td>
                  <td style={td}>{u.phone || '—'}</td>
                  <td style={td}>{u.orderCount}</td>
                  <td style={td}><Badge text={u.role} ok={u.role === 'ADMIN'} /></td>
                  <td style={td}>{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
            </Table>
            {users && !users.length && <Empty text="No customers yet." />}
          </Panel>
        )}

        {/* ===== Messages ===== */}
        {tab === 'messages' && (
          <Panel title="Contact messages" loading={messages === null}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(messages || []).map(m => (
                <div key={m.id} style={{ ...card, padding: 16, opacity: m.handled ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <strong style={{ color: 'var(--text-strong)' }}>{m.name}</strong>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{m.email}{m.phone ? ` · ${m.phone}` : ''}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>{fmtDate(m.createdAt)}</span>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.6, marginBottom: 10 }}>{m.message}</p>
                  {!m.handled
                    ? <button onClick={() => markHandled(m.id)} style={{ ...iconBtn, width: 'auto', padding: '7px 14px', fontWeight: 700, fontSize: 'var(--text-sm)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={15} /> Mark handled</button>
                    : <span style={{ fontSize: 'var(--text-sm)', color: 'var(--status-success)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={15} /> Handled</span>}
                </div>
              ))}
            </div>
            {messages && !messages.length && <Empty text="No messages yet." />}
          </Panel>
        )}
      </div>

      {/* Warehouse editor modal */}
      {whForm && (
        <div onClick={() => setWhForm(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px,96vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: 24 }} className="hide-sb">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ flex: 1, fontSize: 'var(--text-h3)' }}>{whForm.id ? 'Edit warehouse' : 'Add warehouse'}</h3>
              <button onClick={() => setWhForm(null)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Warehouse name *"><input style={inp} value={whForm.data.name} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, name: e.target.value } })} /></Field>
                <Field label="Registered name"><input style={inp} value={whForm.data.registeredName || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, registeredName: e.target.value } })} /></Field>
              </div>
              <Field label="Pickup location * (must EXACTLY match the pickup name in your Delhivery panel)">
                <input style={inp} value={whForm.data.pickupLocation} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, pickupLocation: e.target.value } })} placeholder="e.g. ADC Cookies" />
              </Field>
              <Field label="Address line 1"><input style={inp} value={whForm.data.addressLine1 || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, addressLine1: e.target.value } })} /></Field>
              <Field label="Address line 2 / Area"><input style={inp} value={whForm.data.addressLine2 || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, addressLine2: e.target.value } })} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="City"><input style={inp} value={whForm.data.city || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, city: e.target.value } })} /></Field>
                <Field label="State"><input style={inp} value={whForm.data.state || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, state: e.target.value } })} /></Field>
                <Field label="Pincode *"><input style={inp} value={whForm.data.pincode} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, pincode: e.target.value } })} placeholder="500034" maxLength={6} /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Phone"><input style={inp} value={whForm.data.phone || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, phone: e.target.value } })} /></Field>
                <Field label="Email"><input style={inp} value={whForm.data.email || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, email: e.target.value } })} /></Field>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!whForm.data.isDefault} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, isDefault: e.target.checked } })} /> Set as default warehouse
              </label>
              {!whForm.id && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!whForm.data.skipDelhivery} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, skipDelhivery: e.target.checked } })} style={{ marginTop: 2 }} />
                  <span>Already registered on Delhivery One Panel<br /><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Skip re-registering — the pickup location key above must match exactly what&apos;s in Delhivery.</span></span>
                </label>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  disabled={!whForm.data.name || !whForm.data.pickupLocation || !whForm.data.pincode}
                  onClick={async () => {
                    try {
                      if (whForm.id) {
                        await adminUpdateWarehouse(whForm.id, whForm.data);
                      } else {
                        await adminCreateWarehouse(whForm.data);
                      }
                      setWhForm(null);
                      adminGetWarehouses().then(setWarehouses).catch(() => {});
                    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Save failed'); }
                  }}
                  style={{ ...addBtn, flex: 1, justifyContent: 'center', opacity: (!whForm.data.name || !whForm.data.pickupLocation || !whForm.data.pincode) ? 0.5 : 1 }}>
                  <Check size={16} /> Save warehouse
                </button>
                <button onClick={() => setWhForm(null)} style={{ padding: '12px 18px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product editor modal */}
      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px,96vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: 24 }} className="hide-sb">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ flex: 1, fontSize: 'var(--text-h3)' }}>{editing.id ? 'Edit product' : 'New product'}</h3>
              <button onClick={() => setEditing(null)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Name"><input style={inp} value={editing.data.name} onChange={e => setEditing({ ...editing, data: { ...editing.data, name: e.target.value } })} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Category">
                  <select style={inp} value={editing.data.category} onChange={e => setEditing({ ...editing, data: { ...editing.data, category: e.target.value as 'COOKIES' | 'TINS' } })}>
                    <option value="COOKIES">COOKIES</option><option value="TINS">TINS</option>
                  </select>
                </Field>
                <Field label="Menu group"><input style={inp} value={editing.data.menuGroup || ''} onChange={e => setEditing({ ...editing, data: { ...editing.data, menuGroup: e.target.value } })} /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="Price ₹"><input type="number" style={inp} value={editing.data.price} onChange={e => setEditing({ ...editing, data: { ...editing.data, price: Number(e.target.value) } })} /></Field>
                <Field label="Stock"><input type="number" style={inp} value={editing.data.stockQuantity} onChange={e => setEditing({ ...editing, data: { ...editing.data, stockQuantity: Number(e.target.value) } })} /></Field>
                <Field label="Tag"><input style={inp} value={editing.data.tag || ''} onChange={e => setEditing({ ...editing, data: { ...editing.data, tag: e.target.value } })} /></Field>
              </div>
              <Field label="Description"><textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={editing.data.description || ''} onChange={e => setEditing({ ...editing, data: { ...editing.data, description: e.target.value } })} /></Field>
              <Field label="Image path (e.g. /assets/products/adc-special.jpg or JSON array)"><input style={inp} value={editing.data.images || ''} onChange={e => setEditing({ ...editing, data: { ...editing.data, images: e.target.value } })} /></Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-body)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!editing.data.featured} onChange={e => setEditing({ ...editing, data: { ...editing.data, featured: e.target.checked } })} /> Featured
              </label>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={saveProduct} disabled={!editing.data.name || !editing.data.price} style={{ ...addBtn, flex: 1, justifyContent: 'center', opacity: (!editing.data.name || !editing.data.price) ? 0.5 : 1 }}><Check size={16} /> Save</button>
                <button onClick={() => setEditing(null)} style={{ padding: '12px 18px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order detail popup */}
      {viewOrder && (() => {
        const o = viewOrder;
        const items = o.items || [];
        const parse = (s?: string | null) => { try { return s ? JSON.parse(s) : {}; } catch { return {}; } };
        const giftItem = items.find(it => { const p = parse(it.selectedOptions); return p.giftWrap || p.giftPackaging; });
        const giftOpts = giftItem ? parse(giftItem.selectedOptions) : null;
        const a = o.address;
        const row = (label: string, val: string) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}><span>{label}</span><span>{val}</span></div>
        );
        return (
          <div onClick={() => setViewOrder(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} className="hide-sb" style={{ width: 'min(520px,96vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 'var(--text-h4)' }}>{o.orderNumber}</h3>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 2 }}>{fmtDate(o.createdAt)}</div>
                </div>
                <button onClick={() => setViewOrder(null)} style={iconBtn}><X size={18} /></button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <Badge text={o.orderStatus} />
                <Badge text={o.paymentStatus} ok={o.paymentStatus === 'PAID'} />
              </div>

              <div style={{ ...card, padding: 14, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: giftOpts ? 'var(--gradient-warm)' : 'var(--surface-sunken)', display: 'grid', placeItems: 'center', flex: 'none' }}>{giftOpts ? <Gift size={18} color="#fff" /> : <Package size={18} color="var(--text-muted)" />}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{giftOpts ? 'Gift packaging' : 'Standard packaging'}</div>
                  {giftOpts && (giftOpts.giftMessage ? <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', marginTop: 4, fontStyle: 'italic' }}>&ldquo;{giftOpts.giftMessage}&rdquo;</div> : <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>No gift message</div>)}
                </div>
              </div>

              <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>Items</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {items.map(it => {
                  const opts = parse(it.selectedOptions);
                  const addOns = Array.isArray(opts.addOns) ? opts.addOns : Array.isArray(opts.addons) ? opts.addons : [];
                  return (
                    <div key={it.id} style={{ ...card, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{it.productName} × {it.quantity}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{money(it.totalPrice)}</span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>{money(it.unitPrice)} each</div>
                      {addOns.length > 0 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>Add-ons: {addOns.join(', ')}</div>}
                      {it.specialNotes && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>Note: {it.specialNotes}</div>}
                    </div>
                  );
                })}
                {!items.length && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No item details recorded for this order.</div>}
              </div>

              {a && (
                <div style={{ ...card, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Deliver to</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{a.fullName} · {a.phone}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{[a.addressLine1, a.addressLine2, a.city, a.state, a.pincode].filter(Boolean).join(', ')}</div>
                </div>
              )}

              {/* Shipment info */}
              {(() => {
                const modalW = shipmentWeights[o.id] ?? '0.5';
                const modalTrack = trackResult[o.id] as { status?: string; note?: string; scans?: { time: string; event: string }[] } | undefined;
                return (
                  <div style={{ ...card, padding: 14, marginBottom: 14 }}>
                    <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>Shipment</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Badge text={o.shipmentStatus || 'NOT_CREATED'} ok={o.shipmentStatus === 'CREATED' || o.shipmentStatus === 'DELIVERED'} />
                      {o.delhiveryWaybill && <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>{o.delhiveryWaybill}</span>}
                    </div>
                    {!o.delhiveryWaybill && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                        <Field label="Weight (kg)">
                          <input type="number" value={modalW} min="0.1" step="0.1" onChange={e => setShipmentWeights(p => ({ ...p, [o.id]: e.target.value }))} style={{ ...inp, width: 90 }} />
                        </Field>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {!o.delhiveryWaybill ? (
                        <button disabled={shipmentBusy === o.id} onClick={async () => {
                          setShipmentBusy(o.id); setErr('');
                          const r = await adminCreateShipment(o.id, Number(modalW) || 0.5).catch(e => { setErr(String(e.message || e)); return null; });
                          if (r) {
                            setOrders(p => (p || []).map(x => x.id === o.id ? { ...x, delhiveryWaybill: r.delhiveryWaybill, shipmentStatus: r.shipmentStatus } : x));
                            setViewOrder(prev => prev ? { ...prev, delhiveryWaybill: r.delhiveryWaybill, shipmentStatus: r.shipmentStatus } : prev);
                          }
                          setShipmentBusy(null);
                        }} style={{ ...addBtn, padding: '8px 14px', fontSize: 'var(--text-sm)' }}>
                          <Truck size={14} /> {shipmentBusy === o.id ? 'Creating…' : 'Create shipment'}
                        </button>
                      ) : (
                        <>
                          <button onClick={() => openLabel(o.delhiveryWaybill!).catch(e => setErr(String(e.message || e)))} style={{ ...addBtn, padding: '8px 14px', fontSize: 'var(--text-sm)' }}><Download size={14} /> Label</button>
                          <button onClick={async () => {
                            const r = await adminTrackOrder(o.id).catch(() => null);
                            if (r?.ok) {
                              type ShipmentData = { ShipmentData?: { Shipment?: { Status?: { Status?: string; Instructions?: string }; Scans?: { ScanDetail?: { ScanDateTime?: string; Instructions?: string; Scan?: string } }[] } }[] };
                              const shipment = (r.data as ShipmentData)?.ShipmentData?.[0]?.Shipment;
                              const scans = (shipment?.Scans || []).map(s => ({ time: s.ScanDetail?.ScanDateTime || '', event: [s.ScanDetail?.Scan, s.ScanDetail?.Instructions].filter(Boolean).join(' — ') })).reverse();
                              setTrackResult(p => ({ ...p, [o.id]: { status: shipment?.Status?.Status || 'No status', note: shipment?.Status?.Instructions || '', scans } }));
                            }
                          }} style={{ ...addBtn, padding: '8px 14px', fontSize: 'var(--text-sm)', background: 'var(--surface-raised)', color: 'var(--text-strong)', border: '1.5px solid var(--border-default)' }}><ExternalLink size={14} /> Track</button>
                          {o.shipmentStatus !== 'CANCELLED' && (
                            <button disabled={shipmentBusy === o.id} onClick={async () => {
                              if (!confirm(`Cancel shipment ${o.delhiveryWaybill}?`)) return;
                              setShipmentBusy(o.id); setErr('');
                              await adminCancelShipment(o.id).catch(e => { setErr(String(e.message || e)); });
                              setOrders(p => (p || []).map(x => x.id === o.id ? { ...x, shipmentStatus: 'CANCELLED' } : x));
                              setViewOrder(prev => prev ? { ...prev, shipmentStatus: 'CANCELLED' } : prev);
                              setShipmentBusy(null);
                            }} style={{ padding: '8px 14px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--status-error)', background: 'transparent', color: 'var(--status-error)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <X size={14} /> Cancel shipment
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {modalTrack && (
                      <div style={{ marginTop: 12, background: 'var(--surface-sunken)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>{modalTrack.status}{modalTrack.note ? ` — ${modalTrack.note}` : ''}</div>
                        {modalTrack.scans && modalTrack.scans.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {modalTrack.scans.map((s, i) => (
                              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 'var(--text-xs)', borderLeft: i === 0 ? '2px solid var(--brand-secondary)' : '2px solid var(--border-soft)', paddingLeft: 10 }}>
                                <span style={{ flex: 'none', color: 'var(--text-subtle)', minWidth: 120 }}>{s.time ? new Date(s.time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                <span style={{ color: 'var(--text-body)' }}>{s.event}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {row('Item total', money(o.subtotal ?? o.totalAmount))}
                {!!o.discountAmount && row(`Discount${o.couponCode ? ` (${o.couponCode})` : ''}`, `−${money(o.discountAmount)}`)}
                {o.deliveryFee != null && row('Delivery fee', money(o.deliveryFee))}
                {!!o.taxAmount && row('Tax / GST', money(o.taxAmount))}
                <div style={{ height: 1, background: 'var(--border-default)', margin: '2px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--text-strong)' }}><span>Total</span><span>{money(o.totalAmount)}</span></div>
                {o.payment && (
                  <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border-default)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>Payment:</span> {o.payment.provider === 'RAZORPAY' ? 'Razorpay' : o.payment.provider} · {o.payment.status}
                    {o.payment.transactionId && <><br /><span style={{ fontFamily: 'monospace', color: 'var(--text-body)' }}>{o.payment.transactionId}</span></>}
                    {o.payment.paidAt && <><br />Paid {fmtDate(o.payment.paidAt)}</>}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' };
const addBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' };
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'inline-grid', placeItems: 'center', color: 'var(--text-body)', marginRight: 6 };

/* ---------- Charts (lightweight inline SVG/CSS — no external deps) ---------- */
const PIE = ['#E8772E', '#1F8A5B', '#4285F4', '#9333EA', '#C2410C', '#6B7280'];

// Fill every calendar day in [from, to] so the line chart has no gaps. Capped at 370 points
// (for very long ranges the start is clamped) to keep the SVG light.
function fillDays(rows: { day: string; revenue: number; orders: number; paid: number }[], from: string, to: string) {
  const byDay = new Map(rows.map(r => [r.day, r]));
  const out: { day: string; revenue: number; orders: number; paid: number }[] = [];
  const end = new Date(`${to}T00:00:00Z`);
  let start = new Date(`${from}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return rows;
  const maxStart = new Date(end); maxStart.setUTCDate(end.getUTCDate() - 369);
  if (start < maxStart) start = maxStart;
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const r = byDay.get(key);
    out.push({ day: key, revenue: r?.revenue ?? 0, orders: r?.orders ?? 0, paid: r?.paid ?? 0 });
  }
  return out;
}

function SalesChart({ data }: { data: { day: string; revenue: number; paid: number }[] }) {
  const W = 760, H = 200, pl = 6, pr = 6, pt = 14, pb = 22;
  const n = data.length;
  const max = Math.max(1, ...data.map(d => d.revenue));
  const x = (i: number) => pl + (n <= 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1));
  const y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.revenue).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${(H - pb).toFixed(1)} L ${x(0).toFixed(1)} ${(H - pb).toFixed(1)} Z`;
  const peakI = data.reduce((bi, d, i) => (d.revenue > data[bi].revenue ? i : bi), 0);
  const fmtDay = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block', height: 200 }}>
        <defs>
          <linearGradient id="salesfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8772E" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#E8772E" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(g => <line key={g} x1={pl} x2={W - pr} y1={pt + g * (H - pt - pb)} y2={pt + g * (H - pt - pb)} stroke="var(--border-soft)" strokeWidth="1" />)}
        <path d={area} fill="url(#salesfill)" />
        <path d={line} fill="none" stroke="#E8772E" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {max > 1 && <circle cx={x(peakI)} cy={y(data[peakI].revenue)} r="4" fill="#E8772E" stroke="#fff" strokeWidth="2" />}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 2 }}>
        <span>{fmtDay(data[0].day)}</span>
        <span>Peak {money(data[peakI].revenue)} · {fmtDay(data[peakI].day)}</span>
        <span>{fmtDay(data[n - 1].day)}</span>
      </div>
    </div>
  );
}

function BarRows({ items, color = '#E8772E' }: { items: { label: string; value: number; sub?: string }[]; color?: string }) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {items.map(it => (
        <div key={it.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 4, gap: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
            <span style={{ color: 'var(--text-muted)', flex: 'none' }}>{it.sub ?? it.value}</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(3, (it.value / max) * 100)}%`, height: '100%', background: color, borderRadius: 99 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Donut({ segments, center, centerSub }: { segments: { label: string; value: number; color: string }[]; center?: string; centerSub?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 52, sw = 18, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 130, height: 130, flex: 'none' }}>
        <svg viewBox="0 0 130 130" width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="65" cy="65" r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={sw} />
          {segments.map(s => {
            const frac = s.value / total;
            const dash = frac * c;
            const el = <circle key={s.label} cx="65" cy="65" r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} />;
            offset += dash;
            return el;
          })}
        </svg>
        {center && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}><div><div style={{ fontWeight: 900, fontSize: 'var(--text-h4)', color: 'var(--text-strong)' }}>{center}</div>{centerSub && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{centerSub}</div>}</div></div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 120 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flex: 'none' }} />
            <span style={{ flex: 1, color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, background: accent ? 'var(--brand-secondary)' : 'var(--amber-50)', color: accent ? '#fff' : 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none' }}>{icon}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ font: 'var(--weight-extra) var(--text-h2)/1 var(--font-display)', color: 'var(--text-strong)' }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, children, loading, action }: { title: string; children: React.ReactNode; loading?: boolean; action?: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ flex: 1, fontSize: 'var(--text-h4)' }}>{title}</h3>
        {action}
      </div>
      {loading ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div> : <div style={{ overflowX: 'auto' }} className="hide-sb">{children}</div>}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
      <thead><tr>{head.map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Badge({ text, ok }: { text: string; ok?: boolean }) {
  return <span style={{ padding: '3px 9px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-xs)', fontWeight: 800, background: ok ? 'var(--status-success-bg)' : 'var(--surface-sunken)', color: ok ? 'var(--status-success)' : 'var(--text-muted)' }}>{text}</span>;
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{text}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</span>{children}</label>;
}
