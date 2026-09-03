'use client';
import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { type AdminUser } from '@/lib/api';
import { PAGE_SIZE } from '@/hooks/admin/usePagination';
import { fmtDate } from '../shared/format';
import { tenDigit, formatPhone, isMobile, phoneError } from '@/lib/phone';
import { td, inp, iconBtn, actionBtn, Panel, Table, Empty, FilterBar, Pager } from '../shared/ui';

interface Props {
  users: AdminUser[] | null;
  search: string;
  onSearch: (v: string) => void;
  page: number;
  onPage: (n: number) => void;
  saveUser: (id: number, data: { name?: string; phone?: string }) => Promise<boolean>;
  savingUser: number | null;
}

export default function UsersTab({ users, search, onSearch, page, onPage, saveUser, savingUser }: Props) {
  /* Which row is open for editing, and the draft in it. One at a time — a table with every row in
     edit mode is a form nobody can read, and a half-typed number in a row you have scrolled past
     is a mistake waiting to be saved. */
  const [editing, setEditing] = useState<{ id: number; name: string; phone: string } | null>(null);

  const uq = search.trim().toLowerCase();
  const list = (users || []).filter(u => !uq || u.name.toLowerCase().includes(uq) || (u.email || '').toLowerCase().includes(uq) || tenDigit(u.phone).includes(tenDigit(uq) || uq));
  const search1 = (v: string) => { onSearch(v); onPage(1); };

  const commit = async () => {
    if (!editing) return;
    /* An empty box is a deliberate "remove the number" and the server takes it. Anything else has
       to be a real mobile before it goes anywhere near a rider's screen. */
    if (editing.phone && !isMobile(editing.phone)) return;
    const ok = await saveUser(editing.id, { name: editing.name, phone: editing.phone });
    if (ok) setEditing(null);   // stays open on failure so the correction isn't lost
  };

  return (
    <Panel title={`Customers${users ? ` (${list.length})` : ''}`} loading={users === null}>
      <FilterBar search={search} onSearch={search1} placeholder="Search name, email, phone…" active={false} onClear={() => search1('')} />
      <Table head={['Name', 'Email', 'Phone', 'Address', 'Last login from', 'Orders', 'Joined', '']}>
        {list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(u => {
          const addr = u.addresses?.find(a => a.isDefault) || u.addresses?.[0];
          const addrText = addr ? [addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') : '';
          const isEditing = editing?.id === u.id;
          /* No email means a phone-OTP account, where the number is how they sign in. The server
             refuses to change it for that reason; saying so here beats letting someone type a new
             one and meet an error. */
          const phoneIsLogin = !u.email;
          return (
            <tr key={u.id}>
              <td style={td}>
                {isEditing
                  ? <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} style={{ ...inp, width: 150, padding: '6px 8px' }} aria-label="Name" />
                  : <strong>{u.name}</strong>}
              </td>
              <td style={td}>
                {u.email || '—'}
                {isEditing && u.email && (
                  <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 2, maxWidth: 180, whiteSpace: 'normal', lineHeight: 1.4 }}>
                    Their sign-in — only they can change it.
                  </div>
                )}
              </td>
              <td style={td}>
                {isEditing && !phoneIsLogin
                  ? <>
                      <input value={editing.phone} onChange={e => setEditing({ ...editing, phone: tenDigit(e.target.value) })} placeholder="10-digit mobile" style={{ ...inp, width: 130, padding: '6px 8px' }} aria-label="Phone" />
                      {phoneError(editing.phone) && (
                        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--danger-text, #a4231d)', marginTop: 2, maxWidth: 180, whiteSpace: 'normal', lineHeight: 1.4 }}>
                          {phoneError(editing.phone)}
                        </div>
                      )}
                    </>
                  : <>
                      {formatPhone(u.phone) || u.phone || '—'}
                      {isEditing && phoneIsLogin && (
                        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 2, maxWidth: 180, whiteSpace: 'normal', lineHeight: 1.4 }}>
                          Their sign-in — only they can change it.
                        </div>
                      )}
                    </>}
              </td>
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
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={commit} disabled={savingUser === u.id} style={actionBtn()} title="Save changes">
                      {savingUser === u.id ? '…' : <><Check size={13} /> Save</>}
                    </button>
                    <button onClick={() => setEditing(null)} style={iconBtn} aria-label="Cancel"><X size={15} /></button>
                  </div>
                ) : (
                  <button onClick={() => setEditing({ id: u.id, name: u.name, phone: tenDigit(u.phone) })} style={iconBtn} aria-label={`Edit ${u.name}`} title="Edit name / phone">
                    <Pencil size={15} />
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
      {users && !list.length && <Empty text={users.length ? 'No customers match the search.' : 'No customers yet.'} />}
      <Pager page={page} total={list.length} pageSize={PAGE_SIZE} onPage={onPage} />
    </Panel>
  );
}
