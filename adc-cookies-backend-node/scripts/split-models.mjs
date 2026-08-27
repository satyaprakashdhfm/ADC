/*
 * Turn drizzle-kit's single introspected schema into src/models/<domain>.model.js.
 *
 * Done by SCRIPT and not by hand for one reason: `drizzle-kit pull` always regenerates ONE file,
 * so every future refresh would otherwise need re-splitting by hand — which is how a schema starts
 * drifting from the database again, the exact problem models/ exists to end. Re-run this after a
 * pull and the split is reproduced exactly.
 *
 *   node scripts/split-models.mjs <pulled-schema.js>
 *
 * It reads the declarations, works out which tables each group references, and writes the imports
 * needed to satisfy them. The FK graph is a DAG (checked: 26 references, 0 cycles), so the imports
 * it emits can never be circular.
 */
import fs from 'node:fs';
import path from 'node:path';

let SRC = fs.readFileSync(process.argv[2], 'utf8');

/*
 * Swap the three column types whose Drizzle default does NOT match what raw SQL returns here.
 * See src/models/_columns.js — without this, money comes back as a string and `a + b` silently
 * becomes string concatenation on order totals.
 */
SRC = SRC
  .replace(/\bnumeric\(/g, 'money(')
  .replace(/\btimestamp\((.*?)\{ withTimezone: true, mode: 'string' \}\)/g,
           (_m, args) => `tstz(${args.replace(/,\s*$/, '')})`)
  .replace(/(?<![.\w])date\(/g, 'dateOnly(')
  /* customType has no .defaultNow() — that helper belongs to drizzle's own timestamp column.
     now() is the identical default, and is what the database already holds. */
  .replace(/\.defaultNow\(\)/g, '.default(sql`now()`)');
const OUT = path.resolve(import.meta.dirname, '..', 'src', 'models');

/* Grouped by the thing they describe, not by table count — the six petpooja tables are one
   subject and are never reasoned about separately, while orders and order_items genuinely are. */
const GROUPS = {
  'user':           ['users', 'password_reset_otps'],
  'address':        ['addresses'],
  'product':        ['products'],
  'order':          ['orders'],
  'orderItem':      ['order_items'],
  'orderTracking':  ['order_tracking'],
  'payment':        ['payments'],
  'cart':           ['cart'],
  'cartItem':       ['cart_items'],
  'coupon':         ['coupons'],
  'couponUsage':    ['coupon_usage'],
  'spin':           ['spin_claims', 'spin_draws', 'spin_ticket_pool', 'spin_email_claims'],
  'admin':          ['admin_accounts', 'admin_sessions'],
  'store':          ['store_users', 'store_status', 'store_product_overrides'],
  'warehouse':      ['warehouses'],
  'siteSetting':    ['site_settings'],
  'contactMessage': ['contact_messages'],
  'petpooja':       ['petpooja_items', 'petpooja_orders', 'petpooja_taxes', 'petpooja_addons',
                     'petpooja_stores', 'petpooja_menu_snapshots'],
};

const NOTES = {
  user: ' *\n * password_reset_otps is DEAD — empty in production and referenced nowhere in src/. It is kept\n * here on purpose: models/ is what drizzle-kit diffs the database against, so a table left out of\n * it would be generated as a DROP on the next migration.',
  petpooja: ' *\n * Their menu, mirrored. Prices here are theirs and are an id source only — what we charge lives on\n * our own products table, which is why nothing reads price from these rows.',
};

// Locate each declaration by its start, and take everything up to the next one.
const starts = [...SRC.matchAll(/^export const (\w+) = pgTable\("([a-z_]+)"/gm)]
  .map((m) => ({ i: m.index, varName: m[1], table: m[2] }));
const decls = new Map(starts.map((s, k) => [s.table,
  { ...s, text: SRC.slice(s.i, k + 1 < starts.length ? starts[k + 1].i : SRC.length).trimEnd() }]));

const assigned = new Set(Object.values(GROUPS).flat());
const missing = [...decls.keys()].filter((t) => !assigned.has(t));
if (missing.length) { console.error('NOT ASSIGNED to any group:', missing.join(', ')); process.exit(1); }
const bogus = assigned.size && [...assigned].filter((t) => !decls.has(t));
if (bogus.length) { console.error('grouped but not in the schema:', bogus.join(', ')); process.exit(1); }

// Which drizzle-orm/pg-core builders and which sibling tables each group needs.
const BUILDERS = ['pgTable','text','boolean','timestamp','index','foreignKey','serial','integer',
  'uniqueIndex','check','numeric','unique','jsonb','varchar','doublePrecision','date','primaryKey'];
const LOCAL_TYPES = ['money','tstz','dateOnly'];   // from ./_columns.js, not drizzle-orm
const varOf = new Map([...decls.values()].map((d) => [d.varName, d.table]));

const fileFor = new Map();
for (const [g, tables] of Object.entries(GROUPS)) for (const t of tables) fileFor.set(t, g);

let written = 0;
for (const [group, tables] of Object.entries(GROUPS)) {
  const body = tables.map((t) => decls.get(t).text).join('\n\n');
  const usedBuilders = BUILDERS.filter((b) => new RegExp(`\\b${b}\\s*\\(`).test(body));
  const usesSql = /\bsql`/.test(body);

  // sibling tables referenced by these declarations, grouped by the file they live in
  const needByFile = new Map();
  for (const [v, t] of varOf) {
    if (tables.includes(t)) continue;
    if (!new RegExp(`\\b${v}\\.`).test(body)) continue;
    const f = fileFor.get(t);
    if (!needByFile.has(f)) needByFile.set(f, new Set());
    needByFile.get(f).add(v);
  }

  const usedLocal = LOCAL_TYPES.filter((t) => new RegExp(`\\b${t}\\(`).test(body));
  const imports = [
    `import { ${usedBuilders.join(', ')} } from 'drizzle-orm/pg-core';`,
    usedLocal.length ? `import { ${usedLocal.join(', ')} } from './_columns.js';` : null,
    usesSql ? `import { sql } from 'drizzle-orm';` : null,
    ...[...needByFile.entries()].sort()
      .map(([f, vars]) => `import { ${[...vars].sort().join(', ')} } from './${f}.model.js';`),
  ].filter(Boolean).join('\n');

  const note = NOTES[group] ? `\n${NOTES[group]}` : '';
  const header = `/*\n * ${tables.join(', ')}\n *\n * Generated by scripts/split-models.mjs from a drizzle-kit pull of the live schema. Do not edit by\n * hand — change the database, pull, and re-split.${note}\n */\n`;
  fs.writeFileSync(path.join(OUT, `${group}.model.js`), `${header}${imports}\n\n${body}\n`);
  written++;
}

// index.js re-exports everything; drizzle.config points here so a pull sees every table.
const idx = `/*\n * Every table, in one import.\n *\n * drizzle.config.ts points at this file, so what it re-exports IS what drizzle-kit compares the\n * database against. A table missing from here would be generated as a DROP.\n */\n` +
  Object.keys(GROUPS).sort().map((g) => `export * from './${g}.model.js';`).join('\n') + '\n';
fs.writeFileSync(path.join(OUT, 'index.js'), idx);

console.log(`${written} model files + index.js, covering ${decls.size} tables`);
