'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLogin from './AdminLogin';
import { useAdminSession } from '@/hooks/admin/useAdminSession';
import { useNewOrderAlert } from '@/hooks/admin/useNewOrderAlert';
import {
  LayoutDashboard, ShoppingBag, Package, Ticket, Users, MessageSquare,
  LogOut, Truck, FileText, Store as StoreIcon, Paintbrush, Bell, BellOff, BellRing, TrendingUp,
  SearchCheck,
} from 'lucide-react';
import { usePagination } from '@/hooks/admin/usePagination';
import { useTransientNotice } from '@/hooks/admin/useTransientNotice';
import { useAdminUsers } from '@/hooks/admin/useAdminUsers';
import { useAdminStats } from '@/hooks/admin/useAdminStats';
import { useAdminAnalytics } from '@/hooks/admin/useAdminAnalytics';
import { useAdminMessages } from '@/hooks/admin/useAdminMessages';
import { useAdminTickets } from '@/hooks/admin/useAdminTickets';
import { useAdminStores } from '@/hooks/admin/useAdminStores';
import { useAdminCoupons } from '@/hooks/admin/useAdminCoupons';
import { useAdminProducts } from '@/hooks/admin/useAdminProducts';
import { useSiteSettings } from '@/hooks/admin/useSiteSettings';
import { useAdminAttention } from '@/hooks/admin/useAdminAttention';
import { useAdminOrders } from '@/hooks/admin/useAdminOrders';
import { useAdminDelivery } from '@/hooks/admin/useAdminDelivery';
import { useAdminPetpooja } from '@/hooks/admin/useAdminPetpooja';
import { useAdminTraffic } from '@/hooks/admin/useAdminTraffic';
import UsersTab from './users/UsersTab';
import OverviewTab from './overview/OverviewTab';
import TrafficTab from './traffic/TrafficTab';
import SeoTab from './seo/SeoTab';
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

/*
 * `group` and `about` are presentation only: the desktop sidebar files tabs under their group, and
 * the page heading says what the open tab is for. The phone's pill row keeps this order as it is.
 */
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'Insights', about: 'Sales, orders and customers at a glance.' },
  { id: 'traffic', label: 'Traffic & ads', icon: TrendingUp, group: 'Insights', about: 'Who visits the site, where they come from, and what the ads cost.' },
  { id: 'seo', label: 'SEO', icon: SearchCheck, group: 'Insights', about: 'Which page is written for which Google search, and how many people search it.' },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, group: 'Orders & delivery', about: 'Every order, its payment, and where it is now.' },
  { id: 'products', label: 'Products', icon: Package, group: 'Menu & offers', about: 'The menu: prices, photos and what is available.' },
  { id: 'customize', label: 'Customize UI', icon: Paintbrush, group: 'Menu & offers', about: 'The banner messages and hero image on the storefront.' },
  { id: 'delivery', label: 'Delivery', icon: Truck, group: 'Orders & delivery', about: 'Shipments, couriers and the warehouses they collect from.' },
  { id: 'stores', label: 'Stores', icon: StoreIcon, group: 'Orders & delivery', about: 'The shops, their staff logins and whether they are open.' },
  { id: 'petpooja', label: 'Petpooja', icon: FileText, group: 'Orders & delivery', about: 'The link between our menu and each shop’s Petpooja billing.' },
  { id: 'coupons', label: 'Coupons', icon: Ticket, group: 'Menu & offers', about: 'Discount codes and the spin-the-wheel rewards.' },
  { id: 'users', label: 'Customers', icon: Users, group: 'People', about: 'Everyone with an account.' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, group: 'People', about: 'Contact-form messages and support tickets.' },
] as const;
type TabId = typeof TABS[number]['id'];
const TAB_GROUPS = ['Insights', 'Orders & delivery', 'Menu & offers', 'People'] as const;

export default function AdminDashboard() {
  const router = useRouter();
  /* The dashboard runs on its own session, not the customer one. useAuth is gone from here
     entirely: admin used to mean user.role === 'ADMIN', which put this behind the storefront login. */
  const { admin, checking: adminChecking, signIn: adminSignIn, signOut: adminSignOut } = useAdminSession();
  const [tab, setTab] = useState<TabId>('overview');

  const [err, setErr] = useState('');
  /* Green confirmations clear themselves after a few seconds. Errors do not: one is a receipt
     for something already done, the other is something still to deal with. */
  const [notice, setNotice] = useTransientNotice();
  /* Cancelled/failed orders sit in their own collapsible panel on the Orders tab. Held here,
     not inside OrdersTab, so the Overview tab's "Cancelled / failed" card can open it. */
  const [deadOrdersOpen, setDeadOrdersOpen] = useState(false);

  // Page numbers stay here, not in each tab, so a page survives switching tabs and back.
  const { pageOf, setPageOf } = usePagination();

  const isAdmin = !!admin;

  /* Runs for the whole dashboard, not a tab: an order does not wait for somebody to be on the
     right screen, and the point of a notification is reaching them when they are on another one. */
  const { permission: notifyState, enableNotifications, newOrders, clearNewOrders } = useNewOrderAlert(isAdmin);

  const { attention, refreshAttention } = useAdminAttention(isAdmin);

  const { users, search: userSearch, setSearch: setUserSearch, saveUser, savingUser } = useAdminUsers(isAdmin && tab === 'users', setErr);
  const { stats, refreshStats } = useAdminStats(isAdmin, setErr);
  const { analytics, range, setRange, error: analyticsError, reload: reloadAnalytics } = useAdminAnalytics(isAdmin);
  /* Nine Google Analytics queries plus Meta's per load, so only while the tab is actually open. */
  const traffic = useAdminTraffic(isAdmin && tab === 'traffic');
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
  /* Same tab, so same enable condition — both lists load when Messages is opened and not before. */
  const { tickets, search: ticketSearch, setSearch: setTicketSearch, statusFilter: ticketStatus, setStatusFilter: setTicketStatus, categoryFilter: ticketCategory, setCategoryFilter: setTicketCategory, setStatus: setTicketStatusFor } = useAdminTickets(isAdmin && tab === 'messages');
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

  /* The desktop sidebar and the phone's pill row are two drawings of the same tabs, so opening a tab
     and its badge are decided once, here, and both call these. Opening Orders clears its "new since
     you opened the page" count and refreshes the list, exactly as the pill row always has. */
  const openTab = (id: TabId) => { setTab(id); if (id === 'orders') { clearNewOrders(); refreshOrders(); } };
  /* Orders carries what has landed since this page was opened, cleared by opening the tab. Not a
     count of unhandled orders — that is Needs attention's job, and two badges counting different
     things on the same screen is how both stop being read. */
  const badgeFor = (id: TabId) => (id === 'messages' ? stats?.newMessages : id === 'orders' ? newOrders : undefined);
  const current = TABS.find(t => t.id === tab) ?? TABS[0];
  const CurrentIcon = current.icon;

  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ maxWidth: 1680, margin: '0 auto', padding: '14px var(--gutter)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}><LayoutDashboard size={20} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>A Dough Cookie Admin</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {admin.name || 'Admin'} · ••••{admin.phone.slice(-4)}
              {' · '}signed in until {new Date(admin.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>
          {/* Order alerts. Asking has to come from a click — Safari refuses a prompt that no one
              asked for — so this is a button rather than something that happens on load. Hidden
              entirely where the browser has no Notification API (iOS Safari outside an installed
              web app), because offering a switch that cannot do anything is worse than silence. */}
          {notifyState !== 'unsupported' && (
            notifyState === 'granted'
              ? <span title="Order alerts are on. New orders appear as a browser notification while this tab is open." style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  <BellRing size={16} /> Alerts on
                  {!!newOrders && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--brand-secondary)', color: 'var(--white)', fontSize: 11, fontWeight: 900, display: 'grid', placeItems: 'center' }}>{newOrders}</span>}
                </span>
              : notifyState === 'denied'
                /* Once denied, asking again does nothing at all — the browser will not re-prompt.
                   Saying where to change it is the only useful thing left. */
                ? <span title="This browser is blocking notifications for the dashboard. Turn them back on in the padlock menu beside the address bar." style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontWeight: 700, color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
                    <BellOff size={16} /> Alerts blocked
                  </span>
                : <button onClick={() => void enableNotifications()} title="Get a browser notification the moment an order comes in" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>
                    <Bell size={16} /> Order alerts
                  </button>
          )}
          <button onClick={() => { void adminSignOut().then(() => router.push('/')); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}><LogOut size={16} /> Log out</button>
        </div>
      </header>

      <div className="adm-frame adm-shell">
        {/* Desktop: the tabs as a sidebar, grouped. Hidden below 1025px, where the pill row takes over. */}
        <aside className="adm-sidebar">
          <nav aria-label="Admin sections" style={{ ...card, padding: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {TAB_GROUPS.map(group => (
              <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ padding: '6px 12px 4px', fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{group}</div>
                {TABS.filter(t => t.group === group).map(t => {
                  const on = tab === t.id;
                  const Icon = t.icon;
                  const badge = badgeFor(t.id);
                  return (
                    <button key={t.id} onClick={() => openTab(t.id)} aria-current={on ? 'page' : undefined} className="adm-side-tab" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', background: on ? 'var(--gradient-warm)' : 'transparent', color: on ? 'var(--white)' : 'var(--text-body)', boxShadow: on ? 'var(--shadow-sm)' : 'none' }}>
                      <Icon size={18} style={{ flex: 'none' }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
                      {!!badge && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: on ? 'var(--white)' : 'var(--brand-secondary)', color: on ? 'var(--brand-secondary)' : 'var(--white)', fontSize: 11, fontWeight: 900, display: 'grid', placeItems: 'center', flex: 'none' }}>{badge}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <div className="adm-main">
          {/* Desktop: the open tab's name and what it is for. With the tabs off to the side, the page
              needs its own heading. Phones already show the highlighted pill instead. */}
          <div className="adm-desktop-only" style={{ alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--amber-50)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none' }}><CurrentIcon size={20} /></span>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, font: 'var(--weight-bold) var(--text-h3)/1.15 var(--font-display)', color: 'var(--text-strong)' }}>{current.label}</h1>
              <p style={{ margin: '3px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{current.about}</p>
            </div>
          </div>

          {err && <div onClick={() => setErr('')} style={{ ...card, padding: '12px 16px', marginBottom: 16, color: 'var(--status-error)', borderColor: 'var(--status-error)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>{err}</div>}
          {notice && <div onClick={() => setNotice('')} style={{ ...card, padding: '12px 16px', marginBottom: 16, color: 'var(--status-success, #1a7f4b)', borderColor: 'var(--status-success, #1a7f4b)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', animation: 'annSlide .28s var(--ease-out) both' }}>{notice}</div>}

          {/* Needs attention — orders that took money but did not complete downstream. Sits above the
              tabs because it applies to every screen, and is hidden entirely when there is nothing. */}
          {!!attention?.total && <AttentionPanel report={attention} busy={fixing} onRebook={rebookShipment} onRetryPos={retryPosRelay} onOpen={id => { const o = (orders || []).find(x => x.id === id); if (o) setViewOrder(o); else { setTab('orders'); setOrderSearch(String(id)); } }} onRefresh={refreshAttention} />}

          {/* Phones and tablets: the tabs as a row of pills, as before. Hidden on desktop. */}
          <div className="hide-sb adm-tabs-mobile" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 22, paddingBottom: 4 }}>
            {TABS.map(t => {
              const on = tab === t.id;
              const Icon = t.icon;
              const badge = badgeFor(t.id);
              return (
                <button key={t.id} onClick={() => openTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none', padding: '10px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', border: on ? 'none' : '1.5px solid var(--border-default)', background: on ? 'var(--gradient-warm)' : 'var(--surface-card)', color: on ? 'var(--white)' : 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
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
              analyticsError={analyticsError}
              onReloadAnalytics={reloadAnalytics}
              range={range}
              setRange={setRange}
              onOpenUsers={() => setTab('users')}
              onOpenCancelled={() => { setTab('orders'); setDeadOrdersOpen(true); }}
              ordering={{
                orderingPaused: siteSettings.orderingPaused,
                orderingPausedBusy: siteSettings.orderingPausedBusy,
                orderingLoaded: siteSettings.orderingLoaded,
                changeOrderingPaused: siteSettings.changeOrderingPaused,
                saveOrderingPaused: siteSettings.saveOrderingPaused,
              }}
            />
          )}

          {/* ===== Traffic & ads ===== */}
          {tab === 'traffic' && <TrafficTab {...traffic} />}

          {tab === 'seo' && <SeoTab />}

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
              deadOpen={deadOrdersOpen}
              onDeadOpen={setDeadOrdersOpen}
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
              hero={siteSettings.heroBanner}
              heroUrls={siteSettings.heroUrls}
              heroSizes={siteSettings.heroSizes}
              heroSaved={siteSettings.heroSaved}
              heroBusy={siteSettings.heroBusy}
              changeHeroImage={siteSettings.changeHeroImage}
              changeHeroField={siteSettings.changeHeroField}
              saveHeroBanner={siteSettings.saveHeroBanner}
              heroLive={siteSettings.heroLive}
              resetHeroBanner={siteSettings.resetHeroBanner}
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
              tickets={tickets}
              ticketSearch={ticketSearch}
              onTicketSearch={setTicketSearch}
              ticketStatusFilter={ticketStatus}
              onTicketStatusFilter={setTicketStatus}
              ticketCategoryFilter={ticketCategory}
              onTicketCategoryFilter={setTicketCategory}
              onSetTicketStatus={setTicketStatusFor}
              ticketPage={pageOf('tickets')}
              onTicketPage={n => setPageOf('tickets', n)}
            />
          )}
        </div>
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
