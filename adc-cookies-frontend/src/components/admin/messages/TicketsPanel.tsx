'use client';
import { useState } from 'react';
import { MessageSquare, Package } from 'lucide-react';
import { type AdminTicket, type AdminTicketStatus } from '@/lib/api';
import { PAGE_SIZE } from '@/hooks/admin/usePagination';
import { fmtDate } from '../shared/format';
import { card, inp, Empty, Field, FilterBar, Pager } from '../shared/ui';

/*
 * Support tickets raised from the chat.
 *
 * Every one of these exists because the assistant had no authority to do what was asked — it cannot
 * cancel, refund, or change an order, so raising a ticket IS its entire answer to those requests.
 * That makes an unread ticket a customer who was told "the team will pick this up" and is waiting.
 * Hence OPEN first and loudest, and a status that can be moved in one click.
 */

const STATUS_LABEL: Record<AdminTicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
};

/* Open is deliberately the only one that draws the eye. In-progress is somebody's job already, and
   resolved is history — colouring all three equally would make the list read as uniformly urgent. */
const STATUS_STYLE: Record<AdminTicketStatus, React.CSSProperties> = {
  OPEN: { background: 'var(--status-error)', color: 'var(--white)' },
  IN_PROGRESS: { background: 'var(--status-warning-bg, var(--surface-sunken))', color: 'var(--text-strong)' },
  RESOLVED: { background: 'var(--status-success-bg)', color: 'var(--status-success)' },
};

const pill: React.CSSProperties = {
  padding: '3px 9px', borderRadius: 'var(--radius-pill)',
  fontSize: 'var(--text-xs)', fontWeight: 800, whiteSpace: 'nowrap',
};

interface Props {
  tickets: AdminTicket[] | null;
  search: string;
  onSearch: (v: string) => void;
  statusFilter: string;
  onStatusFilter: (v: string) => void;
  onSetStatus: (id: number, status: AdminTicketStatus) => void;
  page: number;
  onPage: (n: number) => void;
}

export default function TicketsPanel({ tickets, search, onSearch, statusFilter, onStatusFilter, onSetStatus, page, onPage }: Props) {
  /* Which transcripts are expanded. Kept here rather than on the ticket, because it is a property of
     this screen right now, not of the ticket. */
  const [openTranscripts, setOpenTranscripts] = useState<Record<number, boolean>>({});

  const q = search.trim().toLowerCase();
  const list = (tickets || []).filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (!q) return true;
    return t.subject.toLowerCase().includes(q)
      || t.details.toLowerCase().includes(q)
      || (t.customer.name || '').toLowerCase().includes(q)
      || (t.customer.email || '').toLowerCase().includes(q)
      || (t.order?.orderNumber || '').toLowerCase().includes(q);
  });

  const search1 = (v: string) => { onSearch(v); onPage(1); };
  const filter1 = (v: string) => { onStatusFilter(v); onPage(1); };
  const clear = () => { onStatusFilter(''); onSearch(''); onPage(1); };
  const selStyle = { ...inp, cursor: 'pointer' } as React.CSSProperties;

  if (tickets === null) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;

  return (
    <>
      <FilterBar search={search} onSearch={search1} placeholder="Search subject, customer or order…" active={!!statusFilter} onClear={clear}>
        <Field label="Status">
          <select value={statusFilter} onChange={e => filter1(e.target.value)} style={selStyle}>
            <option value="">All tickets</option>
            <option value="OPEN">Open only</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </Field>
      </FilterBar>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(t => {
          const showConvo = !!openTranscripts[t.id];
          return (
            <div key={t.id} style={{ ...card, padding: 16, opacity: t.status === 'RESOLVED' ? 0.65 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ ...pill, ...STATUS_STYLE[t.status] }}>{STATUS_LABEL[t.status]}</span>
                <span style={{ ...pill, background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>{t.category}</span>
                <strong style={{ color: 'var(--text-strong)' }}>{t.subject}</strong>
                <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>#{t.id} · {fmtDate(t.createdAt)}</span>
              </div>

              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 8 }}>
                {t.customer.name || 'Unknown'}
                {t.customer.email ? ` · ${t.customer.email}` : ''}
                {t.customer.phone ? ` · ${t.customer.phone}` : ''}
              </div>

              {t.order && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--text-body)', marginBottom: 8, fontWeight: 700 }}>
                  <Package size={14} /> {t.order.orderNumber}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {t.order.orderStatus} · ₹{Number(t.order.totalAmount || 0).toLocaleString('en-IN')}</span>
                </div>
              )}

              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.6, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{t.details}</p>

              {/* Only offered when there is something to show — an empty ticket has no conversation
                  worth a control that opens onto nothing. */}
              {t.transcript.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <button
                    onClick={() => setOpenTranscripts(o => ({ ...o, [t.id]: !showConvo }))}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-xs)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <MessageSquare size={13} /> {showConvo ? 'Hide' : 'Show'} conversation ({t.transcript.length})
                  </button>
                  {showConvo && (
                    <div style={{ marginTop: 8, padding: 12, borderRadius: 'var(--radius-card)', background: 'var(--surface-sunken)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {t.transcript.map((m, i) => (
                        <div key={i} style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5, color: 'var(--text-body)' }}>
                          <strong style={{ color: 'var(--text-muted)' }}>{m.role === 'user' ? 'Customer' : 'Doughie'}: </strong>
                          <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Field label="Status">
                <select
                  value={t.status}
                  onChange={e => onSetStatus(t.id, e.target.value as AdminTicketStatus)}
                  style={{ ...selStyle, width: 'auto', minWidth: 160 }}>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </Field>
            </div>
          );
        })}
      </div>

      {!list.length && <Empty text={tickets.length ? 'No tickets match the filter.' : 'No support tickets yet.'} />}
      <Pager page={page} total={list.length} pageSize={PAGE_SIZE} onPage={onPage} />
    </>
  );
}
