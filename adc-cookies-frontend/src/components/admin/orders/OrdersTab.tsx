'use client';
import { RefreshCw } from 'lucide-react';
import { type Order } from '@/lib/api';
import { PAGE_SIZE } from '@/hooks/admin/usePagination';
import { money, fmtDate } from '../shared/format';
import { td, inp, iconBtn, Panel, Table, Badge, Empty, Field, FilterBar, Pager } from '../shared/ui';
import { ORDER_STATUSES } from './orderConstants';

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
}

export default function OrdersTab({
  orders, search, onSearch, statusFilter, onStatusFilter, carrierFilter, onCarrierFilter,
  paymentFilter, onPaymentFilter, onRefresh, onOpenOrder, onChangeStatus, page, onPage,
}: Props) {
  const q = search.trim().toLowerCase();
  const filtered = (orders || []).filter(o => {
    if (statusFilter && o.orderStatus !== statusFilter) return false;
    if (carrierFilter && (o.carrier || '') !== carrierFilter) return false;
    if (paymentFilter && o.paymentStatus !== paymentFilter) return false;
    if (!q) return true;
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      (o.address?.fullName || '').toLowerCase().includes(q) ||
      (o.address?.city || '').toLowerCase().includes(q)
    );
  });
  const active = !!(statusFilter || carrierFilter || paymentFilter);
  const clear = () => { onStatusFilter(''); onCarrierFilter(''); onPaymentFilter(''); onSearch(''); onPage(1); };
  const selStyle = { ...inp, cursor: 'pointer' } as React.CSSProperties;

  return (
    <Panel title={`Orders${orders ? ` (${filtered.length}${filtered.length !== orders.length ? '/' + orders.length : ''})` : ''}`} loading={orders === null}
      action={<button onClick={onRefresh} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
      <FilterBar search={search} onSearch={v => { onSearch(v); onPage(1); }} placeholder="Search order #, customer, city…" active={active} onClear={clear}>
        <Field label="Order status"><select value={statusFilter} onChange={e => { onStatusFilter(e.target.value); onPage(1); }} style={selStyle}><option value="">All statuses</option>{ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
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
      {orders && !filtered.length && <Empty text={orders.length ? 'No orders match the filter.' : 'No orders yet.'} />}
      <Pager page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={onPage} />
    </Panel>
  );
}
