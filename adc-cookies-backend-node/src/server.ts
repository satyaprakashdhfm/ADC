/*
 * Starting the server: listen, plus the one-time boot work that a long-lived process does and a
 * serverless invocation must not. The app itself is built in app.js.
 */
import 'dotenv/config';
import app from './app.js';
import { initSchema } from './db/initSchema.js';
import { seedIfEmpty } from './db/seed.js';
import { startStatusPoller } from './jobs/statusPoller.js';
import { startLogRetention } from './jobs/logRetention.js';
import { ensureStoreAccounts } from './services/storeAuth.service.js';
import { ensureMediaBucket } from './services/storage.client.js';
import { getOne } from './db/index.js';
import { assertEnv } from './config/env.js';
import { listTemplates, whatsappConfigured } from './services/whatsapp.client.js';
import { ppRequest, petpoojaConfigured, REST_ID as PP_REST_ID } from './services/petpooja.client.js';

const PORT = Number(process.env.PORT || 8080);

(async () => {
  /* Before anything opens a connection or books anything: refuse to start if an outbound host is
     ambiguous. A wrong host is silent in both directions — staging booking real Delhivery parcels,
     production relaying to a Petpooja sandbox that answers success:"1" — so this is checked once,
     here, rather than discovered from a customer's missing order. See config/env.js. */
  assertEnv();
  await initSchema();
  // SKIP_SEED=true disables the auto-seed entirely — used by the isolated final_deploy test
  // environment, whose DB is provisioned separately (schema + curated reference data) and must
  // NOT be auto-seeded (the seed keys off an empty users table and would clash with pre-loaded
  // reference data / omit the warehouse row Delhivery needs).
  if (process.env.SKIP_SEED === 'true') {
    console.log('[CONFIG] SKIP_SEED=true — auto-seed disabled');
  } else {
    await seedIfEmpty();
  }
  // Give any store that has no staff login one. Idempotent — an existing account is never
  // touched, so a password someone changed cannot be reset by a redeploy.
  await ensureStoreAccounts().catch((e) => console.error('[STORE] account seed failed:', e?.message || e));
  /* The private media bucket, created here rather than by hand so staging and production cannot
     drift into one having it and the other not. Never fatal: no bucket means image uploads report
     themselves unavailable, which is a great deal better than the API refusing to start. */
  await ensureMediaBucket().catch((e) => console.error('[STORAGE] bucket check failed:', e?.message || e));
  /* Carrier status refresh. The store tablet polls and so stays current, but the admin list and
     the customer's account render the stored value — which went stale the moment nobody was
     looking at a portal. The webhook was meant to cover this and has not fired once. */
  startStatusPoller();
  /* Trim the API log directory. It is a mounted volume, so it survives every deploy and nothing
     had ever removed a file from it — and a full volume surfaces as appendFileSync throwing inside
     logApiCall, which stops the record of what we sent Razorpay and Delhivery without stopping the
     calls themselves. Swept on boot and daily; see jobs/logRetention.ts. */
  startLogRetention();
  app.listen(PORT, () => {
    console.log(`ADC Cookies backend listening on http://localhost:${PORT}`);
    console.log(`[CONFIG] DB=${process.env.DATABASE_URL ? 'supabase-pooler' : 'local-pg'}`);
    console.log(`[CONFIG] SUPABASE=${process.env.SUPABASE_URL ? 'yes' : 'MISSING'}`);
    console.log(`[CONFIG] DELHIVERY_TOKEN=${process.env.DELIVERY_API_TOKEN || process.env.DELHIVERY_API_TOKEN ? 'set' : 'MISSING'}`);
    console.log(`[CONFIG] DELHIVERY_BASE_URL=${process.env.DELHIVERY_BASE_URL || '(default: track.delhivery.com)'}`);
    console.log(`[CONFIG] RESEND=${process.env.RESEND_API_KEY ? 'set' : 'MISSING'}`);
    /* The admin allowlist, which is admin_accounts — NOT users.role.
       This counted users WHERE role = 'ADMIN' long after that column was retired, and initSchema
       itself sets every such row to CUSTOMER. So it printed 0 on every boot of every environment
       and read like "nobody can sign in to the dashboard", which was never true and sent somebody
       looking for a seeding bug that did not exist. */
    getOne('SELECT count(*)::int AS n FROM admin_accounts WHERE is_active = TRUE')
      .then((r) => console.log(`[CONFIG] ADMIN phone allowlist=${r?.n ?? '?'} active`)).catch(() => {});

    /*
     * Can we still reach Petpooja, and from where?
     *
     * Their production API is IP-allowlisted, so the answer changes when the egress path changes —
     * which is exactly the sort of thing that is invisible until an order fails to reach the
     * kitchen. This asks once per deploy and tells the two failures apart: a business error means we
     * REACHED them (the allowlist is fine, they just did not like the request), while status 0 means
     * we never got there at all.
     *
     * mapped_restaurant_menus is deprecated by Petpooja and answers with an error, which is exactly
     * why it is used here — it proves the round trip and writes nothing. fetchMenu() would have
     * ingested a menu on success, which is not a probe's business.
     */
    if (petpoojaConfigured()) {
      ppRequest('/mapped_restaurant_menus', { restID: PP_REST_ID })
        .then((r: any) => console.log(r.status > 0
          ? `[PETPOOJA] reachability | ✓ reached them (http ${r.status}) via ${process.env.HTTPS_PROXY || process.env.PETPOOJA_PROXY_URL ? 'PROXY' : 'DIRECT'}`
          : `[PETPOOJA] reachability | ✗ never reached — ${r.reason}`))
        .catch((e) => console.log(`[PETPOOJA] reachability | ✗ ${e.message}`));
    }

    /* One read-only call to Meta on boot, so a broken WhatsApp setup says WHY in the logs.
       The WhatsApp Manager UI reports "not allowed to manage templates" with no reason; the Graph
       API returns a specific code and message for the same condition. One request per deploy. */
    if (whatsappConfigured()) {
      listTemplates()
        .then((r: any) => console.log(r.ok
          ? `[WHATSAPP] templates | ✓ ${r.templates.length} on the account`
          : `[WHATSAPP] templates | ✗ ${r.reason}`))
        .catch((e) => console.log(`[WHATSAPP] templates | ✗ ${e.message}`));
    }
  });
})().catch(err => { console.error('Startup failed:', err); process.exit(1); });
