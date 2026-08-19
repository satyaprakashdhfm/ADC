'use client';
import { useState } from 'react';
import { X, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { type ProductInput } from '@/lib/api';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@/lib/categories';
import { type ProductEditing } from '@/hooks/admin/useAdminProducts';
import { inp, addBtn, iconBtn, Field } from '../shared/ui';
import DeliveryModeToggle from './DeliveryModeToggle';
import ProductImagesField, { toSlots, type ImageSlot } from './ProductImagesField';

interface Props {
  editing: ProductEditing;
  setEditing: (e: ProductEditing | null) => void;
  onSave: () => void;
}

export default function ProductEditorModal({ editing, setEditing, onSave }: Props) {
  const set = (patch: Partial<ProductInput>) => setEditing({ ...editing, data: { ...editing.data, ...patch } });

  /* Slots pair each stored ref with the signed URL that can display it. Seeded once from the row —
     after that this component owns them, and the parent only ever sees the refs. */
  const [slots, setSlots] = useState<ImageSlot[]>(() => toSlots(editing.data.imageRefs || [], editing.images));
  const changeImages = (next: ImageSlot[]) => { setSlots(next); set({ imageRefs: next.map(s => s.ref) }); };

  const available = editing.data.isAvailable !== false;

  return (
    <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px,96vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: 24 }} className="hide-sb">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ flex: 1, fontSize: 'var(--text-h3)' }}>{editing.id ? 'Edit product' : 'New product'}</h3>
          <button onClick={() => setEditing(null)} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Name"><input style={inp} value={editing.data.name} onChange={e => set({ name: e.target.value })} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Category">
              {/* Options come from the shared registry, so a category added there shows up here and
                  on the storefront together — the old hard-coded pair let an admin save a product
                  into a category the menu had no section for, which made it vanish silently. */}
              <select style={inp} value={editing.data.category} onChange={e => set({ category: e.target.value as ProductCategory })}>
                {PRODUCT_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Menu group"><input style={inp} value={editing.data.menuGroup || ''} onChange={e => set({ menuGroup: e.target.value })} /></Field>
          </div>
          {/* Two columns, not three. The third used to be "Stock", which nothing ever decremented. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Price ₹"><input type="number" style={inp} value={editing.data.price} onChange={e => set({ price: Number(e.target.value) })} /></Field>
            <Field label="Tag"><input style={inp} value={editing.data.tag || ''} onChange={e => set({ tag: e.target.value })} /></Field>
          </div>
          <Field label="Description"><textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={editing.data.description || ''} onChange={e => set({ description: e.target.value })} /></Field>

          <ProductImagesField slots={slots} onChange={changeImages} />

          {/*
            The master switch, which this form did not have at all: isAvailable could be filtered on
            in the list but never set, so the only way to take a product off the menu was to delete
            it. It is above the per-mode toggles because it overrules both — off here means off
            everywhere, whatever they say.
          */}
          <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-input)', padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>Available to order</div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                {available ? 'On the menu, subject to the delivery modes below.' : 'Hidden from the menu everywhere, whatever the settings below say.'}
              </div>
            </div>
            <button type="button" onClick={() => set({ isAvailable: !available })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 'var(--radius-pill)', flex: 'none',
                border: `1.5px solid ${available ? 'var(--border-default)' : 'var(--status-error)'}`,
                background: available ? 'var(--surface-card)' : 'var(--status-error-bg)',
                color: available ? 'var(--text-body)' : 'var(--status-error)',
                fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: 'pointer',
              }}>
              {available ? <ToggleRight size={16} color="var(--brand-secondary)" /> : <ToggleLeft size={16} />}
              {available ? 'Available' : 'Unavailable'}
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-body)', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!editing.data.featured} onChange={e => set({ featured: e.target.checked })} /> Featured
          </label>
          <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-input)', padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Which delivery methods this product can go on, right now. Checked at checkout AND at order
              creation — turning either off is enforced, not just labelled.
            </p>
            {/* "Intracity" and "Intercity" throughout, matching the product list, the store
                availability panel and the delivery settings. This form used to say Intracity while
                the list said "Same-day" and "Parcel", so the same two switches had four names. */}
            <DeliveryModeToggle
              label="Intracity — same-day, from one of our stores"
              available={editing.data.intracityAvailable !== false}
              reason={editing.data.intracityUnavailableReason || ''}
              onToggle={v => set({ intracityAvailable: v })}
              onReason={r => set({ intracityUnavailableReason: r })}
            >
              {editing.data.intracityAvailable !== false && (
                <Field label="Only deliver intracity within (city, optional)">
                  <input style={inp} placeholder="e.g. Bengaluru" value={editing.data.restrictCities || ''}
                    onChange={e => set({ restrictCities: e.target.value })} />
                </Field>
              )}
            </DeliveryModeToggle>
            <DeliveryModeToggle
              label="Intercity — multi-day courier, anywhere else"
              available={editing.data.intercityAvailable !== false}
              reason={editing.data.intercityUnavailableReason || ''}
              onToggle={v => set({ intercityAvailable: v })}
              onReason={r => set({ intercityUnavailableReason: r })}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {(() => {
              const missingReason = (editing.data.intracityAvailable === false && !(editing.data.intracityUnavailableReason || '').trim())
                || (editing.data.intercityAvailable === false && !(editing.data.intercityUnavailableReason || '').trim());
              const disabled = !editing.data.name || !editing.data.price || missingReason;
              return <button onClick={onSave} disabled={disabled} style={{ ...addBtn, flex: 1, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}><Check size={16} /> Save</button>;
            })()}
            <button onClick={() => setEditing(null)} style={{ padding: '12px 18px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
