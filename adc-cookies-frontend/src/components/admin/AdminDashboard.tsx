'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLogin from './AdminLogin';
import { useAdminSession } from '@/hooks/admin/useAdminSession';
import {
  LayoutDashboard, ShoppingBag, Package, Ticket, Users, MessageSquare,
  LogOut, Truck, FileText, Store as StoreIcon, Paintbrush,
} from 'lucide-react';
import { usePagination } from '@/hooks/admin/usePagination';
import { useAdminUsers } from '@/hooks/admin/useAdminUsers';
import { useAdminStats } from '@/hooks/admin/useAdminStats';
import { useAdminAnalytics } from '@/hooks/admin/useAdminAnalytics';
import { useAdminMessages } from '@/hooks/admin/useAdminMessages';
import { useAdminStores } from '@/hooks/admin/useAdminStores';
import { useAdminCoupons } from '@/hooks/admin/useAdminCoupons';
import { useAdminProducts } from '@/hooks/admin/useAdminProducts';
import { useSiteSettings } from '@/hooks/admin/useSiteSettings';
import { useAdminAttention } from '@/hooks/admin/useAdminAttention';
import { useAdminOrders } from '@/hooks/admin/useAdminOrders';
import { useAdminDelivery } from '@/hooks/admin/useAdminDelivery';
import { useAdminPetpooja } from '@/hooks/admin/useAdminPetpooja';
import UsersTab from './users/UsersTab';
import OverviewTab from './overview/OverviewTab';
import MessagesTab from './messages/MessagesTab';
import StoresTab from './stores/StoresTab';
import CouponsTab from './coupons/CouponsTab';
import CouponEditorModal from './coupons/CouponEditorModal';
import ProductsTab from './products/ProductsTab';
import ProductEditorModal from './products/ProductEditorModal';
import OrdersTab from './orders/OrdersTab';
import OrderDetailModal from './orders/OrderDetailModal';
import CancelResultModal from './orders/CancelResultModal';
import AttentionPanel from './attention/AttentionPanel';
import DeliveryTab from './delivery/DeliveryTab';
import WarehouseEditorModal from './delivery/WarehouseEditorModal';
import PetpoojaTab from './petpooja/PetpoojaTab';
import CustomizeTab from './customize/CustomizeTab';
import { card } from './shared/ui';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'customize', label: 'Customize UI', icon: Paintbrush },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'stores', label: 'Stores', icon: StoreIcon },
  { id: 'petpooja', label: 'Petpooja', icon: FileText },
  { id: 'coupons', label: 'Coupons', icon: Ticket },
  { id: 'users', label: 'Customers', icon: Users },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
] as const;
type TabId = typeof TABS[number]['id'];

export default function AdminDashboard() {
  const router = useRouter();
  /* The dashboard runs on its own session, not the customer one. useAuth is gone from here
     entirely: admin used to mean user.role === 'ADMIN', which put this behind the storefront login. */
  const { admin, checking: adminChecking, signIn: adminSignIn, signOut: adminSignOut } = useAdminSession();
  const [tab, setTab] = useState<TabId>('overview');

  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  // Page numbers stay here, not in each tab, so a page survives switching tabs and back.
  const { pageOf, setPageOf } = usePagination();

  const isAdmin = !!admin;

  const { attention, refreshAttention } = useAdminAttention(isAdmin);

  const { users, search: userSearch, setSearch: setUserSearch, saveUser, savingUser } = useAdminUsers(isAdmin && tab === 'users', setErr);
  const { stats, refreshStats } = useAdminStats(isAdmin, setErr);
  const { analytics, range, setRange } = useAdminAnalytics(isAdmin);
  const { products, search: productSearch, setSearch: setProductSearch, category: productCat, setCategory: setProductCat, availability: productAvail, setAvailability: setProductAvail, editing, setEditing, saveProduct, removeProduct, refreshProducts } = useAdminProducts(isAdmin && tab === 'products', setErr, refreshStats);
  const siteSettings = useSiteSettings(isAdmin, setErr);
  const {
    orders, setOrders, refreshOrders,
    search: orderSearch, setSearch: setOrderSearch, statusFilter: orderStatusFilter, setStatusFilter: setOrderStatusFilter,
    carrierFilter: orderCarrier, setCarrierFilter: setOrderCarrier, paymentFilter: orderPayment, setPaymentFilter: setOrderPayment,
    viewOrder, setViewOrder, cancelInfo, setCancelInfo, fixing, trackResult, setTrackResult,
    changeOrderStatus, rebookShipment, retryPosRelay,
  } = useAdminOrders(isAdmin && (tab === 'orders' || tab === 'delivery'), { onError: setErr, onNotice: setNotice, refreshStats, refreshAttention });
  const { messages, search: messageSearch, setSearch: setMessageSearch, handledFilter: messageHandled, setHandledFilter: setMessageHandled, markHandled } = useAdminMessages(isAdmin && tab === 'messages', refreshStats);
  const {
    warehouses, setWarehouses, whForm, setWhForm,
    purDate, setPurDate, purTime, setPurTime, purCount, setPurCount, purResult, setPurResult,
    shipmentBusy, setShipmentBusy, shipmentWeights, setShipmentWeights,
    delivSub, setDelivSub, storeReadiness, setStoreReadiness, sfxStatesOpen, setSfxStatesOpen,
  } = useAdminDelivery(isAdmin && tab === 'delivery');
  const { ppMap, setPpMap, ppRelays, setPpRelays, ppBusy, setPpBusy, ppSearch, setPpSearch, ppOnlyUnlinked, setPpOnlyUnlinked } = useAdminPetpooja(isAdmin && tab === 'petpooja');

  const { storeReport, staffBusy, setStaffBusy, refreshStores, storeChanged, deleteOrphanedStaff } = useAdminStores(isAdmin && tab === 'stores', refreshAttention);
  const { coupons, search: couponSearch, setSearch: setCouponSearch, statusFilter: couponStatusFilter, setStatusFilter: setCouponStatusFilter, couponForm, setCouponForm, toggleCoupon, editCoupon, saveCoupon, removeCoupon, resettingSpins, resetAllSpins } = useAdminCoupons(isAdmin && tab === 'coupons', setErr);

  if (adminChecking) return null;

  // No admin session → the admin sign-in. Phone OTP only; there is no other way in.
  if (!isAdmin) return <AdminLogin onSignedIn={adminSignIn} />;

  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px var(--gutter)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}><LayoutDashboard size={20} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>A Dough Cookie Admin</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {admin.name || 'Admin'} · ••••{admin.phone.slice(-4)}
              {' · '}signed in until {new Date(admin.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>
          <button onClick={() => { void adminSignOut().then(() => router.push('/')); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}><LogOut size={16} /> Log out</button>
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
          <OverviewTab
            stats={stats}
            analytics={analytics}
            range={range}
            setRange={setRange}
            onOpenUsers={() => setTab('users')}
            ordering={{
              orderingPaused: siteSettings.orderingPaused,
              orderingPausedBusy: siteSettings.orderingPausedBusy,
              orderingLoaded: siteSettings.orderingLoaded,
              changeOrderingPaused: siteSettings.changeOrderingPaused,
              saveOrderingPaused: siteSettings.saveOrderingPaused,
            }}
          />
        )}

        {/* ===== Orders ===== */}
        {tab === 'orders' && (
          <OrdersTab
            orders={orders}
            search={orderSearch}
            onSearch={setOrderSearch}
            statusFilter={orderStatusFilter}
            onStatusFilter={setOrderStatusFilter}
            carrierFilter={orderCarrier}
            onCarrierFilter={setOrderCarrier}
            paymentFilter={orderPayment}
            onPaymentFilter={setOrderPayment}
            onRefresh={refreshOrders}
            onOpenOrder={setViewOrder}
            onChangeStatus={changeOrderStatus}
            page={pageOf('orders')}
            onPage={n => setPageOf('orders', n)}
          />
        )}

        {/* ===== Products ===== */}
        {tab === 'products' && (
          <ProductsTab
            products={products}
            search={productSearch}
            onSearch={setProductSearch}
            category={productCat}
            onCategory={setProductCat}
            availability={productAvail}
            onAvailability={setProductAvail}
            setEditing={setEditing}
            onRemove={removeProduct}
            page={pageOf('products')}
            onPage={n => setPageOf('products', n)}
          />
        )}

        {/* ===== Customize UI ===== */}
        {tab === 'customize' && (
          <CustomizeTab
            bannerMessages={siteSettings.bannerMessages}
            bannerMessagesSaved={siteSettings.bannerMessagesSaved}
            changeBannerMessage={siteSettings.changeBannerMessage}
            addBannerMessage={siteSettings.addBannerMessage}
            removeBannerMessage={siteSettings.removeBannerMessage}
            saveBannerMessages={siteSettings.saveBannerMessages}
          />
        )}

        {/* ===== Delivery ===== */}
        {tab === 'delivery' && (
          <DeliveryTab
            delivSub={delivSub} setDelivSub={setDelivSub}
            warehouses={warehouses} setWarehouses={setWarehouses} setWhForm={setWhForm}
            orders={orders} setOrders={setOrders}
            purDate={purDate} setPurDate={setPurDate}
            purTime={purTime} setPurTime={setPurTime}
            purCount={purCount} setPurCount={setPurCount}
            purResult={purResult} setPurResult={setPurResult}
            shipmentBusy={shipmentBusy} setShipmentBusy={setShipmentBusy}
            shipmentWeights={shipmentWeights} setShipmentWeights={setShipmentWeights}
            trackResult={trackResult} setTrackResult={setTrackResult}
            storeReadiness={storeReadiness} setStoreReadiness={setStoreReadiness}
            sfxStatesOpen={sfxStatesOpen} setSfxStatesOpen={setSfxStatesOpen}
            setErr={setErr} setCancelInfo={setCancelInfo}
            deliveryFeeOutstation={siteSettings.deliveryFeeOutstation}
            deliveryFeeSaved={siteSettings.deliveryFeeSaved}
            changeDeliveryFeeOutstation={siteSettings.changeDeliveryFeeOutstation}
            saveDeliveryFeeOutstation={siteSettings.saveDeliveryFeeOutstation}
          />
        )}

        {/* ===== Stores (staff portal) ===== */}
        {tab === 'stores' && (
          <StoresTab
            storeReport={storeReport}
            staffBusy={staffBusy}
            setStaffBusy={setStaffBusy}
            onRefresh={refreshStores}
            onStoreChanged={storeChanged}
            onDeleteOrphanedStaff={deleteOrphanedStaff}
            setErr={setErr}
            setNotice={setNotice}
          />
        )}

        {/* ===== Petpooja (POS) ===== */}
        {tab === 'petpooja' && (
          <PetpoojaTab
            ppMap={ppMap} setPpMap={setPpMap}
            ppRelays={ppRelays} setPpRelays={setPpRelays}
            ppBusy={ppBusy} setPpBusy={setPpBusy}
            ppSearch={ppSearch} setPpSearch={setPpSearch}
            ppOnlyUnlinked={ppOnlyUnlinked} setPpOnlyUnlinked={setPpOnlyUnlinked}
            refreshProducts={refreshProducts} refreshAttention={refreshAttention}
            setErr={setErr} setNotice={setNotice}
          />
        )}

        {/* ===== Coupons ===== */}
        {tab === 'coupons' && (
          <CouponsTab
            coupons={coupons}
            search={couponSearch}
            onSearch={setCouponSearch}
            statusFilter={couponStatusFilter}
            onStatusFilter={setCouponStatusFilter}
            onNewCoupon={setCouponForm}
            onEdit={editCoupon}
            onToggle={toggleCoupon}
            onRemove={removeCoupon}
            resettingSpins={resettingSpins}
            onResetAllSpins={resetAllSpins}
            page={pageOf('coupons')}
            onPage={n => setPageOf('coupons', n)}
          />
        )}

        {/* ===== Users ===== */}
        {tab === 'users' && (
          <UsersTab
            users={users}
            search={userSearch}
            onSearch={setUserSearch}
            page={pageOf('users')}
            onPage={n => setPageOf('users', n)}
            saveUser={saveUser}
            savingUser={savingUser}
          />
        )}

        {/* ===== Messages ===== */}
        {tab === 'messages' && (
          <MessagesTab
            messages={messages}
            search={messageSearch}
            onSearch={setMessageSearch}
            handledFilter={messageHandled}
            onHandledFilter={setMessageHandled}
            onMarkHandled={markHandled}
            page={pageOf('messages')}
            onPage={n => setPageOf('messages', n)}
          />
        )}
      </div>

      {/* Create-coupon modal */}
      {couponForm && <CouponEditorModal couponForm={couponForm} setCouponForm={setCouponForm} onSave={saveCoupon} />}

      {/* Warehouse editor modal */}
      {whForm && <WarehouseEditorModal whForm={whForm} setWhForm={setWhForm} setWarehouses={setWarehouses} setErr={setErr} />}

      {/* Product editor modal */}
      {editing && <ProductEditorModal editing={editing} setEditing={setEditing} onSave={saveProduct} />}

      {/* Cancel-result popup */}
      {cancelInfo && <CancelResultModal cancelInfo={cancelInfo} onClose={() => setCancelInfo(null)} />}

      {/* Order detail popup */}
      {viewOrder && (
        <OrderDetailModal
          order={viewOrder}
          onClose={() => setViewOrder(null)}
          trackResult={trackResult}
          setTrackResult={setTrackResult}
          fixing={fixing}
          onRebook={rebookShipment}
          onRetryPos={retryPosRelay}
          setErr={setErr}
          onCancelled={() => { refreshOrders(); refreshAttention(); }}
        />
      )}

    </main>
  );
}
