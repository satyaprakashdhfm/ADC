/*
 * WhatsApp Cloud API — the HTTP half. Talks to Meta and nothing else.
 *
 * Same .client / .service split as Petpooja and Delhivery: nothing here imports the database, so it
 * can be reasoned about (and pointed at a test number) without our schema anywhere near it.
 *
 * DORMANT UNTIL CONFIGURED. With no phone number id or token, whatsappConfigured() is false and
 * every send is a no-op — so this ships before the Meta app is live, exactly like Petpooja on
 * staging.
 *
 * THE ONE RULE THAT SHAPES EVERYTHING: outside a 24-hour customer service window you may only send
 * a PRE-APPROVED TEMPLATE. Every message we send — order confirmation, cancellation, an abandoned
 * cart nudge — is business-initiated, so in practice we are always sending templates and the
 * free-form sender below is only for replying to someone who messaged us first.
 */
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v23.0';
const BASE = `https://graph.facebook.com/${API_VERSION}`;

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

export const whatsappConfigured = () => !!(PHONE_NUMBER_ID && TOKEN);
export const wabaId = () => WABA_ID;
export const log = (op: string, msg: string) => console.log(`[WHATSAPP] ${op} | ${msg}`);

console.log(`[WHATSAPP] config | ${API_VERSION} | phone=${PHONE_NUMBER_ID || 'MISSING'} | waba=${WABA_ID || 'MISSING'} | token=${TOKEN ? 'set' : 'MISSING'}`);

/*
 * E.164 without the leading plus is what their API wants, but the PLUS MATTERS on the way in.
 * Meta's own docs: if the country code is omitted, OUR number's country code is prepended — so a
 * 10-digit Indian mobile is fine, and an 11-digit one silently becomes a different number in a
 * different country. We normalise here rather than trusting the caller.
 */
export function waNumber(input: string | null | undefined): string {
  let d = String(input ?? '').replace(/\D/g, '');
  if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d;
}

async function graph(path: string, body: unknown, { timeoutMs = 20_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Their errors are structured; the code+subcode pair is what support asks for.
      const e = data?.error || {};
      return { ok: false, status: res.status, reason: `${e.code ?? res.status}/${e.error_subcode ?? '-'}: ${e.message || 'unknown'}`, data };
    }
    return { ok: true, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, reason: err.name === 'AbortError' ? 'timeout' : err.message, data: null };
  } finally {
    clearTimeout(timer);
  }
}

/*
 * The parts of a template message that change from one send to the next. The wording, the buttons
 * and the layout live in WhatsApp Manager, where Meta approved them.
 *
 * body is NAMED ({ customer_name: 'Priya' }) or POSITIONAL (['Priya']). The template fixed which one
 * when it was created, and a send in the other format is rejected.
 *
 * headerImage is required on every send of a template with an image header: a public https URL
 * (Meta fetches it, so a login-protected preview deployment will not do), or the id of media
 * already uploaded to WhatsApp.
 */
export interface TemplateMessage {
  name: string;
  language: string;
  headerImage?: string;
  body?: Record<string, string> | string[];
}

export type TemplateSendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; reason: string };

/*
 * Meta refuses the WHOLE message over one bad variable (error 132018): no line breaks, no tabs, no
 * more than four spaces in a row, and never empty. Cleaned here, once, so that no template has to
 * remember — a customer's name with a stray newline in it must not cost them their confirmation.
 */
function paramText(value: string): string {
  const text = String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {5,}/g, '    ').trim();
  return text || '-';
}

function templateComponents(m: TemplateMessage) {
  const components: unknown[] = [];
  if (m.headerImage) {
    const image = /^https?:\/\//i.test(m.headerImage) ? { link: m.headerImage } : { id: m.headerImage };
    components.push({ type: 'header', parameters: [{ type: 'image', image }] });
  }
  if (m.body) {
    const parameters = Array.isArray(m.body)
      ? m.body.map((text) => ({ type: 'text', text: paramText(text) }))
      : Object.entries(m.body).map(([name, text]) => ({ type: 'text', parameter_name: name, text: paramText(text) }));
    if (parameters.length) components.push({ type: 'body', parameters });
  }
  return components;
}

/**
 * Send an approved template. The only thing that reaches a customer who has not messaged us first.
 *
 * A successful result means Meta ACCEPTED the message, not that it arrived. Delivery comes later,
 * on the webhook, keyed by the messageId returned here.
 */
export async function sendTemplate(to: string, m: TemplateMessage): Promise<TemplateSendResult> {
  if (!whatsappConfigured()) return { ok: false, reason: 'not_configured' };
  const number = waNumber(to);
  if (number.length < 11) return { ok: false, reason: `bad_number:${to}` };
  const r = await graph(`/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: `+${number}`,
    type: 'template',
    template: { name: m.name, language: { code: m.language }, components: templateComponents(m) },
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, messageId: r.data?.messages?.[0]?.id ?? null };
}

/**
 * Free-form text. ONLY valid inside a 24-hour customer service window — outside one Meta rejects it,
 * which is why nothing in our order flow uses this. It exists to answer someone who wrote to us.
 */
export async function sendText(to: string, body: string) {
  if (!whatsappConfigured()) return { ok: false, reason: 'not_configured' };
  const r = await graph(`/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: `+${waNumber(to)}`,
    type: 'text',
    text: { preview_url: false, body },
  });
  return r.ok ? { ok: true, messageId: r.data?.messages?.[0]?.id ?? null } : { ok: false, reason: r.reason };
}

/*
 * What Meta itself thinks of our business phone number.
 *
 * The WhatsApp Manager UI and the Production-setup wizard both say "registered" for a number that
 * the Cloud API may still not consider connected, so the UI is not the authority here — this is.
 *
 * platform_type is the field worth reading first: CLOUD_API means the number is on the API we
 * actually call. A number still attached to the WhatsApp Business App reads differently, and that
 * mismatch is a known cause of a number looking registered while behaving as if it is not.
 */
export async function phoneNumberStatus() {
  if (!whatsappConfigured()) return { ok: false, reason: 'not_configured' };
  const fields = 'id,display_phone_number,verified_name,quality_rating,status,code_verification_status,platform_type,name_status,throughput';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`${BASE}/${PHONE_NUMBER_ID}?fields=${fields}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }, signal: ctrl.signal,
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: data?.error?.message || `api_error_${res.status}` };
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, reason: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Every template on the account, with its status and quality rating — read-only, for admin. */
export async function listTemplates() {
  if (!TOKEN || !WABA_ID) return { ok: false, reason: 'not_configured' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const url = `${BASE}/${WABA_ID}/message_templates?limit=100&fields=name,status,category,language,quality_score,components`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: ctrl.signal });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: data?.error?.message || `api_error_${res.status}` };
    return { ok: true, templates: data?.data ?? [] };
  } catch (err: any) {
    return { ok: false, reason: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}
