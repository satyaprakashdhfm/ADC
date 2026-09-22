'use client';
import { LogIn, UserPlus } from 'lucide-react';
import type { AdminTraffic } from '@/lib/api';
import { MiniStat, Empty } from '../shared/ui';
import { num } from './trafficFormat';

type SignInData = NonNullable<AdminTraffic['google']['signIns']>;

/**
 * Sign-ins on the storefront: customers signing back in, and brand-new accounts.
 *
 * Phone versus Google appears only once the sign-in `method` is registered in Google Analytics as a
 * custom dimension. Until then the two totals stand alone — setup steps are not dashboard content.
 */
export default function SignIns({ data }: { data: SignInData }) {
  if (!data.existing && !data.newAccounts) return <Empty text="Nobody signed in during this period." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <MiniStat label="Returning customers signed in" value={num(data.existing)} />
        <MiniStat label="New accounts created" value={num(data.newAccounts)} />
      </div>
      {!!data.byMethod?.length && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.byMethod.map(m => (
            <div key={m.method} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 'var(--text-sm)', padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{m.method}</span>
              <span style={{ color: 'var(--text-muted)', display: 'flex', gap: 14 }}>
                <span title="Returning customers"><LogIn size={13} style={{ verticalAlign: -2 }} /> {num(m.existing)}</span>
                <span title="New accounts"><UserPlus size={13} style={{ verticalAlign: -2 }} /> {num(m.newAccounts)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
