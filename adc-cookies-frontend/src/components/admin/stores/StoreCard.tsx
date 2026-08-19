'use client';
import { useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, ExternalLink, KeyRound, MapPin, Phone, Monitor, Copy } from 'lucide-react';
import {
  adminCreateStoreStaff, adminSetStoreStaffPassword, adminToggleStoreStaff, adminDeleteStoreStaff,
  type AdminStore,
} from '@/lib/api';
import { fmtDate } from '../shared/format';
import { card, td, inp, addBtn, actionBtn, MiniStat, Table, Badge } from '../shared/ui';

/*
 * One store: what it is, and who can sign in to it.
 *
 * Split into two labelled sections, because they were one run of controls and it read as one thing.
 * "Active" appeared in the middle of a card that also showed the store's name and its takings, so it
 * was never clear whether it meant the shop was open or the login worked — and those are two
 * different questions with two different answers, set in two different places. Whether the SHOP is
 * open lives in the Store & product availability panel above; whether a LOGIN works lives here.
 *
 * The password handling is the honest kind. Hashes cannot be read back, so there is no way to answer
 * "what is their password" for an account in use — and pretending otherwise by storing a copy would
 * be worse than useless. Instead: a brand-new account shows the starting password it was created
 * with, and the moment it is used or changed that stops being shown and the only move left is to set
 * a new one, which the admin then hands over in person.
 */

/** A labelled block inside the card, so the two halves cannot be read as one list. */
function Section({ title, note, action, children }: {
  title: string; note?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: note ? 3 : 10 }}>
        <h4 style={{ flex: 1, fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-muted)', margin: 0 }}>{title}</h4>
        {action}
      </div>
      {note && <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: '0 0 10px', lineHeight: 1.5 }}>{note}</p>}
      {children}
    </div>
  );
}

function DetailRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.5 }}>
      <span style={{ flex: 'none', color: 'var(--text-subtle)', marginTop: 2 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  );
}

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
  const activeLogins = store.staff.filter(u => u.isActive).length;

  const guard = async (id: number, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id); setErr(''); setNotice('');
    try { await fn(); setNotice(ok); onChanged(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'That did not work'); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* The store's identity, above both sections — it is what they are both about. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-strong)' }}>{store.name}</strong>
        <Badge text={store.posMode === 'AUTO' ? 'Petpooja: automatic' : 'Petpooja: billed at the store'} ok={store.posMode === 'AUTO'} />
        <code style={{ marginLeft: 'auto', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', background: 'var(--surface-sunken)', padding: '3px 8px', borderRadius: 6 }}>{store.code}</code>
      </div>

      {/* ===================== Store details ===================== */}
      <Section title="Store details">
        <div style={{ display: 'grid', gap: 7, marginBottom: 14 }}>
          <DetailRow icon={<MapPin size={15} />}>
            {store.address ? <>{store.address}, </> : null}{store.city} {store.pincode}{store.state ? `, ${store.state}` : ''}
          </DetailRow>
          {store.phone && <DetailRow icon={<Phone size={15} />}><a href={`tel:${String(store.phone).replace(/\s/g, '')}`} style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{store.phone}</a></DetailRow>}
          <DetailRow icon={<Monitor size={15} />}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <code style={{ fontSize: 'var(--text-xs)', background: 'var(--surface-sunken)', padding: '4px 9px', borderRadius: 6 }}>{portalUrl}</code>
              <button onClick={() => { navigator.clipboard?.writeText(portalUrl); setNotice('Store portal link copied.'); }} style={actionBtn()}><Copy size={12} /> Copy</button>
              <a href={store.portalPath} target="_blank" rel="noreferrer" style={{ ...actionBtn(), textDecoration: 'none' }}><ExternalLink size={13} /> Open</a>
            </span>
          </DetailRow>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          <MiniStat label="Paid, last 30 days" value={String(store.last30Days.paid)} />
          <MiniStat label="Not yet accepted" value={String(store.last30Days.unaccepted)} bad={store.last30Days.unaccepted > 0} />
          {store.posMode === 'MANUAL' && (
            <MiniStat label="No POS bill number" value={String(store.last30Days.unbilled)} bad={store.last30Days.unbilled > 0} />
          )}
        </div>

        {/* Same rule the store's own menu view and the checkout guard enforce — shown here so admin
            sees, without opening the store portal, exactly what each shop cannot sell. */}
        {store.doesNotCarry.length > 0 && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '12px 0 0', padding: '8px 12px', background: 'var(--surface-sunken)', borderRadius: 8, lineHeight: 1.5 }}>
            Does not carry (intracity delivery restricted elsewhere): <strong style={{ color: 'var(--text-body)' }}>{store.doesNotCarry.join(', ')}</strong>
          </p>
        )}
      </Section>

      {/* ===================== Credentials ===================== */}
      <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 16 }}>
        <Section
          title="Credentials"
          note={`Sign-in accounts for this store's own portal. Active or Inactive here is about the LOGIN, not about whether the shop is open — that switch is in "Store & product availability" above.`}
          action={
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 800 }}>
              {store.staff.length === 0
                ? 'no logins yet'
                : `${store.staff.length} login${store.staff.length === 1 ? '' : 's'} · ${activeLogins} active`}
            </span>
          }>
          <Table head={['Username', 'Last signed in', 'Login status', '']}>
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
                {/* "Inactive", not "Disabled" — it pairs with "Active" as the opposite of the same
                    thing, where "Disabled" read like a different property altogether. */}
                <td style={td}>{u.isActive ? <Badge text="Active" ok /> : <Badge text="Inactive" />}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <button onClick={() => { setResetting(resetting === u.id ? null : u.id); setResetPass(''); }} style={actionBtn()}>
                    <KeyRound size={13} /> Set password
                  </button>
                  <button onClick={() => guard(u.id, () => adminToggleStoreStaff(u.id), u.isActive ? 'Login deactivated.' : 'Login activated.')} style={actionBtn()}>
                    {u.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />} {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => guard(u.id, () => adminDeleteStoreStaff(u.id), 'Login deleted.')} style={actionBtn(true)}>
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
        </Section>
      </div>
    </div>
  );
}
