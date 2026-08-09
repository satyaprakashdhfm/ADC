'use client';
import { X, Check, AlertTriangle } from 'lucide-react';
import { addBtn, iconBtn } from '../shared/ui';

interface Props {
  cancelInfo: { orderNumber: string; ok: boolean; message: string };
  onClose: () => void;
}

export default function CancelResultModal({ cancelInfo, onClose }: Props) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px,96vw)', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: 24, borderTop: `4px solid ${cancelInfo.ok ? 'var(--status-success, #1a7f4b)' : 'var(--status-error)'}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          {cancelInfo.ok ? <Check size={20} style={{ color: 'var(--status-success, #1a7f4b)', flex: 'none', marginTop: 2 }} /> : <AlertTriangle size={20} style={{ color: 'var(--status-error)', flex: 'none', marginTop: 2 }} />}
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 'var(--text-h5, 1.05rem)', color: 'var(--text-strong)' }}>{cancelInfo.ok ? 'Cancelled' : 'Not cancelled'}</h3>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 2 }}>{cancelInfo.orderNumber}</div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.6, whiteSpace: 'pre-line', margin: '0 0 16px' }}>{cancelInfo.message}</p>
        <button onClick={onClose} style={{ ...addBtn, width: '100%', justifyContent: 'center' }}>Got it</button>
      </div>
    </div>
  );
}
