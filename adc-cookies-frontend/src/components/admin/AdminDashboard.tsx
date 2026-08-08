'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LoginModal from '@/components/ordering/LoginModal';
import {
  adminDashboard, adminAnalytics, adminGetOrders, adminUpdateOrderStatus, adminGetProducts,
  adminGetSettings, adminSetPromoProduct, adminSetHeaderOffer, adminSetStallInfo,
  adminCreateProduct, adminUpdateProduct, adminDeleteProduct, adminGetCoupons,
  adminCreateCoupon, adminUpdateCoupon, adminToggleCoupon, adminDeleteCoupon, adminResetAllSpins, adminGetUsers, adminGetMessages, adminMarkMessageHandled,
  adminGetWarehouses, adminCreateWarehouse, adminUpdateWarehouse, adminSetDefaultWarehouse,
  adminToggleWarehouse, adminCreateShipment, adminCancelShipment,
  adminTrackOrder, openLabel, adminCreatePickupRequest, adminFetchOrderDocument,
  adminAttention, adminRebookShipment, adminRetryPosRelay, adminGetStoreReadiness,
  adminGetPetpoojaMapping, adminCreateProductFromPetpooja, adminGetPetpoojaRelays, adminLinkProductToPetpooja,
  adminGetStores, adminCreateStoreStaff, adminSetStoreStaffPassword, adminToggleStoreStaff, adminDeleteStoreStaff,
  adminSetDeliveryFeeOutstation, adminGetStoreStatus, adminToggleStoreStatus, adminGetStoreProducts, adminSetStoreProductOverride,
  type AdminStats, type AdminAnalytics, type AdminUser, type AdminCoupon, type CouponInput, type AdminMessage,
  type Product, type Order, type ProductInput, type Warehouse, type WarehouseInput,
  type AttentionReport, type StoreReadinessReport, type PetpoojaMapping, type PetpoojaRelay, type PetpoojaItem,
  type AdminStoresReport, type AdminStore, type AdminStoreStatus, type AdminStoreProduct,
} from '@/lib/api';
import {
  LayoutDashboard, ShoppingBag, Package, Ticket, Users, MessageSquare,
  IndianRupee, Plus, Pencil, Trash2, Check, X, LogOut, Gift,
  Truck, Warehouse as WarehouseIcon, Star, ToggleLeft, ToggleRight, ExternalLink, RefreshCw, Download, Search, Filter, CalendarRange,
  FileText, AlertTriangle, Store as StoreIcon, KeyRound,
} from 'lucide-react';

/*
 * Shiprocket Hyperlocal tracking statuses and what each one does to the order. Mirrors
 * shiprocketStatusToOrderStatus() in adc-cookies-backend-node/src/shiprocket.js — if that mapping
 * changes, change this too, since this table is what an operator trusts when reading a status.
 */
const SR_ORDER_STATES = [
  { id: 'RIDER ASSIGNED', status: 'PACKED', description: 'A rider has been allocated. Nothing has left the store yet.' },
  { id: 'PICKUP SCHEDULED', status: 'PACKED', description: 'Collection is booked; the rider is on the way to the store.' },
  { id: 'AWB ASSIGNED', status: 'PACKED', description: 'The tracking number exists. Assignment is asynchronous, so this can lag the order by a minute or two.' },
  { id: 'PICKED UP', status: 'OUT_FOR_DELIVERY', description: 'The rider has collected the order from the store.' },
  { id: 'IN TRANSIT', status: 'OUT_FOR_DELIVERY', description: 'On the way to the customer.' },
  { id: 'OUT FOR DELIVERY', status: 'OUT_FOR_DELIVERY', description: 'On the final leg to the drop address.' },
  { id: 'RIDER REACHED DROP', status: '(no change)', description: 'The rider is at the door. Deliberately not marked delivered — at the door is not delivered.' },
  { id: 'DELIVERED', status: 'DELIVERED', description: 'Handed to the customer. Terminal state.' },
  { id: 'CANCELLED / RTO', status: 'CANCELLED', description: 'Cancelled, or returned to origin.' },
];

const ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

const PAGE_SIZE = 12; // rows per page in admin list tables
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'stores', label: 'Stores', icon: StoreIcon },
  { id: 'petpooja', label: 'Petpooja', icon: FileText },
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

const EMPTY_PRODUCT: ProductInput = { name: '', category: 'COOKIES', description: '', price: 0, stockQuantity: 0, menuGroup: '', tag: '', featured: false, isAvailable: true, images: '', intracityAvailable: true, intracityUnavailableReason: '', intercityAvailable: true, intercityUnavailableReason: '', restrictCities: '' };

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
  const [deliveryFeeOutstation, setDeliveryFeeOutstation] = useState('100');
  const [deliveryFeeSaved, setDeliveryFeeSaved] = useState(false);
  const [coupons, setCoupons] = useState<AdminCoupon[] | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [messages, setMessages] = useState<AdminMessage[] | null>(null);
  const [editing, setEditing] = useState<{ id?: number; data: ProductInput } | null>(null);
  const [couponForm, setCouponForm] = useState<CouponDraft | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [attention, setAttention] = useState<AttentionReport | null>(null);
  // Outcome of a cancel — shown as a modal rather than a banner, because a REFUSED cancel means a
  // rider is still coming and must not be something you can scroll past.
  const [cancelInfo, setCancelInfo] = useState<{ orderNumber: string; ok: boolean; message: string } | null>(null);
  const [fixing, setFixing] = useState<number | null>(null);   // order id currently being re-booked/re-relayed
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
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
  const [delivSub, setDelivSub] = useState<'main' | 'sameday' | 'delhivery'>('main');
  const [storeReadiness, setStoreReadiness] = useState<StoreReadinessReport | null>(null);
  const [ppMap, setPpMap] = useState<PetpoojaMapping | null>(null);
  const [ppRelays, setPpRelays] = useState<PetpoojaRelay[] | null>(null);
  const [ppBusy, setPpBusy] = useState<string | null>(null);   // "itemId|variationId" being saved
  const [ppSearch, setPpSearch] = useState('');
  const [ppOnlyUnlinked, setPpOnlyUnlinked] = useState(false);
  const [sfxStatesOpen, setSfxStatesOpen] = useState(false);

  // Stores tab
  const [storeReport, setStoreReport] = useState<AdminStoresReport | null>(null);
  const [staffBusy, setStaffBusy] = useState<number | null>(null);

  const EMPTY_WH: WarehouseInput = { name: '', registeredName: '', pickupLocation: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', returnPincode: '', phone: '', email: '', isDefault: false, skipDelhivery: false };

  const isAdmin = !!user && user.role === 'ADMIN';

  useEffect(() => { if (isAdmin) adminDashboard().then(setStats).catch(e => setErr(String(e.message || e))); }, [isAdmin]);
  useEffect(() => { if (isAdmin) adminGetSettings().then(s => { setPromoProductId(s.promoProductId); setHeaderOffer(s.headerOffer || ''); setStallInfo(s.stallInfo || ''); setDeliveryFeeOutstation(String(s.deliveryFeeOutstation ?? 100)); }).catch(() => {}); }, [isAdmin]);
  useEffect(() => { if (isAdmin) adminAnalytics(range.from, range.to).then(setAnalytics).catch(() => {}); }, [isAdmin, range.from, range.to]);
  // Loaded on every admin visit, not lazily per tab: an order that took money but never reached the
  // kitchen or a courier is the one thing that must not wait for someone to click the right tab.
  useEffect(() => { if (isAdmin) adminAttention().then(setAttention).catch(() => {}); }, [isAdmin]);

  // Lazy-load each tab's data the first time it's opened.
  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'orders' && orders === null) adminGetOrders().then(setOrders).catch(() => setOrders([]));
    if (tab === 'products' && products === null) adminGetProducts().then(setProducts).catch(() => setProducts([]));
    if (tab === 'coupons' && coupons === null) adminGetCoupons().then(setCoupons).catch(() => setCoupons([]));
    if (tab === 'users' && users === null) adminGetUsers().then(setUsers).catch(() => setUsers([]));
    if (tab === 'messages' && messages === null) adminGetMessages().then(setMessages).catch(() => setMessages([]));
    if (tab === 'petpooja') {
      if (ppMap === null) adminGetPetpoojaMapping().then(setPpMap).catch(() => setPpMap(null));
      if (ppRelays === null) adminGetPetpoojaRelays().then(setPpRelays).catch(() => setPpRelays([]));
    }
    if (tab === 'delivery') {
      if (warehouses === null) adminGetWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
      if (orders === null) adminGetOrders().then(setOrders).catch(() => setOrders([]));
      if (storeReadiness === null) adminGetStoreReadiness().then(setStoreReadiness).catch(() => setStoreReadiness(null));
    }
    if (tab === 'stores' && storeReport === null) adminGetStores().then(setStoreReport).catch(() => setStoreReport(null));
  }, [tab, isAdmin, orders, products, coupons, users, messages, storeReadiness, ppMap, ppRelays, storeReport]);

  const refreshProducts = useCallback(() => { adminGetProducts().then(setProducts).catch(() => {}); adminDashboard().then(setStats).catch(() => {}); }, []);

  const refreshAttention = useCallback(() => { adminAttention().then(setAttention).catch(() => {}); }, []);

  const changeOrderStatus = async (id: number, status: string) => {
    const updated = await adminUpdateOrderStatus(id, status).catch(() => null);
    if (!updated) return;
    setOrders(o => (o || []).map(x => x.id === id ? updated : x));
    adminDashboard().then(setStats).catch(() => {});
    refreshAttention();
    // Cancelling also cancels the POS ticket and the courier booking. If either refused, say so
    // loudly — otherwise the operator assumes the rider was called off when they were not.
    if (updated.cancelWarnings?.length) {
      setCancelInfo({ orderNumber: updated.orderNumber, ok: false, message: updated.cancelWarnings.join(String.fromCharCode(10, 10)) });
    }
  };

  /** Retry the automatic courier booking for a paid order that never got one. */
  const rebookShipment = async (id: number) => {
    setFixing(id); setErr(''); setNotice('');
    try {
      const r = await adminRebookShipment(id);
      setNotice(`Courier booked — ${r.carrier} ${r.waybill}`);
      // Refresh the open modal too, or it keeps showing the failure that was just fixed.
      adminGetOrders().then(list => { setOrders(list); setViewOrder(v => (v ? list.find(x => x.id === v.id) ?? v : v)); }).catch(() => {});
      refreshAttention();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not book a courier');
    } finally { setFixing(null); }
  };

  /** Push a paid order to the Petpooja POS again — after fixing an item mapping, typically. */
  const retryPosRelay = async (id: number) => {
    setFixing(id); setErr(''); setNotice('');
    try {
      const r = await adminRetryPosRelay(id);
      if (r.ok) setNotice(r.skipped ? 'Already on the POS.' : 'Sent to the Petpooja POS.');
      else setErr(`POS refused it: ${r.reason}`);
      // Refresh the open modal too, or it keeps showing the failure that was just fixed.
      adminGetOrders().then(list => { setOrders(list); setViewOrder(v => (v ? list.find(x => x.id === v.id) ?? v : v)); }).catch(() => {});
      refreshAttention();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not reach the POS');
    } finally { setFixing(null); }
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
  const [resettingSpins, setResettingSpins] = useState(false);
  const resetAllSpins = async () => {
    if (!confirm("Reset every customer's spin? It's one spin per customer — this lets everyone play again, effective immediately.")) return;
    setResettingSpins(true);
    try {
      const r = await adminResetAllSpins();
      alert(`Done — ${r.cleared} spin record(s) cleared. Everyone can spin again.`);
    } catch {
      alert('Could not reset spins right now — please try again.');
    } finally {
      setResettingSpins(false);
    }
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
        {err && <div onClick={() => setErr('')} style={{ ...card, padding: '12px 16px', marginBottom: 16, color: 'var(--status-error)', borderColor: 'var(--status-error)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>{err}</div>}
        {notice && <div onClick={() => setNotice('')} style={{ ...card, padding: '12px 16px', marginBottom: 16, color: 'var(--status-success, #1a7f4b)', borderColor: 'var(--status-success, #1a7f4b)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>{notice}</div>}

        {/* Needs attention — orders that took money but did not complete downstream. Sits above the
            tabs because it applies to every screen, and is hidden entirely when there is nothing. */}
        {!!attention?.total && <AttentionPanel report={attention} busy={fixing} onRebook={rebookShipment} onRetryPos={retryPosRelay} onOpen={id => { const o = (orders || []).find(x => x.id === id); if (o) setViewOrder(o); else { setTab('orders'); setOrderSearch(String(id)); } }} onRefresh={refreshAttention} />}

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
                <Field label="Carrier"><select value={orderCarrier} onChange={e => { setOrderCarrier(e.target.value); setPageOf('orders', 1); }} style={selStyle}><option value="">All carriers</option><option value="SHIPROCKET">Shiprocket (intracity)</option><option value="DELHIVERY">Delhivery (outstation)</option></select></Field>
                <Field label="Payment"><select value={orderPayment} onChange={e => { setOrderPayment(e.target.value); setPageOf('orders', 1); }} style={selStyle}><option value="">Any payment</option><option value="PAID">Paid</option><option value="PENDING">Pending</option></select></Field>
              </FilterBar>
              <Table head={['Order', 'Customer', 'Total', 'Payment', 'Shipment', 'POS', 'Status', 'Date']}>
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
                    <td style={td}>
                      <Badge text={o.shipmentStatus || 'NOT_CREATED'} ok={o.shipmentStatus === 'CREATED' || o.shipmentStatus === 'DELIVERED'} />
                      {/* A paid order with no courier is money taken for an undelivered parcel — say why. */}
                      {o.shipmentError && !o.delhiveryWaybill && (
                        <div title={o.shipmentError} style={{ color: 'var(--status-error)', fontSize: 'var(--text-2xs)', fontWeight: 700, marginTop: 3, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.shipmentError}</div>
                      )}
                    </td>
                    {/* Did the kitchen actually get this ticket? Blank for unpaid orders, which are
                        never relayed by design, so a dash there is correct rather than a failure. */}
                    <td style={td}>
                      {o.paymentStatus !== 'PAID' ? <span style={{ color: 'var(--text-subtle)' }}>—</span>
                        : o.pos?.relayed ? <Badge text="On POS" ok />
                        : <span title={o.pos?.lastError || 'Not sent to the POS yet.'}><Badge text={o.pos ? 'FAILED' : 'NOT SENT'} /></span>}
                    </td>
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
          <Panel title="Delivery fee — outstation">
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '0 0 12px' }}>
              What a customer pays for outstation (Delhivery) delivery. Same-day intracity is never set here —
              that&apos;s charged exactly what Shiprocket quotes for each address, live at checkout.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>₹</span>
              <input
                type="number" min="0" step="1"
                value={deliveryFeeOutstation}
                onChange={e => { setDeliveryFeeOutstation(e.target.value); setDeliveryFeeSaved(false); }}
                style={{ ...inp, width: 120 }}
              />
              <button
                onClick={async () => {
                  const n = Number(deliveryFeeOutstation);
                  if (!Number.isFinite(n) || n < 0) { setErr('Enter a valid, non-negative delivery fee.'); return; }
                  await adminSetDeliveryFeeOutstation(n).catch(err => setErr(String(err.message || err)));
                  setDeliveryFeeSaved(true);
                }}
                style={addBtn}
              >{deliveryFeeSaved ? 'Saved ✓' : 'Save'}</button>
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
                  <td style={td}>
                    <strong>{p.name}</strong>
                    {!p.intracityAvailable && (
                      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--status-error)', fontWeight: 800, marginTop: 2 }}>
                        Intracity off{p.intracityUnavailableReason ? ` — ${p.intracityUnavailableReason}` : ''}
                      </div>
                    )}
                    {!p.intercityAvailable && (
                      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--status-error)', fontWeight: 800, marginTop: 2 }}>
                        Intercity off{p.intercityUnavailableReason ? ` — ${p.intercityUnavailableReason}` : ''}
                      </div>
                    )}
                    {p.intracityAvailable && p.restrictCities && (
                      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>
                        Intracity restricted to {p.restrictCities}
                      </div>
                    )}
                  </td>
                  <td style={td}>{p.category}</td>
                  <td style={td}>{money(p.price)}</td>
                  <td style={td}><span style={{ color: p.stockQuantity <= 10 ? 'var(--status-error)' : 'var(--text-body)', fontWeight: p.stockQuantity <= 10 ? 800 : 400 }}>{p.stockQuantity}</span></td>
                  <td style={td}>{p.tag || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => setEditing({ id: p.id, data: { name: p.name, category: p.category, description: p.description, price: p.price, stockQuantity: p.stockQuantity, images: p.images, options: p.options, isAvailable: p.isAvailable, menuGroup: p.menuGroup, tag: p.tag, featured: p.featured, intracityAvailable: p.intracityAvailable, intracityUnavailableReason: p.intracityUnavailableReason || '', intercityAvailable: p.intercityAvailable, intercityUnavailableReason: p.intercityUnavailableReason || '', restrictCities: p.restrictCities || '' } })} aria-label="Edit" style={iconBtn}><Pencil size={15} /></button>
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

            {/* Sub-nav: all shipments · same-day intracity · Delhivery outstation */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([['main', 'All shipments'], ['sameday', 'Same-day · Intracity'], ['delhivery', 'Delhivery · Outstation']] as const).map(([id, label]) => {
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
                Intracity needs no pickup request — Shiprocket dispatches a rider to the store automatically once the order is confirmed.
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
                  // The backend translates Delhivery's terse refusals — a wallet under the Rs.500
                  // minimum, or a slot already open for this warehouse today — into a sentence worth
                  // reading, so prefer it over the raw reason.
                  setPurResult(r.ok
                    ? `Pickup scheduled for ${purDate} at ${purTime} · ${purCount} package(s). Delhivery sometimes moves the date — check their panel to confirm the slot.`
                    : `Error: ${(r as { ok: boolean; reason?: string }).reason}`);
                }} disabled={!purDate || !purTime} style={{ ...addBtn, opacity: !purDate ? 0.5 : 1 }}>Request pickup</button>
              </div>
              {purResult && <div style={{ marginTop: 10, fontSize: 'var(--text-sm)', color: purResult.startsWith('Error') ? 'var(--status-error)' : 'var(--status-success)', fontWeight: 700 }}>{purResult}</div>}

              {/* Delhivery's rules, from their own Pickup Request Creation docs. An earlier version
                  of this box claimed the waybills had to be attached by hand in their panel and that
                  a pickup with none attached collects nothing. That was wrong: their documentation
                  states the request is raised against the WAREHOUSE, not the waybill, and one
                  request therefore covers every parcel ready at that location. */}
              <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--amber-50)', border: '1px solid var(--border-brand)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <AlertTriangle size={16} style={{ color: 'var(--brand-secondary)', flex: 'none', marginTop: 2 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-strong)', marginBottom: 6 }}>
                      How Delhivery pickups work
                    </div>
                    <ul style={{ fontSize: 'var(--text-xs)', color: 'var(--text-body)', lineHeight: 1.7, margin: '0 0 8px', paddingLeft: 18 }}>
                      <li><strong>One request covers every parcel at this warehouse.</strong> It is raised against the pickup location, not against waybills — you do not need one request per shipment.</li>
                      <li><strong>Only one open request per warehouse per day.</strong> A second can be raised only after the existing one is closed, so schedule once the day&apos;s parcels are ready rather than per order.</li>
                      <li><strong>Raise it when the parcels are packed</strong> and ready to hand to the field executive — not at the moment the order is placed.</li>
                      <li><strong>Count</strong> is how many packages the rider should collect. Use the button above to fill in the {Math.max(1, pending.length)} awaiting pickup.</li>
                      <li>Each parcel needs its <strong>shipping label</strong> printed — recipient address and scannable tracking barcode. Download them from the shipments list.</li>
                      <li>Parcels at a <strong>different location</strong> need their own request from that warehouse.</li>
                      <li><strong>Your Delhivery wallet must hold at least ₹500</strong> or the request is rejected. This applies to Prepaid and COD alike — confirmed live. Shipment creation also debits the wallet at the time the parcel is created, not on delivery.</li>
                      <li>Delhivery may <strong>move the date</strong> you ask for — a request for one day has come back scheduled for the next. Check the confirmation rather than assuming the slot you chose.</li>
                    </ul>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 8px' }}>
                      This step is optional: your Delhivery account POC can enable <strong>auto-pickup</strong>, after which collections are
                      scheduled for you and this panel is only needed for an ad-hoc slot. Delhivery has no cancel-pickup API, so cancelling
                      is done in their panel.
                    </p>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <a href="https://one.delhivery.com/v2/pickup-requests/domestic" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--brand-secondary)' }}>
                        <ExternalLink size={13} /> Open pickup requests
                      </a>
                      <a href="https://one.delhivery.com/v2/pickup-requests/domestic" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--status-error)' }}
                        title="Delhivery provides no cancel-pickup API — cancel it from their panel">
                        <X size={13} /> Cancel a pickup request
                      </a>
                    </div>
                  </div>
                </div>
              </div>
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
                    const service = o.carrier === 'SHIPROCKET' ? { kind: 'Intracity', name: 'Shiprocket' }
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
                        <td style={td}><Badge text={shipStatusLabel(o.shipmentStatus)} ok={o.shipmentStatus === 'DELIVERED'} /></td>
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
                            /* Labelled pills rather than bare icons — four unlabelled glyphs in a row
                               gave no clue which one cancelled a shipment. */
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {o.carrier === 'DELHIVERY' && <button onClick={() => openLabel(o.delhiveryWaybill!).catch(e => setErr(String(e.message || e)))} style={actionBtn()} title="Download the shipping label PDF"><Download size={13} /> Label</button>}
                              {o.carrier === 'DELHIVERY' && (
                                <button title="Proof of delivery / signature (available after delivery)" onClick={async () => {
                                  setErr('');
                                  for (const t of ['EPOD', 'SIGNATURE_URL'] as const) {
                                    const r = await adminFetchOrderDocument(o.id, t).catch(() => null);
                                    if (r?.ok && r.url) { window.open(r.url, '_blank', 'noopener'); return; }
                                  }
                                  setErr('No proof-of-delivery document available yet — Delhivery provides it after delivery.');
                                }} style={actionBtn()}><FileText size={13} /> POD</button>
                              )}
                              <button title="Fetch the latest carrier status" onClick={async () => {
                                const r = await adminTrackOrder(o.id).catch(() => null);
                                if (!r?.ok) { if (r) setTrackResult(p => ({ ...p, [o.id]: { status: `Error: ${r.reason || 'unknown'}` } })); return; }
                                if (r.carrier === 'SHIPROCKET') {
                                  setTrackResult(p => ({ ...p, [o.id]: { status: r.status || 'No status', note: '', scans: r.scans || [] } }));
                                } else {
                                  type ShipmentData = { ShipmentData?: { Shipment?: { Status?: { Status?: string; Instructions?: string }; Scans?: { ScanDetail?: { ScanDateTime?: string; Instructions?: string; Scan?: string } }[] } }[] };
                                  const shipment = (r.data as ShipmentData)?.ShipmentData?.[0]?.Shipment;
                                  const scans = (shipment?.Scans || []).map(s => ({ time: s.ScanDetail?.ScanDateTime || '', event: [s.ScanDetail?.Scan, s.ScanDetail?.Instructions].filter(Boolean).join(' — ') })).reverse();
                                  setTrackResult(p => ({ ...p, [o.id]: { status: shipment?.Status?.Status || 'No status', note: shipment?.Status?.Instructions || '', scans } }));
                                }
                              }} style={actionBtn()}><ExternalLink size={13} /> Status</button>
                              {o.shipmentStatus !== 'CANCELLED' && (
                                <button disabled={shipmentBusy === o.id} onClick={async () => {
                                  // For Shiprocket the AWB only exists once a real rider has been
                                  // found — so its presence means someone is already on their way
                                  // AND the delivery charge has been taken. That is a different
                                  // decision from cancelling a booking still searching for a rider,
                                  // and must not sit behind the same casual confirm.
                                  const riderOut = o.carrier === 'SHIPROCKET' && !!o.delhiveryWaybill;
                                  const q = riderOut
                                    ? `A RIDER HAS ALREADY BEEN DISPATCHED for ${o.orderNumber}.\n\nThey may be at the store or on the way to the customer, and the delivery charge has already been taken. The carrier may refuse to call them off this late.\n\nStill try to cancel?`
                                    : `Cancel shipment ${o.delhiveryWaybill}?\n\nThis cancels the parcel with the carrier. It does NOT refund the customer's payment.`;
                                  if (!confirm(q)) return;
                                  setShipmentBusy(o.id); setErr('');
                                  try {
                                    const r = await adminCancelShipment(o.id);
                                    // Only NOW is it actually cancelled. This used to mark the row
                                    // CANCELLED even when the carrier refused, so a failed cancel
                                    // looked identical to a successful one — while a rider was still
                                    // on the way.
                                    setOrders(p => (p || []).map(x => x.id === o.id ? { ...x, shipmentStatus: 'CANCELLED' } : x));
                                    // Prefer the backend's sentence: it knows whether a rider was
                                    // out, and therefore whether anything was actually charged.
                                    setCancelInfo({ orderNumber: o.orderNumber, ok: true, message: r?.message || `Booking ${o.delhiveryWaybill} cancelled with ${o.carrier || 'the carrier'}. The customer's payment is not refunded by this.` });
                                  } catch (e: unknown) {
                                    setCancelInfo({ orderNumber: o.orderNumber, ok: false, message: e instanceof Error ? e.message : 'The carrier refused to cancel this booking.' });
                                  } finally { setShipmentBusy(null); }
                                }} style={actionBtn(true)} title="Cancel this shipment with the carrier">
                                  {shipmentBusy === o.id ? '…' : <><X size={13} /> Cancel</>}
                                </button>
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

            {delivSub === 'sameday' && (
              <>
              {/* Pickup readiness. What decides whether a store can take a same-day order is
                  whether its Shiprocket pickup location is VERIFIED — an unverified one quotes a
                  price and then refuses the booking, so it must never read as available. */}
              <Panel title="Same-day stores — Shiprocket pickup readiness" loading={storeReadiness === null}
                action={storeReadiness === null ? undefined : <button onClick={() => adminGetStoreReadiness().then(setStoreReadiness).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
                {storeReadiness && (
                  <>
                    {!storeReadiness.configured ? (
                      <Empty text="Shiprocket is not configured on this environment, so no store can take a same-day order." />
                    ) : (
                      <>
                        <div style={{ ...card, padding: '10px 14px', marginBottom: 12, borderColor: storeReadiness.verifiedCount === storeReadiness.stores.length ? 'var(--border-default)' : 'var(--status-error)' }}>
                          <strong style={{ color: storeReadiness.verifiedCount === storeReadiness.stores.length ? 'var(--text-strong)' : 'var(--status-error)', fontSize: 'var(--text-sm)' }}>
                            {storeReadiness.verifiedCount} of {storeReadiness.stores.length} stores can dispatch
                          </strong>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                            A store can take same-day orders when its pickup nickname exists in Shiprocket — that is where the rider
                            collects from. Shiprocket&apos;s own <em>status</em> is shown for reference only: it reads 2 on your primary
                            location and 1 on the rest, while their panel marks all of them verified, and bookings from status-1
                            locations are accepted. Read live from Shiprocket, not cached.
                          </p>
                        </div>
                        <Table head={['Store', 'City', 'Pincode', 'Pickup name', 'Can dispatch?']}>
                          {storeReadiness.stores.map((s) => (
                            <tr key={s.pincode} style={{ opacity: s.verified ? 1 : 0.75 }}>
                              <td style={td}><strong style={{ color: 'var(--text-strong)' }}>{s.name}</strong>{s.isPrimary && <span style={{ marginLeft: 6, fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-subtle)' }}>PRIMARY</span>}</td>
                              <td style={td}>{s.city}, {s.state}</td>
                              <td style={td}><span style={{ fontFamily: 'monospace' }}>{s.pincode}</span></td>
                              <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{s.pickupName || '—'}</span>{s.pickupId ? <><br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-2xs)' }}>id {s.pickupId}</span></> : null}</td>
                              <td style={td}>
                                {s.usable ? <Badge text="Yes" ok /> : <Badge text="No" />}
                                {s.usable && !s.verified && <div style={{ marginTop: 3, fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>Shiprocket status 1 (normal for a non-primary location)</div>}
                                {s.blockedReason && <div style={{ marginTop: 4, fontSize: 'var(--text-2xs)', color: 'var(--status-error)', maxWidth: 320, lineHeight: 1.45 }}>{s.blockedReason}</div>}
                              </td>
                            </tr>
                          ))}
                        </Table>
                        {!!storeReadiness.unmappedPickups?.length && (
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '10px 0 0' }}>
                            Registered in Shiprocket but not mapped to any ADC store: {storeReadiness.unmappedPickups.map(p => p.nickname).join(', ')}.
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}
              </Panel>
              <Panel title="Shiprocket — status reference (admin only)"
                action={<button onClick={() => setSfxStatesOpen(v => !v)} style={{ ...iconBtn, width: 'auto', padding: '4px 10px', fontSize: 'var(--text-xs)', fontWeight: 700 }}>{sfxStatesOpen ? 'Hide' : 'Show'}</button>}>
                {sfxStatesOpen ? (
                  <>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                      What each Shiprocket tracking status does to the order. Anything not listed leaves the order untouched rather than
                      guessing. Note &quot;Rider assigned&quot; only means a rider was allocated — nothing has left the store yet, so it must
                      not read as shipped to the customer.
                    </p>
                    <Table head={['Shiprocket status', 'Order becomes', 'What it means']}>
                      {SR_ORDER_STATES.map((s) => (
                        <tr key={s.id}>
                          <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{s.id}</span></td>
                          <td style={td}><strong>{s.status}</strong></td>
                          <td style={{ ...td, color: 'var(--text-muted)' }}>{s.description}</td>
                        </tr>
                      ))}
                    </Table>
                    <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: '10px 0 0', lineHeight: 1.5 }}>
                      Observed on a real delivery (1 Aug 2026, Rapido rider, 10.61 km): Rider reached pickup 18:33:01 → Picked up 18:33:28
                      → Rider reached drop 18:57:12 → Delivered 19:46:05. Every webhook arrived within seconds of the event.
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>{SR_ORDER_STATES.length} mapped statuses — click Show to view the full reference.</p>
                )}
              </Panel>
              <Panel title="Same-day — intracity orders" loading={orders === null}
                action={orders === null ? undefined : <button onClick={() => adminGetOrders().then(setOrders).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
                {orders && (() => {
                  // Was filtered to the retired carrier, so every real intracity order since the
                  // carrier changed was invisible on this screen.
                  const sfx = orders.filter(o => o.carrier === 'SHIPROCKET');
                  if (!sfx.length) return <Empty text="No intracity orders yet." />;
                  return (
                    <>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>Same-city orders delivered by a rider from the nearest store, on Shiprocket Hyperlocal. There is no shipping label to print — the rider collects from the store — so tracking is the live status trail.</p>
                      <Table head={['Order', 'Customer', 'AWB', 'Status', 'Documents']}>
                        {sfx.map(o => {
                          const trackData = trackResult[o.id] as { status?: string; scans?: { time: string; event: string }[] } | undefined;
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
                                    {/* Hyperlocal has no printable document — the rider collects
                                        from the store — so the public tracking page is the artefact. */}
                                    {o.trackingUrl && (
                                      <a href={o.trackingUrl} target="_blank" rel="noreferrer" title="Open Shiprocket tracking page" style={{ ...iconBtn, display: 'inline-grid' }}><FileText size={14} /></a>
                                    )}
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

        {/* ===== Stores (staff portal) ===== */}
        {tab === 'stores' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Panel title="How an order reaches each kitchen" >
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', margin: '0 0 10px', lineHeight: 1.6 }}>
                Every paid order is assigned to the store that will make it — from the delivery address when it is
                placed, then corrected to whichever store the carrier can actually collect from. Staff sign in at
                their store&apos;s own page and work only their own orders: accept, bake, mark ready. They cannot
                cancel anything or see another store&apos;s work.
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', margin: 0, lineHeight: 1.6 }}>
                <strong>Petpooja has one outlet configured for us — Begur.</strong> Begur&apos;s orders are pushed
                there automatically. Every other store bills the order on its own Petpooja terminal and types the
                bill number back into the portal; without that number nothing links the payment to their till, so
                it is chased in <em>Needs attention</em>.
              </p>
            </Panel>

            <StoreAvailabilityPanel setErr={setErr} setNotice={setNotice} />

            <Panel title="Stores" loading={storeReport === null}
              action={<button onClick={() => adminGetStores().then(setStoreReport).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
              {storeReport && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {storeReport.stores.map(s => (
                    <StoreCard key={s.code} store={s} busy={staffBusy}
                      onChanged={() => { adminGetStores().then(setStoreReport).catch(() => {}); refreshAttention(); }}
                      setBusy={setStaffBusy} setErr={setErr} setNotice={setNotice} />
                  ))}
                  {!!storeReport.orphanedStaff.length && (
                    <div style={{ ...card, padding: 14, borderColor: 'var(--status-error)' }}>
                      <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--status-error)' }}>
                        {storeReport.orphanedStaff.length} login{storeReport.orphanedStaff.length !== 1 ? 's' : ''} for a store that no longer exists
                      </strong>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '6px 0 10px' }}>
                        These cannot sign in. Delete them.
                      </p>
                      {storeReport.orphanedStaff.map(u => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 'var(--text-sm)' }}>
                          <span style={{ fontFamily: 'monospace' }}>{u.username}</span>
                          <span style={{ color: 'var(--text-muted)', flex: 1 }}>→ {u.storeCode}</span>
                          <button onClick={async () => { await adminDeleteStoreStaff(u.id); adminGetStores().then(setStoreReport).catch(() => {}); }}
                            style={actionBtn(true)}><Trash2 size={13} /> Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Panel>
          </div>
        )}

        {/* ===== Petpooja (POS) ===== */}
        {tab === 'petpooja' && (() => {
          const key = (i: { item_id: string; variation_id: string }) => `${i.item_id}|${i.variation_id}`;
          const reload = () => { adminGetPetpoojaMapping().then(setPpMap).catch(() => {}); refreshAttention(); };
          const linkByProduct = async (productId: number, composite: string) => {
            setPpBusy('p' + productId); setErr('');
            const [itemId, variationId] = composite ? composite.split('|') : [null, ''];
            try { await adminLinkProductToPetpooja(productId, itemId, variationId || ''); reload(); }
            catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not save the link'); }
            finally { setPpBusy(null); }
          };
          const createAndLink = async (i: { item_id: string; variation_id: string; name: string }) => {
            setPpBusy(key(i)); setErr(''); setNotice('');
            try {
              const r = await adminCreateProductFromPetpooja(i.item_id, i.variation_id);
              setNotice(r.created ? `Created "${r.product.name}" and linked it.` : `Linked to the existing product "${r.product.name}".`);
              reload(); adminGetProducts().then(setProducts).catch(() => {});
            } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not create the product'); }
            finally { setPpBusy(null); }
          };
          const q = ppSearch.trim().toLowerCase();
          const rows = (ppMap?.items || []).filter(i => {
            if (ppOnlyUnlinked && i.product_id) return false;
            if (!q) return true;
            return i.name.toLowerCase().includes(q) || (i.variation_name || '').toLowerCase().includes(q) || i.item_id.includes(q);
          });
          const linked = (ppMap?.items || []).filter(i => i.product_id).length;
          const total = ppMap?.items.length || 0;
          const lastPush = ppMap?.pushes?.[0];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Menu status. Petpooja PUSHES the catalogue to us — menu fetch is deprecated on their
                  side — so this panel is the only place the arrival of a menu is visible. */}
              <Panel title="Menu from Petpooja" loading={ppMap === null}
                action={<button onClick={reload} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
                {ppMap && (!ppMap.menuSynced ? (
                  <Empty text="No menu received yet. Petpooja pushes the catalogue to us — ask them to trigger it, we cannot pull it." />
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
                      <MiniStat label="Items in menu" value={String(total)} />
                      <MiniStat label="Linked to products" value={`${linked} / ${total}`} bad={linked < total} />
                      <MiniStat label="Restaurant code" value={ppMap.restId} />
                      <MiniStat label="Last received" value={lastPush ? fmtDate(lastPush.received_at) : '—'} />
                    </div>
                    {linked < total && (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700, margin: '0 0 12px', lineHeight: 1.5 }}>
                        {total - linked} item{total - linked !== 1 ? 's are' : ' is'} not linked to a product. An order reaches the kitchen only when
                        every product it contains has a Petpooja item — one unlinked product fails the whole relay.
                      </p>
                    )}
                    <details>
                      <summary style={{ cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-muted)' }}>
                        Push history ({ppMap.pushes.length}) and taxes ({ppMap.taxes.length})
                      </summary>
                      <div style={{ marginTop: 10 }}>
                        <Table head={['Received', 'Restaurant', 'Source', 'Items']}>
                          {ppMap.pushes.map(p => (
                            <tr key={p.id}>
                              <td style={td}>{fmtDate(p.received_at)}</td>
                              <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{p.rest_id}</span></td>
                              <td style={td}>{p.source}</td>
                              <td style={td}>{p.item_count}</td>
                            </tr>
                          ))}
                        </Table>
                        <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginTop: 8 }}>
                          Taxes: {ppMap.taxes.map(t => `${t.name} ${t.percentage}%`).join(' · ') || 'none'}
                        </p>
                      </div>
                    </details>
                  </>
                ))}
              </Panel>

              {/* Petpooja owns the menu and there is no API to change it from here. Saying so in
                  the product is better than leaving someone hunting for a button that cannot exist:
                  their integration exposes save_order, update_order_status and rider_status_update
                  outbound, and menu/stock/store-status inbound. Nothing creates or edits an item. */}
              <Panel title="Changing the menu">
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ margin: 0 }}>
                    <strong>The menu is edited in Petpooja, never here.</strong> Their integration has no
                    create-item or edit-item endpoint — we can only receive. So a price change, a new cookie or a
                    withdrawn one is made on the Petpooja dashboard, and their system pushes the whole catalogue
                    to us within moments. Nobody needs to tell us; the push above records every arrival.
                  </p>
                  <p style={{ margin: 0 }}>
                    We <strong>update in place and never delete</strong>. An item that changes keeps its link to
                    your product, so prices and names can change freely without breaking anything. A brand-new
                    item arrives unlinked and appears below as not linked to anything. An item they remove simply
                    stops appearing in their pushes.
                  </p>
                  <p style={{ margin: 0 }}>
                    After any menu change, check the <em>done</em> count below. If it dropped, something new needs
                    linking before an order containing it can reach the kitchen.
                  </p>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    Marking an item out of stock is separate and instant — that arrives on its own feed the
                    moment the kitchen toggles it, without a full menu push.
                  </p>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    To change what the <em>website</em> sells or charges, use the Products tab. Our price is what
                    the customer pays and what Razorpay settles; theirs only prints on the POS bill.
                  </p>
                </div>
              </Panel>

              {ppMap?.menuSynced && (() => {
                /*
                 * Rows are OUR products, not theirs. Our catalogue is the fixed set we sell; theirs
                 * is larger and contains items we never list online. Product-first means every row
                 * matters and "what is still unmapped" is visible without hunting.
                 */
                const itemFor = new Map<number, PetpoojaItem>();
                for (const i of ppMap.items) if (i.product_id) itemFor.set(i.product_id, i);
                const label = (i: PetpoojaItem) =>
                  `${i.name}${i.variation_name ? ' — ' + i.variation_name : ''}${i.price != null ? `  (₹${i.price})` : ''}`;
                const claimedBy = new Map<string, number>();
                for (const i of ppMap.items) if (i.product_id) claimedBy.set(`${i.item_id}|${i.variation_id}`, i.product_id);

                const pq = ppSearch.trim().toLowerCase();
                const prodRows = (ppMap.products || []).filter(p => {
                  if (ppOnlyUnlinked && itemFor.has(p.id)) return false;
                  return !pq || p.name.toLowerCase().includes(pq);
                });
                const mapped = (ppMap.products || []).filter(p => itemFor.has(p.id)).length;
                const spare = ppMap.items.filter(i => !i.product_id);

                return (
                  <Panel title={`Link your products to Petpooja items — ${mapped} of ${ppMap.products.length} done`}>
                    <FilterBar search={ppSearch} onSearch={setPpSearch} placeholder="Search your products…"
                      active={ppOnlyUnlinked} onClear={() => { setPpSearch(''); setPpOnlyUnlinked(false); }}>
                      <Field label="Show">
                        <select value={ppOnlyUnlinked ? 'unlinked' : 'all'} onChange={e => setPpOnlyUnlinked(e.target.value === 'unlinked')}
                          style={{ ...inp, cursor: 'pointer' }}>
                          <option value="all">All products</option>
                          <option value="unlinked">Not linked only</option>
                        </select>
                      </Field>
                    </FilterBar>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                      Every product that can appear in a web order needs a Petpooja item, or that order will not reach the kitchen.
                      Petpooja items you do not sell online (coffees, combo packs) can be left alone.
                    </p>
                    <Table head={['Your product', 'Your price', 'Petpooja item', 'Their price']}>
                      {prodRows.map(p => {
                        const cur = itemFor.get(p.id) || null;
                        const busy = ppBusy === `p${p.id}`;
                        return (
                          <tr key={p.id} style={{ opacity: busy ? 0.5 : 1 }}>
                            <td style={td}>
                              <strong style={{ color: 'var(--text-strong)' }}>{p.name}</strong>
                              {!cur && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--status-error)', fontWeight: 800, marginTop: 2 }}>not linked</div>}
                            </td>
                            <td style={td}>{money(p.price)}</td>
                            <td style={td}>
                              <select value={cur ? `${cur.item_id}|${cur.variation_id}` : ''} disabled={busy}
                                onChange={e => linkByProduct(p.id, e.target.value)}
                                style={{ ...inp, cursor: 'pointer', minWidth: 260, padding: '7px 10px' }}>
                                <option value="">— not linked —</option>
                                {ppMap.items.map(i => {
                                  const k = `${i.item_id}|${i.variation_id}`;
                                  const owner = claimedBy.get(k);
                                  const taken = owner != null && owner !== p.id;
                                  return <option key={k} value={k} disabled={taken}>
                                    {label(i)}{taken ? '  — already linked' : ''}
                                  </option>;
                                })}
                              </select>
                            </td>
                            <td style={td}>
                              {cur?.price != null ? (
                                <>
                                  {money(cur.price)}
                                  {Number(cur.price) !== Number(p.price) && (
                                    <div title="Their price differs from yours. The customer is charged YOUR price; theirs only appears on the POS bill."
                                      style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginTop: 2 }}>differs from yours</div>
                                  )}
                                </>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </Table>
                    {!prodRows.length && <Empty text="No products match." />}
                    {spare.length > 0 && (
                      <details style={{ marginTop: 14 }}>
                        <summary style={{ cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-muted)' }}>
                          {spare.length} Petpooja item{spare.length !== 1 ? 's' : ''} not linked to anything
                        </summary>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '8px 0 10px', lineHeight: 1.5 }}>
                          These exist on the POS but not on your site. That is fine for anything you do not sell online. If you do want to
                          sell one, create it as a product and link it in one step.
                        </p>
                        <Table head={['Petpooja item', 'Their price', 'Stock', '']}>
                          {spare.map(i => (
                            <tr key={`${i.item_id}|${i.variation_id}`}>
                              <td style={td}>
                                {i.name}{i.variation_name && <span style={{ color: 'var(--text-muted)' }}> — {i.variation_name}</span>}
                                <br /><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>{i.item_id}</span>
                              </td>
                              <td style={td}>{i.price != null ? money(i.price) : '—'}</td>
                              <td style={td}>{i.in_stock ? <Badge text="In stock" ok /> : <Badge text="Out" />}</td>
                              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                <button disabled={ppBusy === `${i.item_id}|${i.variation_id}`} onClick={() => createAndLink(i)} style={actionBtn()}
                                  title="Create this as one of your products and link them">
                                  <Plus size={13} /> Add as product
                                </button>
                              </td>
                            </tr>
                          ))}
                        </Table>
                      </details>
                    )}
                  </Panel>
                );
              })()}

              <Panel title="Orders sent to the POS" loading={ppRelays === null}
                action={<button onClick={() => adminGetPetpoojaRelays().then(setPpRelays).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
                {ppRelays && (ppRelays.length ? (
                  <Table head={['Order', 'Total', 'Reached kitchen?', 'Their order id', 'Attempts', 'When']}>
                    {ppRelays.map(r => (
                      <tr key={r.order_id}>
                        <td style={td}><strong style={{ color: 'var(--text-link)' }}>{r.order_number}</strong></td>
                        <td style={td}>{money(r.total_amount)}</td>
                        <td style={td}>
                          {r.relay_ok ? <Badge text="Yes" ok /> : <Badge text="Failed" />}
                          {!r.relay_ok && r.last_error && <div style={{ marginTop: 3, fontSize: 'var(--text-2xs)', color: 'var(--status-error)', maxWidth: 300 }}>{r.last_error}</div>}
                        </td>
                        <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{r.petpooja_order_id || '—'}</span></td>
                        <td style={td}>{r.attempts}</td>
                        <td style={td}>{fmtDate(r.updated_at)}</td>
                      </tr>
                    ))}
                  </Table>
                ) : <Empty text="No orders have been sent to the POS yet." />)}
              </Panel>
            </div>
          );
        })()}

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
              action={
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={resetAllSpins} disabled={resettingSpins} style={{ ...iconBtn, width: 'auto', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 'var(--text-xs)', opacity: resettingSpins ? 0.6 : 1 }}>
                    <RefreshCw size={14} /> {resettingSpins ? 'Resetting…' : 'Reset all spins'}
                  </button>
                  <button onClick={() => setCouponForm({ ...EMPTY_SPIN_COUPON })} style={addBtn}><Plus size={16} /> New offer</button>
                </div>
              }>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 6px', lineHeight: 1.5 }}>
                Each offer's <strong>Weight</strong> is its % chance of landing when someone spins. Weights across active offers currently sum to <strong>{totalSpinWeight.toFixed(1)}%</strong> — the remaining <strong>{noRewardChance.toFixed(1)}%</strong> is &quot;Better luck next time&quot;.
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', margin: '0 0 6px', lineHeight: 1.5 }}>
                <strong>How odds are guaranteed:</strong> every 1,000 spins draw from one shuffled batch pre-built to these exact weights (e.g. 5% weight = exactly 50 of the 1,000) — a real ratio per batch, not just an average over time. The batch auto-rebuilds the moment you change a weight here, and again once it runs out.
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', margin: '0 0 14px', lineHeight: 1.5 }}>
                <strong>One spin per customer:</strong> it's a single lifetime spin per device/account, not a daily reset — once their result (win or miss) is drawn, that's it for good. Use <strong>Reset all spins</strong> above to wipe everyone's record at once and open a fresh round (already-won coupons aren't affected).
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
              <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-input)', padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Which delivery methods this product can go on, right now. Checked at checkout AND at order
                  creation — turning either off is enforced, not just labelled.
                </p>
                <DeliveryModeToggle
                  label="Intracity — same-day, from one of our stores"
                  available={editing.data.intracityAvailable !== false}
                  reason={editing.data.intracityUnavailableReason || ''}
                  onToggle={v => setEditing({ ...editing, data: { ...editing.data, intracityAvailable: v } })}
                  onReason={r => setEditing({ ...editing, data: { ...editing.data, intracityUnavailableReason: r } })}
                >
                  {editing.data.intracityAvailable !== false && (
                    <Field label="Only deliver same-day within (city, optional)">
                      <input style={inp} placeholder="e.g. Bengaluru" value={editing.data.restrictCities || ''}
                        onChange={e => setEditing({ ...editing, data: { ...editing.data, restrictCities: e.target.value } })} />
                    </Field>
                  )}
                </DeliveryModeToggle>
                <DeliveryModeToggle
                  label="Intercity — multi-day courier, anywhere else"
                  available={editing.data.intercityAvailable !== false}
                  reason={editing.data.intercityUnavailableReason || ''}
                  onToggle={v => setEditing({ ...editing, data: { ...editing.data, intercityAvailable: v } })}
                  onReason={r => setEditing({ ...editing, data: { ...editing.data, intercityUnavailableReason: r } })}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                {(() => {
                  const missingReason = (editing.data.intracityAvailable === false && !(editing.data.intracityUnavailableReason || '').trim())
                    || (editing.data.intercityAvailable === false && !(editing.data.intercityUnavailableReason || '').trim());
                  const disabled = !editing.data.name || !editing.data.price || missingReason;
                  return <button onClick={saveProduct} disabled={disabled} style={{ ...addBtn, flex: 1, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}><Check size={16} /> Save</button>;
                })()}
                <button onClick={() => setEditing(null)} style={{ padding: '12px 18px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order detail popup */}
      {cancelInfo && (
        <div onClick={() => setCancelInfo(null)} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px,96vw)', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: 24, borderTop: `4px solid ${cancelInfo.ok ? 'var(--status-success, #1a7f4b)' : 'var(--status-error)'}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              {cancelInfo.ok ? <Check size={20} style={{ color: 'var(--status-success, #1a7f4b)', flex: 'none', marginTop: 2 }} /> : <AlertTriangle size={20} style={{ color: 'var(--status-error)', flex: 'none', marginTop: 2 }} />}
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 'var(--text-h5, 1.05rem)', color: 'var(--text-strong)' }}>{cancelInfo.ok ? 'Cancelled' : 'Not cancelled'}</h3>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 2 }}>{cancelInfo.orderNumber}</div>
              </div>
              <button onClick={() => setCancelInfo(null)} style={iconBtn}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.6, whiteSpace: 'pre-line', margin: '0 0 16px' }}>{cancelInfo.message}</p>
            <button onClick={() => setCancelInfo(null)} style={{ ...addBtn, width: '100%', justifyContent: 'center' }}>Got it</button>
          </div>
        </div>
      )}

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
                const service = o.carrier === 'SHIPROCKET' ? 'Intracity (Shiprocket)' : o.carrier === 'DELHIVERY' ? 'Intercity (Delhivery)' : null;
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
                          // Shiprocket is pre-normalised by the backend into { status, scans };
                          // only Delhivery returns its own raw envelope.
                          if (r.carrier === 'SHIPROCKET') {
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
                      <div style={{ marginTop: 10 }}>
                        {o.shipmentError && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700, margin: '0 0 8px' }}>Booking failed: {o.shipmentError}</p>}
                        {!a ? (
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>This order has no delivery address, so no courier can be booked for it.</p>
                        ) : o.paymentStatus === 'PAID' && o.orderStatus !== 'CANCELLED' ? (
                          <button disabled={fixing === o.id} onClick={() => rebookShipment(o.id)} style={{ ...addBtn, padding: '8px 14px', fontSize: 'var(--text-sm)', opacity: fixing === o.id ? 0.5 : 1 }}>
                            <Truck size={14} /> {fixing === o.id ? 'Booking…' : 'Book courier now'}
                          </button>
                        ) : (
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>Not shipped — a courier is only booked once payment is confirmed.</p>
                        )}
                      </div>
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

              {/* Kitchen / POS — the leg that decides whether the bill and KOT actually print.
                  Shown only for paid orders: an unpaid one is never relayed, by design. */}
              {o.paymentStatus === 'PAID' && (
                <div style={{ ...card, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>Kitchen (Petpooja POS)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge text={o.pos?.relayed ? 'Ticket printed' : o.pos ? 'Relay failed' : 'Not sent'} ok={!!o.pos?.relayed} />
                    {o.pos?.petpoojaOrderId && <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>{o.pos.petpoojaOrderId}</span>}
                  </div>
                  {!o.pos?.relayed && (
                    <div style={{ marginTop: 10 }}>
                      {o.pos?.lastError && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700, margin: '0 0 8px' }}>{o.pos.lastError}{o.pos.attempts ? ` — ${o.pos.attempts} attempt${o.pos.attempts > 1 ? 's' : ''}` : ''}</p>}
                      {o.orderStatus !== 'CANCELLED' && (
                        <button disabled={fixing === o.id} onClick={() => retryPosRelay(o.id)} style={{ ...addBtn, padding: '8px 14px', fontSize: 'var(--text-sm)', opacity: fixing === o.id ? 0.5 : 1 }}>
                          <RefreshCw size={14} /> {fixing === o.id ? 'Sending…' : 'Send to POS'}
                        </button>
                      )}
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '8px 0 0' }}>Invoices and KOTs live in the Petpooja dashboard — this only shows whether the ticket reached them.</p>
                    </div>
                  )}
                </div>
              )}

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

/*
 * Orders that took the customer's money but did not finish downstream.
 *
 * Four separate lists rather than one, because each needs a different action:
 *   • paid, no courier      → re-book (one click, re-runs the same routing payment would have)
 *   • paid, no POS ticket   → usually an unmapped product; fix the mapping, then push again
 *   • cancelled, leg stuck  → the POS or carrier refused; must be finished in THEIR dashboard
 *   • money reversed        → a refund or chargeback landed on an order still being fulfilled
 * The whole panel is hidden when every list is empty, so a clean day shows nothing at all.
 */
function AttentionPanel({ report, busy, onRebook, onRetryPos, onOpen, onRefresh }: {
  report: AttentionReport; busy: number | null;
  onRebook: (id: number) => void; onRetryPos: (id: number) => void;
  onOpen: (id: number) => void; onRefresh: () => void;
}) {
  const head: React.CSSProperties = { fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', margin: '14px 0 6px' };
  const line: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border-soft)', fontSize: 'var(--text-sm)' };
  const num: React.CSSProperties = { fontWeight: 800, color: 'var(--text-link)', cursor: 'pointer' };
  const why: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 'var(--text-xs)', flex: 1, minWidth: 180 };

  return (
    <div style={{ ...card, padding: '14px 16px', marginBottom: 16, borderColor: 'var(--status-error)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={18} style={{ color: 'var(--status-error)' }} />
        <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>Needs attention ({report.total})</span>
        <button onClick={onRefresh} style={{ ...iconBtn, marginLeft: 'auto' }} title="Refresh"><RefreshCw size={15} /></button>
      </div>

      {!!report.paidNoShipment.length && <>
        <div style={head}>Paid, but no courier booked ({report.paidNoShipment.length})</div>
        {report.paidNoShipment.map(o => (
          <div key={o.id} style={line}>
            <span style={num} onClick={() => onOpen(o.id)}>{o.order_number}</span>
            <span>{money(o.total_amount)}</span>
            {/* No address = nothing to ship to, and no retry can ever fix it. Say so instead of
                offering a button that is guaranteed to fail. */}
            <span style={why}>{o.has_address === false ? 'No delivery address on this order — it cannot be shipped.' : (o.shipment_error || 'No booking attempt recorded yet.')}</span>
            {o.has_address === false ? (
              <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>Not shippable</span>
            ) : (
              <button disabled={busy === o.id} onClick={() => onRebook(o.id)} style={{ ...actionBtn(), opacity: busy === o.id ? 0.5 : 1 }}>
                <Truck size={13} /> {busy === o.id ? 'Booking…' : 'Book courier'}
              </button>
            )}
          </div>
        ))}
      </>}

      {!!report.paidNoPosTicket.length && <>
        <div style={head}>Paid, but the kitchen never got the ticket ({report.paidNoPosTicket.length})</div>
        {report.paidNoPosTicket.map(o => (
          <div key={o.id} style={line}>
            <span style={num} onClick={() => onOpen(o.id)}>{o.order_number}</span>
            <span>{money(o.total_amount)}</span>
            <span style={why}>{o.last_error || 'Never attempted.'}{o.attempts ? ` (${o.attempts} attempt${o.attempts > 1 ? 's' : ''})` : ''}</span>
            <button disabled={busy === o.id} onClick={() => onRetryPos(o.id)} style={{ ...actionBtn(), opacity: busy === o.id ? 0.5 : 1 }}>
              <RefreshCw size={13} /> {busy === o.id ? 'Sending…' : 'Send to POS'}
            </button>
          </div>
        ))}
      </>}

      {!!report.cancelStuckDownstream.length && <>
        <div style={head}>Cancelled here, but still live downstream ({report.cancelStuckDownstream.length})</div>
        {report.cancelStuckDownstream.map((o, i) => (
          <div key={`${o.id}-${i}`} style={line}>
            <span style={num} onClick={() => onOpen(o.id)}>{o.order_number}</span>
            <span style={why}>{o.remarks}</span>
          </div>
        ))}
      </>}

      {!!report.moneyReversed.length && <>
        <div style={head}>Money refunded or contested ({report.moneyReversed.length})</div>
        {report.moneyReversed.map((o, i) => (
          <div key={`${o.id}-${i}`} style={line}>
            <span style={num} onClick={() => onOpen(o.id)}>{o.order_number}</span>
            <span style={why}>{o.remarks}</span>
          </div>
        ))}
      </>}

      {/* Only the stores that bill on their own Petpooja terminal can land here — Begur relays
          automatically. There is no button: nobody at head office can type a bill number that only
          exists on a shop's till. The fix is to ring the store. */}
      {!!report.posManualUnbilled?.length && <>
        <div style={head}>Made at a store, but no POS bill number recorded ({report.posManualUnbilled.length})</div>
        {report.posManualUnbilled.map(o => (
          <div key={o.id} style={line}>
            <span style={num} onClick={() => onOpen(o.id)}>{o.order_number}</span>
            <span>{money(o.total_amount)}</span>
            <span style={why}>
              {o.store_code} — {o.store_accepted_at ? 'accepted' : 'not even accepted yet'}
              {o.store_ready_at ? ', packed' : ''}. Nothing links this payment to a bill on their till.
            </span>
          </div>
        ))}
      </>}
    </div>
  );
}

/*
 * Every store, online or off (including Begur, which has no staff portal so it never appears in the
 * "Stores" panel below) — and, per store, a flat on/off for each product. This generalizes the
 * product-level intracity/intercity toggle (which only ever understands "restricted to city X") to
 * any one-off case an admin wants to flip directly, no code change: a store fully out of an
 * ingredient today, or the reverse. An explicit override here always wins over the automatic rule.
 */
function StoreAvailabilityPanel({ setErr, setNotice }: { setErr: (s: string) => void; setNotice: (s: string) => void }) {
  const [stores, setStores] = useState<AdminStoreStatus[] | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [products, setProducts] = useState<AdminStoreProduct[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // a store code, or "code:productId", currently saving

  const load = () => adminGetStoreStatus().then(r => setStores(r.stores)).catch(() => setStores([]));
  useEffect(() => { load(); }, []);

  const toggleStore = async (code: string) => {
    setBusy(code); setErr('');
    try { const r = await adminToggleStoreStatus(code); setNotice(r.isActive ? 'Store is back online.' : 'Store taken offline — it will stop receiving new orders.'); load(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'That did not work'); }
    finally { setBusy(null); }
  };

  const toggleProducts = async (code: string) => {
    if (openCode === code) { setOpenCode(null); return; }
    setOpenCode(code); setProducts(null);
    try { setProducts((await adminGetStoreProducts(code)).products); }
    catch { setProducts([]); }
  };

  const setOverride = async (code: string, productId: number, available: boolean | null) => {
    setBusy(`${code}:${productId}`); setErr('');
    try {
      await adminSetStoreProductOverride(code, productId, available);
      setProducts((await adminGetStoreProducts(code)).products);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'That did not work'); }
    finally { setBusy(null); }
  };

  return (
    <Panel title="Store &amp; product availability" loading={stores === null} action={<button onClick={load} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
        Take a whole store offline (it stops receiving new orders) or turn one product on/off for just one store —
        e.g. Red Velvet already hides outside Bengaluru automatically, but this also lets you turn it off at a
        single Bengaluru store specifically, for a one-off reason like running out of it for the day.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {stores?.map(s => (
          <div key={s.code} style={{ ...card, padding: 14, opacity: busy === s.code ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{s.name}</strong>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{s.city}</span>
              <Badge text={s.isActive ? 'Online' : 'Offline'} ok={s.isActive} />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => toggleProducts(s.code)} style={actionBtn()}>
                  {openCode === s.code ? 'Hide products' : 'Products'}
                </button>
                <button disabled={busy === s.code} onClick={() => toggleStore(s.code)} style={actionBtn(s.isActive)}>
                  {s.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />} {s.isActive ? 'Take offline' : 'Bring online'}
                </button>
              </div>
            </div>
            {openCode === s.code && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
                {products === null ? (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Loading…</span>
                ) : !products.length ? (
                  <Empty text="No available products." />
                ) : (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {products.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                        <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{p.name}</span>
                        {p.isOverride
                          ? <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--brand-secondary)', fontWeight: 800 }}>manual override</span>
                          : !p.automaticallyAvailable && <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 800 }}>auto-restricted here</span>}
                        <button disabled={busy === `${s.code}:${p.id}`} onClick={() => setOverride(s.code, p.id, !p.available)} style={actionBtn(!p.available)}>
                          {p.available ? <ToggleRight size={13} /> : <ToggleLeft size={13} />} {p.available ? 'On' : 'Off'}
                        </button>
                        {p.isOverride && (
                          <button disabled={busy === `${s.code}:${p.id}`} onClick={() => setOverride(s.code, p.id, null)} style={actionBtn()}>Reset</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/*
 * One store: where its staff sign in, who can, and what it is sitting on.
 *
 * The password handling here is the honest kind. Hashes cannot be read back, so there is no way to
 * answer "what is their password" for an account in use — and pretending otherwise by storing a
 * copy would be worse than useless. Instead: a brand-new account shows the starting password it was
 * created with, and the moment it is used or changed that stops being shown and the only move left
 * is to set a new one, which the admin then hands over in person.
 */
function StoreCard({ store, busy, setBusy, onChanged, setErr, setNotice }: {
  store: AdminStore; busy: number | null;
  setBusy: (n: number | null) => void; onChanged: () => void;
  setErr: (s: string) => void; setNotice: (s: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [resetting, setResetting] = useState<number | null>(null);
  const [resetPass, setResetPass] = useState('');

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}${store.portalPath}` : store.portalPath;

  const guard = async (id: number, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id); setErr(''); setNotice('');
    try { await fn(); setNotice(ok); onChanged(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'That did not work'); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-strong)' }}>{store.name}</strong>
        <Badge text={store.posMode === 'AUTO' ? 'Petpooja: automatic' : 'Petpooja: billed at the store'} ok={store.posMode === 'AUTO'} />
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {store.city} · {store.pincode}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>Staff sign in at</span>
        <code style={{ fontSize: 'var(--text-xs)', background: 'var(--surface-sunken)', padding: '4px 9px', borderRadius: 6 }}>{portalUrl}</code>
        <button onClick={() => { navigator.clipboard?.writeText(portalUrl); setNotice('Link copied.'); }} style={actionBtn()}>Copy</button>
        <a href={store.portalPath} target="_blank" rel="noreferrer" style={{ ...actionBtn(), textDecoration: 'none' }}><ExternalLink size={13} /> Open</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
        <MiniStat label="Paid, last 30 days" value={String(store.last30Days.paid)} />
        <MiniStat label="Not yet accepted" value={String(store.last30Days.unaccepted)} bad={store.last30Days.unaccepted > 0} />
        {store.posMode === 'MANUAL' && (
          <MiniStat label="No POS bill number" value={String(store.last30Days.unbilled)} bad={store.last30Days.unbilled > 0} />
        )}
      </div>

      {/* Same rule the store's own /menu view and the checkout guard enforce — shown here so admin
          sees, without opening the store portal, exactly what each shop cannot sell. */}
      {store.doesNotCarry.length > 0 && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 14px', padding: '8px 12px', background: 'var(--surface-sunken)', borderRadius: 8 }}>
          Does not carry (same-day delivery restricted elsewhere): <strong style={{ color: 'var(--text-body)' }}>{store.doesNotCarry.join(', ')}</strong>
        </p>
      )}

      <Table head={['Username', 'Last signed in', 'Status', '']}>
        {store.staff.map(u => (
          <tr key={u.id} style={{ opacity: busy === u.id ? 0.5 : 1 }}>
            <td style={td}>
              <strong style={{ fontFamily: 'monospace', color: 'var(--text-strong)' }}>{u.username}</strong>
              {u.onStartingPassword && u.startingPassword && (
                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--status-error)', fontWeight: 800, marginTop: 3 }}>
                  Starting password: <code>{u.startingPassword}</code> — never used yet
                </div>
              )}
            </td>
            <td style={td}>{u.lastLoginAt ? fmtDate(u.lastLoginAt) : <span style={{ color: 'var(--text-muted)' }}>never</span>}</td>
            <td style={td}>{u.isActive ? <Badge text="Active" ok /> : <Badge text="Disabled" />}</td>
            <td style={{ ...td, whiteSpace: 'nowrap' }}>
              <button onClick={() => { setResetting(resetting === u.id ? null : u.id); setResetPass(''); }} style={actionBtn()}>
                <KeyRound size={13} /> Set password
              </button>
              <button onClick={() => guard(u.id, () => adminToggleStoreStaff(u.id), u.isActive ? 'Account disabled.' : 'Account enabled.')} style={actionBtn()}>
                {u.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />} {u.isActive ? 'Disable' : 'Enable'}
              </button>
              <button onClick={() => guard(u.id, () => adminDeleteStoreStaff(u.id), 'Account deleted.')} style={actionBtn(true)}>
                <Trash2 size={13} />
              </button>
            </td>
          </tr>
        ))}
        {resetting != null && (
          <tr>
            <td style={td} colSpan={4}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="text" value={resetPass} onChange={e => setResetPass(e.target.value)}
                  placeholder="New password (8+ characters)" style={{ ...inp, width: 'auto', flex: '1 1 220px' }} />
                <button disabled={resetPass.length < 8}
                  onClick={() => guard(resetting, () => adminSetStoreStaffPassword(resetting, resetPass),
                    `Password set. Give it to them: ${resetPass}`).then(() => { setResetting(null); setResetPass(''); })}
                  style={{ ...addBtn, opacity: resetPass.length < 8 ? 0.5 : 1 }}>Save</button>
                <button onClick={() => setResetting(null)} style={actionBtn()}>Cancel</button>
              </div>
              <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', margin: '8px 0 0' }}>
                Shown once, here, after saving — write it down before you close this. It cannot be read back.
              </p>
            </td>
          </tr>
        )}
      </Table>

      {adding ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="username" style={{ ...inp, width: 'auto', flex: '1 1 160px' }} />
          <input value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="password (8+)" style={{ ...inp, width: 'auto', flex: '1 1 160px' }} />
          <button disabled={!newUser.trim() || newPass.length < 8}
            onClick={() => guard(-1, () => adminCreateStoreStaff(store.code, newUser.trim(), newPass), `Created ${newUser.trim()}.`)
              .then(() => { setAdding(false); setNewUser(''); setNewPass(''); })}
            style={{ ...addBtn, opacity: !newUser.trim() || newPass.length < 8 ? 0.5 : 1 }}>Create</button>
          <button onClick={() => setAdding(false)} style={actionBtn()}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ ...actionBtn(), marginTop: 12 }}><Plus size={13} /> Add another login</button>
      )}
    </div>
  );
}

function MiniStat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div style={{ ...card, padding: '10px 14px' }}>
      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: bad ? 'var(--status-error)' : 'var(--text-strong)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' };
const addBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' };
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'inline-grid', placeItems: 'center', color: 'var(--text-body)', marginRight: 6 };

/** Labelled row action ("Label", "POD", "Status", "Cancel"). `danger` tints it for destructive ones. */
const actionBtn = (danger = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 'var(--radius-pill)',
  border: `1.5px solid ${danger ? 'var(--status-error)' : 'var(--border-default)'}`,
  background: 'var(--surface-card)', color: danger ? 'var(--status-error)' : 'var(--text-body)',
  fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-2xs)', cursor: 'pointer', whiteSpace: 'nowrap',
});

/*
 * Admin-facing shipment status. Delhivery's own wording is misleading at the start of the journey:
 * "CREATED"/"Manifested" only means a waybill exists, which happens automatically on payment while
 * the parcel is still on the counter. Spelling that out as "Awaiting pickup" is what tells the
 * operator there is still something to DO (schedule a pickup for the warehouse).
 */
function shipStatusLabel(s?: string | null): string {
  const t = (s || '').trim();
  if (!t) return 'Not created';
  const u = t.toUpperCase();
  if (u === 'CREATED' || u === 'MANIFESTED') return 'Awaiting pickup';
  if (u === 'AWAITING_PICKUP') return 'Awaiting pickup';
  if (u === 'NOT_CREATED') return 'Not created';
  return t;
}

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
      {/* minWidth:0 is what actually makes the horizontal scroll work on a phone: without it a wide
          table stretches this flex/grid child instead of scrolling inside it, and the whole admin
          page ends up wider than the screen. */}
      {loading ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div> : <div style={{ overflowX: 'auto', minWidth: 0, maxWidth: '100%' }} className="hide-sb">{children}</div>}
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

/**
 * One delivery-mode on/off switch on the product form. Turning it OFF requires a reason before it
 * can be saved with that value — an off switch with no explanation is useless to whoever reads it
 * later (the customer sees this text when the product is disabled for them; another admin sees it
 * when wondering why a product they didn't touch is suddenly unavailable). `children` renders
 * extra fields only relevant while this mode is ON (e.g. the city restriction, for intracity).
 */
function DeliveryModeToggle({ label, available, reason, onToggle, onReason, children }: {
  label: string; available: boolean; reason: string;
  onToggle: (v: boolean) => void; onReason: (r: string) => void; children?: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', flex: 1 }}>{label}</span>
        <button type="button" onClick={() => onToggle(!available)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 'var(--radius-pill)',
            border: `1.5px solid ${available ? 'var(--border-default)' : 'var(--status-error)'}`,
            background: available ? 'var(--surface-card)' : 'var(--status-error-bg, #fdecec)',
            color: available ? 'var(--text-body)' : 'var(--status-error)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
          {available ? <ToggleRight size={15} color="var(--brand-secondary)" /> : <ToggleLeft size={15} />}
          {available ? 'On' : 'Off'}
        </button>
      </div>
      {!available && (
        <div style={{ marginTop: 8 }}>
          <input style={{ ...inp, borderColor: !reason.trim() ? 'var(--status-error)' : undefined }}
            placeholder={'Reason shown to the customer (required) — e.g. "Out of same-day stock today"'}
            value={reason} onChange={e => onReason(e.target.value)} />
          {!reason.trim() && (
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--status-error)', margin: '4px 0 0' }}>
              A reason is required while this is off.
            </p>
          )}
        </div>
      )}
      {available && children && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
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
