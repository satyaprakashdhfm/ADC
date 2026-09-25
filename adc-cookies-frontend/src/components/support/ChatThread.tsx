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
  const [notesOpen, setNotesOpen] = useState(false);
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
  /* A photo arriving grows the chat after it was scrolled to the end; keep the end in view. */
  const onMediaLoad = () => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  };
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

  const handoverText = c.needsHuman
    ? `Bot passed this to you${c.needsHumanReason ? `: ${c.needsHumanReason}` : ''}`
    : `${c.takenBy || 'The team'} has this chat. The bot is paused.`;

  /* Day separators, and the author line only on the first bubble of a run, as WhatsApp draws them. */
  const rows: ReactNode[] = [];
  let lastDay = '';
  let lastSide = '';
  for (const m of messages) {
    const day = dayLabel(m.createdAt);
    const side = m.sender === 'system' ? 'system' : `${m.direction}:${m.sender}`;
    const newDay = day !== lastDay;
    if (newDay) rows.push(<div key={`d${m.id}`} className={s.day}><span className={s.dayPill}>{day}</span></div>);
    rows.push(<MessageBubble key={m.id} api={api} m={m} first={side !== lastSide || newDay} onMediaLoad={onMediaLoad} />);
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
            ? <button className={s.btn} title="Take over from the bot" disabled={!!busy} onClick={() => void act('take', () => api.take(c.id))}><Hand size={15} /><span className={s.btnLabel}>Take over</span></button>
            : <button className={s.btn} title="Hand back to the bot" disabled={!!busy} onClick={() => void act('release', () => api.release(c.id))}><Bot size={15} /><span className={s.btnLabel}>Hand back to bot</span></button>}
          {c.status === 'OPEN' && <button className={s.btn} title="Close this chat" disabled={!!busy} onClick={close}><CheckCircle2 size={15} /><span className={s.btnLabel}>Close</span></button>}
        </div>
      </div>

      {c.ticket && (
        <div className={`${s.banner} ${s.bannerTicket}`}>
          <strong style={{ flexShrink: 0 }}>#{c.ticket.id}</strong>
          <span className={s.bannerText} title={`${c.ticket.subject}${c.ticket.orderNumber ? ` · ${c.ticket.orderNumber}` : ''}`}>
            {c.ticket.subject}{c.ticket.orderNumber && !c.ticket.subject.includes(c.ticket.orderNumber) ? ` · ${c.ticket.orderNumber}` : ''}
          </span>
          {ticketNotes.length > 0 && (
            <button className={s.bannerMore} onClick={() => setNotesOpen(o => !o)}>{notesOpen ? 'Hide notes' : `+${ticketNotes.length} added`}</button>
          )}
          <span className={`${s.tag} ${c.ticket.status === 'RESOLVED' ? s.tagClosed : s.tagHuman}`}>{c.ticket.status.replace('_', ' ')}</span>
        </div>
      )}
      {notesOpen && ticketNotes.length > 0 && (
        <div className={s.notes}>
          {ticketNotes.map((n, i) => (
            <div key={i} className={s.note}><span className={s.noteMeta}>{n.source === 'WHATSAPP' ? 'WhatsApp' : n.source === 'WEB' ? 'Website' : n.author || 'Staff'}: </span>{n.body}</div>
          ))}
        </div>
      )}
      {c.mode === 'BOT' ? (
        <div className={`${s.banner} ${s.bannerBot}`}>
          <Bot size={15} style={{ flexShrink: 0 }} />
          <span className={s.bannerText}>The bot is answering. Sending a reply takes over.</span>
        </div>
      ) : (
        <div className={`${s.banner} ${s.bannerHuman}`} title={handoverText}>
          <UserRound size={15} style={{ flexShrink: 0 }} />
          <span className={s.bannerText}>{handoverText}</span>
        </div>
      )}

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
