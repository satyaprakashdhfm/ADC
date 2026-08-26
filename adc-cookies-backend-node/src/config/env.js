/*
 * Boot-time environment check.
 *
 * The problem this exists for is not a missing variable — that is loud and obvious. It is a
 * PRESENT DEFAULT that silently points at the wrong world:
 *
 *   DELHIVERY_BASE_URL falls back to track.delhivery.com, which is PRODUCTION. Unset on staging,
 *   test orders book real shipments, print real labels and bill the real wallet. Nothing fails;
 *   the parcels are simply real.
 *
 *   PETPOOJA_BASE_URL falls back to the sandbox host from their PDF guide. Unset in production,
 *   paid orders relay to a sandbox that cheerfully answers success:"1" — so our side records a
 *   relayed order, the admin dashboard shows it went through, and the kitchen never sees it. This
 *   one is worse than a crash: it looks exactly like success.
 *
 * The rule, and the reason it is safe to enforce: an implicit host is only acceptable when the
 * integration is switched OFF anyway. If credentials are present, something is going to make real
 * calls, and it must say out loud which host it is calling. A developer with no Petpooja
 * credentials is unaffected; an environment holding live keys must be explicit.
 *
 * Everything wrong is reported in ONE failure, not one per boot. Fixing four variables should take
 * one deploy, not four.
 */

const present = (v) => typeof v === 'string' && v.trim() !== '';

/** Which integrations hold credentials, and are therefore going to make real calls. */
function configured(env) {
  return {
    delhivery: present(env.DELIVERY_API_TOKEN) || present(env.DELHIVERY_API_TOKEN),
    petpooja: present(env.PETPOOJA_APP_KEY || env.PETPOOJA_API)
      && present(env.PETPOOJA_APP_SECRET || env.PETPOOJA_API_SECRET)
      && present(env.PETPOOJA_ACCESS_TOKEN || env.PETPOOJA_API_TOKEN)
      && present(env.PETPOOJA_REST_ID),
    shiprocket: present(env.SHIPROCKET_EMAIL) && present(env.SHIPROCKET_PASSWORD),
    messageCentral: present(env.CUSTOMER_ID) && present(env.AUTH_KEY),
  };
}

/*
 * MUST be explicit when the integration is live: the default points at the wrong environment, and
 * being wrong is silent in both directions.
 *
 * WARN when the integration is live but the host is implicit: the default is the right host today,
 * so this is not worth refusing to boot over — but it is the same shape of trap as the two above,
 * and neither Railway service sets them, which is why they cannot be promoted to errors without
 * taking both environments down on the next deploy.
 */
const MUST_BE_EXPLICIT = [
  { key: 'DELHIVERY_BASE_URL', when: 'delhivery',
    why: 'defaults to track.delhivery.com — PRODUCTION. On staging that books real shipments against the real wallet.' },
  { key: 'PETPOOJA_BASE_URL', when: 'petpooja',
    why: 'defaults to the sandbox. In production, paid orders relay to a sandbox that answers success:"1" and never reach the kitchen.' },
];

const SHOULD_BE_EXPLICIT = [
  { key: 'SHIPROCKET_BASE_URL', when: 'shiprocket', fallback: 'apiv2.shiprocket.in (production)' },
  { key: 'MC_BASE_URL', when: 'messageCentral', fallback: 'cpaas.messagecentral.com (production)' },
];

/**
 * Check the environment. Returns the warnings; throws with every problem listed if any outbound
 * host that must be explicit is missing.
 */
export function checkEnv(env = process.env) {
  const on = configured(env);
  const errors = [];
  const warnings = [];

  for (const { key, when, why } of MUST_BE_EXPLICIT) {
    if (on[when] && !present(env[key])) {
      errors.push(`${key} is not set, but ${when} has credentials and will make real calls.\n      ${why}`);
    }
  }
  for (const { key, when, fallback } of SHOULD_BE_EXPLICIT) {
    if (on[when] && !present(env[key])) {
      warnings.push(`${key} is not set — falling back to ${fallback}.`);
    }
  }

  if (errors.length) {
    throw new Error(
      `Refusing to start — ${errors.length} outbound host${errors.length > 1 ? 's are' : ' is'} ambiguous:\n\n` +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n\n') +
      `\n\n  Set them explicitly for this environment. An implicit host is only safe when the\n` +
      `  integration is switched off, and these hold credentials.\n`
    );
  }
  return warnings;
}

/** Run the check and report. Called once, from server.js, before anything opens a connection. */
export function assertEnv(env = process.env) {
  const warnings = checkEnv(env);
  for (const w of warnings) console.warn(`[CONFIG] ⚠ ${w}`);
  return warnings;
}
