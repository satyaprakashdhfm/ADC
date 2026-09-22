/*
 * Meta Ads — the Marketing API's Insights edge, read-only. Talks to Meta and nothing else.
 *
 * What our ads cost and how many taps they sent to the website. Everything a customer did AFTER
 * the click comes from our own orders and from GA4 instead; trafficAnalytics.service lines the three up by campaign and ad name, which
 * all come from the same {{campaign.name}} / {{ad.name}} URL parameters on the ad.
 *
 * DORMANT UNTIL CONFIGURED, like WhatsApp:
 *   META_AD_ACCOUNT_ID  the ad account's number (the act=… in Ads Manager's address bar)
 *   META_ADS_TOKEN      a system-user token with ads_read ONLY — deliberately not the WhatsApp or
 *                       Conversions API token, so this one can read ad numbers and do nothing else
 *
 * Free: there is no charge for reading your own ad account through the API.
 */
const API_VERSION = process.env.META_API_VERSION || 'v23.0';
const ACCOUNT = String(process.env.META_AD_ACCOUNT_ID || '').trim().replace(/^act_/, '');
const TOKEN = String(process.env.META_ADS_TOKEN || '').trim();

export const metaAdsConfigured = () => !!(ACCOUNT && TOKEN);

/** Why Meta Ads is off, in a sentence for the admin — or null when it is on. */
export function metaAdsProblem(): string | null {
  if (!ACCOUNT && !TOKEN) return 'Not connected yet. Needs META_AD_ACCOUNT_ID and META_ADS_TOKEN (a token with ads_read).';
  if (!ACCOUNT) return 'META_AD_ACCOUNT_ID is not set.';
  if (!TOKEN) return 'META_ADS_TOKEN is not set.';
  if (!/^\d+$/.test(ACCOUNT)) return 'META_AD_ACCOUNT_ID should be the number after act= in Ads Manager.';
  return null;
}

console.log(metaAdsConfigured()
  ? `[META] ads | ✓ on | account=act_…${ACCOUNT.slice(-4)}`
  : `[META] ads | off | ${metaAdsProblem()}`);

/**
 * One row of the Insights report: what an ad cost and how many people it sent to the website.
 *
 * Only the website side is read. Reach and times shown say nothing about the shop, and "link
 * clicks" is no good either: Meta counts a tap that opens an Instagram DM as a link click, so a
 * messages campaign shows hundreds of them and sends nobody to the site. Outbound clicks are the
 * taps that left Instagram or Facebook, which for our ads means the website.
 */
export interface MetaInsightRow {
  campaign: string;
  adset: string;
  ad: string;
  spend: number;
  /** Taps that left Meta for our site (Meta's outbound clicks). */
  siteClicks: number;
}

export type MetaInsightsResult = { ok: true; rows: MetaInsightRow[] } | { ok: false; reason: string };

function actionValue(list: any[] | undefined, types: string[]): number {
  for (const t of types) {
    const hit = (list || []).find((a) => a?.action_type === t);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

/**
 * Spend and website clicks for a date range (inclusive, in the ad account's timezone), one row per
 * campaign or per ad. Follows paging.
 */
export async function metaInsights(level: 'campaign' | 'ad', since: string, until: string): Promise<MetaInsightsResult> {
  if (!metaAdsConfigured()) return { ok: false, reason: metaAdsProblem() || 'not_configured' };
  const fields = ['campaign_name', 'adset_name', 'ad_name', 'spend', 'outbound_clicks'];
  const qs = new URLSearchParams({
    level,
    fields: fields.join(','),
    time_range: JSON.stringify({ since, until }),
    limit: '200',
  });
  let url: string | null = `https://graph.facebook.com/${API_VERSION}/act_${ACCOUNT}/insights?${qs}`;
  const rows: MetaInsightRow[] = [];
  try {
    for (let page = 0; url && page < 10; page++) {
      const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(20_000) });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const e = data?.error || {};
        /* The two a person can act on, in their words: an expired/revoked token, and a token that
           was never given ads_read on this account. */
        const reason = e.code === 190 ? 'The Meta Ads token has expired or was revoked. Generate a new one with ads_read.'
          : (e.code === 200 || e.code === 10 || (e.code === 100 && /permission/i.test(e.message || ''))) ? 'The Meta Ads token cannot read this ad account. Give its system user the ad account with ads_read.'
          : `${e.code ?? res.status}: ${e.message || 'unknown error'}`;
        return { ok: false, reason };
      }
      for (const r of data.data || []) {
        rows.push({
          campaign: r.campaign_name || '',
          adset: r.adset_name || '',
          ad: r.ad_name || '',
          spend: Number(r.spend) || 0,
          siteClicks: actionValue(r.outbound_clicks, ['outbound_click']),
        });
      }
      url = data?.paging?.next || null;
    }
    return { ok: true, rows };
  } catch (err: any) {
    return { ok: false, reason: err?.name === 'TimeoutError' ? 'Meta timed out' : err?.message || String(err) };
  }
}
