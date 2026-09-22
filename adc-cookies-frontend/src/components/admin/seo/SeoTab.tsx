'use client';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { AdminSeoPage } from '@/lib/api';
import type { useAdminSeo } from '@/hooks/admin/useAdminSeo';
import { SEO_PERIODS } from '@/hooks/admin/useAdminSeo';
import { MiniStat, th, td } from '../shared/ui';
import { Section, Labelled, Notice } from '../traffic/TrafficParts';
import { KEYWORD_SOURCE, PLAN_PAGES, statFor, type Competition } from '@/lib/seo/plan';

type Props = ReturnType<typeof useAdminSeo>;

/*
 * SEO: which page is written for which Google search, and how it is doing in Google.
 *
 * The plan (pages, their searches, the Keyword Planner numbers) comes from lib/seo/plan.ts and
 * shows at once. Google's side (indexed or not, times shown, clicks, position per search) comes
 * from Search Console through the backend and fills in when it arrives.
 */

const SITE = 'https://www.adoughcookie.com';

const COMPETITION: Record<Competition, string> = { Low: 'Low competition', Medium: 'Medium competition', High: 'High competition', Unknown: 'Competition not known' };

const TONE = {
  good: { bg: 'var(--status-success-bg)', fg: 'var(--status-success)' },
  wait: { bg: 'var(--amber-50)', fg: 'var(--amber-800)' },
  bad: { bg: 'var(--status-error-bg)', fg: 'var(--status-error)' },
  none: { bg: 'var(--surface-sunken)', fg: 'var(--text-muted)' },
} as const;

function Pill({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  const t = TONE[tone];
  return <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-xs)', fontWeight: 800, background: t.bg, color: t.fg, whiteSpace: 'nowrap' }}>{children}</span>;
}

/* Google's URL Inspection wording, in plain words. Its dash varies (- or –), so match loosely. */
function indexLabel(index: AdminSeoPage['index']): { tone: keyof typeof TONE; text: string } {
  if (!index) return { tone: 'none', text: 'Not checked' };
  const c = index.coverage.toLowerCase();
  if (index.verdict === 'PASS') return { tone: 'good', text: 'In Google' };
  if (c.includes('unknown')) return { tone: 'none', text: 'Not found yet' };
  if (c.includes('discovered')) return { tone: 'wait', text: 'Found, waiting' };
  if (c.includes('crawled')) return { tone: 'wait', text: 'Read, not added yet' };
  return { tone: 'bad', text: index.coverage || 'Not in Google' };
}

const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const num = (n: number) => n.toLocaleString('en-IN');
const pos = (n: number) => `#${n < 10 ? n.toFixed(1) : Math.round(n)}`;

const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-xs)', fontWeight: 700, background: 'var(--surface-sunken)', color: 'var(--text-body)', margin: '0 6px 6px 0' };
const small: React.CSSProperties = { fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 3, lineHeight: 1.5 };

const TERMS: [string, string][] = [
  ['Main search', 'The one Google search a page is written for. Its title, first heading and opening line all use it.'],
  ['Also targets', 'Close variations the same page can show up for. A number next to one means Google already shows the page for it, at that position.'],
  ['In Google', 'Whether Google has added the page to its results. "Found, waiting" means Google knows the page exists but has not read it yet; a new page usually takes one to four weeks.'],
  ['Position', 'Where the page sat in Google\'s results for that search, on average. #1 is the top; #1 to #10 is the first page.'],
  ['Shown', 'How many times the page appeared in someone\'s Google results in this period, whether or not they clicked.'],
  ['Clicks', 'How many times someone clicked through to the page from Google.'],
  ['Searches a month', 'How many times a month people type the search into Google, as Google\'s range. "1K–10K" means somewhere between 1,000 and 10,000.'],
  ['Competition', 'How many businesses pay to advertise on the search. It says nothing about how hard it is to appear in the free results.'],
];

export default function SeoTab({ report, days, setDays, error, refreshing, refresh }: Props) {
  const loading = !report && !error;
  const byPath = new Map((report?.pages || []).map(p => [p.path, p]));
  const indexed = (report?.pages || []).filter(p => p.index?.verdict === 'PASS').length;
  const dash = loading ? '…' : '–';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Period and refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {SEO_PERIODS.map(d => (
          <button key={d} onClick={() => setDays(d)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', border: d === days ? 'none' : '1.5px solid var(--border-default)', background: d === days ? 'var(--gradient-warm)' : 'var(--surface-card)', color: d === days ? 'var(--white)' : 'var(--text-body)' }}>
            Last {d} days
          </button>
        ))}
        <button onClick={refresh} disabled={refreshing || loading} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 'var(--radius-pill)', cursor: refreshing ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-body)' }}>
          <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} /> {refreshing ? 'Asking Google…' : 'Refresh'}
        </button>
      </div>

      {error && <Notice tone="error" title="Google Search Console did not load">{error}</Notice>}
      {report && !report.connected && <Notice tone="waiting" title="Google Search Console is not connected">{report.problem}</Notice>}
      {report?.connected && report.problem && <Notice tone="waiting">{report.problem}</Notice>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <MiniStat label={`Shown in Google · ${days} days`} value={report?.totals ? num(report.totals.impressions) : dash} />
        <MiniStat label={`Clicks from Google · ${days} days`} value={report?.totals ? num(report.totals.clicks) : dash} />
        <MiniStat label="Search pages in Google" value={report?.connected ? `${indexed} of ${PLAN_PAGES.length}` : dash} />
        <MiniStat label="Sitemap last read" value={report?.sitemap?.lastRead ? `${shortDate(report.sitemap.lastRead)} · ${report.sitemap.pages} pages` : dash} />
      </div>

      <Section
        title="Pages and how they are doing in Google"
        hint={`Each page is written for one main search, plus a few close ones. Shown, clicks and position are for ${report ? `${shortDate(report.from)} to ${shortDate(report.to)}` : `the last ${days} days`}. The first two numbers above cover the whole site. Google's numbers run about two days behind.`}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1060 }}>
          <thead>
            <tr>{['Page', 'Main search', 'In Google', 'Position', 'Shown · clicks', 'Also targets'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {PLAN_PAGES.map(p => {
              const stat = statFor(p.primary);
              const g = byPath.get(p.path);
              const findQuery = (k: string) => g?.queries.find(q => q.query === k.toLowerCase());
              const main = findQuery(p.primary);
              const planned = new Set([p.primary, ...p.secondary].map(k => k.toLowerCase()));
              const others = (g?.queries || []).filter(q => !planned.has(q.query)).slice(0, 3);
              const idx = indexLabel(g?.index ?? null);
              return (
                <tr key={p.path}>
                  <td style={{ ...td, verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{p.name}</div>
                    <a href={`${SITE}${p.path}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--text-link)', fontWeight: 700, marginTop: 2, wordBreak: 'break-all' }}>
                      {p.path} <ExternalLink size={11} />
                    </a>
                    <div style={small}>{p.kind} · live since {shortDate(p.live)}</div>
                  </td>
                  <td style={{ ...td, verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{p.primary}</div>
                    <div style={small}>{stat ? `${stat.searches} a month · ${COMPETITION[stat.competition]}` : 'Not checked in the planner yet'}</div>
                  </td>
                  <td style={{ ...td, verticalAlign: 'top' }}>
                    {g ? <Pill tone={idx.tone}>{idx.text}</Pill> : <span style={{ color: 'var(--text-muted)' }}>{dash}</span>}
                    {g?.index?.lastCrawl && <div style={small}>Read by Google {shortDate(g.index.lastCrawl)}</div>}
                  </td>
                  <td style={{ ...td, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {main
                      ? <div style={{ fontWeight: 900, fontSize: 'var(--text-base)', color: main.position <= 10 ? 'var(--status-success)' : 'var(--text-strong)' }}>{pos(main.position)}</div>
                      : <div style={{ color: 'var(--text-muted)' }}>{g ? 'Not showing yet' : dash}</div>}
                    {g?.position != null && <div style={small}>avg {pos(g.position)} over {g.queries.length} search{g.queries.length === 1 ? '' : 'es'}</div>}
                  </td>
                  <td style={{ ...td, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {g ? <><span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{num(g.impressions)}</span> shown · <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{num(g.clicks)}</span> clicks</> : <span style={{ color: 'var(--text-muted)' }}>{dash}</span>}
                  </td>
                  <td style={{ ...td, verticalAlign: 'top', maxWidth: 340 }}>
                    {p.secondary.map(k => {
                      const hit = findQuery(k);
                      return <span key={k} style={chip}>{k}{hit && <strong style={{ color: 'var(--status-success)' }}>{pos(hit.position)}</strong>}</span>;
                    })}
                    {!!others.length && <div style={small}>Google also shows it for: {others.map(q => `${q.query} ${pos(q.position)}`).join(', ')}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="What the words mean" hint={`Search volumes and competition from ${KEYWORD_SOURCE}. Everything else from Google Search Console.`}>
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
