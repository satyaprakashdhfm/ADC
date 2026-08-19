'use client';
import { useState, useEffect } from 'react';
import { RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  adminGetStoreStatus, adminToggleStoreStatus, adminGetStoreProducts, adminSetStoreProductOverride,
  adminSetStoreServiceMode,
  type AdminStoreStatus, type AdminStoreProduct, type StoreServiceMode,
} from '@/lib/api';
import { card, iconBtn, actionBtn, Panel, Badge, Empty } from '../shared/ui';

/*
 * Every store, online or off (including Begur, which has no staff portal so it never appears in the
 * "Stores" panel below) — and, per store, a flat on/off for each product. This generalizes the
 * product-level intracity/intercity toggle (which only ever understands "restricted to city X") to
 * any one-off case an admin wants to flip directly, no code change: a store fully out of an
 * ingredient today, or the reverse. An explicit override here always wins over the automatic rule.
 */
export default function StoreAvailabilityPanel({ setErr, setNotice }: { setErr: (s: string) => void; setNotice: (s: string) => void }) {
  const [stores, setStores] = useState<AdminStoreStatus[] | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [products, setProducts] = useState<AdminStoreProduct[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // a store code, or "code:productId", currently saving

  const load = () => adminGetStoreStatus().then(r => setStores(r.stores)).catch(() => setStores([]));
  useEffect(() => { load(); }, []);

  const toggleStore = async (code: string) => {
    setBusy(code); setErr('');
    try { const r = await adminToggleStoreStatus(code); setNotice(r.isActive ? 'Store is back online.' : 'Store taken offline — it will stop receiving new orders.'); load(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'That did not work'); }
    finally { setBusy(null); }
  };

  const toggleProducts = async (code: string) => {
    if (openCode === code) { setOpenCode(null); return; }
    setOpenCode(code); setProducts(null);
    try { setProducts((await adminGetStoreProducts(code)).products); }
    catch { setProducts([]); }
  };

  /* Which delivery kinds a store takes part in. Narrowing every store in one zone to Parcels only
     does not close that zone — the server falls back to the nearest open store rather than refusing
     the city — so this cannot accidentally stop same-day for a whole city. */
  const setServiceMode = async (code: string, mode: StoreServiceMode) => {
    setBusy(`${code}:mode`); setErr('');
    try {
      await adminSetStoreServiceMode(code, mode);
      setNotice(mode === 'BOTH' ? 'Store takes both same-day and parcel orders.'
        : mode === 'INTRACITY' ? 'Store is same-day only — it will not be used as an outstation pickup.'
        : 'Store is parcels only — it will not be picked for same-day.');
      load();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'That did not work'); }
    finally { setBusy(null); }
  };

  const setOverride = async (code: string, productId: number, available: boolean | null) => {
    setBusy(`${code}:${productId}`); setErr('');
    try {
      await adminSetStoreProductOverride(code, productId, available);
      setProducts((await adminGetStoreProducts(code)).products);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'That did not work'); }
    finally { setBusy(null); }
  };

  return (
    <Panel title="Store &amp; product availability" loading={stores === null} action={<button onClick={load} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
        Take a whole store offline (it stops receiving new orders) or turn one product on/off for just one store —
        e.g. Red Velvet already hides outside Bengaluru automatically, but this also lets you turn it off at a
        single Bengaluru store specifically, for a one-off reason like running out of it for the day.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {stores?.map(s => (
          <div key={s.code} style={{ ...card, padding: 14, opacity: busy === s.code ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{s.name}</strong>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{s.city}</span>
              <Badge text={s.isActive ? 'Online' : 'Offline'} ok={s.isActive} />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Three-way, not two toggles: the states are mutually exclusive, and a pair of
                    checkboxes would let an admin turn both off and mean nothing by it. */}
                <span style={{ display: 'inline-flex', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-strong)', overflow: 'hidden' }}>
                  {([['BOTH', 'Both'], ['INTRACITY', 'Same-day'], ['INTERCITY', 'Parcels']] as [StoreServiceMode, string][]).map(([mode, label]) => (
                    <button key={mode} disabled={busy === `${s.code}:mode` || s.serviceMode === mode}
                      onClick={() => setServiceMode(s.code, mode)}
                      title={mode === 'BOTH' ? 'Same-day and outstation parcels' : mode === 'INTRACITY' ? 'Same-day only — never an outstation pickup' : 'Outstation parcels only — not picked for same-day'}
                      style={{
                        border: 'none', padding: '5px 11px', fontFamily: 'var(--font-body)', fontSize: 'var(--text-2xs)', fontWeight: 800,
                        cursor: s.serviceMode === mode ? 'default' : 'pointer',
                        background: s.serviceMode === mode ? 'var(--gradient-warm)' : 'var(--surface-raised)',
                        color: s.serviceMode === mode ? 'var(--white)' : 'var(--text-muted)',
                      }}>{label}</button>
                  ))}
                </span>
                <button onClick={() => toggleProducts(s.code)} style={actionBtn()}>
                  {openCode === s.code ? 'Hide products' : 'Products'}
                </button>
                <button disabled={busy === s.code} onClick={() => toggleStore(s.code)} style={actionBtn(s.isActive)}>
                  {s.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />} {s.isActive ? 'Take offline' : 'Bring online'}
                </button>
              </div>
            </div>
            {openCode === s.code && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
                {products === null ? (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Loading…</span>
                ) : !products.length ? (
                  <Empty text="No available products." />
                ) : (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {products.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                        <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{p.name}</span>
                        {p.isOverride
                          ? <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--brand-secondary)', fontWeight: 800 }}>manual override</span>
                          : !p.automaticallyAvailable && <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 800 }}>auto-restricted here</span>}
                        <button disabled={busy === `${s.code}:${p.id}`} onClick={() => setOverride(s.code, p.id, !p.available)} style={actionBtn(!p.available)}>
                          {p.available ? <ToggleRight size={13} /> : <ToggleLeft size={13} />} {p.available ? 'On' : 'Off'}
                        </button>
                        {p.isOverride && (
                          <button disabled={busy === `${s.code}:${p.id}`} onClick={() => setOverride(s.code, p.id, null)} style={actionBtn()}>Reset</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/*
 * One store: where its staff sign in, who can, and what it is sitting on.
 *
 * The password handling here is the honest kind. Hashes cannot be read back, so there is no way to
 * answer "what is their password" for an account in use — and pretending otherwise by storing a
 * copy would be worse than useless. Instead: a brand-new account shows the starting password it was
 * created with, and the moment it is used or changed that stops being shown and the only move left
 * is to set a new one, which the admin then hands over in person.
 */
