import { getAll } from '../db/index.js';
import { ga4Configured, ga4Problem, runReport, runRealtimeReport, type Ga4Result, type Ga4Row } from './ga4.client.js';
import { metaAdsConfigured, metaAdsProblem, metaInsights, type MetaInsightRow } from './metaAds.client.js';
import { CHANNELS, channelOfOrder, channelOfVisit, type ChannelKey } from './trafficChannels.js';

/*
 * The admin "Traffic" tab: who came to the site, from where, and what it turned into.
 *
 * Three sources, each the authority on its own part and nothing else:
 *   GA4       visits — people, pages, where they came from, how far they got   (ga4.client)
 *   Meta Ads  what the ads cost and how many people they reached              (metaAds.client)
 *   orders    what was actually PAID for, from our own database
 *
 * They are joined in three places: by channel (trafficChannels), and — for Meta ads — by campaign
 * name and by ad name, which the ads' URL parameters put into GA4 and into our attribution as the
 * same {{campaign.name}} / {{ad.name}} Meta itself reports. Each side can be missing (Meta not
 * connected yet, GA4 key wrong, a report failing) and the rest still shows; the tab says which part
 * is missing and why rather than drawing zeros for it.
 *
 * Cached per date range for ten minutes. GA4 meters tokens per property per day and a full report
 * is nine queries, so an admin clicking between tabs must not re-run them each time.
 */

const REPORT_TTL_MS = 10 * 60_000;
const LIVE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, ttlMs: number, fresh: boolean, build: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await build();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 50) cache.delete(cache.keys().next().value as string);
  return value;
}

/* Campaign and ad names meet from three systems; spacing and case are the only things that differ. */
const norm = (s: string) => s.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const isSet = (s: string) => !!s && !['(not set)', '(none)', '(direct)', '(organic)', '(referral)'].includes(s.toLowerCase());

/** Run one GA4 query; a failure is noted and the section comes back null, never thrown. */
async function section<T>(errors: string[], result: Promise<Ga4Result>, map: (rows: Ga4Row[]) => T): Promise<T | null> {
  const r = await result;
  if (!r.ok) { if (!errors.includes(r.reason)) errors.push(r.reason); return null; }
  return map(r.rows);
}

const DEVICE: Record<string, string> = { mobile: 'Phone', desktop: 'Computer', tablet: 'Tablet', 'smart tv': 'TV' };
const RETURNING: Record<string, string> = { new: 'First visit', returning: 'Came back again' };
const SIGN_IN_METHOD: Record<string, string> = { phone: 'Phone (OTP)', google: 'Google' };

/* The path from arriving to paying, as GA4 event names. Staff screens never load gtag.js, so
   nobody at the counter is counted in any of these. */
const FUNNEL: [string, string][] = [
  ['session_start', 'Visited the site'],
  ['add_to_cart', 'Added something to the cart'],
  ['begin_checkout', 'Opened checkout'],
  ['add_payment_info', 'Pressed Pay'],
  ['purchase', 'Paid'],
];

interface Counts { orders: number; revenue: number }
const bump = <K>(m: Map<K, Counts>, k: K, amount: number) => {
  const r = m.get(k) || { orders: 0, revenue: 0 };
  r.orders += 1; r.revenue += amount; m.set(k, r);
};

async function googleSide(from: string, to: string) {
  if (!ga4Configured()) return { connected: false as const, problem: ga4Problem(), errors: [] as string[] };
  const errors: string[] = [];
  const dateRanges = [{ startDate: from, endDate: to }];
  const q = (body: object) => runReport({ dateRanges, ...body });

  const [summary, byDay, visits, adVisits, funnelRows, methods, landingPages, devices, cities, newVsReturning] = await Promise.all([
    section(errors, q({ metrics: ['activeUsers', 'newUsers', 'sessions', 'engagedSessions', 'screenPageViews', 'averageSessionDuration'].map((name) => ({ name })) }),
      (rows) => {
        const m = rows[0]?.mets || [];
        return { visitors: m[0] || 0, newVisitors: m[1] || 0, visits: m[2] || 0, engagedVisits: m[3] || 0, pageViews: m[4] || 0, avgVisitSeconds: Math.round(m[5] || 0) };
      }),
    section(errors, q({ dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }], orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 }),
      (rows) => rows.map((r) => ({ day: `${r.dim(0).slice(0, 4)}-${r.dim(0).slice(4, 6)}-${r.dim(0).slice(6, 8)}`, visitors: r.met(0), visits: r.met(1) }))),
    section(errors, q({
      dimensions: ['sessionSource', 'sessionMedium', 'sessionDefaultChannelGroup', 'sessionCampaignName'].map((name) => ({ name })),
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'engagedSessions' }], limit: 1000,
    }), (rows) => rows),
    section(errors, q({
      dimensions: ['sessionSource', 'sessionMedium', 'sessionCampaignName', 'sessionManualTerm', 'sessionManualAdContent'].map((name) => ({ name })),
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }], limit: 1000,
    }), (rows) => rows),
    section(errors, q({
      dimensions: [{ name: 'eventName' }], metrics: [{ name: 'activeUsers' }, { name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: [...FUNNEL.map(([e]) => e), 'login', 'sign_up'] } } },
    }), (rows) => new Map(rows.map((r) => [r.dim(0), { people: r.met(0), times: r.met(1) }]))),
    /* Phone vs Google needs `method` registered in GA4 as a custom dimension. Until it is, this
       query fails; that is not an error worth showing, just a split we cannot make yet. */
    runReport({
      dateRanges, dimensions: [{ name: 'eventName' }, { name: 'customEvent:method' }], metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: ['login', 'sign_up'] } } },
    }),
    section(errors, q({ dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 12 }),
      (rows) => rows.filter((r) => isSet(r.dim(0))).slice(0, 10).map((r) => ({ label: r.dim(0), visits: r.met(0), visitors: r.met(1) }))),
    section(errors, q({ dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] }),
      (rows) => rows.map((r) => ({ label: DEVICE[r.dim(0)] || r.dim(0), visitors: r.met(0) }))),
    section(errors, q({ dimensions: [{ name: 'city' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 12 }),
      (rows) => rows.filter((r) => isSet(r.dim(0))).slice(0, 10).map((r) => ({ label: r.dim(0), visitors: r.met(0) }))),
    section(errors, q({ dimensions: [{ name: 'newVsReturning' }], metrics: [{ name: 'activeUsers' }] }),
      (rows) => rows.filter((r) => RETURNING[r.dim(0)]).map((r) => ({ label: RETURNING[r.dim(0)], visitors: r.met(0) }))),
  ]);

  const funnel = funnelRows && FUNNEL.map(([event, label]) => ({ step: event, label, people: funnelRows.get(event)?.people || 0 }));
  const signIns = funnelRows && {
    existing: funnelRows.get('login')?.times || 0,
    newAccounts: funnelRows.get('sign_up')?.times || 0,
    byMethod: methods.ok
      ? [...methods.rows.reduce((m, r) => {
          const label = SIGN_IN_METHOD[r.dim(1)] || (isSet(r.dim(1)) ? r.dim(1) : 'Not recorded');
          const row = m.get(label) || { method: label, existing: 0, newAccounts: 0 };
          if (r.dim(0) === 'login') row.existing += r.met(0); else row.newAccounts += r.met(0);
          return m.set(label, row);
        }, new Map<string, { method: string; existing: number; newAccounts: number }>()).values()]
      : null,
  };

  return { connected: true as const, problem: null, errors, summary, byDay, visits, adVisits, funnel, signIns, landingPages, devices, cities, newVsReturning };
}

async function metaSide(from: string, to: string) {
  if (!metaAdsConfigured()) return { connected: false as const, problem: metaAdsProblem(), error: null, totals: null, campaigns: [] as MetaInsightRow[], ads: [] as MetaInsightRow[] };
  const [account, campaigns, ads] = await Promise.all([
    metaInsights('account', from, to), metaInsights('campaign', from, to), metaInsights('ad', from, to),
  ]);
  const error = [account, campaigns, ads].find((r) => !r.ok);
  const zero = { spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, landingPageViews: 0, metaPurchases: 0, metaPurchaseValue: 0 };
  return {
    connected: true as const,
    problem: null,
    error: error && !error.ok ? error.reason : null,
    totals: account.ok ? { ...zero, ...(account.rows[0] || {}) } : null,
    campaigns: campaigns.ok ? campaigns.rows : [],
    ads: ads.ok ? ads.rows : [],
  };
}

async function ordersSide(from: string, to: string) {
  /* PAID orders only: "cost per order" divided by orders that never paid would flatter every ad.
     Grouped by the IST day, like every other figure on the dashboard. */
  const rows = await getAll(
    `SELECT o.attribution, o.total_amount FROM orders o
      WHERE (o.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1::date AND $2::date
        AND o.payment_status = 'PAID' AND o.order_status <> 'CANCELLED'`, [from, to]);
  const byChannel = new Map<ChannelKey, Counts>();
  const byCampaign = new Map<string, Counts & { name: string }>();
  const byAd = new Map<string, Counts & { campaign: string; adset: string; ad: string }>();
  let paid = 0; let revenue = 0;
  for (const r of rows) {
    const amount = Number(r.total_amount) || 0;
    const channel = channelOfOrder(r.attribution);
    paid += 1; revenue += amount;
    bump(byChannel, channel, amount);
    if (channel !== 'meta_ads') continue;
    const campaign = String(r.attribution?.campaign || '(no campaign name)');
    const c = byCampaign.get(norm(campaign)) || { name: campaign, orders: 0, revenue: 0 };
    c.orders += 1; c.revenue += amount; byCampaign.set(norm(campaign), c);
    if (r.attribution?.content) {
      const key = `${norm(campaign)}|${norm(r.attribution.content)}`;
      const a = byAd.get(key) || { campaign, adset: String(r.attribution.term || ''), ad: String(r.attribution.content), orders: 0, revenue: 0 };
      a.orders += 1; a.revenue += amount; byAd.set(key, a);
    }
  }
  return { paid, revenue, byChannel, byCampaign, byAd };
}

export async function trafficReport(from: string, to: string, { fresh = false } = {}) {
  return cached(`report|${from}|${to}`, REPORT_TTL_MS, fresh, async () => {
    const [google, meta, orders] = await Promise.all([googleSide(from, to), metaSide(from, to), ordersSide(from, to)]);

    /* ---- Every channel either side knows about, visits and orders on one row ---- */
    const channels = new Map<ChannelKey, { visitors: number; visits: number; engagedVisits: number; orders: number; revenue: number }>();
    const channelRow = (k: ChannelKey) => channels.get(k) || channels.set(k, { visitors: 0, visits: 0, engagedVisits: 0, orders: 0, revenue: 0 }).get(k)!;
    for (const r of (google.connected && google.visits) || []) {
      const row = channelRow(channelOfVisit(r.dim(0), r.dim(1), r.dim(2), r.dim(3)));
      row.visitors += r.met(0); row.visits += r.met(1); row.engagedVisits += r.met(2);
    }
    for (const [k, c] of orders.byChannel) { const row = channelRow(k); row.orders += c.orders; row.revenue += c.revenue; }

    /* ---- Meta campaigns: spend (Meta) + visitors (GA4) + orders (ours) ---- */
    const campaigns = new Map<string, { name: string; spend: number | null; impressions: number | null; reach: number | null; clicks: number | null; metaPurchases: number | null; visitors: number; visits: number; orders: number; revenue: number }>();
    const campaignRow = (name: string) => campaigns.get(norm(name))
      || campaigns.set(norm(name), { name, spend: null, impressions: null, reach: null, clicks: null, metaPurchases: null, visitors: 0, visits: 0, orders: 0, revenue: 0 }).get(norm(name))!;
    for (const c of meta.campaigns) {
      Object.assign(campaignRow(c.campaign), { name: c.campaign, spend: c.spend, impressions: c.impressions, reach: c.reach, clicks: c.linkClicks, metaPurchases: c.metaPurchases });
    }
    for (const r of (google.connected && google.visits) || []) {
      if (channelOfVisit(r.dim(0), r.dim(1), r.dim(2), r.dim(3)) !== 'meta_ads' || !isSet(r.dim(3))) continue;
      const row = campaignRow(r.dim(3)); row.visitors += r.met(0); row.visits += r.met(1);
    }
    for (const c of orders.byCampaign.values()) { const row = campaignRow(c.name); row.orders += c.orders; row.revenue += c.revenue; }

    /* ---- Individual Meta ads, the same three ways ---- */
    const ads = new Map<string, { campaign: string; adset: string; ad: string; spend: number | null; impressions: number | null; clicks: number | null; visitors: number; visits: number; orders: number; revenue: number }>();
    const adRow = (campaign: string, adset: string, ad: string) => {
      const key = `${norm(campaign)}|${norm(ad)}`;
      return ads.get(key) || ads.set(key, { campaign, adset, ad, spend: null, impressions: null, clicks: null, visitors: 0, visits: 0, orders: 0, revenue: 0 }).get(key)!;
    };
    for (const a of meta.ads) Object.assign(adRow(a.campaign, a.adset, a.ad), { spend: a.spend, impressions: a.impressions, clicks: a.linkClicks });
    for (const r of (google.connected && google.adVisits) || []) {
      if (channelOfVisit(r.dim(0), r.dim(1), '', r.dim(2)) !== 'meta_ads' || !isSet(r.dim(4))) continue;
      const row = adRow(r.dim(2), isSet(r.dim(3)) ? r.dim(3) : '', r.dim(4)); row.visitors += r.met(0); row.visits += r.met(1);
    }
    for (const a of orders.byAd.values()) { const row = adRow(a.campaign, a.adset, a.ad); row.orders += a.orders; row.revenue += a.revenue; }

    /* The raw GA4 source / medium pairs, for whoever wants to see exactly what Google recorded. */
    const rawSources = google.connected && google.visits
      ? [...google.visits.reduce((m, r) => {
          const key = `${r.dim(0)} / ${r.dim(1)}`;
          const row = m.get(key) || { source: r.dim(0), medium: r.dim(1), visitors: 0, visits: 0 };
          row.visitors += r.met(0); row.visits += r.met(1);
          return m.set(key, row);
        }, new Map<string, { source: string; medium: string; visitors: number; visits: number }>()).values()]
          .sort((a, b) => b.visits - a.visits).slice(0, 30)
      : null;

    const byVisitsThenOrders = <T extends { visits: number; orders: number }>(a: T, b: T) => b.visits - a.visits || b.orders - a.orders;
    return {
      from, to, generatedAt: new Date().toISOString(),
      google: google.connected
        ? {
            connected: true, problem: null, errors: google.errors,
            summary: google.summary, byDay: google.byDay, funnel: google.funnel, signIns: google.signIns,
            landingPages: google.landingPages, devices: google.devices, cities: google.cities,
            newVsReturning: google.newVsReturning, rawSources,
          }
        : { connected: false, problem: google.problem, errors: [] },
      meta: { connected: meta.connected, problem: meta.problem, error: meta.error, totals: meta.totals },
      orders: { paid: orders.paid, revenue: orders.revenue },
      channels: [...channels.entries()]
        .map(([key, v]) => ({ key, label: CHANNELS[key].label, hint: CHANNELS[key].hint, ...v }))
        .sort(byVisitsThenOrders),
      campaigns: [...campaigns.values()].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0) || byVisitsThenOrders(a, b)),
      ads: [...ads.values()].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0) || byVisitsThenOrders(a, b)),
    };
  });
}

/** People on the site in the last 30 minutes, which pages and on what. Cached for a minute. */
export async function liveVisitors({ fresh = false } = {}) {
  return cached('live', LIVE_TTL_MS, fresh, async () => {
    if (!ga4Configured()) return { connected: false, problem: ga4Problem(), error: null, visitors: 0, pages: [], devices: [] };
    const [total, pages, devices] = await Promise.all([
      runRealtimeReport({ metrics: [{ name: 'activeUsers' }] }),
      runRealtimeReport({ dimensions: [{ name: 'unifiedScreenName' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 6 }),
      runRealtimeReport({ dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }] }),
    ]);
    const failed = [total, pages, devices].find((r) => !r.ok);
    return {
      connected: true,
      problem: null,
      error: failed && !failed.ok ? failed.reason : null,
      visitors: total.ok ? total.rows[0]?.mets[0] || 0 : 0,
      pages: pages.ok ? pages.rows.map((r) => ({ label: r.dim(0), visitors: r.met(0) })) : [],
      devices: devices.ok ? devices.rows.map((r) => ({ label: DEVICE[r.dim(0)] || r.dim(0), visitors: r.met(0) })) : [],
    };
  });
}
