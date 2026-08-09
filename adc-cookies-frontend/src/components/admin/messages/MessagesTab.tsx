'use client';
import { Check } from 'lucide-react';
import { type AdminMessage } from '@/lib/api';
import { PAGE_SIZE } from '@/hooks/admin/usePagination';
import { fmtDate } from '../shared/format';
import { card, inp, iconBtn, Panel, Empty, Field, FilterBar, Pager } from '../shared/ui';

interface Props {
  messages: AdminMessage[] | null;
  search: string;
  onSearch: (v: string) => void;
  handledFilter: string;
  onHandledFilter: (v: string) => void;
  onMarkHandled: (id: number) => void;
  page: number;
  onPage: (n: number) => void;
}

export default function MessagesTab({ messages, search, onSearch, handledFilter, onHandledFilter, onMarkHandled, page, onPage }: Props) {
  const mq = search.trim().toLowerCase();
  const list = (messages || []).filter(m => {
    if (handledFilter === 'open' && m.handled) return false;
    if (handledFilter === 'done' && !m.handled) return false;
    if (!mq) return true;
    return m.name.toLowerCase().includes(mq) || (m.email || '').toLowerCase().includes(mq) || m.message.toLowerCase().includes(mq);
  });
  const search1 = (v: string) => { onSearch(v); onPage(1); };
  const filter1 = (v: string) => { onHandledFilter(v); onPage(1); };
  const clear = () => { onHandledFilter(''); onSearch(''); onPage(1); };
  const selStyle = { ...inp, cursor: 'pointer' } as React.CSSProperties;

  return (
    <Panel title={`Contact messages${messages ? ` (${list.length})` : ''}`} loading={messages === null}>
      <FilterBar search={search} onSearch={search1} placeholder="Search sender or message…" active={!!handledFilter} onClear={clear}>
        <Field label="Status"><select value={handledFilter} onChange={e => filter1(e.target.value)} style={selStyle}><option value="">All messages</option><option value="open">Unhandled only</option><option value="done">Handled only</option></select></Field>
      </FilterBar>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(m => (
          <div key={m.id} style={{ ...card, padding: 16, opacity: m.handled ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <strong style={{ color: 'var(--text-strong)' }}>{m.name}</strong>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{m.email}{m.phone ? ` · ${m.phone}` : ''}</span>
              <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>{fmtDate(m.createdAt)}</span>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.6, marginBottom: 10 }}>{m.message}</p>
            {!m.handled
              ? <button onClick={() => onMarkHandled(m.id)} style={{ ...iconBtn, width: 'auto', padding: '7px 14px', fontWeight: 700, fontSize: 'var(--text-sm)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={15} /> Mark handled</button>
              : <span style={{ fontSize: 'var(--text-sm)', color: 'var(--status-success)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={15} /> Handled</span>}
          </div>
        ))}
      </div>
      {messages && !list.length && <Empty text={messages.length ? 'No messages match the filter.' : 'No messages yet.'} />}
      <Pager page={page} total={list.length} pageSize={PAGE_SIZE} onPage={onPage} />
    </Panel>
  );
}
