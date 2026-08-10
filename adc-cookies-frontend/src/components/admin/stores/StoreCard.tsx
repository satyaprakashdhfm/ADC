'use client';
import { useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, ExternalLink, KeyRound } from 'lucide-react';
import {
  adminCreateStoreStaff, adminSetStoreStaffPassword, adminToggleStoreStaff, adminDeleteStoreStaff,
  type AdminStore,
} from '@/lib/api';
import { fmtDate } from '../shared/format';
import { card, td, inp, addBtn, actionBtn, MiniStat, Table, Badge } from '../shared/ui';

export default function StoreCard({ store, busy, setBusy, onChanged, setErr, setNotice }: {
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
