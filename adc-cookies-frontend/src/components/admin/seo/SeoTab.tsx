'use client';
import { ExternalLink } from 'lucide-react';
import { MiniStat, th, td } from '../shared/ui';
import { Section, Labelled } from '../traffic/TrafficParts';
import { KEYWORD_SOURCE, PLAN_PAGES, statFor, type Competition } from '@/lib/seo/plan';

/*
 * SEO: which page is written for which Google search, and how big each search is.
 *
 * Everything here comes from lib/seo/plan.ts, which is also where a new page's keywords are added.
 * Nothing is fetched, so the tab opens instantly and works even when the backend is down.
 */

const SITE = 'https://www.adoughcookie.com';

const COMPETITION: Record<Competition, { bg: string; fg: string }> = {
  Low: { bg: 'var(--status-success-bg)', fg: 'var(--status-success)' },
  Medium: { bg: 'var(--amber-50)', fg: 'var(--amber-800)' },
  High: { bg: 'var(--status-error-bg)', fg: 'var(--status-error)' },
  Unknown: { bg: 'var(--surface-sunken)', fg: 'var(--text-muted)' },
};

function CompetitionChip({ level, index }: { level: Competition; index?: number }) {
  const c = COMPETITION[level];
  return (
    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-xs)', fontWeight: 800, background: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>
      {level === 'Unknown' ? 'Not known' : level}{index !== undefined ? ` · ${index}` : ''}
    </span>
  );
}

const chip: React.CSSProperties = { display: 'inline-block', padding: '3px 9px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-xs)', fontWeight: 700, background: 'var(--surface-sunken)', color: 'var(--text-body)', margin: '0 6px 6px 0' };

const liveSince = (iso: string) =>
  new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

const TERMS: [string, string][] = [
  ['Searches a month', 'How many times a month people in the planner\'s area typed this into Google, as Google\'s range. "1K–10K" means somewhere between 1,000 and 10,000.'],
  ['Competition', 'How many businesses pay to advertise on this search, from 0 to 100. It says nothing about how hard it is to appear in the free results. Low means few advertisers, so fewer shops are chasing these customers.'],
  ['vs last year', 'How the searches changed against a year before. "New" means almost nobody searched it a year ago.'],
  ['Main search', 'The one Google search a page is written for. Its title, first heading and opening line all use it.'],
  ['Also targets', 'Close variations the same page can show up for, without a page of their own.'],
  ['Landing page / Article', 'A landing page is for someone ready to buy. An article is a guide that answers a question and links to the landing pages.'],
];

export default function SeoTab() {
  const keywordsTargeted = new Set(PLAN_PAGES.flatMap(p => [p.primary, ...p.secondary])).size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <MiniStat label="Pages written for search" value={String(PLAN_PAGES.length)} />
        <MiniStat label="Searches targeted" value={String(keywordsTargeted)} />
        <MiniStat label="Biggest search" value="cookie tins · 10K–100K a month" />
        <MiniStat label="Easiest to win" value="cookie tins near me" />
      </div>

      <Section
        title="Pages and the searches they target"
        hint="Each page is written for one main Google search, plus a few close ones. New pages usually take a few weeks to start showing in Google."
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>{['Page', 'Main search', 'Searches a month', 'Competition', 'Also targets', 'Live since'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {PLAN_PAGES.map(p => {
              const stat = statFor(p.primary);
              return (
                <tr key={p.path}>
                  <td style={{ ...td, verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{p.name}</div>
                    <a href={`${SITE}${p.path}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--text-link)', fontWeight: 700, marginTop: 2, wordBreak: 'break-all' }}>
                      {p.path} <ExternalLink size={11} />
                    </a>
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 3 }}>{p.kind} · {p.intent}</div>
                  </td>
                  <td style={{ ...td, verticalAlign: 'top', fontWeight: 800, color: 'var(--text-strong)' }}>{p.primary}</td>
                  <td style={{ ...td, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {stat?.searches ?? 'Not checked yet'}
                    {stat?.trend && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>{stat.trend} vs last year</div>}
                  </td>
                  <td style={{ ...td, verticalAlign: 'top' }}><CompetitionChip level={stat?.competition ?? 'Unknown'} index={stat?.index} /></td>
                  <td style={{ ...td, verticalAlign: 'top', maxWidth: 320 }}>{p.secondary.map(k => <span key={k} style={chip}>{k}</span>)}</td>
                  <td style={{ ...td, verticalAlign: 'top', whiteSpace: 'nowrap' }}>{liveSince(p.live)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="What the words mean" hint={`Numbers from ${KEYWORD_SOURCE}.`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '14px 24px' }}>
          {TERMS.map(([term, meaning]) => (
            <div key={term}>
              <Labelled label={term} />
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.6, margin: '4px 0 0' }}>{meaning}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
