'use client';
import { X, Check } from 'lucide-react';
import { adminCreateWarehouse, adminUpdateWarehouse, adminGetWarehouses, type Warehouse, type WarehouseInput } from '@/lib/api';
import { inp, addBtn, iconBtn, Field } from '../shared/ui';

type WhForm = { id?: number; data: WarehouseInput };

interface Props {
  whForm: WhForm;
  setWhForm: (v: WhForm | null) => void;
  setWarehouses: React.Dispatch<React.SetStateAction<Warehouse[] | null>>;
  setErr: (s: string) => void;
}

export default function WarehouseEditorModal({ whForm, setWhForm, setWarehouses, setErr }: Props) {
  return (

    <div onClick={() => setWhForm(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px,96vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: 24 }} className="hide-sb">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ flex: 1, fontSize: 'var(--text-h3)' }}>{whForm.id ? 'Edit warehouse' : 'Add warehouse'}</h3>
          <button onClick={() => setWhForm(null)} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Warehouse name *"><input style={inp} value={whForm.data.name} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, name: e.target.value } })} /></Field>
            <Field label="Registered name"><input style={inp} value={whForm.data.registeredName || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, registeredName: e.target.value } })} /></Field>
          </div>
          <Field label="Pickup location * (must EXACTLY match the pickup name in your Delhivery panel)">
            <input style={inp} value={whForm.data.pickupLocation} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, pickupLocation: e.target.value } })} placeholder="e.g. A Dough Cookie" />
          </Field>
          <Field label="Address line 1"><input style={inp} value={whForm.data.addressLine1 || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, addressLine1: e.target.value } })} /></Field>
          <Field label="Address line 2 / Area"><input style={inp} value={whForm.data.addressLine2 || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, addressLine2: e.target.value } })} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="City"><input style={inp} value={whForm.data.city || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, city: e.target.value } })} /></Field>
            <Field label="State"><input style={inp} value={whForm.data.state || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, state: e.target.value } })} /></Field>
            <Field label="Pincode *"><input style={inp} value={whForm.data.pincode} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, pincode: e.target.value } })} placeholder="500034" maxLength={6} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Phone"><input style={inp} value={whForm.data.phone || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, phone: e.target.value } })} /></Field>
            <Field label="Email"><input style={inp} value={whForm.data.email || ''} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, email: e.target.value } })} /></Field>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!whForm.data.isDefault} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, isDefault: e.target.checked } })} /> Set as default warehouse
          </label>
          {!whForm.id && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!whForm.data.skipDelhivery} onChange={e => setWhForm({ ...whForm, data: { ...whForm.data, skipDelhivery: e.target.checked } })} style={{ marginTop: 2 }} />
              <span>Already registered on Delhivery One Panel<br /><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Skip re-registering — the pickup location key above must match exactly what&apos;s in Delhivery.</span></span>
            </label>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              disabled={!whForm.data.name || !whForm.data.pickupLocation || !whForm.data.pincode}
              onClick={async () => {
                try {
                  if (whForm.id) {
                    await adminUpdateWarehouse(whForm.id, whForm.data);
                  } else {
                    await adminCreateWarehouse(whForm.data);
                  }
                  setWhForm(null);
                  adminGetWarehouses().then(setWarehouses).catch(() => {});
                } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Save failed'); }
              }}
              style={{ ...addBtn, flex: 1, justifyContent: 'center', opacity: (!whForm.data.name || !whForm.data.pickupLocation || !whForm.data.pincode) ? 0.5 : 1 }}>
              <Check size={16} /> Save warehouse
            </button>
            <button onClick={() => setWhForm(null)} style={{ padding: '12px 18px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
