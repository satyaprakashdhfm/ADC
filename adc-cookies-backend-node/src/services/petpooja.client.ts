/*
 * Petpooja (POS / billing) — the HTTP client. Talks to their API and nothing else.
 *
 * Petpooja is the restaurant's till. We are the "aggregator": their menu flows DOWN to us and we
 * relay orders UP, so the bill and KOT print at the store.
 *
 * This half deliberately does not import db, and that is the whole convention behind the
 * .client.js / .service.js split: a client is the part you can reason about without knowing our
 * schema, and could point at their sandbox in a test with no database anywhere near it. Everything
 * that reads or writes our own tables lives in petpooja.service.js.
 *
 * Quirks confirmed against the live sandbox, not assumed:
 *   • Business failures still return HTTP 200 — success lives in the body.
 *   • `success` is the STRING "1"/"0", never a boolean.
 *   • Fetch Menu answers "unable to fetch Object from s3 bucket" until the merchant has hit
 *     Menu Trigger at least once; that is an empty menu, not an auth or id error.
 *
 *   PETPOOJA_BASE_URL     defaults to the host in Petpooja's PDF guide. Their Apiary reference
 *                         lists a different host for save_order; both answer identically today,
 *                         so this is an env var rather than a constant.
 *   PETPOOJA_APP_KEY / _APP_SECRET / _ACCESS_TOKEN   from the dashboard's Configuration tab
 *   PETPOOJA_REST_ID      menu-sharing / mapping code
 */
import { ProxyAgent } from 'undici';
import { logApiCall } from '../utils/logger.js';

const BASE = (process.env.PETPOOJA_BASE_URL || 'https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1').replace(/\/+$/, '');
// Two accepted spellings: the descriptive ones matching Petpooja's own field names, and the
// shorter PETPOOJA_API* set already present in .env. Same values either way.
const APP_KEY = process.env.PETPOOJA_APP_KEY || process.env.PETPOOJA_API || '';
const APP_SECRET = process.env.PETPOOJA_APP_SECRET || process.env.PETPOOJA_API_SECRET || '';
const ACCESS_TOKEN = process.env.PETPOOJA_ACCESS_TOKEN || process.env.PETPOOJA_API_TOKEN || '';
export const REST_ID = process.env.PETPOOJA_REST_ID || '';

export const petpoojaConfigured = () => !!(APP_KEY && APP_SECRET && ACCESS_TOKEN && REST_ID);

console.log(`[PETPOOJA] config | base=${BASE} | restID=${REST_ID || 'MISSING'} | keys=${APP_KEY && APP_SECRET && ACCESS_TOKEN ? 'set' : 'MISSING'}`);

export const log = (op, msg) => console.log(`[PETPOOJA] ${op} | ${msg}`);
const creds = () => ({ app_key: APP_KEY, app_secret: APP_SECRET, access_token: ACCESS_TOKEN });

/** POST JSON and normalise their "HTTP 200 + success:'0'" convention into a plain result. */
/*
 * Petpooja is the ONE integration that has to leave from a fixed IP — they allowlist ours — so it,
 * and only it, goes through the egress proxy.
 *
 * This used to be arranged the other way round, with NODE_USE_ENV_PROXY sending EVERY outbound
 * request through the proxy and a NO_PROXY list naming the dozen hosts that should not. That list
 * can only ever contain hosts somebody thought of in advance, and the failures it produced were
 * silent and far from their cause: phone OTP died because messagecentral.com was missing from it,
 * and Delhivery labels died because the PDF arrives on a pre-signed link at a host nobody can
 * enumerate. Each one looked like a broken integration rather than a networking rule.
 *
 * Proxying the exception instead of the rule makes the blast radius exactly one file. Nothing else
 * in the app can be affected by the proxy being wrong, unreachable, or absent.
 *
 * With no proxy configured this is undefined and fetch behaves normally, which is what staging
 * wants — it has no Petpooja credentials and needs the static IP for nothing.
 *
 * PETPOOJA_PROXY_URL and nothing else. It used to fall back to HTTPS_PROXY, which is the variable
 * left over from the abandoned proxy-everything setup this comment describes — so the one
 * integration that is supposed to opt IN to the proxy was in fact inheriting it from a general
 * setting, and the file contradicted its own rule. Now that Railway's own static egress IPs are
 * allowlisted by Petpooja, the proxy is not needed at all; naming it explicitly means the route is
 * whatever this one variable says, and putting the VM back is one variable, not four.
 */
const PROXY_URL = process.env.PETPOOJA_PROXY_URL || '';
let proxyAgent;
if (PROXY_URL) {
  try {
    proxyAgent = new ProxyAgent(PROXY_URL);
    console.log(`[PETPOOJA] outbound via proxy ${PROXY_URL.replace(/(:\/\/)[^@]*@/, '$1***@')}`);
  } catch (e: any) {
    // A malformed proxy URL must not take the POS integration down with it — go direct and say so.
    console.warn(`[PETPOOJA] proxy url unusable (${e.message}) — calling Petpooja directly`);
  }
}

/*
 * Which way calls actually leave, for the boot line that reports it.
 *
 * Exported rather than re-derived from the environment by the caller: server.ts used to decide the
 * PROXY/DIRECT label by reading HTTPS_PROXY itself, so the moment the two disagreed the log would
 * confidently name a route nothing was using — and that log line is the evidence the cutover is
 * judged on. It reads proxyAgent, so a proxy URL that failed to parse reports DIRECT, which is what
 * the request will actually do.
 */
export const egressRoute = () => (proxyAgent ? 'PROXY' : 'DIRECT');

export async function ppRequest(path: string, body: unknown, { timeoutMs = 20_000 }: { timeoutMs?: number } = {}): Promise<any> {
  const url = `${BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      // Scoped to this call — see PROXY_URL above. undefined means a normal direct request.
      dispatcher: proxyAgent,
      // Their docs show credentials two ways: as snake_case fields in the body (Save Order) and as
      // hyphenated HEADERS (Fetch Menu). Send both — each endpoint reads whichever it expects, and
      // the unused form is ignored. Verified to make no difference where the body form suffices.
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'app-key': APP_KEY,
        'app-secret': APP_SECRET,
        'access-token': ACCESS_TOKEN,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    const durationMs = Date.now() - t0;
    // success is the string "1"; anything else (including a missing key) is a failure.
    const ok = res.ok && String(data?.success ?? '') === '1';
    logApiCall({ service: 'petpooja', method: 'POST', endpoint: path, request: body, response: data, status: res.status, ok, durationMs });
    return { ok, status: res.status, data, reason: ok ? null : (data?.message || `http_${res.status}`) };
  } catch (err: any) {
    logApiCall({ service: 'petpooja', method: 'POST', endpoint: path, request: body, ok: false, durationMs: Date.now() - t0, error: err.message });
    return { ok: false, status: 0, data: null, reason: `network_error: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

/*
 * Relay a paid order.
 *
 * The nesting here is not decorative and not what their PDF's field tables imply. Petpooja wants
 *   orderinfo -> OrderInfo -> Restaurant|Customer|Order|OrderItem|Tax|Discount -> details
 * with restID inside Restaurant.details and udid/device_type beside OrderInfo. A flatter shape —
 * which is what the field tables read like — is refused with "Invalid order relay payload ", the
 * SAME message an empty {} gets, because the body is never inspected. That cost a day; the shape
 * below is the one verified to return {"success":"1","message":"Your order is saved."}.
 */
export async function saveOrder(payload) {
  if (!petpoojaConfigured()) return { ok: false, reason: 'not_configured' };
  const orderID = payload?.orderinfo?.OrderInfo?.Order?.details?.orderID || '?';
  log('save-order', `orderID=${orderID} | relaying…`);
  const r = await ppRequest('/save_order', { ...creds(), ...payload });
  log('save-order', r.ok ? `✓ ${JSON.stringify(r.data).slice(0, 160)}` : `✗ ${r.reason}`);
  return r;
}

/** Their Update Order Status only accepts cancel (-1); there is no other transition. */
export async function cancelOrder(clientOrderId, cancelReason = 'Cancelled by customer', restId = REST_ID) {
  if (!petpoojaConfigured()) return { ok: false, reason: 'not_configured' };
  log('cancel-order', `clientorderID=${clientOrderId} | cancelling…`);
  const r = await ppRequest('/update_order_status', {
    ...creds(), restID: restId, orderID: '', clientorderID: String(clientOrderId),
    cancelReason, status: '-1',
  });
  log('cancel-order', r.ok ? `✓ cancelled` : `✗ ${r.reason}`);
  return r;
}

/**
 * Tell the POS the parcel moved, so the merchant sees delivery progress without polling.
 * status: rider-assigned | rider-arrived | pickedup | delivered
 */
export async function riderStatus(clientOrderId, status, riderData = {}) {
  if (!petpoojaConfigured()) return { ok: false, reason: 'not_configured' };
  const r = await ppRequest('/rider_status_update', {
    ...creds(), status, order_id: String(clientOrderId), external_order_id: '', rider_data: riderData,
  });
  log('rider-status', `order=${clientOrderId} | ${status} | ${r.ok ? '✓' : `✗ ${r.reason}`}`);
  return r;
}
