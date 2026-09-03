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

export interface TemplateParam { type: 'text'; text: string; parameter_name?: string }

/**
 * Send an approved template. The only thing that reaches a customer who has not messaged us first.
 *
 * `params` are BODY parameters in order (positional format). Named format is supported by passing
 * parameter_name on each — the template decides which, and mixing them is what gets a send rejected.
 */
export async function sendTemplate(to: string, name: string, language = 'en', params: TemplateParam[] = []) {
  if (!whatsappConfigured()) return { ok: false, reason: 'not_configured' };
  const number = waNumber(to);
  if (number.length < 11) return { ok: false, reason: `bad_number:${to}` };
  const components = params.length ? [{ type: 'body', parameters: params }] : [];
  const r = await graph(`/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: `+${number}`,
    type: 'template',
    template: { name, language: { code: language }, components },
  });
  const messageId = r.ok ? r.data?.messages?.[0]?.id ?? null : null;
  log('send', `${name} → ${number} | ${r.ok ? `✓ ${messageId}` : `✗ ${r.reason}`}`);
  return r.ok ? { ok: true, messageId, data: r.data } : { ok: false, reason: r.reason, data: r.data };
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
