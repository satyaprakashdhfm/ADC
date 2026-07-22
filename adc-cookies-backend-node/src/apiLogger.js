/*
 * File-based logger for every outbound call to Razorpay / Delhivery / Shadowfax.
 *
 * Writes one JSON line per call to logs/<service>-<YYYY-MM-DD>.log (local disk, gitignored),
 * in addition to the existing console.log summaries (which Railway's log viewer already
 * captures). Use this when you need to see, after the fact, exactly which endpoint was hit,
 * with what request payload, and what came back — not just a one-line status summary.
 *
 * Secrets (tokens/keys/passwords/signatures) are redacted before anything touches disk.
 */
import fs from 'node:fs';
import path from 'node:path';

const LOG_DIR = path.join(process.cwd(), 'logs');
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* best-effort */ }

function fileFor(service) {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `${service}-${day}.log`);
}

const REDACT_KEYS = new Set([
  'authorization', 'password', 'secret', 'token', 'api_secret', 'key_secret',
  'razorpaysignature', 'signature', 'jwt_secret', 'service_role_key',
]);

function redact(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[redacted]' : redact(v);
  }
  return out;
}

// service: 'razorpay' | 'delhivery' | 'shadowfax'
export function logApiCall({ service, method, endpoint, request, response, status, ok, durationMs, error }) {
  const entry = {
    ts: new Date().toISOString(),
    service,
    method,
    endpoint,
    status: status ?? null,
    ok: ok ?? null,
    durationMs: durationMs ?? null,
    request: request !== undefined ? redact(request) : undefined,
    response: response !== undefined ? redact(response) : undefined,
    error: error || undefined,
  };
  try {
    fs.appendFileSync(fileFor(service), JSON.stringify(entry) + '\n');
  } catch (e) {
    console.error(`[apiLogger] failed to write ${service} log: ${e.message}`);
  }
}
