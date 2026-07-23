'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LoginModal from '@/components/ordering/LoginModal';
import {
  adminDashboard, adminAnalytics, adminGetOrders, adminUpdateOrderStatus, adminGetProducts,
  adminGetSettings, adminSetPromoProduct, adminSetHeaderOffer, adminSetStallInfo,
  adminCreateProduct, adminUpdateProduct, adminDeleteProduct, adminGetCoupons,
  adminCreateCoupon, adminUpdateCoupon, adminToggleCoupon, adminDeleteCoupon, adminGetUsers, adminGetMessages, adminMarkMessageHandled,
  adminGetWarehouses, adminCreateWarehouse, adminUpdateWarehouse, adminSetDefaultWarehouse,
  adminToggleWarehouse, adminCreateShipment, adminCancelShipment,
  adminTrackOrder, openLabel, adminCreatePickupRequest, adminFetchOrderDocument, adminFetchShadowfaxDoc, adminGetShadowfaxStores,
  type AdminStats, type AdminAnalytics, type AdminUser, type AdminCoupon, type CouponInput, type AdminMessage,
  type Product, type Order, type ProductInput, type Warehouse, type WarehouseInput, type ShadowfaxDocResult, type ShadowfaxStore,
} from '@/lib/api';
import {
  LayoutDashboard, ShoppingBag, Package, Ticket, Users, MessageSquare,
  IndianRupee, Plus, Pencil, Trash2, Check, X, LogOut, Gift,
  Truck, Warehouse as WarehouseIcon, Star, ToggleLeft, ToggleRight, ExternalLink, RefreshCw, Download, Search, Filter, CalendarRange,
  FileText,
} from 'lucide-react';

const ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

// Shadowfax's official Marketplace order-lifecycle states (forward flow only — we don't use
// COD/reverse) verbatim from their API docs, for admin reference. Customers only ever see the
// small friendly set from sfxStatusLabel() in src/shadowfax.js — this full table is admin-only,
// so admin can make sense of whatever raw status_id a tracking poll or webhook actually reports.
const SFX_ORDER_STATES: { id: string; status: string; description: string }[] = [
  { id: 'new', status: 'New', description: 'When the delivery request is new at Shadowfax facility.' },
  { id: 'assigned_for_seller_pickup', status: 'Assigned For Pickup', description: 'Order is assigned to a Shadowfax rider for seller (store) pickup.' },
  { id: 'ofp', status: 'Out For Pickup', description: 'Order is out for seller pickup — rider is on the way to the store.' },
  { id: 'picked', status: 'Picked', description: 'Order was picked up successfully from the store.' },
  { id: 'recd_at_rev_hub', status: 'Received At Reverse Hub', description: 'Order was picked and received at the pickup hub.' },
  { id: 'item_manifested', status: 'Item Added To Bag', description: 'Order was added to a bag (manifest) at a Shadowfax facility.' },
  { id: 'bag_in_transit', status: 'Bag In Transit', description: 'The bag (master manifest) containing this order is in forward transit.' },
  { id: 'bag_received_at_via', status: 'Bag Received At Via', description: 'The bag was received at an intermediate facility.' },
  { id: 'bag_received', status: 'Bag Received', description: 'The bag was received at the destination facility.' },
  { id: 'recd_at_fwd_hub', status: 'Received At Forward Hub', description: 'Order was received at the destination hub.' },
  { id: 'recd_at_fwd_dc', status: 'Received At DC', description: 'Order was received at the destination city DC.' },
  { id: 'assigned_for_delivery', status: 'Assigned For Customer Delivery', description: 'Order is assigned to a Shadowfax rider for customer delivery.' },
  { id: 'ofd', status: 'Out For Delivery', description: 'Order is out for customer delivery — rider_name/rider_contact are shared at this point.' },
  { id: 'delivered', status: 'Delivered', description: 'Order has been delivered to the customer. POD (proof of delivery) becomes available.' },
  { id: 'cid', status: 'Cid (Customer Initiated Delay)', description: 'Customer requested delivery on another day.' },
  { id: 'seller_initiated_delay', status: 'Seller Initiated Delay', description: 'Seller (us) requested pickup on another day.' },
  { id: 'nc', status: 'Not Contactable', description: 'Customer is not contactable for delivery — see Shadowfax’s On Hold/Not Contactable remarks appendix for the specific reason.' },
  { id: 'na', status: 'Not Attempted', description: 'Customer delivery was not attempted by the rider this cycle — see appendix for the specific reason.' },
  { id: 'pickup_not_attempted', status: 'Pickup Not Attempted', description: 'Seller pickup was not attempted this cycle.' },
  { id: 'cancelled_by_customer', status: 'Cancelled (by customer)', description: 'Delivery request was cancelled by the customer.' },
  { id: 'cancelled_by_seller', status: 'Cancelled (by seller)', description: 'We (the seller) requested to cancel the pickup.' },
  { id: 'on_hold', status: 'On Hold', description: 'Order is on hold due to client/operational concerns — see appendix for the specific reason.' },
  { id: 'pickup_on_hold', status: 'Pickup On Hold', description: 'Pickup specifically is on hold (marketplace-only status) — see appendix for the specific reason.' },
  { id: 'reopen_ndr', status: 'Require Delivery (NDR)', description: 'Customer delivery will be reattempted per the customer’s request.' },
  { id: 'lost', status: 'Lost', description: 'Order was lost in transit.' },
  { id: 'item_misrouted', status: 'Item Misrouted', description: 'The shipment reached the wrong Shadowfax facility.' },
  { id: 'pincode_updated', status: 'Pincode Updated', description: 'The destination pincode on this order was updated.' },
  { id: 'rts', status: 'Return To Seller — initiated', description: 'Order return-to-seller has been initiated (only relevant if we ever accept returns — we currently don’t).' },
  { id: 'rts_in_process', status: 'RTS In Progress', description: 'Return to seller is in progress.' },
  { id: 'rts_ofd', status: 'Out For Delivery (RTS)', description: 'Item is out for delivery back to the seller.' },
  { id: 'rts_d', status: 'Returned To Client', description: 'Order was successfully returned to the seller.' },
  { id: 'rts_nd', status: 'Undelivered (RTS)', description: 'Order was not successfully returned to the seller.' },
];
const PAGE_SIZE = 12; // rows per page in admin list tables
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

// Coupon create/edit form uses string fields (easy inputs); converted to CouponInput on save.
// `editId` is set when editing an existing coupon (PUT) instead of creating a new one (POST).
type CouponDraft = {
  editId?: number; code: string; discountType: 'PERCENTAGE' | 'FIXED'; discountValue: string;
  minimumOrderAmount: string; maximumDiscount: string; validDays: string; usageLimit: string;
  isSpin: boolean; spinWeight: string; spinLabel: string; terms: string;
};
const EMPTY_COUPON: CouponDraft = { code: '', discountType: 'PERCENTAGE', discountValue: '', minimumOrderAmount: '', maximumDiscount: '', validDays: '', usageLimit: '', isSpin: false, spinWeight: '', spinLabel: '', terms: '' };
const EMPTY_SPIN_COUPON: CouponDraft = { ...EMPTY_COUPON, discountType: 'FIXED', isSpin: true };
// Prefill the form from an existing coupon, for editing.
function couponToDraft(c: AdminCoupon): CouponDraft {
  const days = c.expiryDate ? Math.max(1, Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / 864e5)) : null;
  return {
    editId: c.id, code: c.code, discountType: c.discountType as 'PERCENTAGE' | 'FIXED',
    discountValue: String(c.discountValue), minimumOrderAmount: c.minimumOrderAmount != null ? String(c.minimumOrderAmount) : '',
    maximumDiscount: c.maximumDiscount != null ? String(c.maximumDiscount) : '', validDays: days != null ? String(days) : '',
    usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
    isSpin: c.spinWeight != null, spinWeight: c.spinWeight != null ? String(c.spinWeight) : '',
    spinLabel: c.spinLabel || '', terms: c.terms || '',
  };
}

// Live coupon status derived at read-time — no cron needed to "deactivate" a coupon.
function couponStatus(c: AdminCoupon): { text: string; ok: boolean } {
  if (!c.isActive) return { text: 'Disabled', ok: false };
  if (c.expiryDate && c.expiryDate < new Date().toISOString().slice(0, 10)) return { text: 'Expired', ok: false };
  if (c.usageLimit != null && (c.timesUsed ?? 0) >= c.usageLimit) return { text: 'Limit reached', ok: false };
  return { text: 'Active', ok: true };
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState<TabId>('overview');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [range, setRange] = useState(() => ({ from: daysAgoStr(29), to: todayStr() }));
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [promoProductId, setPromoProductId] = useState<number | null>(null);
  const [headerOffer, setHeaderOffer] = useState('');
  const [headerOfferSaved, setHeaderOfferSaved] = useState(false);
  const [stallInfo, setStallInfo] = useState('');
  const [stallInfoSaved, setStallInfoSaved] = useState(false);
  const [coupons, setCoupons] = useState<AdminCoupon[] | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [messages, setMessages] = useState<AdminMessage[] | null>(null);
  const [editing, setEditing] = useState<{ id?: number; data: ProductInput } | null>(null);
  const [couponForm, setCouponForm] = useState<CouponDraft | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [err, setErr] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

  // Orders filter state
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderCarrier, setOrderCarrier] = useState('');
  const [orderPayment, setOrderPayment] = useState('');

  // Per-tab search/filter state for the other lists
  const [productSearch, setProductSearch] = useState('');
  const [productCat, setProductCat] = useState('');
  const [productAvail, setProductAvail] = useState('');
  const [couponSearch, setCouponSearch] = useState('');
  const [couponStatusFilter, setCouponStatusFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [messageHandled, setMessageHandled] = useState('');

  // Pagination: one page number per list key.
  const [pages, setPages] = useState<Record<string, number>>({});
  const pageOf = (k: string) => pages[k] || 1;
  const setPageOf = (k: string, n: number) => setPages(p => ({ ...p, [k]: n }));
  function paginate<T>(arr: T[], key: string): T[] {
    const page = pageOf(key);
    return arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }

  // Delivery tab state
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [whForm, setWhForm] = useState<{ id?: number; data: WarehouseInput } | null>(null);
  const [purDate, setPurDate] = useState('');
  const [purTime, setPurTime] = useState('10:00');
  const [purCount, setPurCount] = useState('1');
  const [purResult, setPurResult] = useState<string>('');
  const [shipmentBusy, setShipmentBusy] = useState<number | null>(null);
  const [trackResult, setTrackResult] = useState<Record<number, unknown>>({});
  const [shipmentWeights, setShipmentWeights] = useState<Record<number, string>>({});
  const [delivSub, setDelivSub] = useState<'main' | 'shadowfax' | 'delhivery'>('main');
  const [sfxDoc, setSfxDoc] = useState<Record<number, ShadowfaxDocResult | { error: string }>>({});
  const [sfxStores, setSfxStores] = useState<ShadowfaxStore[] | null>(null);
  const [sfxStatesOpen, setSfxStatesOpen] = useState(false);

  const EMPTY_WH: WarehouseInput = { name: '', registeredName: '', pickupLocation: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', returnPincode: '', phone: '', email: '', isDefault: false, skipDelhivery: false };

  const isAdmin = !!user && user.role === 'ADMIN';

  useEffect(() => { if (isAdmin) adminDashboard().then(setStats).catch(e => setErr(String(e.message || e))); }, [isAdmin]);
  useEffect(() => { if (isAdmin) adminGetSettings().then(s => { setPromoProductId(s.promoProductId); setHeaderOffer(s.headerOffer || ''); setStallInfo(s.stallInfo || ''); }).catch(() => {}); }, [isAdmin]);
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
      if (sfxStores === null) adminGetShadowfaxStores().then(setSfxStores).catch(() => setSfxStores([]));
    }
  }, [tab, isAdmin, orders, products, coupons, users, messages, sfxStores]);

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
    if (updated) setCoupons(c => (c || []).map(x => x.id === id ? { ...updated, timesUsed: x.timesUsed } : x));
  };
  const editCoupon = (c: AdminCoupon) => setCouponForm(couponToDraft(c));
  const saveCoupon = async () => {
    if (!couponForm) return;
    const f = couponForm;
    if (!f.code.trim() || !f.discountValue) { setErr('A coupon needs a code and a discount value.'); return; }
    if (f.isSpin && !f.spinWeight) { setErr('A Spin Wheel offer needs an odds weight (%).'); return; }
    const days = Number(f.validDays);
    const payload: CouponInput = {
      code: f.code.trim().toUpperCase(),
      discountType: f.discountType,
      discountValue: Number(f.discountValue),
      minimumOrderAmount: f.minimumOrderAmount ? Number(f.minimumOrderAmount) : null,
      maximumDiscount: f.maximumDiscount ? Number(f.maximumDiscount) : null,
      // "Valid for N days" → concrete expiry date; blank = never expires.
      expiryDate: days > 0 ? new Date(Date.now() + days * 864e5).toISOString().slice(0, 10) : null,
      usageLimit: f.usageLimit ? Number(f.usageLimit) : null,
      isActive: true,
      spinWeight: f.isSpin ? Number(f.spinWeight) : null,
      spinLabel: f.isSpin ? (f.spinLabel.trim() || null) : null,
      terms: f.isSpin ? (f.terms.trim() || null) : null,
    };
    try {
      if (f.editId != null) {
        const updated = await adminUpdateCoupon(f.editId, payload);
        setCoupons(c => (c || []).map(x => x.id === f.editId ? { ...updated, timesUsed: x.timesUsed } : x));
      } else {
        const created = await adminCreateCoupon(payload);
        setCoupons(c => [...(c || []), { ...created, timesUsed: 0 }]);
      }
      setCouponForm(null); setErr('');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save coupon'); }
  };
  const removeCoupon = async (id: number) => {
    if (!confirm('Delete this coupon? This cannot be undone.')) return;
    await adminDeleteCoupon(id).catch(() => {});
    setCoupons(c => (c || []).filter(x => x.id !== id));
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
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: 'var(--white)', margin: '0 auto 18px' }}><LayoutDashboard size={26} /></div>
          <h1 style={{ fontSize: 'var(--text-h3)', marginBottom: 8 }}>Admin access</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 22 }}>
            {user
              ? <>You&apos;re signed in as <strong>{user.email || user.phone || 'a customer account'}</strong>, which isn&apos;t an admin account. Sign in with an authorised admin account to manage the store.</>
              : <>Sign in with an authorised admin account — Google or your registered mobile (OTP) — to open the dashboard.</>}
          </p>
          <button onClick={() => setLoginOpen(true)} style={addBtn}>Log in as admin</button>
          {user && <div style={{ marginTop: 12 }}><button onClick={() => { logout(); }} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>Switch account</button></div>}
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
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}><LayoutDashboard size={20} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>A Dough Cookie Admin</div>
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
              <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none', padding: '10px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', border: on ? 'none' : '1.5px solid var(--border-default)', background: on ? 'var(--gradient-warm)' : 'var(--surface-card)', color: on ? 'var(--white)' : 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                <Icon size={17} /> {t.label}
                {!!badge && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: on ? 'var(--white)' : 'var(--brand-secondary)', color: on ? 'var(--brand-secondary)' : 'var(--white)', fontSize: 11, fontWeight: 900, display: 'grid', placeItems: 'center' }}>{badge}</span>}
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
                      style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-xs)', border: active ? 'none' : '1.5px solid var(--border-default)', background: active ? 'var(--gradient-warm)' : 'var(--surface-card)', color: active ? 'var(--white)' : 'var(--text-body)' }}>{lbl}</button>
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
              <StatCard icon={<Users size={20} />} label="Customers" value={stats ? String(stats.totalUsers) : '—'} onClick={() => setTab('users')} />
              <StatCard icon={<ShoppingBag size={20} />} label="Total orders" value={stats ? String(stats.totalOrders) : '—'} />
              <StatCard icon={<IndianRupee size={20} />} label="Revenue" value={stats ? money(stats.totalRevenue) : '—'} sub={stats ? `${money(stats.paidRevenue)} paid` : ''} />
              <StatCard icon={<Package size={20} />} label="Products" value={stats ? String(stats.totalProducts) : '—'} />
              <StatCard icon={<MessageSquare size={20} />} label="New messages" value={stats ? String(stats.newMessages) : '—'} accent={!!stats?.newMessages} />
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
                <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 14 }}>Orders by city</h3>
                {analytics?.ordersByArea.length ? <BarRows items={analytics.ordersByArea.map(a => ({ label: a.city, value: a.orders, sub: `${a.orders} order${a.orders === 1 ? '' : 's'} · ${money(a.revenue)}` }))} /> : <Empty text="No orders yet." />}
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
            if (orderCarrier && (o.carrier || '') !== orderCarrier) return false;
            if (orderPayment && o.paymentStatus !== orderPayment) return false;
            if (!q) return true;
            return (
              o.orderNumber.toLowerCase().includes(q) ||
              (o.address?.fullName || '').toLowerCase().includes(q) ||
              (o.address?.city || '').toLowerCase().includes(q)
            );
          });
          const active = !!(orderStatusFilter || orderCarrier || orderPayment);
          const clear = () => { setOrderStatusFilter(''); setOrderCarrier(''); setOrderPayment(''); setOrderSearch(''); setPageOf('orders', 1); };
          const selStyle = { ...inp, cursor: 'pointer' } as React.CSSProperties;
          return (
            <Panel title={`Orders${orders ? ` (${filtered.length}${filtered.length !== orders.length ? '/' + orders.length : ''})` : ''}`} loading={orders === null}
              action={<button onClick={() => adminGetOrders().then(setOrders).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
              <FilterBar search={orderSearch} onSearch={v => { setOrderSearch(v); setPageOf('orders', 1); }} placeholder="Search order #, customer, city…" active={active} onClear={clear}>
                <Field label="Order status"><select value={orderStatusFilter} onChange={e => { setOrderStatusFilter(e.target.value); setPageOf('orders', 1); }} style={selStyle}><option value="">All statuses</option>{ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
                <Field label="Carrier"><select value={orderCarrier} onChange={e => { setOrderCarrier(e.target.value); setPageOf('orders', 1); }} style={selStyle}><option value="">All carriers</option><option value="SHADOWFAX">Shadowfax (intracity)</option><option value="DELHIVERY">Delhivery (outstation)</option></select></Field>
                <Field label="Payment"><select value={orderPayment} onChange={e => { setOrderPayment(e.target.value); setPageOf('orders', 1); }} style={selStyle}><option value="">Any payment</option><option value="PAID">Paid</option><option value="PENDING">Pending</option></select></Field>
              </FilterBar>
              <Table head={['Order', 'Customer', 'Total', 'Payment', 'Shipment', 'Status', 'Date']}>
                {paginate(filtered, 'orders').map(o => (
                  <tr key={o.id} onClick={() => setViewOrder(o)} style={{ cursor: 'pointer' }}>
                    <td style={td}><strong style={{ color: 'var(--text-link)' }}>{o.orderNumber}</strong><br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-2xs)' }}>{(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''} · tap for details</span></td>
                    <td style={td}>{o.address?.fullName || '—'}<br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)' }}>{o.address?.city || ''}</span></td>
                    <td style={td}>{money(o.totalAmount)}</td>
                    <td style={td}>
                      <Badge text={o.paymentStatus} ok={o.paymentStatus === 'PAID'} />
                      {o.warningFlags?.includes('DUPLICATE_CHARGE') && (
                        <div title="More than one captured payment was found against this order's Razorpay order — review in the Razorpay dashboard before refunding/shipping." style={{ marginTop: 4, fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--status-danger, #C0392B)' }}>
                          ⚠ Possible duplicate charge
                        </div>
                      )}
                    </td>
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
              <Pager page={pageOf('orders')} total={filtered.length} pageSize={PAGE_SIZE} onPage={n => setPageOf('orders', n)} />
            </Panel>
          );
        })()}

        {/* ===== Products ===== */}
        {tab === 'products' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Panel title="Homepage promo popup">
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '0 0 12px' }}>Pick the product featured in the popup shown to new visitors — its photo, name and description are used, and the button opens that product. Leave as Default for the generic offer.</p>
            <select
              value={promoProductId ?? ''}
              onChange={async e => {
                const val = e.target.value ? Number(e.target.value) : null;
                setPromoProductId(val);
                await adminSetPromoProduct(val).catch(err => setErr(String(err.message || err)));
              }}
              style={{ ...inp, width: 'auto', minWidth: 260, cursor: 'pointer' }}
            >
              <option value="">Default (no specific product)</option>
              {(products || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Panel>
          <Panel title="Header banner offer">
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '0 0 12px' }}>Free text shown in the rotating banner at the very top of every page. Only put a real, currently-active coupon code here — leave blank to hide this line entirely (the veg/login lines keep rotating either way).</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={headerOffer}
                onChange={e => { setHeaderOffer(e.target.value); setHeaderOfferSaved(false); }}
                placeholder="e.g. Get 5% off with code SAVE5"
                style={{ ...inp, flex: '1 1 320px' }}
              />
              <button
                onClick={async () => {
                  await adminSetHeaderOffer(headerOffer.trim() || null).catch(err => setErr(String(err.message || err)));
                  setHeaderOfferSaved(true);
                }}
                style={addBtn}
              >{headerOfferSaved ? 'Saved ✓' : 'Save'}</button>
            </div>
          </Panel>
          <Panel title="Today's stall — visit us">
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '0 0 12px' }}>Shown as a card on the homepage (right under the hero). Use it for a pop-up stall's location and timing — leave blank to hide the card entirely.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={stallInfo}
                onChange={e => { setStallInfo(e.target.value); setStallInfoSaved(false); }}
                placeholder="e.g. Phoenix Mall, Whitefield — 11am to 8pm today"
                style={{ ...inp, flex: '1 1 320px' }}
              />
              <button
                onClick={async () => {
                  await adminSetStallInfo(stallInfo.trim() || null).catch(err => setErr(String(err.message || err)));
                  setStallInfoSaved(true);
                }}
                style={addBtn}
              >{stallInfoSaved ? 'Saved ✓' : 'Save'}</button>
            </div>
          </Panel>
          {(() => {
            const cats = Array.from(new Set((products || []).map(p => p.category))).sort();
            const pq = productSearch.trim().toLowerCase();
            const list = (products || []).filter(p => {
              if (productCat && p.category !== productCat) return false;
              if (productAvail === 'in' && !p.isAvailable) return false;
              if (productAvail === 'out' && p.isAvailable) return false;
              if (!pq) return true;
              return p.name.toLowerCase().includes(pq) || (p.tag || '').toLowerCase().includes(pq);
            });
            const active = !!(productCat || productAvail);
            const clear = () => { setProductCat(''); setProductAvail(''); setProductSearch(''); setPageOf('products', 1); };
            const selStyle = { ...inp, cursor: 'pointer' } as React.CSSProperties;
            return (
          <Panel title={`Products${products ? ` (${list.length})` : ''}`} loading={products === null} action={<button onClick={() => setEditing({ data: { ...EMPTY_PRODUCT } })} style={addBtn}><Plus size={16} /> Add product</button>}>
            <FilterBar search={productSearch} onSearch={v => { setProductSearch(v); setPageOf('products', 1); }} placeholder="Search product or tag…" active={active} onClear={clear}>
              <Field label="Category"><select value={productCat} onChange={e => { setProductCat(e.target.value); setPageOf('products', 1); }} style={selStyle}><option value="">All categories</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
              <Field label="Availability"><select value={productAvail} onChange={e => { setProductAvail(e.target.value); setPageOf('products', 1); }} style={selStyle}><option value="">Any</option><option value="in">In stock / available</option><option value="out">Unavailable</option></select></Field>
            </FilterBar>
            <Table head={['Name', 'Category', 'Price', 'Stock', 'Tag', '']}>
              {paginate(list, 'products').map(p => (
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
            {products && !list.length && <Empty text={products.length ? 'No products match the filter.' : 'No products.'} />}
            <Pager page={pageOf('products')} total={list.length} pageSize={PAGE_SIZE} onPage={n => setPageOf('products', n)} />
          </Panel>
            );
          })()}
          </div>
        )}

        {/* ===== Delivery ===== */}
        {tab === 'delivery' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Sub-nav: all shipments · Shadowfax intracity · Delhivery outstation */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([['main', 'All shipments'], ['shadowfax', 'Shadowfax · Intracity'], ['delhivery', 'Delhivery · Outstation']] as const).map(([id, label]) => {
                const on = delivSub === id;
                return <button key={id} onClick={() => setDelivSub(id)} style={{ padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: on ? 'none' : '1.5px solid var(--border-default)', background: on ? 'var(--gradient-warm)' : 'var(--surface-card)', color: on ? 'var(--white)' : 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>{label}</button>;
              })}
            </div>

            {(delivSub === 'main' || delivSub === 'delhivery') && (<>
            {delivSub === 'main' && (<>
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

            {/* Pickup request (Delhivery only) */}
            {(() => {
              const pending = (orders || []).filter(o => o.carrier === 'DELHIVERY' && o.delhiveryWaybill && !['DELIVERED', 'CANCELLED'].includes(o.shipmentStatus || ''));
              return (
            <Panel title="Schedule a Delhivery pickup">
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Delhivery collects <strong>all manifested outstation packages</strong> from your default warehouse at the chosen slot.
                Shadowfax (intracity) needs no pickup request — a rider is dispatched to the store automatically once the order is confirmed.
              </p>
              <div style={{ marginBottom: 14, background: 'var(--surface-sunken)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-strong)', marginBottom: pending.length ? 6 : 0 }}>
                  {pending.length} Delhivery package{pending.length !== 1 ? 's' : ''} awaiting pickup
                </div>
                {pending.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {pending.map(o => (
                      <span key={o.id} style={{ fontSize: 'var(--text-2xs)', fontFamily: 'monospace', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '2px 7px', color: 'var(--text-body)' }} title={`${o.address?.fullName || ''} · ${o.delhiveryWaybill}`}>{o.orderNumber}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="Pickup date"><input type="date" style={{ ...inp, width: 160 }} value={purDate} min={todayStr()} onChange={e => setPurDate(e.target.value)} /></Field>
                <Field label="Pickup time"><input type="time" style={{ ...inp, width: 120 }} value={purTime} onChange={e => setPurTime(e.target.value)} /></Field>
                <Field label="Package count"><input type="number" style={{ ...inp, width: 90 }} value={purCount} onChange={e => setPurCount(e.target.value)} min="1" /></Field>
                <button onClick={() => setPurCount(String(Math.max(1, pending.length)))} style={{ ...iconBtn, width: 'auto', padding: '0 12px', height: 40, marginRight: 0, fontSize: 'var(--text-xs)', fontWeight: 700 }} title="Use the awaiting-pickup count">Use {Math.max(1, pending.length)}</button>
                <button onClick={async () => {
                  setPurResult('Submitting…');
                  const r = await adminCreatePickupRequest(purDate, purTime, Number(purCount)).catch(e => ({ ok: false, reason: String(e.message || e), data: undefined }));
                  setPurResult(r.ok ? `Pickup scheduled for ${purDate} at ${purTime} · ${purCount} package(s).` : `Error: ${(r as { ok: boolean; reason?: string }).reason}`);
                }} disabled={!purDate || !purTime} style={{ ...addBtn, opacity: !purDate ? 0.5 : 1 }}>Request pickup</button>
              </div>
              {purResult && <div style={{ marginTop: 10, fontSize: 'var(--text-sm)', color: purResult.startsWith('Error') ? 'var(--status-error)' : 'var(--status-success)', fontWeight: 700 }}>{purResult}</div>}
            </Panel>
              );
            })()}
            </>)}

            {/* Orders with shipment actions — all carriers under "All", or Delhivery-only under its tab */}
            <Panel title={delivSub === 'delhivery' ? 'Delhivery — outstation shipments' : 'Order shipments'} loading={orders === null}
              action={orders === null ? undefined : <button onClick={() => adminGetOrders().then(setOrders).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
              {orders && (
                <Table head={['Order', 'Customer', 'Service', 'Waybill', 'Status', 'Actions']}>
                  {(delivSub === 'delhivery' ? (orders || []).filter(o => o.carrier === 'DELHIVERY') : (orders || [])).map(o => {
                    const w = shipmentWeights[o.id] ?? '0.5';
                    const trackData = trackResult[o.id] as { status?: string; note?: string; scans?: { time: string; event: string }[] } | undefined;
                    const service = o.carrier === 'SHADOWFAX' ? { kind: 'Intracity', name: 'Shadowfax' }
                      : o.carrier === 'DELHIVERY' ? { kind: 'Intercity', name: 'Delhivery' } : null;
                    return (
                      <tr key={o.id}>
                        <td style={td}><strong style={{ color: 'var(--text-link)' }}>{o.orderNumber}</strong><br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-2xs)' }}>{o.orderStatus}</span></td>
                        <td style={td}>{o.address?.fullName || '—'}<br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)' }}>{o.address?.pincode || ''}</span></td>
                        <td style={td}>
                          {service
                            ? <><span style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-xs)' }}>{service.kind}</span><br /><span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-2xs)' }}>({service.name})</span></>
                            : <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>—</span>}
                        </td>
                        <td style={td}>
                          {o.delhiveryWaybill
                            ? <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-strong)' }}>{o.delhiveryWaybill}</span>
                            : <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>—</span>}
                        </td>
                        <td style={td}><Badge text={o.shipmentStatus || 'NOT_CREATED'} ok={o.shipmentStatus === 'CREATED' || o.shipmentStatus === 'DELIVERED'} /></td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          {!o.delhiveryWaybill ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input type="number" value={w} min="0.1" step="0.1" title="Weight (kg)"
                                onChange={e => setShipmentWeights(p => ({ ...p, [o.id]: e.target.value }))}
                                style={{ ...inp, width: 62, padding: '6px 8px' }} />
                              <button disabled={shipmentBusy === o.id} onClick={async () => {
                                setShipmentBusy(o.id); setErr('');
                                const r = await adminCreateShipment(o.id, Number(w) || 0.5).catch(e => { setErr(String(e.message || e)); return null; });
                                if (r) setOrders(p => (p || []).map(x => x.id === o.id ? { ...x, delhiveryWaybill: r.delhiveryWaybill, shipmentStatus: r.shipmentStatus, carrier: 'DELHIVERY' } : x));
                                setShipmentBusy(null);
                              }} style={{ ...addBtn, padding: '7px 12px', fontSize: 'var(--text-xs)' }}>
                                {shipmentBusy === o.id ? '…' : <><Truck size={13} /> Create</>}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {o.carrier !== 'SHADOWFAX' && <button onClick={() => openLabel(o.delhiveryWaybill!).catch(e => setErr(String(e.message || e)))} style={iconBtn} title="Download label"><Download size={14} /></button>}
                              {o.carrier !== 'SHADOWFAX' && (
                                <button title="Proof of delivery / signature" onClick={async () => {
                                  setErr('');
                                  for (const t of ['EPOD', 'SIGNATURE_URL'] as const) {
                                    const r = await adminFetchOrderDocument(o.id, t).catch(() => null);
                                    if (r?.ok && r.url) { window.open(r.url, '_blank', 'noopener'); return; }
                                  }
                                  setErr('No proof-of-delivery document available yet — Delhivery provides it after delivery.');
                                }} style={iconBtn}><FileText size={14} /></button>
                              )}
                              <button title="Track" onClick={async () => {
                                const r = await adminTrackOrder(o.id).catch(() => null);
                                if (!r?.ok) { if (r) setTrackResult(p => ({ ...p, [o.id]: { status: `Error: ${r.reason || 'unknown'}` } })); return; }
                                if (r.carrier === 'SHADOWFAX') {
                                  setTrackResult(p => ({ ...p, [o.id]: { status: r.status || 'No status', note: '', scans: r.scans || [] } }));
                                } else {
                                  type ShipmentData = { ShipmentData?: { Shipment?: { Status?: { Status?: string; Instructions?: string }; Scans?: { ScanDetail?: { ScanDateTime?: string; Instructions?: string; Scan?: string } }[] } }[] };
                                  const shipment = (r.data as ShipmentData)?.ShipmentData?.[0]?.Shipment;
                                  const scans = (shipment?.Scans || []).map(s => ({ time: s.ScanDetail?.ScanDateTime || '', event: [s.ScanDetail?.Scan, s.ScanDetail?.Instructions].filter(Boolean).join(' — ') })).reverse();
                                  setTrackResult(p => ({ ...p, [o.id]: { status: shipment?.Status?.Status || 'No status', note: shipment?.Status?.Instructions || '', scans } }));
                                }
                              }} style={iconBtn}><ExternalLink size={14} /></button>
                              {o.shipmentStatus !== 'CANCELLED' && (
                                <button disabled={shipmentBusy === o.id} onClick={async () => {
                                  if (!confirm(`Cancel shipment ${o.delhiveryWaybill}?`)) return;
                                  setShipmentBusy(o.id); setErr('');
                                  await adminCancelShipment(o.id).catch(e => { setErr(String(e.message || e)); });
                                  setOrders(p => (p || []).map(x => x.id === o.id ? { ...x, shipmentStatus: 'CANCELLED' } : x));
                                  setShipmentBusy(null);
                                }} style={{ ...iconBtn, color: 'var(--status-error)' }} title="Cancel shipment"><X size={14} /></button>
                              )}
                            </div>
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
              {orders !== null && !(delivSub === 'delhivery' ? orders.filter(o => o.carrier === 'DELHIVERY') : orders).length && <Empty text={delivSub === 'delhivery' ? 'No Delhivery (outstation) shipments yet.' : 'No orders yet.'} />}
              {orders === null && <button onClick={() => adminGetOrders().then(setOrders).catch(() => setOrders([]))} style={addBtn}>Load orders</button>}
            </Panel>
            </>)}

            {delivSub === 'shadowfax' && (
              <>
              <Panel title="Shadowfax — pickup stores" loading={sfxStores === null}
                action={sfxStores === null ? undefined : <button onClick={() => adminGetShadowfaxStores().then(setSfxStores).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
                {sfxStores && (
                  <>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                      Our real stores that can act as a Shadowfax pickup point. &quot;Not serviceable&quot; means Shadowfax doesn&apos;t currently service that store&apos;s pincode on the connected environment — orders will automatically fall back to the next in-zone store, or to Delhivery if none work. Checked live against Shadowfax just now, not cached.
                    </p>
                    <Table head={['Store', 'City', 'Pincode', 'Status', 'Services']}>
                      {sfxStores.map((s) => (
                        <tr key={s.pincode} style={{ opacity: s.serviceable === false ? 0.45 : 1 }}>
                          <td style={td}><strong style={{ color: 'var(--text-strong)' }}>{s.name}</strong></td>
                          <td style={td}>{s.city}, {s.state}</td>
                          <td style={td}><span style={{ fontFamily: 'monospace' }}>{s.pincode}</span></td>
                          <td style={td}>
                            {s.serviceable === null ? <Badge text="Unknown" /> : s.serviceable ? <Badge text="Serviceable" ok /> : <Badge text="Not serviceable" />}
                          </td>
                          <td style={td}>{s.services.length ? s.services.join(' / ') : '—'}</td>
                        </tr>
                      ))}
                    </Table>
                  </>
                )}
              </Panel>
              <Panel title="Shadowfax — order status reference (admin only)"
                action={<button onClick={() => setSfxStatesOpen(v => !v)} style={{ ...iconBtn, width: 'auto', padding: '4px 10px', fontSize: 'var(--text-xs)', fontWeight: 700 }}>{sfxStatesOpen ? 'Hide' : 'Show'}</button>}>
                {sfxStatesOpen ? (
                  <>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                      Every raw status Shadowfax can report for a marketplace (forward) order, straight from their official docs. Customers only ever see a small friendly subset (New / Confirmed / Out for delivery / Delivered) — this full list is for admin so a raw status_id from a tracking poll or webhook always makes sense.
                    </p>
                    <Table head={['status_id', 'Label', 'What it means']}>
                      {SFX_ORDER_STATES.map((s) => (
                        <tr key={s.id}>
                          <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{s.id}</span></td>
                          <td style={td}><strong>{s.status}</strong></td>
                          <td style={{ ...td, color: 'var(--text-muted)' }}>{s.description}</td>
                        </tr>
                      ))}
                    </Table>
                  </>
                ) : (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>{SFX_ORDER_STATES.length} known statuses — click Show to view the full reference.</p>
                )}
              </Panel>
              <Panel title="Shadowfax — intracity orders" loading={orders === null}
                action={orders === null ? undefined : <button onClick={() => adminGetOrders().then(setOrders).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
                {orders && (() => {
                  const sfx = orders.filter(o => o.carrier === 'SHADOWFAX');
                  if (!sfx.length) return <Empty text="No intracity (Shadowfax) orders yet." />;
                  return (
                    <>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>Same-city orders shipped by Shadowfax. There is no printable shipping label (the rider collects from the store) — the available documents are the live tracking link and the proof-of-delivery signature (after delivery).</p>
                      <Table head={['Order', 'Customer', 'AWB', 'Status', 'Documents']}>
                        {sfx.map(o => {
                          const trackData = trackResult[o.id] as { status?: string; scans?: { time: string; event: string }[] } | undefined;
                          const doc = sfxDoc[o.id];
                          return (
                            <tr key={o.id}>
                              <td style={td}><strong style={{ color: 'var(--text-link)' }}>{o.orderNumber}</strong><br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-2xs)' }}>{o.orderStatus}</span></td>
                              <td style={td}>{o.address?.fullName || '—'}<br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)' }}>{o.address?.city} · {o.address?.pincode}</span></td>
                              <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-strong)' }}>{o.delhiveryWaybill || '—'}</span></td>
                              <td style={td}><Badge text={o.shipmentStatus || 'NOT_CREATED'} ok={o.shipmentStatus === 'DELIVERED'} /></td>
                              <td style={{ ...td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                {o.delhiveryWaybill ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <button title="Track" onClick={async () => {
                                      const r = await adminTrackOrder(o.id).catch(() => null);
                                      if (r?.ok) setTrackResult(p => ({ ...p, [o.id]: { status: r.status || 'No status', scans: r.scans || [] } }));
                                      else setTrackResult(p => ({ ...p, [o.id]: { status: `Error: ${r?.reason || 'unknown'}` } }));
                                    }} style={iconBtn}><ExternalLink size={14} /></button>
                                    <button title="Fetch documents (tracking link + POD)" onClick={async () => {
                                      setErr('');
                                      const r = await adminFetchShadowfaxDoc(o.id).catch(() => null);
                                      setSfxDoc(p => ({ ...p, [o.id]: r || { error: 'Could not fetch documents' } }));
                                    }} style={iconBtn}><FileText size={14} /></button>
                                  </div>
                                ) : <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>No shipment</span>}
                                {trackData && (
                                  <div style={{ marginTop: 6, background: 'var(--surface-sunken)', borderRadius: 8, padding: '8px 12px', maxWidth: 340, whiteSpace: 'normal' }}>
                                    <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-xs)', marginBottom: trackData.scans?.length ? 6 : 0 }}>{trackData.status}</div>
                                    {(trackData.scans || []).slice(0, 5).map((s, i) => (
                                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                                        <span style={{ flex: 'none', color: 'var(--text-subtle)', minWidth: 110 }}>{s.time ? new Date(s.time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                        <span>{s.event}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {doc && (
                                  <div style={{ marginTop: 6, fontSize: 'var(--text-2xs)', whiteSpace: 'normal', maxWidth: 340 }}>
                                    {'error' in doc ? (
                                      <span style={{ color: 'var(--status-error)', fontWeight: 700 }}>{doc.error}</span>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        {doc.trackUrl && <a href={doc.trackUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 700 }}>↗ Live tracking link</a>}
                                        {doc.pod?.urls?.length ? doc.pod.urls.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 700 }}>↗ Proof of delivery (PDF)</a>) : <span style={{ color: 'var(--text-muted)' }}>POD available after delivery.</span>}
                                        {doc.pod?.recipient && <span style={{ color: 'var(--text-muted)' }}>Received by {doc.pod.recipient}</span>}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </Table>
                    </>
                  );
                })()}
                {orders === null && <button onClick={() => adminGetOrders().then(setOrders).catch(() => setOrders([]))} style={addBtn}>Load orders</button>}
              </Panel>
              </>
            )}
          </div>
        )}

        {/* ===== Coupons ===== */}
        {tab === 'coupons' && (() => {
          const cq = couponSearch.trim().toLowerCase();
          const regular = (coupons || []).filter(c => c.spinWeight == null);
          const spinCoupons = (coupons || []).filter(c => c.spinWeight != null).sort((a, b) => (b.spinWeight ?? 0) - (a.spinWeight ?? 0));
          const list = regular.filter(c => {
            if (couponStatusFilter && couponStatus(c).text !== couponStatusFilter) return false;
            return !cq || c.code.toLowerCase().includes(cq);
          });
          const selStyle = { ...inp, cursor: 'pointer' } as React.CSSProperties;
          const totalSpinWeight = spinCoupons.filter(c => couponStatus(c).ok).reduce((s, c) => s + (c.spinWeight ?? 0), 0);
          const noRewardChance = Math.max(0, 100 - totalSpinWeight);
          return (
          <>
          <Panel title={`Coupons${coupons ? ` (${list.length})` : ''}`} loading={coupons === null}
            action={<button onClick={() => setCouponForm({ ...EMPTY_COUPON })} style={addBtn}><Plus size={16} /> New coupon</button>}>
            <FilterBar search={couponSearch} onSearch={v => { setCouponSearch(v); setPageOf('coupons', 1); }} placeholder="Search code…" active={!!couponStatusFilter} onClear={() => { setCouponStatusFilter(''); setCouponSearch(''); setPageOf('coupons', 1); }}>
              <Field label="Status"><select value={couponStatusFilter} onChange={e => { setCouponStatusFilter(e.target.value); setPageOf('coupons', 1); }} style={selStyle}><option value="">All</option><option value="Active">Active</option><option value="Expired">Expired</option><option value="Limit reached">Limit reached</option><option value="Disabled">Disabled</option></select></Field>
            </FilterBar>
            <Table head={['Code', 'Discount', 'Min order', 'Valid till', 'Uses', 'Status', '']}>
              {paginate(list, 'coupons').map(c => {
                const st = couponStatus(c);
                return (
                <tr key={c.id}>
                  <td style={td}><strong>{c.code}</strong></td>
                  <td style={td}>{c.discountType === 'PERCENTAGE' ? `${c.discountValue}%${c.maximumDiscount ? ` (max ${money(c.maximumDiscount)})` : ''}` : money(c.discountValue)}</td>
                  <td style={td}>{c.minimumOrderAmount ? money(c.minimumOrderAmount) : '—'}</td>
                  <td style={td}>{c.expiryDate ? fmtDate(c.expiryDate) : 'No expiry'}</td>
                  <td style={td}>{c.timesUsed ?? 0}{c.usageLimit != null ? ` / ${c.usageLimit}` : ''}</td>
                  <td style={td}><Badge text={st.text} ok={st.ok} /></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => editCoupon(c)} aria-label="Edit" style={{ ...iconBtn, marginRight: 6 }}><Pencil size={15} /></button>
                    <button onClick={() => toggleCoupon(c.id)} style={{ ...iconBtn, width: 'auto', padding: '6px 10px', marginRight: 6, fontWeight: 700, fontSize: 'var(--text-xs)' }}>{c.isActive ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => removeCoupon(c.id)} aria-label="Delete" style={{ ...iconBtn, color: 'var(--status-error)' }}><Trash2 size={15} /></button>
                  </td>
                </tr>
                );
              })}
            </Table>
            {coupons && !list.length && <Empty text={coupons.length ? 'No coupons match the filter.' : 'No coupons yet — create one above.'} />}
            <Pager page={pageOf('coupons')} total={list.length} pageSize={PAGE_SIZE} onPage={n => setPageOf('coupons', n)} />
          </Panel>

          {/* ===== Spin Wheel Offers — a separate section: the rewards the Spin & Win wheel can
              award, each with its own odds (weight %), usage limit, active window, and terms. ===== */}
          <div style={{ marginTop: 24 }}>
            <Panel title={`Spin Wheel Offers${coupons ? ` (${spinCoupons.length})` : ''}`} loading={coupons === null}
              action={<button onClick={() => setCouponForm({ ...EMPTY_SPIN_COUPON })} style={addBtn}><Plus size={16} /> New offer</button>}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 6px', lineHeight: 1.5 }}>
                Each offer's <strong>Weight</strong> is its % chance of landing when someone spins. Weights across active offers currently sum to <strong>{totalSpinWeight.toFixed(1)}%</strong> — the remaining <strong>{noRewardChance.toFixed(1)}%</strong> is &quot;Better luck next time&quot;.
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', margin: '0 0 6px', lineHeight: 1.5 }}>
                <strong>How odds are guaranteed:</strong> every 1,000 spins draw from one shuffled batch pre-built to these exact weights (e.g. 5% weight = exactly 50 of the 1,000) — a real ratio per batch, not just an average over time. The batch auto-rebuilds the moment you change a weight here, and again once it runs out.
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', margin: '0 0 14px', lineHeight: 1.5 }}>
                <strong>Anti-abuse:</strong> re-spinning (reload, reopen) doesn't draw again — each device/account gets one locked-in result (win or miss) per 12h window, replayed if they retry, so no one can re-roll for a better prize or burn through other customers' tickets.
              </p>
              <Table head={['Wheel label', 'Code', 'Discount', 'Weight', 'Uses', 'Status', '']}>
                {spinCoupons.map(c => {
                  const st = couponStatus(c);
                  return (
                    <tr key={c.id}>
                      <td style={td}><strong>{c.spinLabel || c.code}</strong></td>
                      <td style={td}>{c.code}</td>
                      <td style={td}>{c.discountType === 'PERCENTAGE' ? `${c.discountValue}%${c.maximumDiscount ? ` (max ${money(c.maximumDiscount)})` : ''}` : money(c.discountValue)}</td>
                      <td style={td}>{(c.spinWeight ?? 0).toFixed(1)}%</td>
                      <td style={td}>{c.timesUsed ?? 0}{c.usageLimit != null ? ` / ${c.usageLimit}` : ''}</td>
                      <td style={td}><Badge text={st.text} ok={st.ok} /></td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button onClick={() => editCoupon(c)} aria-label="Edit" style={{ ...iconBtn, marginRight: 6 }}><Pencil size={15} /></button>
                        <button onClick={() => toggleCoupon(c.id)} style={{ ...iconBtn, width: 'auto', padding: '6px 10px', marginRight: 6, fontWeight: 700, fontSize: 'var(--text-xs)' }}>{c.isActive ? 'Disable' : 'Enable'}</button>
                        <button onClick={() => removeCoupon(c.id)} aria-label="Delete" style={{ ...iconBtn, color: 'var(--status-error)' }}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
              </Table>
              {coupons && !spinCoupons.length && <Empty text="No Spin Wheel offers yet — create one above." />}
            </Panel>
          </div>
          </>
          );
        })()}

        {/* ===== Users ===== */}
        {tab === 'users' && (() => {
          const uq = userSearch.trim().toLowerCase();
          const list = (users || []).filter(u => !uq || u.name.toLowerCase().includes(uq) || (u.email || '').toLowerCase().includes(uq) || (u.phone || '').includes(uq));
          return (
          <Panel title={`Customers${users ? ` (${list.length})` : ''}`} loading={users === null}>
            <FilterBar search={userSearch} onSearch={v => { setUserSearch(v); setPageOf('users', 1); }} placeholder="Search name, email, phone…" active={false} onClear={() => { setUserSearch(''); setPageOf('users', 1); }} />
            <Table head={['Name', 'Email', 'Phone', 'Address', 'Last login from', 'Orders', 'Joined']}>
              {paginate(list, 'users').map(u => {
                const addr = u.addresses?.find(a => a.isDefault) || u.addresses?.[0];
                const addrText = addr ? [addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') : '';
                return (
                <tr key={u.id}>
                  <td style={td}><strong>{u.name}</strong></td>
                  <td style={td}>{u.email || '—'}</td>
                  <td style={td}>{u.phone || '—'}</td>
                  <td style={{ ...td, maxWidth: 280, whiteSpace: 'normal', lineHeight: 1.4 }}>
                    {addr ? (
                      <span title={addrText}>
                        {addrText}
                        {(u.addresses?.length || 0) > 1 && <span style={{ color: 'var(--text-subtle)', fontWeight: 700 }}> · +{(u.addresses!.length - 1)} more</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={td}>{u.lastLoginLocation || '—'}</td>
                  <td style={td}>{u.orderCount}</td>
                  <td style={td}>{fmtDate(u.createdAt)}</td>
                </tr>
                );
              })}
            </Table>
            {users && !list.length && <Empty text={users.length ? 'No customers match the search.' : 'No customers yet.'} />}
            <Pager page={pageOf('users')} total={list.length} pageSize={PAGE_SIZE} onPage={n => setPageOf('users', n)} />
          </Panel>
          );
        })()}

        {/* ===== Messages ===== */}
        {tab === 'messages' && (() => {
          const mq = messageSearch.trim().toLowerCase();
          const list = (messages || []).filter(m => {
            if (messageHandled === 'open' && m.handled) return false;
            if (messageHandled === 'done' && !m.handled) return false;
            if (!mq) return true;
            return m.name.toLowerCase().includes(mq) || (m.email || '').toLowerCase().includes(mq) || m.message.toLowerCase().includes(mq);
          });
          const clear = () => { setMessageHandled(''); setMessageSearch(''); setPageOf('messages', 1); };
          const selStyle = { ...inp, cursor: 'pointer' } as React.CSSProperties;
          return (
          <Panel title={`Contact messages${messages ? ` (${list.length})` : ''}`} loading={messages === null}>
            <FilterBar search={messageSearch} onSearch={v => { setMessageSearch(v); setPageOf('messages', 1); }} placeholder="Search sender or message…" active={!!messageHandled} onClear={clear}>
              <Field label="Status"><select value={messageHandled} onChange={e => { setMessageHandled(e.target.value); setPageOf('messages', 1); }} style={selStyle}><option value="">All messages</option><option value="open">Unhandled only</option><option value="done">Handled only</option></select></Field>
            </FilterBar>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {paginate(list, 'messages').map(m => (
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
            {messages && !list.length && <Empty text={messages.length ? 'No messages match the filter.' : 'No messages yet.'} />}
            <Pager page={pageOf('messages')} total={list.length} pageSize={PAGE_SIZE} onPage={n => setPageOf('messages', n)} />
          </Panel>
          );
        })()}
      </div>

      {/* Create-coupon modal */}
      {couponForm && (
        <div onClick={() => setCouponForm(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(480px,96vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: 24 }} className="hide-sb">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ flex: 1, fontSize: 'var(--text-h3)' }}>{couponForm.editId != null ? 'Edit' : 'New'} {couponForm.isSpin ? 'Spin Wheel offer' : 'coupon'}</h3>
              <button onClick={() => setCouponForm(null)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Code"><input style={inp} value={couponForm.code} onChange={e => setCouponForm(f => f && ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="WELCOME10" /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Discount type"><select style={{ ...inp, cursor: 'pointer' }} value={couponForm.discountType} onChange={e => setCouponForm(f => f && ({ ...f, discountType: e.target.value as 'PERCENTAGE' | 'FIXED' }))}><option value="PERCENTAGE">Percentage (%)</option><option value="FIXED">Fixed (₹)</option></select></Field>
                <Field label={couponForm.discountType === 'PERCENTAGE' ? 'Percent off' : 'Amount off (₹)'}><input style={inp} type="number" min="0" value={couponForm.discountValue} onChange={e => setCouponForm(f => f && ({ ...f, discountValue: e.target.value }))} /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Min order (₹)"><input style={inp} type="number" min="0" value={couponForm.minimumOrderAmount} onChange={e => setCouponForm(f => f && ({ ...f, minimumOrderAmount: e.target.value }))} placeholder="Optional" /></Field>
                <Field label="Max discount (₹)"><input style={inp} type="number" min="0" value={couponForm.maximumDiscount} onChange={e => setCouponForm(f => f && ({ ...f, maximumDiscount: e.target.value }))} placeholder="Optional cap" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Valid for (days)"><input style={inp} type="number" min="1" value={couponForm.validDays} onChange={e => setCouponForm(f => f && ({ ...f, validDays: e.target.value }))} placeholder="Blank = no expiry" /></Field>
                <Field label="Total uses limit"><input style={inp} type="number" min="1" value={couponForm.usageLimit} onChange={e => setCouponForm(f => f && ({ ...f, usageLimit: e.target.value }))} placeholder="Blank = unlimited" /></Field>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>The coupon auto-stops when it expires or hits its use limit — no need to disable it manually.</p>

              <button type="button" onClick={() => setCouponForm(f => f && ({ ...f, isSpin: !f.isSpin }))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center', border: couponForm.isSpin ? 'none' : '2px solid var(--border-strong)', background: couponForm.isSpin ? 'var(--gradient-warm)' : 'transparent', color: 'var(--white)', flex: 'none' }}>{couponForm.isSpin && <Check size={13} strokeWidth={3} />}</span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>Show on the Spin &amp; Win wheel</span>
              </button>

              {couponForm.isSpin && (
                <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 'var(--radius-card)', background: 'var(--surface-raised)', border: '1px solid var(--border-soft)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Wheel label"><input style={inp} value={couponForm.spinLabel} onChange={e => setCouponForm(f => f && ({ ...f, spinLabel: e.target.value }))} placeholder="e.g. Free Cookie Tin" /></Field>
                    <Field label="Weight — odds (%)"><input style={inp} type="number" min="0" max="100" step="0.01" value={couponForm.spinWeight} onChange={e => setCouponForm(f => f && ({ ...f, spinWeight: e.target.value }))} placeholder="e.g. 5" /></Field>
                  </div>
                  <Field label="Terms & conditions (shown to shoppers)">
                    <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={couponForm.terms} onChange={e => setCouponForm(f => f && ({ ...f, terms: e.target.value }))} placeholder="e.g. Valid on orders of ₹200 or more. One reward per account. Cannot be combined with other offers." />
                  </Field>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={saveCoupon} style={{ ...addBtn, flex: 1, justifyContent: 'center' }}>{couponForm.editId != null ? 'Save changes' : couponForm.isSpin ? 'Create offer' : 'Create coupon'}</button>
                <button onClick={() => setCouponForm(null)} style={{ ...iconBtn, width: 'auto', padding: '0 16px', fontWeight: 700 }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <input style={inp} value={whForm.data.pickupLocation} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, pickupLocation: e.target.value } })} placeholder="e.g. A Dough Cookie" />
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
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <Badge text={o.orderStatus} />
                <Badge text={o.paymentStatus} ok={o.paymentStatus === 'PAID'} />
                {o.warningFlags?.includes('DUPLICATE_CHARGE') && (
                  <span style={{ padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: 'var(--status-danger-bg, #FCEBEA)', color: 'var(--status-danger, #C0392B)', fontSize: 'var(--text-xs)', fontWeight: 800 }}>
                    ⚠ Possible duplicate charge — check Razorpay
                  </span>
                )}
              </div>

              <div style={{ ...card, padding: 14, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: giftOpts ? 'var(--gradient-warm)' : 'var(--surface-sunken)', display: 'grid', placeItems: 'center', flex: 'none' }}>{giftOpts ? <Gift size={18} style={{ color: 'var(--white)' }} /> : <Package size={18} color="var(--text-muted)" />}</span>
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

              {/* Shipment — read-only summary; create/cancel/label live in the Delivery tab (no duplication) */}
              {(() => {
                const modalTrack = trackResult[o.id] as { status?: string; note?: string; scans?: { time: string; event: string }[] } | undefined;
                const service = o.carrier === 'SHADOWFAX' ? 'Intracity (Shadowfax)' : o.carrier === 'DELHIVERY' ? 'Intercity (Delhivery)' : null;
                return (
                  <div style={{ ...card, padding: 14, marginBottom: 14 }}>
                    <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>Shipment</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Badge text={o.shipmentStatus || 'NOT_CREATED'} ok={o.shipmentStatus === 'CREATED' || o.shipmentStatus === 'DELIVERED'} />
                      {service && <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>{service}</span>}
                      {o.delhiveryWaybill && <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>{o.delhiveryWaybill}</span>}
                    </div>
                    {o.delhiveryWaybill ? (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <button onClick={async () => {
                          const r = await adminTrackOrder(o.id).catch(() => null);
                          if (!r?.ok) return;
                          if (r.carrier === 'SHADOWFAX') {
                            setTrackResult(p => ({ ...p, [o.id]: { status: r.status || 'No status', note: '', scans: r.scans || [] } }));
                          } else {
                            type ShipmentData = { ShipmentData?: { Shipment?: { Status?: { Status?: string; Instructions?: string }; Scans?: { ScanDetail?: { ScanDateTime?: string; Instructions?: string; Scan?: string } }[] } }[] };
                            const shipment = (r.data as ShipmentData)?.ShipmentData?.[0]?.Shipment;
                            const scans = (shipment?.Scans || []).map(s => ({ time: s.ScanDetail?.ScanDateTime || '', event: [s.ScanDetail?.Scan, s.ScanDetail?.Instructions].filter(Boolean).join(' — ') })).reverse();
                            setTrackResult(p => ({ ...p, [o.id]: { status: shipment?.Status?.Status || 'No status', note: shipment?.Status?.Instructions || '', scans } }));
                          }
                        }} style={{ ...addBtn, padding: '8px 14px', fontSize: 'var(--text-sm)', background: 'var(--surface-raised)', color: 'var(--text-strong)', border: '1.5px solid var(--border-default)' }}><ExternalLink size={14} /> Track</button>
                      </div>
                    ) : (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '10px 0 0' }}>Not shipped yet — create, cancel or download the label from the <strong>Delivery</strong> tab.</p>
                    )}
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
const addBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' };
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'inline-grid', placeItems: 'center', color: 'var(--text-body)', marginRight: 6 };

/* ---------- Charts (lightweight inline SVG/CSS — no external deps) ---------- */
const PIE = ['var(--orange-cta)', 'var(--green-success)', 'var(--google-blue)', 'var(--purple)', 'var(--orange-dark)', 'var(--gray)'];

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
            <stop offset="0%" style={{ stopColor: 'var(--orange-cta)' }} stopOpacity="0.35" />
            <stop offset="100%" style={{ stopColor: 'var(--orange-cta)' }} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(g => <line key={g} x1={pl} x2={W - pr} y1={pt + g * (H - pt - pb)} y2={pt + g * (H - pt - pb)} stroke="var(--border-soft)" strokeWidth="1" />)}
        <path d={area} fill="url(#salesfill)" />
        <path d={line} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: 'var(--orange-cta)' }} />
        {max > 1 && <circle cx={x(peakI)} cy={y(data[peakI].revenue)} r="4" strokeWidth="2" style={{ fill: 'var(--orange-cta)', stroke: 'var(--white)' }} />}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 2 }}>
        <span>{fmtDay(data[0].day)}</span>
        <span>Peak {money(data[peakI].revenue)} · {fmtDay(data[peakI].day)}</span>
        <span>{fmtDay(data[n - 1].day)}</span>
      </div>
    </div>
  );
}

function BarRows({ items, color = 'var(--orange-cta)' }: { items: { label: string; value: number; sub?: string }[]; color?: string }) {
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
            const el = <circle key={s.label} cx="65" cy="65" r={r} fill="none" strokeWidth={sw} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} style={{ stroke: s.color }} />;
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

function StatCard({ icon, label, value, sub, accent, onClick }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} style={{ ...card, padding: 18, cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={onClick ? (e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }) : undefined}
      onMouseLeave={onClick ? (e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }) : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, background: accent ? 'var(--brand-secondary)' : 'var(--amber-50)', color: accent ? 'var(--white)' : 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none' }}>{icon}</span>
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

// Search box + a compact "Filters" popover (the filter symbol reveals the extra filters inside).
function FilterBar({ search, onSearch, placeholder, onClear, active, children }: { search: string; onSearch: (v: string) => void; placeholder: string; onClear: () => void; active: boolean; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input style={{ ...inp, paddingLeft: 34 }} placeholder={placeholder} value={search} onChange={e => onSearch(e.target.value)} />
      </div>
      {children && (
        <div style={{ position: 'relative' }}>
          <button onClick={() => setOpen(o => !o)} aria-label="Filters" style={{ ...iconBtn, width: 'auto', padding: '0 14px', height: 40, marginRight: 0, display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 'var(--text-sm)', color: active ? 'var(--brand-secondary)' : 'var(--text-body)', borderColor: active ? 'var(--brand-secondary)' : 'var(--border-default)' }}>
            <Filter size={15} /> Filters{active ? ' •' : ''}
          </button>
          {open && (<>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 31, width: 250, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-md)', padding: 14, display: 'grid', gap: 12 }}>
              {children}
              <button onClick={() => { onClear(); setOpen(false); }} style={{ ...iconBtn, width: '100%', padding: '8px', marginRight: 0, fontWeight: 700, fontSize: 'var(--text-sm)' }}>Clear all</button>
            </div>
          </>)}
        </div>
      )}
      {!children && active && <button onClick={onClear} style={{ ...iconBtn, width: 'auto', padding: '0 12px', marginRight: 0, fontSize: 'var(--text-xs)', fontWeight: 700 }}>Clear</button>}
    </div>
  );
}

// Prev/next pager. Renders nothing when everything fits on one page.
function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1, to = Math.min(total, page * pageSize);
  const btn = (disabled: boolean): React.CSSProperties => ({ ...iconBtn, width: 'auto', padding: '0 12px', height: 34, marginRight: 0, opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 'var(--text-sm)' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{from}–{to} of {total}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} style={btn(page <= 1)}>Prev</button>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} style={btn(page >= pages)}>Next</button>
      </div>
    </div>
  );
}
