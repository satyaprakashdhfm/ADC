'use client';
import { useEffect, useState } from 'react';
import { Check, CheckCheck, Clock, AlertCircle, FileText, Mic, Image as ImageIcon } from 'lucide-react';
import type { SupportApi, SupportMessage } from '@/lib/supportTypes';
import { clock, waFormat } from './format';
import s from './whatsapp.module.css';

/* Sent, delivered, read (blue), held for the 24-hour window, or failed: WhatsApp's ticks. */
function Ticks({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck size={15} className={s.tickRead} />;
  if (status === 'delivered') return <CheckCheck size={15} />;
  if (status === 'held') return <Clock size={13} />;
  if (status === 'failed') return <AlertCircle size={13} className={s.tickFailed} />;
  return <Check size={15} />;
}

/* A customer's photo, voice note or file. Fetched only when shown, with this side's credential. */
function Media({ api, m, onLoad }: { api: SupportApi; m: SupportMessage; onLoad?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const isPicture = m.mediaType === 'image' || m.mediaType === 'sticker';

  const load = () => {
    if (!m.mediaId || url) return;
    api.mediaUrl(m.mediaId).then(setUrl).catch(() => setFailed(true));
  };
  useEffect(() => {
    if (!isPicture || !m.mediaId) return;
    let cancelled = false;
    api.mediaUrl(m.mediaId).then(u => { if (!cancelled) setUrl(u); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [api, isPicture, m.mediaId]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (!m.mediaId) return null;
  if (failed) return <div className={s.mediaBox}><AlertCircle size={16} /> This file is no longer available from WhatsApp.</div>;
  if (isPicture) {
    return url
      // eslint-disable-next-line @next/next/no-img-element -- a private blob URL, not an optimisable asset
      ? <a href={url} target="_blank" rel="noreferrer"><img className={s.media} src={url} alt="Photo from the customer" onLoad={onLoad} /></a>
      : <div className={s.mediaBox}><ImageIcon size={16} /> Loading photo…</div>;
  }
  if (m.mediaType === 'voice note' || m.mediaType === 'audio') {
    return url ? <audio controls src={url} style={{ maxWidth: 260 }} /> : (
      <button className={s.btn} onClick={load}><Mic size={14} /> Play voice note</button>
    );
  }
  if (m.mediaType === 'video') {
    return url ? <video controls src={url} className={s.media} /> : <button className={s.btn} onClick={load}>Load video</button>;
  }
  return url
    ? <a className={s.mediaBox} href={url} target="_blank" rel="noreferrer" download><FileText size={16} /> Open file</a>
    : <button className={s.btn} onClick={load}><FileText size={14} /> Load file</button>;
}

export default function MessageBubble({ api, m, first, onMediaLoad }: { api: SupportApi; m: SupportMessage; first: boolean; onMediaLoad?: () => void }) {
  if (m.sender === 'system') {
    return <div className={s.system}><span className={s.systemPill}>{m.body}</span></div>;
  }
  const out = m.direction === 'out';
  const author = out ? (m.sender === 'bot' ? 'Doughie (bot)' : m.senderName || 'ADC team') : null;
  const bubble = [s.bubble, out ? s.bubbleOut : s.bubbleIn, first ? s.first : '', m.status === 'held' ? s.bubbleHeld : ''].join(' ');

  return (
    <div className={`${s.line} ${out ? s.lineOut : ''}`}>
      <div className={bubble}>
        {author && first && <div className={`${s.author} ${m.sender === 'bot' ? s.authorBot : s.authorStaff}`}>{author}</div>}
        {m.mediaType && <Media api={api} m={m} onLoad={onMediaLoad} />}
        {m.body && <span className={s.text}>{waFormat(m.body)}</span>}
        <span className={s.meta}>
          {clock(m.createdAt)}
          {out && <Ticks status={m.status} />}
        </span>
        {m.status === 'held' && <div className={s.error} style={{ color: '#7a4100' }}>Waiting for the customer to open the chat. It sends then.</div>}
        {m.status === 'failed' && <div className={s.error}>Not delivered{m.error ? `: ${m.error}` : ''}</div>}
      </div>
    </div>
  );
}
