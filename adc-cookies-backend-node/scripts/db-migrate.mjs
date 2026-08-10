// Applies a migration file statement-by-statement (split on drizzle's --> statement-breakpoint).
// Usage: railway run --service <svc> node scripts/db-migrate.mjs drizzle/0002_money_numeric.sql
import pg from 'pg';
import fs from 'node:fs';
const file = process.argv[2];
if (!file) { console.error('usage: node scripts/db-migrate.mjs <file.sql>'); process.exit(1); }
const sql = fs.readFileSync(file, 'utf8');
const stmts = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s && !/^(--[^\n]*\n?)+$/.test(s));
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
console.log(`host: ${c.connectionParameters.host}  file: ${file}  statements: ${stmts.length}`);
let n = 0;
for (const s of stmts) {
  const body = s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim();
  if (!body) continue;
  await c.query(body);
  n++;
  console.log('  ok  ' + body.replace(/\s+/g, ' ').slice(0, 88));
}
console.log(`applied ${n} statements`);
await c.end();
