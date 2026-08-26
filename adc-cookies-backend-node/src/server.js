/*
 * Starting the server: listen, plus the one-time boot work that a long-lived process does and a
 * serverless invocation must not. The app itself is built in app.js.
 */
import 'dotenv/config';
import app from './app.js';
import { initSchema } from './db/initSchema.js';
import { seedIfEmpty } from './db/seed.js';
import { startStatusPoller } from './jobs/statusPoller.js';
import { ensureStoreAccounts } from './services/storeAuth.service.js';
import { ensureMediaBucket } from './services/storage.client.js';
import { getOne } from './db/index.js';

const PORT = Number(process.env.PORT || 8080);

(async () => {
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
  });
})().catch(err => { console.error('Startup failed:', err); process.exit(1); });
