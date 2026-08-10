'use client';
import { type AdminUser } from '@/lib/api';
import { PAGE_SIZE } from '@/hooks/admin/usePagination';
import { fmtDate } from '../shared/format';
import { td, Panel, Table, Empty, FilterBar, Pager } from '../shared/ui';

interface Props {
  users: AdminUser[] | null;
  search: string;
  onSearch: (v: string) => void;
  page: number;
  onPage: (n: number) => void;
}

export default function UsersTab({ users, search, onSearch, page, onPage }: Props) {
  const uq = search.trim().toLowerCase();
  const list = (users || []).filter(u => !uq || u.name.toLowerCase().includes(uq) || (u.email || '').toLowerCase().includes(uq) || (u.phone || '').includes(uq));
  const search1 = (v: string) => { onSearch(v); onPage(1); };

  return (
    <Panel title={`Customers${users ? ` (${list.length})` : ''}`} loading={users === null}>
      <FilterBar search={search} onSearch={search1} placeholder="Search name, email, phone…" active={false} onClear={() => search1('')} />
      <Table head={['Name', 'Email', 'Phone', 'Address', 'Last login from', 'Orders', 'Joined']}>
        {list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(u => {
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
      <Pager page={page} total={list.length} pageSize={PAGE_SIZE} onPage={onPage} />
    </Panel>
  );
}
