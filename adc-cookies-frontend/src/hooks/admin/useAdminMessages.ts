'use client';
import { useState, useEffect } from 'react';
import { adminGetMessages, adminMarkMessageHandled, type AdminMessage } from '@/lib/api';

/**
 * Contact-form messages. `onHandled` fires after one is marked handled so the Overview counters
 * (which include a "new messages" tile) can re-fetch — this hook doesn't reach into stats itself.
 */
export function useAdminMessages(enabled: boolean, onHandled?: () => void) {
  const [messages, setMessages] = useState<AdminMessage[] | null>(null);
  const [search, setSearch] = useState('');
  const [handledFilter, setHandledFilter] = useState('');

  useEffect(() => {
    if (enabled && messages === null) adminGetMessages().then(setMessages).catch(() => setMessages([]));
  }, [enabled, messages]);

  const markHandled = async (id: number) => {
    await adminMarkMessageHandled(id).catch(() => {});
    setMessages(m => (m || []).map(x => x.id === id ? { ...x, handled: true } : x));
    onHandled?.();
  };

  return { messages, search, setSearch, handledFilter, setHandledFilter, markHandled };
}
