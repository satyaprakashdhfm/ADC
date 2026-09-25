'use client';
import { useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { SupportConversation } from '@/lib/supportTypes';
import { avatarColour, initials, listTime } from './format';
import s from './whatsapp.module.css';

type Filter = 'all' | 'waiting' | 'unread' | 'closed';

/* The left pane: every conversation, newest first, like WhatsApp's chat list. */
export default function ChatList({ title, chats, openId, onOpen }: {
  title: string;
  chats: SupportConversation[] | null;
  openId: number | null;
  onOpen: (id: number) => void;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (chats || []).filter(c => {
      if (filter === 'waiting' && !(c.needsHuman && c.status === 'OPEN')) return false;
      if (filter === 'unread' && !c.unread) return false;
      if (filter === 'closed' && c.status !== 'CLOSED') return false;
      if (!needle) return true;
      return [c.name, c.phone, c.preview, c.ticket?.orderNumber, c.ticket ? `#${c.ticket.id}` : '']
        .some(v => (v || '').toLowerCase().includes(needle));
    });
  }, [chats, q, filter]);

  const waiting = (chats || []).filter(c => c.needsHuman && c.status === 'OPEN').length;
  const chip = (id: Filter, label: string) => (
    <button key={id} className={`${s.chip} ${filter === id ? s.chipOn : ''}`} onClick={() => setFilter(id)}>{label}</button>
  );

  return (
    <div className={s.list}>
      <div className={s.listHead}>
        <div className={s.listTitle}><MessageCircle size={18} color="#00a884" /> {title}</div>
        <input className={s.search} placeholder="Search name, number, order or ticket" value={q} onChange={e => setQ(e.target.value)} />
        <div className={s.chips}>
          {chip('all', 'All')}
          {chip('waiting', waiting ? `Needs reply (${waiting})` : 'Needs reply')}
          {chip('unread', 'Unread')}
          {chip('closed', 'Closed')}
        </div>
      </div>
      <div className={s.rows}>
        {chats === null && <div className={s.empty}>Loading chats…</div>}
        {chats && !shown.length && (
          <div className={s.empty}>{chats.length ? 'No chats match.' : 'No WhatsApp chats yet. They appear here when a customer writes to us.'}</div>
        )}
        {shown.map(c => (
          <button key={c.id} className={`${s.row} ${openId === c.id ? s.rowOn : ''}`} onClick={() => onOpen(c.id)}>
            <div className={s.avatar} style={{ background: avatarColour(c.phone) }}>{initials(c.name)}</div>
            <div className={s.rowMain}>
              <div className={s.rowTop}>
                <span className={s.rowName}>{c.name}</span>
                <span className={`${s.rowTime} ${c.unread ? s.rowTimeUnread : ''}`}>{listTime(c.lastMessageAt)}</span>
              </div>
              <div className={s.rowBottom}>
                <span className={s.rowPreview}>{c.ticket ? `#${c.ticket.id} · ` : ''}{c.preview}</span>
                {c.status === 'CLOSED'
                  ? <span className={`${s.tag} ${s.tagClosed}`}>Closed</span>
                  : c.needsHuman
                    ? <span className={`${s.tag} ${s.tagHuman}`}>Needs reply</span>
                    : c.mode === 'BOT' ? <span className={`${s.tag} ${s.tagBot}`}>Bot</span> : null}
                {!!c.unread && <span className={s.badge}>{c.unread}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
