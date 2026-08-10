'use client';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { type AdminCoupon } from '@/lib/api';
import { PAGE_SIZE } from '@/hooks/admin/usePagination';
import { money, fmtDate } from '../shared/format';
import { td, inp, addBtn, iconBtn, Panel, Table, Badge, Empty, Field, FilterBar, Pager } from '../shared/ui';
import { couponStatus, EMPTY_COUPON, EMPTY_SPIN_COUPON, type CouponDraft } from './couponForm';

interface Props {
  coupons: AdminCoupon[] | null;
  search: string;
  onSearch: (v: string) => void;
  statusFilter: string;
  onStatusFilter: (v: string) => void;
  onNewCoupon: (draft: CouponDraft) => void;
  resettingSpins: boolean;
  onResetAllSpins: () => void;
  onEdit: (c: AdminCoupon) => void;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
  page: number;
  onPage: (n: number) => void;
}

export default function CouponsTab({ coupons, search, onSearch, statusFilter, onStatusFilter, onNewCoupon, onEdit, onToggle, onRemove, resettingSpins, onResetAllSpins, page, onPage }: Props) {
  const cq = search.trim().toLowerCase();
  const regular = (coupons || []).filter(c => c.spinWeight == null);
  const spinCoupons = (coupons || []).filter(c => c.spinWeight != null).sort((a, b) => (b.spinWeight ?? 0) - (a.spinWeight ?? 0));
  const list = regular.filter(c => {
    if (statusFilter && couponStatus(c).text !== statusFilter) return false;
    return !cq || c.code.toLowerCase().includes(cq);
  });
  const selStyle = { ...inp, cursor: 'pointer' } as React.CSSProperties;
  const totalSpinWeight = spinCoupons.filter(c => couponStatus(c).ok).reduce((s, c) => s + (c.spinWeight ?? 0), 0);
  const noRewardChance = Math.max(0, 100 - totalSpinWeight);
  const search1 = (v: string) => { onSearch(v); onPage(1); };
  const filter1 = (v: string) => { onStatusFilter(v); onPage(1); };

  const rowActions = (c: AdminCoupon) => (
    <>
      <button onClick={() => onEdit(c)} aria-label="Edit" style={{ ...iconBtn, marginRight: 6 }}><Pencil size={15} /></button>
      <button onClick={() => onToggle(c.id)} style={{ ...iconBtn, width: 'auto', padding: '6px 10px', marginRight: 6, fontWeight: 700, fontSize: 'var(--text-xs)' }}>{c.isActive ? 'Disable' : 'Enable'}</button>
      <button onClick={() => onRemove(c.id)} aria-label="Delete" style={{ ...iconBtn, color: 'var(--status-error)' }}><Trash2 size={15} /></button>
    </>
  );
  const discountText = (c: AdminCoupon) => c.discountType === 'PERCENTAGE' ? `${c.discountValue}%${c.maximumDiscount ? ` (max ${money(c.maximumDiscount)})` : ''}` : money(c.discountValue);

  return (
    <>
      <Panel title={`Coupons${coupons ? ` (${list.length})` : ''}`} loading={coupons === null}
        action={<button onClick={() => onNewCoupon({ ...EMPTY_COUPON })} style={addBtn}><Plus size={16} /> New coupon</button>}>
        <FilterBar search={search} onSearch={search1} placeholder="Search code…" active={!!statusFilter} onClear={() => { onStatusFilter(''); onSearch(''); onPage(1); }}>
          <Field label="Status"><select value={statusFilter} onChange={e => filter1(e.target.value)} style={selStyle}><option value="">All</option><option value="Active">Active</option><option value="Expired">Expired</option><option value="Limit reached">Limit reached</option><option value="Disabled">Disabled</option></select></Field>
        </FilterBar>
        <Table head={['Code', 'Discount', 'Min order', 'Valid till', 'Uses', 'Status', '']}>
          {list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(c => {
            const st = couponStatus(c);
            return (
              <tr key={c.id}>
                <td style={td}><strong>{c.code}</strong></td>
                <td style={td}>{discountText(c)}</td>
                <td style={td}>{c.minimumOrderAmount ? money(c.minimumOrderAmount) : '—'}</td>
                <td style={td}>{c.expiryDate ? fmtDate(c.expiryDate) : 'No expiry'}</td>
                <td style={td}>{c.timesUsed ?? 0}{c.usageLimit != null ? ` / ${c.usageLimit}` : ''}</td>
                <td style={td}><Badge text={st.text} ok={st.ok} /></td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{rowActions(c)}</td>
              </tr>
            );
          })}
        </Table>
        {coupons && !list.length && <Empty text={coupons.length ? 'No coupons match the filter.' : 'No coupons yet — create one above.'} />}
        <Pager page={page} total={list.length} pageSize={PAGE_SIZE} onPage={onPage} />
      </Panel>

      {/* ===== Spin Wheel Offers — a separate section: the rewards the Spin & Win wheel can
          award, each with its own odds (weight %), usage limit, active window, and terms. ===== */}
      <div style={{ marginTop: 24 }}>
        <Panel title={`Spin Wheel Offers${coupons ? ` (${spinCoupons.length})` : ''}`} loading={coupons === null}
          action={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={onResetAllSpins} disabled={resettingSpins} style={{ ...iconBtn, width: 'auto', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 'var(--text-xs)', opacity: resettingSpins ? 0.6 : 1 }}>
                <RefreshCw size={14} /> {resettingSpins ? 'Resetting…' : 'Reset all spins'}
              </button>
              <button onClick={() => onNewCoupon({ ...EMPTY_SPIN_COUPON })} style={addBtn}><Plus size={16} /> New offer</button>
            </div>
          }>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 6px', lineHeight: 1.5 }}>
            Each offer&apos;s <strong>Weight</strong> is its % chance of landing when someone spins. Weights across active offers currently sum to <strong>{totalSpinWeight.toFixed(1)}%</strong> — the remaining <strong>{noRewardChance.toFixed(1)}%</strong> is &quot;Better luck next time&quot;.
          </p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', margin: '0 0 6px', lineHeight: 1.5 }}>
            <strong>How odds are guaranteed:</strong> every 1,000 spins draw from one shuffled batch pre-built to these exact weights (e.g. 5% weight = exactly 50 of the 1,000) — a real ratio per batch, not just an average over time. The batch auto-rebuilds the moment you change a weight here, and again once it runs out.
          </p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', margin: '0 0 14px', lineHeight: 1.5 }}>
            <strong>One spin per customer:</strong> it's a single lifetime spin per device/account, not a daily reset — once their result (win or miss) is drawn, that's it for good. Use <strong>Reset all spins</strong> above to wipe everyone's record at once and open a fresh round (already-won coupons aren't affected).</p>
          <Table head={['Wheel label', 'Code', 'Discount', 'Weight', 'Uses', 'Status', '']}>
            {spinCoupons.map(c => {
              const st = couponStatus(c);
              return (
                <tr key={c.id}>
                  <td style={td}><strong>{c.spinLabel || c.code}</strong></td>
                  <td style={td}>{c.code}</td>
                  <td style={td}>{discountText(c)}</td>
                  <td style={td}>{(c.spinWeight ?? 0).toFixed(1)}%</td>
                  <td style={td}>{c.timesUsed ?? 0}{c.usageLimit != null ? ` / ${c.usageLimit}` : ''}</td>
                  <td style={td}><Badge text={st.text} ok={st.ok} /></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{rowActions(c)}</td>
                </tr>
              );
            })}
          </Table>
          {coupons && !spinCoupons.length && <Empty text="No Spin Wheel offers yet — create one above." />}
        </Panel>
      </div>
    </>
  );
}
