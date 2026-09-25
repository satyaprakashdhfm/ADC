'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { SupportApi, SupportConversation, SupportThread } from '@/lib/supportTypes';
import ChatList from './ChatList';
import ChatThread from './ChatThread';
import s from './whatsapp.module.css';

/*
 * The WhatsApp support inbox, used as-is by the store portal and the admin dashboard. Which
 * conversations it shows is decided by the API it is given (a store sees only its own), never here.
 *
 * Polls rather than holding a socket open: a counter tablet sleeps and wakes all day, and a poll
 * simply carries on where a socket would have to notice it died and reconnect.
 */
const LIST_MS = 5000;
const THREAD_MS = 3500;

export default function SupportInbox({ api, title = 'WhatsApp chats' }: { api: SupportApi; title?: string }) {
  const [chats, setChats] = useState<SupportConversation[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [err, setErr] = useState('');

  /* The chat being looked at right now, so a slow reply for a chat already left is dropped. */
  const current = useRef<number | null>(null);
  useEffect(() => { current.current = openId; }, [openId]);

  const loadList = useCallback(() => api.list()
    .then(list => { setChats(list); setErr(''); })
    .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not load chats')), [api]);

  const loadThread = useCallback((id: number) => api.open(id)
    .then(t => { if (current.current === id) setThread(t); })
    .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not open that chat')), [api]);

  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void loadList(); };
    tick();
    const t = setInterval(tick, LIST_MS);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (openId == null) return;
    const tick = () => { if (document.visibilityState === 'visible') void loadThread(openId); };
    tick();
    const t = setInterval(tick, THREAD_MS);
    return () => clearInterval(t);
  }, [openId, loadThread]);

  const refresh = useCallback(async () => {
    await Promise.all([loadList(), openId != null ? loadThread(openId) : Promise.resolve()]);
  }, [loadList, loadThread, openId]);

  return (
    <div>
      {err && <p style={{ color: '#d93025', fontSize: 13, margin: '0 0 8px' }}>{err}</p>}
      <div className={`${s.shell} ${openId != null ? s.threadOpen : ''}`}>
        <ChatList title={title} chats={chats} openId={openId} onOpen={setOpenId} />
        {thread && thread.conversation.id === openId ? (
          <ChatThread key={thread.conversation.id} api={api} thread={thread} onBack={() => setOpenId(null)} onChanged={refresh} />
        ) : (
          <div className={s.thread}>
            <div className={s.placeholder}>
              <div>
                <MessageCircle size={56} color="#00a884" />
                <h3>{openId != null ? 'Opening chat…' : 'WhatsApp support'}</h3>
                <p>Pick a chat on the left. Replies go out from the company WhatsApp number.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
