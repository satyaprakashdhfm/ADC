'use client';
import { RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import type { AdminTraffic } from '@/lib/api';
import { card, iconBtn } from '../shared/ui';
import { Notice } from './TrafficParts';

function Pill({ name, on, offText }: { name: string; on: boolean; offText: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-xs)', fontWeight: 800, background: on ? 'var(--status-success-bg)' : 'var(--amber-50)', color: on ? 'var(--status-success)' : 'var(--amber-800)' }}>
      {on ? <CheckCircle2 size={14} /> : <Clock size={14} />} {name}: {on ? 'connected' : offText}
    </span>
  );
}

/**
 * Which of the two outside sources this tab is reading, and why one is not.
 *
 * Shown at the top rather than in each section because a missing source changes how EVERY number
 * below reads — a zero under "Visitors" means nothing if Google Analytics is not connected.
 */
export default function ConnectionStatus({ report, refreshing, onRefresh }: {
  report: AdminTraffic | null; refreshing: boolean; onRefresh: () => void;
}) {
  const g = report?.google;
  const m = report?.meta;
  return (
    <div style={{ ...card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill name="Google Analytics" on={!!g?.connected} offText="not connected" />
        <Pill name="Meta Ads" on={!!m?.connected} offText="waiting" />
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', fontWeight: 700 }}>
          {report && `Updated ${new Date(report.generatedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · refreshes every 10 min`}
          <button onClick={onRefresh} disabled={refreshing} title="Fetch fresh numbers from Google and Meta now" style={{ ...iconBtn, marginRight: 0, opacity: refreshing ? 0.5 : 1 }}>
            <RefreshCw size={15} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
        </span>
      </div>
      {g && !g.connected && g.problem && <Notice tone="waiting" title="Google Analytics is not connected yet">{g.problem}</Notice>}
      {g?.connected && g.errors.length > 0 && (
        <Notice tone="error" title="Some Google Analytics reports did not load">{g.errors.join(' · ')}</Notice>
      )}
      {m && !m.connected && m.problem && <Notice tone="waiting" title="Meta Ads is not connected yet">{m.problem} Visitors and orders from your ads still show below; spend, reach and cost per order appear once it is connected.</Notice>}
      {m?.connected && m.error && <Notice tone="error" title="Meta Ads did not answer">{m.error}</Notice>}
    </div>
  );
}
