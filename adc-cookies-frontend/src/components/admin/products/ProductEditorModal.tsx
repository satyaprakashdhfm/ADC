'use client';
import { X, Check } from 'lucide-react';
import { type ProductInput } from '@/lib/api';
import { inp, addBtn, iconBtn, Field } from '../shared/ui';
import DeliveryModeToggle from './DeliveryModeToggle';

type Editing = { id?: number; data: ProductInput };

interface Props {
  editing: Editing;
  setEditing: (e: Editing | null) => void;
  onSave: () => void;
}

export default function ProductEditorModal({ editing, setEditing, onSave }: Props) {
  const set = (patch: Partial<ProductInput>) => setEditing({ ...editing, data: { ...editing.data, ...patch } });
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
              <select style={inp} value={editing.data.category} onChange={e => set({ category: e.target.value as 'COOKIES' | 'TINS' })}>
                <option value="COOKIES">COOKIES</option><option value="TINS">TINS</option>
              </select>
            </Field>
            <Field label="Menu group"><input style={inp} value={editing.data.menuGroup || ''} onChange={e => set({ menuGroup: e.target.value })} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Price ₹"><input type="number" style={inp} value={editing.data.price} onChange={e => set({ price: Number(e.target.value) })} /></Field>
            <Field label="Stock"><input type="number" style={inp} value={editing.data.stockQuantity} onChange={e => set({ stockQuantity: Number(e.target.value) })} /></Field>
            <Field label="Tag"><input style={inp} value={editing.data.tag || ''} onChange={e => set({ tag: e.target.value })} /></Field>
          </div>
          <Field label="Description"><textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={editing.data.description || ''} onChange={e => set({ description: e.target.value })} /></Field>
          <Field label="Image path (e.g. /assets/products/adc-special.jpg or JSON array)"><input style={inp} value={editing.data.images || ''} onChange={e => set({ images: e.target.value })} /></Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-body)', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!editing.data.featured} onChange={e => set({ featured: e.target.checked })} /> Featured
          </label>
          <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-input)', padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Which delivery methods this product can go on, right now. Checked at checkout AND at order
              creation — turning either off is enforced, not just labelled.
            </p>
            <DeliveryModeToggle
              label="Intracity — same-day, from one of our stores"
              available={editing.data.intracityAvailable !== false}
              reason={editing.data.intracityUnavailableReason || ''}
              onToggle={v => set({ intracityAvailable: v })}
              onReason={r => set({ intracityUnavailableReason: r })}
            >
              {editing.data.intracityAvailable !== false && (
                <Field label="Only deliver same-day within (city, optional)">
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
