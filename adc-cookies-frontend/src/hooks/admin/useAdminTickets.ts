'use client';
import { useState, useEffect } from 'react';
import { adminGetTickets, adminSetTicketStatus, type AdminTicket, type AdminTicketStatus } from '@/lib/api';

/**
 * Support tickets raised from the chat.
 *
 * Fetched whole and filtered in the browser, like contact messages: the endpoint caps at 200 rows
 * and the status filter is the one thing people flip constantly, so a round trip per flip would be
 * slower than the list is long.
 *
 * The status write is optimistic and NOT rolled back on failure — instead the list is re-fetched,
 * because a PATCH that failed usually means somebody else already moved the ticket, and the server's
 * answer is the one worth showing.
 */
export function useAdminTickets(enabled: boolean) {
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    if (enabled && tickets === null) adminGetTickets().then(setTickets).catch(() => setTickets([]));
  }, [enabled, tickets]);

  const setStatus = async (id: number, status: AdminTicketStatus) => {
    setTickets(t => (t || []).map(x => (x.id === id ? { ...x, status } : x)));
    try {
      await adminSetTicketStatus(id, status);
    } catch {
      setTickets(null); // force a re-fetch; the server knows better than this optimistic guess
    }
  };

  return { tickets, search, setSearch, statusFilter, setStatusFilter, categoryFilter, setCategoryFilter, setStatus };
}
