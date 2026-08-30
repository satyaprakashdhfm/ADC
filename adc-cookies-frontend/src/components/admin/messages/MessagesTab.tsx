'use client';
import { useState } from 'react';
import { Check } from 'lucide-react';
import { type AdminMessage, type AdminTicket, type AdminTicketStatus } from '@/lib/api';
import { PAGE_SIZE } from '@/hooks/admin/usePagination';
import { fmtDate } from '../shared/format';
import { card, inp, iconBtn, Panel, Empty, Field, FilterBar, Pager } from '../shared/ui';
import TicketsPanel from './TicketsPanel';

/*
 * Two inboxes, one tab.
 *
 * Contact messages come from the website form; support tickets come from the chat, raised when the
 * assistant was asked for something it has no authority to do (cancel, refund, change an address).
 * Different origins, but the same job to whoever is on this screen: somebody wants a person.
 *
 * They are a switch rather than two stacked panels because each has its own search, filter and
 * pager, and stacking those would put six controls on one screen for two lists you read one at a
 * time. The open-ticket count sits on the tab itself so the quieter list cannot go unnoticed just
 * because it is not the one showing.
 */
interface Props {
  messages: AdminMessage[] | null;
  search: string;
  onSearch: (v: string) => void;
  handledFilter: string;
  onHandledFilter: (v: string) => void;
  onMarkHandled: (id: number) => void;
  page: number;
  onPage: (n: number) => void;
  tickets: AdminTicket[] | null;
  ticketSearch: string;
  onTicketSearch: (v: string) => void;
  ticketStatusFilter: string;
  onTicketStatusFilter: (v: string) => void;
  ticketCategoryFilter: string;
  onTicketCategoryFilter: (v: string) => void;
  onSetTicketStatus: (id: number, status: AdminTicketStatus) => void;
  ticketPage: number;
  onTicketPage: (n: number) => void;
}

export default function MessagesTab({
  messages, search, onSearch, handledFilter, onHandledFilter, onMarkHandled, page, onPage,
  tickets, ticketSearch, onTicketSearch, ticketStatusFilter, onTicketStatusFilter,
  ticketCategoryFilter, onTicketCategoryFilter, onSetTicketStatus, ticketPage, onTicketPage,
}: Props) {
  const [view, setView] = useState<'messages' | 'tickets'>('messages');

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

  const openTickets = (tickets || []).filter(t => t.status === 'OPEN').length;

  const switchBtn = (id: 'messages' | 'tickets', label: string, count?: number): React.ReactNode => (
    <button
      key={id}
      onClick={() => setView(id)}
      style={{
        padding: '7px 14px', borderRadius: 'var(--radius-pill)',
        border: view === id ? 'none' : '1.5px solid var(--border-default)',
        background: view === id ? 'var(--gradient-warm)' : 'var(--surface-card)',
        color: view === id ? 'var(--white)' : 'var(--text-body)',
        fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 7,
      }}>
      {label}
      {/* Only when there is something waiting — a zero badge is noise that trains people to skip it. */}
      {!!count && (
        <span style={{
          padding: '1px 7px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-xs)', fontWeight: 800,
          background: view === id ? 'var(--white-16)' : 'var(--status-error)',
          color: 'var(--white)',
        }}>{count}</span>
      )}
    </button>
  );

  const title = view === 'messages'
    ? `Contact messages${messages ? ` (${list.length})` : ''}`
    : `Support tickets${tickets ? ` (${tickets.length})` : ''}`;

  return (
    <Panel
      title={title}
      loading={view === 'messages' && messages === null}
      action={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[switchBtn('messages', 'Contact'), switchBtn('tickets', 'Tickets', openTickets)]}</div>}
    >
      {view === 'tickets' ? (
        <TicketsPanel
          tickets={tickets}
          search={ticketSearch}
          onSearch={onTicketSearch}
          statusFilter={ticketStatusFilter}
          onStatusFilter={onTicketStatusFilter}
          categoryFilter={ticketCategoryFilter}
          onCategoryFilter={onTicketCategoryFilter}
          onSetStatus={onSetTicketStatus}
          page={ticketPage}
          onPage={onTicketPage}
        />
      ) : (
        <>
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
        </>
      )}
    </Panel>
  );
}
