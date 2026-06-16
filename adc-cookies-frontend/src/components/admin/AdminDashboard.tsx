'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LoginModal from '@/components/ordering/LoginModal';
import {
  adminDashboard, adminGetOrders, adminUpdateOrderStatus, adminGetProducts,
  adminCreateProduct, adminUpdateProduct, adminDeleteProduct, adminGetCoupons,
  adminToggleCoupon, adminGetUsers, adminGetMessages, adminMarkMessageHandled,
  type AdminStats, type AdminUser, type AdminCoupon, type AdminMessage,
  type Product, type Order, type ProductInput,
} from '@/lib/api';
import {
  LayoutDashboard, ShoppingBag, Package, Ticket, Users, MessageSquare,
  IndianRupee, AlertTriangle, Plus, Pencil, Trash2, Check, X, LogOut, Gift,
} from 'lucide-react';

const ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'coupons', label: 'Coupons', icon: Ticket },
  { id: 'users', label: 'Customers', icon: Users },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
] as const;
type TabId = typeof TABS[number]['id'];

const card: React.CSSProperties = { background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)' };
const money = (v: number) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
const fmtDate = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', fontWeight: 800, borderBottom: '1px solid var(--border-default)' };
const td: React.CSSProperties = { padding: '12px', fontSize: 'var(--text-sm)', color: 'var(--text-body)', borderBottom: '1px solid var(--border-soft)', verticalAlign: 'middle' };

const EMPTY_PRODUCT: ProductInput = { name: '', category: 'COOKIES', description: '', price: 0, stockQuantity: 0, menuGroup: '', tag: '', featured: false, isAvailable: true, images: '' };

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState<TabId>('overview');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [coupons, setCoupons] = useState<AdminCoupon[] | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [messages, setMessages] = useState<AdminMessage[] | null>(null);
  const [editing, setEditing] = useState<{ id?: number; data: ProductInput } | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [err, setErr] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

  const isAdmin = !!user && user.role === 'ADMIN';

  useEffect(() => { if (isAdmin) adminDashboard().then(setStats).catch(e => setErr(String(e.message || e))); }, [isAdmin]);

  // Lazy-load each tab's data the first time it's opened.
  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'orders' && orders === null) adminGetOrders().then(setOrders).catch(() => setOrders([]));
    if (tab === 'products' && products === null) adminGetProducts().then(setProducts).catch(() => setProducts([]));
    if (tab === 'coupons' && coupons === null) adminGetCoupons().then(setCoupons).catch(() => setCoupons([]));
    if (tab === 'users' && users === null) adminGetUsers().then(setUsers).catch(() => setUsers([]));
    if (tab === 'messages' && messages === null) adminGetMessages().then(setMessages).catch(() => setMessages([]));
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
          </div>
        )}

        {/* ===== Orders ===== */}
        {tab === 'orders' && (
          <Panel title="All orders" loading={orders === null}>
            <Table head={['Order', 'Customer', 'Total', 'Payment', 'Status', 'Date']}>
              {(orders || []).map(o => (
                <tr key={o.id} onClick={() => setViewOrder(o)} style={{ cursor: 'pointer' }}>
                  <td style={td}><strong style={{ color: 'var(--text-link)' }}>{o.orderNumber}</strong><br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-2xs)' }}>{(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''} · tap for details</span></td>
                  <td style={td}>{o.address?.fullName || '—'}<br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)' }}>{o.address?.city || ''}</span></td>
                  <td style={td}>{money(o.totalAmount)}</td>
                  <td style={td}><Badge text={o.paymentStatus} ok={o.paymentStatus === 'PAID'} /></td>
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <select value={o.orderStatus} onChange={e => changeOrderStatus(o.id, e.target.value)} style={{ padding: '7px 10px', borderRadius: 10, border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)', cursor: 'pointer' }}>
                      {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={td}>{fmtDate(o.createdAt)}</td>
                </tr>
              ))}
            </Table>
            {orders && !orders.length && <Empty text="No orders yet." />}
          </Panel>
        )}

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

              <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {row('Item total', money(o.subtotal ?? o.totalAmount))}
                {!!o.discountAmount && row(`Discount${o.couponCode ? ` (${o.couponCode})` : ''}`, `−${money(o.discountAmount)}`)}
                {o.deliveryFee != null && row('Delivery fee', money(o.deliveryFee))}
                {!!o.taxAmount && row('Tax / GST', money(o.taxAmount))}
                <div style={{ height: 1, background: 'var(--border-default)', margin: '2px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--text-strong)' }}><span>Total</span><span>{money(o.totalAmount)}</span></div>
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
