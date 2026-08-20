'use client';
import { RefreshCw, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import { type Order } from '@/lib/api';
import { PAGE_SIZE } from '@/hooks/admin/usePagination';
import { money, fmtDate } from '../shared/format';
import { td, inp, iconBtn, Panel, Table, Badge, Empty, Field, FilterBar, Pager } from '../shared/ui';
import { ORDER_STATUSES, LIVE_ORDER_STATUSES, isDeadOrder, deadOrderReason } from './orderConstants';

interface Props {
  orders: Order[] | null;
  search: string;
  onSearch: (v: string) => void;
  statusFilter: string;
  onStatusFilter: (v: string) => void;
  carrierFilter: string;
  onCarrierFilter: (v: string) => void;
  paymentFilter: string;
  onPaymentFilter: (v: string) => void;
  onRefresh: () => void;
  onOpenOrder: (o: Order) => void;
  onChangeStatus: (id: number, status: string) => void;
  page: number;
  onPage: (n: number) => void;
  /** Cancelled/failed orders live in their own collapsible panel; this is its open state. */
  deadOpen: boolean;
  onDeadOpen: (v: boolean) => void;
}

/**
 * One half of the cancelled list.
 *
 * The two halves are shown as separate groups rather than one table with a "why" column, because
 * they need opposite things from whoever is reading: a paid order that was cancelled has a refund
 * waiting, and a closed payment window has nothing at all. Sorting that out by squinting at a column
 * was the problem.
 *
 * Capped, and says when it capped — a long tail of abandoned checkouts must not be able to push the
 * half that needs acting on off the screen, and silently truncating would read as "that is all of
 * them".
 */
function DeadGroup({ title, note, rows, emptyText, owed, onOpenOrder }: {
  title: string; note: string; rows: Order[]; emptyText: string; owed?: boolean;
  onOpenOrder: (o: Order) => void;
}) {
  const CAP = 10;
  const shown = rows.slice(0, CAP);
  const hidden = rows.length - shown.length;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-strong)', margin: 0 }}>{title}</h4>
        <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: owed && rows.length ? 'var(--status-error)' : 'var(--text-subtle)' }}>
          {rows.length}
        </span>
      </div>
      <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: '0 0 10px', lineHeight: 1.5 }}>{note}</p>
      {!rows.length ? <Empty text={emptyText} /> : (
        <>
          <Table head={['Order', 'Customer', 'Total', 'Why', 'Date', '']}>
            {shown.map(o => {
              const reason = deadOrderReason(o);
              return (
                <tr key={o.id} onClick={() => onOpenOrder(o)} style={{ cursor: 'pointer', opacity: 0.9 }}>
                  <td style={td}><strong style={{ color: 'var(--text-link)' }}>{o.orderNumber}</strong><br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-2xs)' }}>{(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''} · tap for details</span></td>
                  <td style={td}>{o.address?.fullName || '—'}<br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)' }}>{o.address?.city || ''}</span></td>
                  <td style={{ ...td, color: 'var(--text-muted)' }}>{money(o.totalAmount)}</td>
                  <td style={td}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-body)' }}>{reason.text}</span>
                    {reason.owed && <div style={{ marginTop: 4 }}><Badge text="refund owed" /></div>}
                  </td>
                  <td style={td}>{fmtDate(o.createdAt)}</td>
                  <td style={td}><XCircle size={15} color="var(--text-subtle)" /></td>
                </tr>
              );
            })}
          </Table>
          {hidden > 0 && (
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: '8px 0 0', fontWeight: 700 }}>
              +{hidden} more — use the search above to narrow this down.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function OrdersTab({
  orders, search, onSearch, statusFilter, onStatusFilter, carrierFilter, onCarrierFilter,
  paymentFilter, onPaymentFilter, onRefresh, onOpenOrder, onChangeStatus, page, onPage,
  deadOpen, onDeadOpen,
}: Props) {
  const q = search.trim().toLowerCase();
  const matches = (o: Order) => {
    if (!q) return true;
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      (o.address?.fullName || '').toLowerCase().includes(q) ||
      (o.address?.city || '').toLowerCase().includes(q)
    );
  };

  /* The split that makes this tab honest.
     A cancelled order and an abandoned checkout are not orders the shop has to act on, and mixing
     them into the same list meant the count at the top of this panel never matched the takings on
     the Overview tab. They are kept — audit matters — in their own panel below. */
  const live = (orders || []).filter(o => !isDeadOrder(o));
  const dead = (orders || []).filter(isDeadOrder);

  const filtered = live.filter(o => {
    if (statusFilter && o.orderStatus !== statusFilter) return false;
    if (carrierFilter && (o.carrier || '') !== carrierFilter) return false;
    if (paymentFilter && o.paymentStatus !== paymentFilter) return false;
    return matches(o);
  });
  const deadFiltered = dead.filter(matches);

  /* Split on whether money changed hands. A closed payment window costs nothing and needs nobody;
     a paid order that was then cancelled has a refund at the end of it. These were one list, which
     meant the half that needed acting on was buried in the half that did not. */
  const deadPaid = deadFiltered.filter(o => o.paymentStatus === 'PAID');
  const deadUnpaid = deadFiltered.filter(o => o.paymentStatus !== 'PAID');

  const active = !!(statusFilter || carrierFilter || paymentFilter);
  const clear = () => { onStatusFilter(''); onCarrierFilter(''); onPaymentFilter(''); onSearch(''); onPage(1); };
  const selStyle = { ...inp, cursor: 'pointer' } as React.CSSProperties;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Panel title={`Orders${orders ? ` (${filtered.length}${filtered.length !== live.length ? '/' + live.length : ''})` : ''}`} loading={orders === null}
        action={<button onClick={onRefresh} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
        <FilterBar search={search} onSearch={v => { onSearch(v); onPage(1); }} placeholder="Search order #, customer, city…" active={active} onClear={clear}>
          <Field label="Order status"><select value={statusFilter} onChange={e => { onStatusFilter(e.target.value); onPage(1); }} style={selStyle}><option value="">All statuses</option>{LIVE_ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
          <Field label="Carrier"><select value={carrierFilter} onChange={e => { onCarrierFilter(e.target.value); onPage(1); }} style={selStyle}><option value="">All carriers</option><option value="SHIPROCKET">Shiprocket (intracity)</option><option value="DELHIVERY">Delhivery (outstation)</option></select></Field>
          <Field label="Payment"><select value={paymentFilter} onChange={e => { onPaymentFilter(e.target.value); onPage(1); }} style={selStyle}><option value="">Any payment</option><option value="PAID">Paid</option><option value="PENDING">Pending</option></select></Field>
        </FilterBar>
        <Table head={['Order', 'Customer', 'Total', 'Payment', 'Shipment', 'POS', 'Status', 'Date']}>
          {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(o => (
            <tr key={o.id} onClick={() => onOpenOrder(o)} style={{ cursor: 'pointer' }}>
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
                  /* A store that bills by hand has no ticket to send and never will, so "NOT SENT"
                     was reporting a failure that cannot happen. The bill its staff typed is the
                     POS link for these orders — the same thing the detail view shows, which is why
                     the two disagreed until now. */
                  : o.store?.posManual
                    ? (o.store.posBillNo
                        ? <span title={`Billed at the store — bill ${o.store.posBillNo}`}><Badge text={`Bill ${o.store.posBillNo}`} ok /></span>
                        : <span title="This store bills on its own Petpooja terminal — staff enter the bill number when they accept."><Badge text="Not billed" /></span>)
                  : o.pos?.relayed ? <Badge text="On POS" ok />
                  : <span title={o.pos?.lastError || 'Not sent to the POS yet.'}><Badge text={o.pos ? 'FAILED' : 'NOT SENT'} /></span>}
              </td>
              <td style={td} onClick={e => e.stopPropagation()}>
                <select value={o.orderStatus} onChange={e => onChangeStatus(o.id, e.target.value)} style={{ padding: '7px 10px', borderRadius: 10, border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)', cursor: 'pointer' }}>
                  {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td style={td}>{fmtDate(o.createdAt)}</td>
            </tr>
          ))}
        </Table>
        {orders && !filtered.length && <Empty text={live.length ? 'No orders match the filter.' : 'No orders yet.'} />}
        <Pager page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={onPage} />
      </Panel>

      {/* ===== Cancelled & failed payments =====
          Kept for history and for chasing refunds, deliberately out of the list above and collapsed
          by default: nothing here needs baking, shipping or a status change. */}
      {!!dead.length && (
        <div>
          <Panel
            title={`Cancelled & failed payments (${deadFiltered.length})`}
            action={
              <button onClick={() => onDeadOpen(!deadOpen)} style={{ ...iconBtn, width: 'auto', padding: '0 12px', height: 34, marginRight: 0, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 'var(--text-xs)' }}>
                {deadOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />} {deadOpen ? 'Hide' : 'Show'}
              </button>
            }>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: deadOpen ? '0 0 16px' : 0, lineHeight: 1.6 }}>
              None of these are live orders. They are excluded from the list above, from the takings on
              Overview, and from every sales chart — and split below by whether money changed hands,
              because only one of the two needs anybody to do anything.
            </p>
            {deadOpen && (<>
              {/* Money taken first. This is the half that needs acting on, so it does not sit
                  underneath a longer list of checkouts nobody completed. */}
              <DeadGroup
                title="Cancelled after payment"
                note="Paid for, then cancelled — by us or on request. Each of these has a refund to settle in the Razorpay dashboard."
                rows={deadPaid}
                emptyText="None — nothing is owed."
                owed
                onOpenOrder={onOpenOrder}
              />
              <DeadGroup
                title="Left at checkout"
                note="The customer reached the payment step and closed it without paying. Nothing was charged and there is nothing to do."
                rows={deadUnpaid}
                emptyText="None."
                onOpenOrder={onOpenOrder}
              />
              {!deadFiltered.length && <Empty text="None match the search." />}
            </>)}
          </Panel>
        </div>
      )}
    </div>
  );
}
