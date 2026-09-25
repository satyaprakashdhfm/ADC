'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Bot, CheckCircle2, Hand, Send, UserRound } from 'lucide-react';
import type { SupportApi, SupportThread } from '@/lib/supportTypes';
import MessageBubble from './MessageBubble';
import { avatarColour, dayLabel, initials } from './format';
import s from './whatsapp.module.css';

/*
 * The right pane: one conversation, its ticket, who is answering, and the reply box.
 *
 * Replying takes the chat over from the bot (the server does that, so it holds for every client).
 * "Hand back to bot" is the way back; "Close" ends it and can resolve the ticket.
 */
export default function ChatThread({ api, thread, onBack, onChanged }: {
  api: SupportApi;
  thread: SupportThread;
  onBack: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const { conversation: c, messages, ticketNotes } = thread;
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastId = messages[messages.length - 1]?.id;

  /* Follow new messages only when already at the bottom, as WhatsApp does: someone scrolled up to
     read history is not yanked away from it. Each conversation mounts fresh (keyed by id in
     SupportInbox), so a different one always opens at the end with an empty reply box. */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, c.id]);
  const onScroll = () => {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setErr('');
    try { await fn(); await onChanged(); } catch (e) { setErr(e instanceof Error ? e.message : 'That did not work'); } finally { setBusy(null); }
  };
  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    stick.current = true;
    void act('send', async () => { await api.reply(c.id, text); setDraft(''); });
  };
  const close = () => {
    const resolve = c.ticket && c.ticket.status !== 'RESOLVED'
      ? window.confirm(`Also mark ticket #${c.ticket.id} as resolved?`)
      : false;
    void act('close', () => api.close(c.id, resolve));
  };

  /* Day separators, and the author line only on the first bubble of a run, as WhatsApp draws them. */
  const rows: ReactNode[] = [];
  let lastDay = '';
  let lastSide = '';
  for (const m of messages) {
    const day = dayLabel(m.createdAt);
    const side = m.sender === 'system' ? 'system' : `${m.direction}:${m.sender}`;
    const newDay = day !== lastDay;
    if (newDay) rows.push(<div key={`d${m.id}`} className={s.day}><span className={s.dayPill}>{day}</span></div>);
    rows.push(<MessageBubble key={m.id} api={api} m={m} first={side !== lastSide || newDay} />);
    lastDay = day;
    lastSide = side;
  }

  return (
    <div className={s.thread}>
      <div className={s.threadHead}>
        <button className={s.back} onClick={onBack} aria-label="Back to chats"><ArrowLeft size={20} /></button>
        <div className={s.avatar} style={{ background: avatarColour(c.phone), width: 40, height: 40, fontSize: 14 }}>{initials(c.name)}</div>
        <div className={s.threadWho}>
          <div className={s.threadName}>{c.name}</div>
          <div className={s.threadSub}>{c.phone}{c.linkedAccount ? '' : ' · no ADC account on this number'}</div>
        </div>
        <div className={s.actions}>
          {c.mode === 'BOT'
            ? <button className={s.btn} disabled={!!busy} onClick={() => void act('take', () => api.take(c.id))}><Hand size={14} /> Take over</button>
            : <button className={s.btn} disabled={!!busy} onClick={() => void act('release', () => api.release(c.id))}><Bot size={14} /> Hand back to bot</button>}
          {c.status === 'OPEN' && <button className={s.btn} disabled={!!busy} onClick={close}><CheckCircle2 size={14} /> Close</button>}
        </div>
      </div>

      {c.ticket && (
        <div className={`${s.banner} ${s.bannerTicket}`}>
          <strong>Ticket #{c.ticket.id}</strong>
          <span>{c.ticket.subject}</span>
          {c.ticket.orderNumber && <span style={{ color: '#667781' }}>· {c.ticket.orderNumber}</span>}
          <span className={`${s.tag} ${c.ticket.status === 'RESOLVED' ? s.tagClosed : s.tagHuman}`}>{c.ticket.status.replace('_', ' ')}</span>
        </div>
      )}
      {ticketNotes.length > 0 && (
        <div className={s.notes}>
          <strong>Added to the ticket later</strong>
          {ticketNotes.slice(-5).map((n, i) => (
            <div key={i} className={s.note}><span className={s.noteMeta}>{n.source === 'WHATSAPP' ? 'WhatsApp' : n.source === 'WEB' ? 'Website' : n.author || 'Staff'}: </span>{n.body}</div>
          ))}
        </div>
      )}
      {c.mode === 'BOT'
        ? <div className={`${s.banner} ${s.bannerBot}`}><Bot size={15} /> Doughie, the bot, is answering this chat. Sending a reply takes it over.</div>
        : <div className={`${s.banner} ${s.bannerHuman}`}><UserRound size={15} />
            {c.needsHuman ? `The bot passed this to the team${c.needsHumanReason ? `: ${c.needsHumanReason}` : ''}.` : `${c.takenBy || 'The team'} has this chat.`} The bot is paused.
          </div>}

      <div className={s.messages} ref={scroller} onScroll={onScroll}>
        {rows}
      </div>

      <div className={s.composer}>
        {!c.windowOpen && (
          <div className={s.hint}>
            The customer last wrote over 24 hours ago, so WhatsApp only allows a template. Your reply will be held,
            they get a message saying there is a reply, and it sends the moment they open it.
          </div>
        )}
        {err && <div className={s.hint} style={{ color: '#d93025' }}>{err}</div>}
        <div className={s.composerRow}>
          <textarea
            className={s.input}
            rows={1}
            placeholder="Type a message"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button className={s.send} onClick={send} disabled={!draft.trim() || !!busy} aria-label="Send"><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
}
