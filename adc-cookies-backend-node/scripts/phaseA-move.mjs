/*
 * Phase A — relocation only.
 *
 * Moves every src file to its new home and rewrites the relative imports that point at it. No
 * behaviour changes: the only edits inside a file are its own `from '...'` specifiers.
 *
 * Imports are rewritten by RESOLVING each specifier against the file's OLD location to an absolute
 * path, looking that up in the map, then re-relativising from the file's NEW location. Doing it by
 * string substitution instead would break the moment two files at different depths imported the
 * same module by different relative paths, which is most of them.
 *
 * Content splits (db.js, server.js) are deliberately NOT done here; they were done by hand after
 * this ran, so that git records each as a rename plus a small carve-out rather than a rewrite. Merges
 * the target structure asks for (heroBanner + bannerMessages) are left for Phase B, so that every
 * change in this commit is a rename git can recognise as one.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

export const MAP = {
  // ---- top-level modules ----
  'adminAuth.js':        'services/adminAuth.service.js',
  'apiLogger.js':        'utils/logger.js',
  'bannerMessages.js':   'services/bannerMessages.service.js',
  'delhivery.js':        'services/delhivery.client.js',
  'geo.js':              'services/geo.client.js',
  'heroBanner.js':       'services/heroBanner.service.js',
  'mailer.js':           'services/mailer.client.js',
  'messageCentral.js':   'services/messageCentral.client.js',
  'middleware.js':       'middlewares/auth.middleware.js',
  'orderProgress.js':    'services/orderProgress.service.js',
  'packs.js':            'services/pack.service.js',
  'petpooja.js':         'services/petpooja.service.js',
  'razorpay.js':         'services/razorpay.client.js',
  'seed.js':             'db/seed.js',
  'serializers.js':      'serializers/index.js',
  'shiprocket.js':       'services/shiprocket.client.js',
  'statusPoller.js':     'jobs/statusPoller.js',
  'storage.js':          'services/storage.client.js',
  'storeAuth.js':        'services/storeAuth.service.js',
  'stores.js':           'services/store.service.js',
  'supabaseAdmin.js':    'config/supabase.js',
  'supabaseJwt.js':      'services/auth.service.js',
  'db.js':               'db/initSchema.js',     // the 630-line DDL half keeps the rename;
                                                 // the 57-line pool/query half became db/index.js
  // server.js keeps its name and is split by hand into app.js (the Express app) + server.js (listen)

  // ---- public routes ----
  'routes/addresses.js': 'routes/addresses.routes.js',
  'routes/adminAuth.js': 'routes/adminAuth.routes.js',
  'routes/auth.js':      'routes/auth.routes.js',
  'routes/cart.js':      'routes/cart.routes.js',
  'routes/contact.js':   'routes/contact.routes.js',
  'routes/coupons.js':   'routes/coupons.routes.js',
  'routes/delivery.js':  'routes/delivery.routes.js',
  'routes/geo.js':       'routes/geo.routes.js',
  'routes/orders.js':    'routes/orders.routes.js',
  'routes/products.js':  'routes/products.routes.js',
  'routes/store.js':     'routes/store.routes.js',

  // ---- webhooks: grouped, because they authenticate by secret/HMAC and must never 500 ----
  'routes/hyperlocal.js':      'routes/webhooks/hyperlocal.routes.js',
  'routes/paymentsWebhook.js': 'routes/webhooks/razorpay.routes.js',
  'routes/petpooja.js':        'routes/webhooks/petpooja.routes.js',

  // ---- admin: still routers in Phase A; controllers are carved out in Phase B ----
  'routes/admin/index.js':        'routes/admin.routes.js',
  'routes/admin/cancelRefund.js': 'routes/admin/cancelRefund.routes.js',
  'routes/admin/contact.js':      'routes/admin/contact.routes.js',
  'routes/admin/coupons.js':      'routes/admin/coupons.routes.js',
  'routes/admin/delivery.js':     'routes/admin/delivery.routes.js',
  'routes/admin/insights.js':     'routes/admin/insights.routes.js',
  'routes/admin/orders.js':       'routes/admin/orders.routes.js',
  'routes/admin/petpooja.js':     'routes/admin/petpooja.routes.js',
  'routes/admin/products.js':     'routes/admin/products.routes.js',
  'routes/admin/settings.js':     'routes/admin/settings.routes.js',
  'routes/admin/shipments.js':    'routes/admin/shipments.routes.js',
  'routes/admin/stores.js':       'routes/admin/stores.routes.js',
  'routes/admin/uploads.js':      'routes/admin/uploads.routes.js',
  'routes/admin/users.js':        'routes/admin/users.routes.js',
};

/** Where a file ends up, as a src-relative path. Unmapped files stay where they are. */
const dest = (rel) => MAP[rel] || rel;

/** Resolve a relative specifier from a src-relative file to a src-relative target. */
function targetOf(fromRel, spec) {
  const abs = path.resolve(path.dirname(path.join(SRC, fromRel)), spec);
  return path.relative(SRC, abs);
}

function rewrite(oldRel, newRel, text) {
  return text.replace(/(\bfrom\s+|\bimport\s*\(\s*)(['"])(\.[^'"]*)\2/g, (m, kw, q, spec) => {
    const oldTarget = targetOf(oldRel, spec);
    const newTarget = dest(oldTarget);
    let out = path.relative(path.dirname(path.join(SRC, newRel)), path.join(SRC, newTarget));
    if (!out.startsWith('.')) out = './' + out;
    return `${kw}${q}${out}${q}`;
  });
}

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' });

if (process.argv[2] !== '--apply') {
  console.log('dry run — pass --apply to move\n');
}
const apply = process.argv[2] === '--apply';

// 1. create directories
for (const d of ['config','db','models','controllers','controllers/admin','controllers/webhooks',
                 'routes/webhooks','services','middlewares','serializers','utils','jobs']) {
  const p = path.join(SRC, d);
  if (apply) fs.mkdirSync(p, { recursive: true });
}

// 2. move
for (const [from, to] of Object.entries(MAP)) {
  const src = path.join(SRC, from), dst = path.join(SRC, to);
  if (!fs.existsSync(src)) { console.log(`  SKIP (missing) ${from}`); continue; }
  console.log(`  ${from}  ->  ${to}`);
  if (apply) { fs.mkdirSync(path.dirname(dst), { recursive: true }); git('mv', path.relative(ROOT, src), path.relative(ROOT, dst)); }
}

// 3. rewrite imports in every src file, at its NEW location
if (apply) {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  const inverse = Object.fromEntries(Object.entries(MAP).map(([a, b]) => [b, a]));
  let touched = 0;
  for (const abs of walk(SRC).filter(f => f.endsWith('.js'))) {
    const newRel = path.relative(SRC, abs);
    const oldRel = inverse[newRel] || newRel;
    const before = fs.readFileSync(abs, 'utf8');
    const after = rewrite(oldRel, newRel, before);
    if (after !== before) { fs.writeFileSync(abs, after); touched++; }
  }
  console.log(`\nrewrote imports in ${touched} files`);
}
