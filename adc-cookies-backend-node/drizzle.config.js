import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/*
 * What the database is supposed to look like.
 *
 * The schema now lives in src/models/, as the same pgTable definitions the application queries
 * through — so there is ONE description of a table rather than one for migrations and another for
 * the code. Until now it lived inside initSchema() as CREATE TABLE IF NOT EXISTS and ALTER TABLE
 * ADD COLUMN IF NOT EXISTS, which can only ever ADD: it cannot change a column's type, rename one,
 * or add a constraint, and because IF NOT EXISTS silently skips, an edited CREATE TABLE never
 * reaches a database that already has the table. That is exactly how payments ended up missing six
 * columns the payment code writes to, on every environment initSchema built.
 *
 * REFRESHING THE MODELS from a live database is two steps, because drizzle-kit pull always writes
 * one file and src/models is split by subject:
 *
 *   npx drizzle-kit pull --config=<config whose out= is a scratch dir>
 *   node scripts/split-models.mjs <that dir>/schema.ts
 *
 * split-models.mjs also substitutes the column types in src/models/_columns.js. Without those,
 * Drizzle and raw SQL disagree about money and timestamps — silently, and on order totals. Read
 * that file before changing anything here.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/models/index.js',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  },
  // Our tables live in public and are created by initSchema(); nothing else should be touched.
  schemaFilter: ['public'],
  verbose: true,
  strict: true,
});
