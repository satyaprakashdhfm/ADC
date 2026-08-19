'use client';
import { Trash2, RefreshCw } from 'lucide-react';
import { type AdminStoresReport } from '@/lib/api';
import { card, iconBtn, actionBtn, Panel } from '../shared/ui';
import StoreCard from './StoreCard';
import StoreAvailabilityPanel from './StoreAvailabilityPanel';

interface Props {
  storeReport: AdminStoresReport | null;
  staffBusy: number | null;
  setStaffBusy: (n: number | null) => void;
  onRefresh: () => void;
  onStoreChanged: () => void;
  onDeleteOrphanedStaff: (id: number) => void;
  setErr: (s: string) => void;
  setNotice: (s: string) => void;
}

export default function StoresTab({ storeReport, staffBusy, setStaffBusy, onRefresh, onStoreChanged, onDeleteOrphanedStaff, setErr, setNotice }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Panel title="How an order reaches each kitchen" >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', margin: '0 0 10px', lineHeight: 1.6 }}>
          Every paid order is assigned to the store that will make it — from the delivery address when it is
          placed, then corrected to whichever store the carrier can actually collect from. Staff sign in at
          their store&apos;s own page and work only their own orders: accept, bake, mark ready. They cannot
          cancel anything or see another store&apos;s work.
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', margin: '0 0 10px', lineHeight: 1.6 }}>
          A store can also <strong>close itself for the day</strong> and <strong>turn an item off</strong> when
          it runs out, from its own page — the same two switches as the panel below, scoped to that one shop.
          It was worth giving them: the alternative was a counter with a broken oven taking orders it could not
          bake until somebody here picked up the phone. Anything wider than their own shop still only happens
          from here.
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
        action={<button onClick={onRefresh} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
        {storeReport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {storeReport.stores.map(s => (
              <StoreCard key={s.code} store={s} busy={staffBusy}
                onChanged={onStoreChanged}
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
                    <button onClick={() => onDeleteOrphanedStaff(u.id)}
                      style={actionBtn(true)}><Trash2 size={13} /> Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
