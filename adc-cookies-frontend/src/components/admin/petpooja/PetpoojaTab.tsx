'use client';
import { Plus, RefreshCw } from 'lucide-react';
import {
  adminGetPetpoojaMapping, adminGetPetpoojaRelays, adminLinkProductToPetpooja,
  adminCreateProductFromPetpooja,
  type PetpoojaMapping, type PetpoojaRelay, type PetpoojaItem,
} from '@/lib/api';
import { money, fmtDate } from '../shared/format';
import { td, inp, iconBtn, actionBtn, MiniStat, Panel, Table, Badge, Empty, Field, FilterBar } from '../shared/ui';

interface Props {
  ppMap: PetpoojaMapping | null;
  setPpMap: React.Dispatch<React.SetStateAction<PetpoojaMapping | null>>;
  ppRelays: PetpoojaRelay[] | null;
  setPpRelays: React.Dispatch<React.SetStateAction<PetpoojaRelay[] | null>>;
  ppBusy: string | null; setPpBusy: (v: string | null) => void;
  ppSearch: string; setPpSearch: (v: string) => void;
  ppOnlyUnlinked: boolean; setPpOnlyUnlinked: (v: boolean) => void;
  refreshProducts: () => void;
  refreshAttention: () => void;
  setErr: (s: string) => void;
  setNotice: (s: string) => void;
}

export default function PetpoojaTab({
  ppMap, setPpMap, ppRelays, setPpRelays, ppBusy, setPpBusy, ppSearch, setPpSearch,
  ppOnlyUnlinked, setPpOnlyUnlinked, refreshProducts, refreshAttention,
  setErr, setNotice,
}: Props) {
  return (
    () => {
              const key = (i: { item_id: string; variation_id: string }) => `${i.item_id}|${i.variation_id}`;
              const reload = () => { adminGetPetpoojaMapping().then(setPpMap).catch(() => {}); refreshAttention(); };
              const linkByProduct = async (productId: number, composite: string) => {
                setPpBusy('p' + productId); setErr('');
                const [itemId, variationId] = composite ? composite.split('|') : [null, ''];
                try { await adminLinkProductToPetpooja(productId, itemId, variationId || ''); reload(); }
                catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not save the link'); }
                finally { setPpBusy(null); }
              };
              const createAndLink = async (i: { item_id: string; variation_id: string; name: string }) => {
                setPpBusy(key(i)); setErr(''); setNotice('');
                try {
                  const r = await adminCreateProductFromPetpooja(i.item_id, i.variation_id);
                  setNotice(r.created ? `Created "${r.product.name}" and linked it.` : `Linked to the existing product "${r.product.name}".`);
                  reload(); refreshProducts();
                } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Could not create the product'); }
                finally { setPpBusy(null); }
              };
              const q = ppSearch.trim().toLowerCase();
              const rows = (ppMap?.items || []).filter(i => {
                if (ppOnlyUnlinked && i.product_id) return false;
                if (!q) return true;
                return i.name.toLowerCase().includes(q) || (i.variation_name || '').toLowerCase().includes(q) || i.item_id.includes(q);
              });
              const linked = (ppMap?.items || []).filter(i => i.product_id).length;
              const total = ppMap?.items.length || 0;
              const lastPush = ppMap?.pushes?.[0];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Menu status. Petpooja PUSHES the catalogue to us — menu fetch is deprecated on their
                      side — so this panel is the only place the arrival of a menu is visible. */}
                  <Panel title="Menu from Petpooja" loading={ppMap === null}
                    action={<button onClick={reload} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
                    {ppMap && (!ppMap.menuSynced ? (
                      <Empty text="No menu received yet. Petpooja pushes the catalogue to us — ask them to trigger it, we cannot pull it." />
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
                          <MiniStat label="Items in menu" value={String(total)} />
                          <MiniStat label="Linked to products" value={`${linked} / ${total}`} bad={linked < total} />
                          <MiniStat label="Restaurant code" value={ppMap.restId} />
                          <MiniStat label="Last received" value={lastPush ? fmtDate(lastPush.received_at) : '—'} />
                        </div>
                        {linked < total && (
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700, margin: '0 0 12px', lineHeight: 1.5 }}>
                            {total - linked} item{total - linked !== 1 ? 's are' : ' is'} not linked to a product. An order reaches the kitchen only when
                            every product it contains has a Petpooja item — one unlinked product fails the whole relay.
                          </p>
                        )}
                        <details>
                          <summary style={{ cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-muted)' }}>
                            Push history ({ppMap.pushes.length}) and taxes ({ppMap.taxes.length})
                          </summary>
                          <div style={{ marginTop: 10 }}>
                            <Table head={['Received', 'Restaurant', 'Source', 'Items']}>
                              {ppMap.pushes.map(p => (
                                <tr key={p.id}>
                                  <td style={td}>{fmtDate(p.received_at)}</td>
                                  <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{p.rest_id}</span></td>
                                  <td style={td}>{p.source}</td>
                                  <td style={td}>{p.item_count}</td>
                                </tr>
                              ))}
                            </Table>
                            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginTop: 8 }}>
                              Taxes: {ppMap.taxes.map(t => `${t.name} ${t.percentage}%`).join(' · ') || 'none'}
                            </p>
                          </div>
                        </details>
                      </>
                    ))}
                  </Panel>

                  {/* Petpooja owns the menu and there is no API to change it from here. Saying so in
                      the product is better than leaving someone hunting for a button that cannot exist:
                      their integration exposes save_order, update_order_status and rider_status_update
                      outbound, and menu/stock/store-status inbound. Nothing creates or edits an item. */}
                  <Panel title="Changing the menu">
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ margin: 0 }}>
                        <strong>The menu is edited in Petpooja, never here.</strong> Their integration has no
                        create-item or edit-item endpoint — we can only receive. So a price change, a new cookie or a
                        withdrawn one is made on the Petpooja dashboard, and their system pushes the whole catalogue
                        to us within moments. Nobody needs to tell us; the push above records every arrival.
                      </p>
                      <p style={{ margin: 0 }}>
                        We <strong>update in place and never delete</strong>. An item that changes keeps its link to
                        your product, so prices and names can change freely without breaking anything. A brand-new
                        item arrives unlinked and appears below as not linked to anything. An item they remove simply
                        stops appearing in their pushes.
                      </p>
                      <p style={{ margin: 0 }}>
                        After any menu change, check the <em>done</em> count below. If it dropped, something new needs
                        linking before an order containing it can reach the kitchen.
                      </p>
                      <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                        Marking an item out of stock is separate and instant — that arrives on its own feed the
                        moment the kitchen toggles it, without a full menu push.
                      </p>
                      <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                        To change what the <em>website</em> sells or charges, use the Products tab. Our price is what
                        the customer pays and what Razorpay settles; theirs only prints on the POS bill.
                      </p>
                    </div>
                  </Panel>

                  {ppMap?.menuSynced && (() => {
                    /*
                     * Rows are OUR products, not theirs. Our catalogue is the fixed set we sell; theirs
                     * is larger and contains items we never list online. Product-first means every row
                     * matters and "what is still unmapped" is visible without hunting.
                     */
                    const itemFor = new Map<number, PetpoojaItem>();
                    for (const i of ppMap.items) if (i.product_id) itemFor.set(i.product_id, i);
                    const label = (i: PetpoojaItem) =>
                      `${i.name}${i.variation_name ? ' — ' + i.variation_name : ''}${i.price != null ? `  (₹${i.price})` : ''}`;
                    const claimedBy = new Map<string, number>();
                    for (const i of ppMap.items) if (i.product_id) claimedBy.set(`${i.item_id}|${i.variation_id}`, i.product_id);

                    const pq = ppSearch.trim().toLowerCase();
                    const prodRows = (ppMap.products || []).filter(p => {
                      if (ppOnlyUnlinked && itemFor.has(p.id)) return false;
                      return !pq || p.name.toLowerCase().includes(pq);
                    });
                    const mapped = (ppMap.products || []).filter(p => itemFor.has(p.id)).length;
                    const spare = ppMap.items.filter(i => !i.product_id);

                    return (
                      <Panel title={`Link your products to Petpooja items — ${mapped} of ${ppMap.products.length} done`}>
                        <FilterBar search={ppSearch} onSearch={setPpSearch} placeholder="Search your products…"
                          active={ppOnlyUnlinked} onClear={() => { setPpSearch(''); setPpOnlyUnlinked(false); }}>
                          <Field label="Show">
                            <select value={ppOnlyUnlinked ? 'unlinked' : 'all'} onChange={e => setPpOnlyUnlinked(e.target.value === 'unlinked')}
                              style={{ ...inp, cursor: 'pointer' }}>
                              <option value="all">All products</option>
                              <option value="unlinked">Not linked only</option>
                            </select>
                          </Field>
                        </FilterBar>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                          Every product that can appear in a web order needs a Petpooja item, or that order will not reach the kitchen.
                          Petpooja items you do not sell online (coffees, combo packs) can be left alone.
                        </p>
                        <Table head={['Your product', 'Your price', 'Petpooja item', 'Their price']}>
                          {prodRows.map(p => {
                            const cur = itemFor.get(p.id) || null;
                            const busy = ppBusy === `p${p.id}`;
                            return (
                              <tr key={p.id} style={{ opacity: busy ? 0.5 : 1 }}>
                                <td style={td}>
                                  <strong style={{ color: 'var(--text-strong)' }}>{p.name}</strong>
                                  {!cur && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--status-error)', fontWeight: 800, marginTop: 2 }}>not linked</div>}
                                </td>
                                <td style={td}>{money(p.price)}</td>
                                <td style={td}>
                                  <select value={cur ? `${cur.item_id}|${cur.variation_id}` : ''} disabled={busy}
                                    onChange={e => linkByProduct(p.id, e.target.value)}
                                    style={{ ...inp, cursor: 'pointer', minWidth: 260, padding: '7px 10px' }}>
                                    <option value="">— not linked —</option>
                                    {ppMap.items.map(i => {
                                      const k = `${i.item_id}|${i.variation_id}`;
                                      const owner = claimedBy.get(k);
                                      const taken = owner != null && owner !== p.id;
                                      return <option key={k} value={k} disabled={taken}>
                                        {label(i)}{taken ? '  — already linked' : ''}
                                      </option>;
                                    })}
                                  </select>
                                </td>
                                <td style={td}>
                                  {cur?.price != null ? (
                                    <>
                                      {money(cur.price)}
                                      {Number(cur.price) !== Number(p.price) && (
                                        <div title="Their price differs from yours. The customer is charged YOUR price; theirs only appears on the POS bill."
                                          style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginTop: 2 }}>differs from yours</div>
                                      )}
                                    </>
                                  ) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </Table>
                        {!prodRows.length && <Empty text="No products match." />}
                        {spare.length > 0 && (
                          <details style={{ marginTop: 14 }}>
                            <summary style={{ cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-muted)' }}>
                              {spare.length} Petpooja item{spare.length !== 1 ? 's' : ''} not linked to anything
                            </summary>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '8px 0 10px', lineHeight: 1.5 }}>
                              These exist on the POS but not on your site. That is fine for anything you do not sell online. If you do want to
                              sell one, create it as a product and link it in one step.
                            </p>
                            <Table head={['Petpooja item', 'Their price', 'Stock', '']}>
                              {spare.map(i => (
                                <tr key={`${i.item_id}|${i.variation_id}`}>
                                  <td style={td}>
                                    {i.name}{i.variation_name && <span style={{ color: 'var(--text-muted)' }}> — {i.variation_name}</span>}
                                    <br /><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>{i.item_id}</span>
                                  </td>
                                  <td style={td}>{i.price != null ? money(i.price) : '—'}</td>
                                  <td style={td}>{i.in_stock ? <Badge text="In stock" ok /> : <Badge text="Out" />}</td>
                                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                    <button disabled={ppBusy === `${i.item_id}|${i.variation_id}`} onClick={() => createAndLink(i)} style={actionBtn()}
                                      title="Create this as one of your products and link them">
                                      <Plus size={13} /> Add as product
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </Table>
                          </details>
                        )}
                      </Panel>
                    );
                  })()}

                  <Panel title="Orders sent to the POS" loading={ppRelays === null}
                    action={<button onClick={() => adminGetPetpoojaRelays().then(setPpRelays).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
                    {ppRelays && (ppRelays.length ? (
                      <Table head={['Order', 'Total', 'Reached kitchen?', 'Their order id', 'Attempts', 'When']}>
                        {ppRelays.map(r => (
                          <tr key={r.order_id}>
                            <td style={td}><strong style={{ color: 'var(--text-link)' }}>{r.order_number}</strong></td>
                            <td style={td}>{money(r.total_amount)}</td>
                            <td style={td}>
                              {r.relay_ok ? <Badge text="Yes" ok /> : <Badge text="Failed" />}
                              {!r.relay_ok && r.last_error && <div style={{ marginTop: 3, fontSize: 'var(--text-2xs)', color: 'var(--status-error)', maxWidth: 300 }}>{r.last_error}</div>}
                            </td>
                            <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{r.petpooja_order_id || '—'}</span></td>
                            <td style={td}>{r.attempts}</td>
                            <td style={td}>{fmtDate(r.updated_at)}</td>
                          </tr>
                        ))}
                      </Table>
                    ) : <Empty text="No orders have been sent to the POS yet." />)}
                  </Panel>
                </div>
              );
            })(
  );
}
