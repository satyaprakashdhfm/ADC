'use client';
import { X, Check } from 'lucide-react';
import { inp, addBtn, iconBtn, Field } from '../shared/ui';
import { type CouponDraft } from './couponForm';

interface Props {
  couponForm: CouponDraft;
  setCouponForm: React.Dispatch<React.SetStateAction<CouponDraft | null>>;
  onSave: () => void;
}

export default function CouponEditorModal({ couponForm, setCouponForm, onSave }: Props) {
  const close = () => setCouponForm(null);
  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(480px,96vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: 24 }} className="hide-sb">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ flex: 1, fontSize: 'var(--text-h3)' }}>{couponForm.editId != null ? 'Edit' : 'New'} {couponForm.isSpin ? 'Spin Wheel offer' : 'coupon'}</h3>
          <button onClick={close} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Code"><input style={inp} value={couponForm.code} onChange={e => setCouponForm(f => f && ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="WELCOME10" /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Discount type"><select style={{ ...inp, cursor: 'pointer' }} value={couponForm.discountType} onChange={e => setCouponForm(f => f && ({ ...f, discountType: e.target.value as 'PERCENTAGE' | 'FIXED' }))}><option value="PERCENTAGE">Percentage (%)</option><option value="FIXED">Fixed (₹)</option></select></Field>
            <Field label={couponForm.discountType === 'PERCENTAGE' ? 'Percent off' : 'Amount off (₹)'}><input style={inp} type="number" min="0" value={couponForm.discountValue} onChange={e => setCouponForm(f => f && ({ ...f, discountValue: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Min order (₹)"><input style={inp} type="number" min="0" value={couponForm.minimumOrderAmount} onChange={e => setCouponForm(f => f && ({ ...f, minimumOrderAmount: e.target.value }))} placeholder="Optional" /></Field>
            <Field label="Max discount (₹)"><input style={inp} type="number" min="0" value={couponForm.maximumDiscount} onChange={e => setCouponForm(f => f && ({ ...f, maximumDiscount: e.target.value }))} placeholder="Optional cap" /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Valid for (days)"><input style={inp} type="number" min="1" value={couponForm.validDays} onChange={e => setCouponForm(f => f && ({ ...f, validDays: e.target.value }))} placeholder="Blank = no expiry" /></Field>
            <Field label="Total uses limit"><input style={inp} type="number" min="1" value={couponForm.usageLimit} onChange={e => setCouponForm(f => f && ({ ...f, usageLimit: e.target.value }))} placeholder="Blank = unlimited" /></Field>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>The coupon auto-stops when it expires or hits its use limit — no need to disable it manually.</p>

          <button type="button" onClick={() => setCouponForm(f => f && ({ ...f, isSpin: !f.isSpin }))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center', border: couponForm.isSpin ? 'none' : '2px solid var(--border-strong)', background: couponForm.isSpin ? 'var(--gradient-warm)' : 'transparent', color: 'var(--white)', flex: 'none' }}>{couponForm.isSpin && <Check size={13} strokeWidth={3} />}</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>Show on the Spin &amp; Win wheel</span>
          </button>

          {couponForm.isSpin && (
            <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 'var(--radius-card)', background: 'var(--surface-raised)', border: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Wheel label"><input style={inp} value={couponForm.spinLabel} onChange={e => setCouponForm(f => f && ({ ...f, spinLabel: e.target.value }))} placeholder="e.g. Free Cookie Tin" /></Field>
                <Field label="Weight — odds (%)"><input style={inp} type="number" min="0" max="100" step="0.01" value={couponForm.spinWeight} onChange={e => setCouponForm(f => f && ({ ...f, spinWeight: e.target.value }))} placeholder="e.g. 5" /></Field>
              </div>
              <Field label="Terms & conditions (shown to shoppers)">
                <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={couponForm.terms} onChange={e => setCouponForm(f => f && ({ ...f, terms: e.target.value }))} placeholder="e.g. Valid on orders of ₹200 or more. One reward per account. Cannot be combined with other offers." />
              </Field>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onSave} style={{ ...addBtn, flex: 1, justifyContent: 'center' }}>{couponForm.editId != null ? 'Save changes' : couponForm.isSpin ? 'Create offer' : 'Create coupon'}</button>
            <button onClick={close} style={{ ...iconBtn, width: 'auto', padding: '0 16px', fontWeight: 700 }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
