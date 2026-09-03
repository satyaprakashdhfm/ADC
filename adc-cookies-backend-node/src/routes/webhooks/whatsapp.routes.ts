import crypto from 'node:crypto';
import { Router } from 'express';
import { query, nowIso } from '../../db/index.js';
import { log } from '../../services/whatsapp.client.js';

/*
 * Endpoints Meta calls on US.
 *
 * TWO HANDLERS, and the GET is not optional: Meta will not save a webhook URL until it has sent a
 * GET with a challenge and had it echoed back. That handshake is the "Verify and save" button in
 * the App Dashboard.
 *
 * The POST is signed — X-Hub-Signature-256, an HMAC-SHA256 of the RAW BYTES with the app secret.
 * Verifying it requires the unparsed body, which is why this router is mounted with express.raw()
 * before the JSON parser, exactly like the Razorpay webhook. Computing the HMAC over a
 * re-serialised body fails every time, and looks like a wrong secret.
 *
 * NEVER 500. Meta retries a non-200 with decreasing frequency FOR UP TO 7 DAYS, and sends those
 * retries to every app subscribed to the account — so one thrown error becomes days of duplicate
 * deliveries. We answer 200 and record, always.
 */
const router = Router();

const APP_SECRET = (process.env.WHATSAPP_APP_SECRET || '').trim();
const VERIFY_TOKEN = (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim();

/* ---- The handshake. Meta GETs this once, when you press "Verify and save". ---- */
router.get('/webhook', (req, res) => {
  const mode = String(req.query['hub.mode'] || '');
  const token = String(req.query['hub.verify_token'] || '');
  const challenge = String(req.query['hub.challenge'] || '');

  if (!VERIFY_TOKEN) {
    console.warn('[WHATSAPP] ✗ verify rejected: WHATSAPP_WEBHOOK_VERIFY_TOKEN not set');
    return res.sendStatus(403);
  }
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    log('verify', '✓ handshake accepted');
    // Their challenge, echoed as PLAIN TEXT. A JSON-wrapped body fails the check.
    return res.status(200).type('text/plain').send(challenge);
  }
  console.warn(`[WHATSAPP] ✗ verify rejected: mode=${mode || 'none'} token=${token ? 'mismatch' : 'absent'}`);
  return res.sendStatus(403);
});

/*
 * Is this really Meta?
 *
 * Fail closed when a secret is configured. If none is set we accept and warn — the alternative is a
 * webhook that cannot be set up at all before the secret is pasted, and this endpoint only ever
 * RECORDS. It changes no order and moves no money.
 */
function signatureOk(req): boolean {
  if (!APP_SECRET) {
    console.warn('[WHATSAPP] ⚠ unverified webhook — WHATSAPP_APP_SECRET is not set');
    return true;
  }
  const header = String(req.get('x-hub-signature-256') || '');
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? '');
  const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex');
  const a = Buffer.from(header, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // Byte lengths, not string lengths — timingSafeEqual throws on a mismatch.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/webhook', async (req, res) => {
  if (!signatureOk(req)) {
    console.warn('[WHATSAPP] ✗ rejected: bad X-Hub-Signature-256');
    return res.sendStatus(403);
  }

  /* Answer FIRST. Meta's retry policy punishes a slow or failed response harder than anything we
     could gain by finishing the work before replying, and everything below is bookkeeping. */
  res.sendStatus(200);

  let body: any = {};
  try {
    body = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '{}'));
  } catch {
    log('webhook', '✗ unparseable body');
    return;
  }

  try {
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const field = change?.field;
        const value = change?.value ?? {};

        /* Delivery receipts for messages WE sent: sent → delivered → read, or failed. This is the
           only way to know a message actually arrived; the send call's 200 means accepted, not
           delivered. */
        for (const st of value?.statuses ?? []) {
          const err = st?.errors?.[0];
          await query(
            `UPDATE whatsapp_messages
                SET status = $1,
                    last_error = COALESCE($2, last_error),
                    updated_at = $3
              WHERE message_id = $4`,
            [String(st?.status || ''), err ? `${err.code}: ${err.title || err.message || ''}`.slice(0, 500) : null, nowIso(), String(st?.id || '')]
          ).catch(() => {});
          log('status', `${st?.id} → ${st?.status}${err ? ` (${err.code} ${err.title || ''})` : ''}`);
        }

        /* Someone messaged US. Recorded, not answered — replying opens a 24-hour service window and
           is a product decision, not a webhook's. */
        for (const m of value?.messages ?? []) {
          log('inbound', `from=${m?.from} type=${m?.type} id=${m?.id}`);
        }

        /* A template was approved, rejected, paused or disabled. Worth logging loudly: a paused
           template silently stops every message that uses it. */
        if (field === 'message_template_status_update') {
          log('template', `${value?.message_template_name} → ${value?.event}${value?.reason ? ` (${value.reason})` : ''}`);
        }
      }
    }
  } catch (err: any) {
    // Already answered 200; a failure here must not become a retry storm.
    log('webhook', `✗ ${err.message}`);
  }
});

export default router;
