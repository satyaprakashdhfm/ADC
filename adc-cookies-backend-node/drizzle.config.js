import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/*
 * Drizzle is here for the SCHEMA, not to replace how we query.
 *
 * The routes keep using query()/getOne()/getAll() from db.js — nothing has to be rewritten. What
 * this buys us is a real migration history: until now the schema lived inside initSchema() as 27
 * CREATE TABLE IF NOT EXISTS and 35 ALTER TABLE ADD COLUMN IF NOT EXISTS, which can only ever ADD.
 * It cannot change a column's type, rename one, or add a constraint — and because IF NOT EXISTS
 * silently skips, an edited CREATE TABLE never reaches a database that already has the table, so
 * environments drift apart with nothing to signal it.
 *
 * `drizzle-kit pull` reads the live schema into schema.js + a baseline SQL file. From then on a
 * schema change is a reviewable, ordered, rollback-able file.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './drizzle/schema.ts',
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
