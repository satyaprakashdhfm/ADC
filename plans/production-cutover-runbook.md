# Production cutover runbook

Written 2026-09-08, after doing the whole thing on staging. This is the rehearsed sequence, not a
design — every step below was executed against staging first, and the notes say what actually
happened rather than what was expected.

Read alongside `supabase-to-railway-db-migration.md` (the plan and the backup design) and
`mail-resend-to-zeptomail.md` (the verified DNS state).

## What is already true in production

- **Stage 1 shipped and verified.** No code reads Supabase's `auth` schema; the association lives
  in `users.supabase_user_id`. The backfill linked **77 of 204** accounts — the other 127 are the
  imported contacts, which have no auth account by definition.
- **Off-site backups are running.** Nightly `pg_dump` to Cloudflare R2 under `daily/`, 30-day
  lifecycle rule, GitHub Actions. First real object: 149,131 bytes, 34 tables, 26 sequences.
- Production is still on **Supabase Postgres** and still on **Supabase Auth**.

## What is on `final_deploy` and NOT on production

Stage 2 (database) and Stage 3 (auth) both. **17 files diverged.** A plain
`git merge final_deploy` into `main` ships them together, which is the one combination worth
avoiding: if production then misbehaves, there are two suspects and no way to separate them.

**So production goes in two passes, with a gap between them.**

---

## Pass 1 — the database

Rehearsed on staging 2026-09-08. Took about fifteen minutes end to end.

### Before

1. **Run the backup workflow by hand** and confirm it goes green. Not the nightly one — a fresh
   dump taken minutes before the cutover is the only rollback that covers the cutover itself.
2. **Run the restore-verification workflow.** It asserts all 26 sequences sit ahead of their
   columns, which is the failure that actually ruins a migration.
3. **Pick a quiet hour.** Writes during the window are lost. At current volume a short
   maintenance window beats engineering zero downtime.

### Provision

4. Railway → project `adc-cookies-backend` → **+ Create → Database → PostgreSQL**. The volume comes
   with it. **This is Postgres 18.6 where Supabase is 17.6** — a major version jump, accepted
   deliberately because Railway's PITR lives in their own image and the community 17 templates
   have no pgBackRest. Restoring 17.6 into 18.6 was verified on staging: 337 rows identical, all
   26 sequences correct.
5. **Enable PITR** (Postgres → Settings → Backups) and **set a volume backup schedule**. Two
   different layers; keep both.
6. **PITR will look broken for the first few minutes** and it is not. An idle database generates no
   WAL, so `archived_count` sits at 0 and Railway warns that credentials may be invalid. The
   distinguishing signal is `pg_stat_archiver.failed_count`: **zero means nothing was attempted**,
   non-zero means it is genuinely failing. Force one segment with a write plus
   `SELECT pg_switch_wal();` and coverage appears. **Do not press "Regenerate credentials &
   redeploy"** on the strength of that warning — it restarts Postgres for nothing.

### Move the data

7. Dump from Supabase, restore into Railway, verify. The script used on staging is
   `restore_verify.sh` in the session scratchpad; it does five things and the last three are the
   point:
   - create `pgcrypto`, `uuid-ossp`, and a stub `auth` schema (the dump leans on them; exclude
     `supabase_vault`, which is Supabase-only and will fail)
   - `pg_restore --no-owner --no-acl`
   - **diff every table's row count against the source** — captured with `count(*)`, never
     `reltuples`, which is stale on a fresh table and would "verify" a half-empty database
   - **assert every sequence is ahead of its own column**
   - check app invariants: orphaned orders, orphaned order_items, and that `admin_accounts` is not
     empty — an empty allowlist locks every admin out and looks like an auth bug, not a restore one
8. **One `pg_restore` error is expected**: `schema "public" already exists`. The dump carries
   `CREATE SCHEMA public`. Harmless.
9. **Getting a shell on the new database.** `railway connect Postgres --tunnel-only` is the right
   way and needs an SSH key. A public TCP proxy also works but exposes the database on the
   internet, and the Railway MCP tool **cannot remove one** — its `remove_tcp_proxy` rejects its
   own required `confirm` parameter, so removal is a dashboard job. Prefer the tunnel.

### Cut over

10. Set `DATABASE_URL` on **adc-backend** to a **reference**: `${{ Postgres.DATABASE_URL }}`, not a
    pasted string. It then resolves to `postgres.railway.internal` and follows any password
    rotation automatically.
11. Save the old Supabase URL as `DATABASE_URL_SUPABASE_ROLLBACK` on the same service first, so
    reverting is a copy-paste rather than a hunt.
12. Redeploy and read the boot log. `[CONFIG] DB=` now prints the real host — it used to print the
    literal string `supabase-pooler` regardless, which is how a successful staging cutover got
    misread as a failure.

### Prove it

13. **"The site loads" proves nothing** — `/` is static JSON and never touches the database, and the
    restored data looks identical either way. Nor does `pg_stat_activity`: the pool closes idle
    connections, so an idle app shows none. What worked on staging: read
    `pg_stat_database.tup_returned`, drive a few `/api/products` calls, read it again. Five calls
    moved it by 628 rows.
14. Watch the first `[POLL]` and `[PAYRECON]` sweeps (300s each).
15. **Re-point `BACKUP_DATABASE_URL`** at Railway, or you will keep faithfully backing up an
    abandoned Supabase database. The verification job's 48-hour freshness check would catch it, a
    month late.
16. **Keep the Supabase project alive and untouched for two weeks.** It costs nothing and it is
    what keeps rollback down to one variable.

### Then, separately

17. Drop the `max: 10` pool cap in `db/index.ts`. It exists only because of Supabase's pooler.
    Deliberately held back until now: that file is shared with staging, and raising it while
    anything still ran through the pooler would have pushed past its limits. Also the fix for
    `GET /api/admin/users` firing 319 queries through a pool of 10.

---

## Pass 2 — authentication

**Only after Pass 1 has been quiet for a while.** Nothing here depends on the database move, which
is exactly why they should not travel together.

### Before

1. **Google Cloud Console** → the existing OAuth client → confirm
   `https://adc-backend-production.up.railway.app/api/auth/google/callback` is in Authorized
   redirect URIs. Keep the Supabase one alongside it; that is the rollback.
2. On **adc-backend**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI` (**production's**, not a copy of staging's — staging had exactly that bug
   and it sends users to the wrong environment's callback), and
   `FRONTEND_URL=https://www.adoughcookie.com`.
3. **Read the boot log before testing anything.** It reports presence without printing secrets, and
   prints the redirect URI in full on purpose: Google answers a mismatch with nothing but
   `redirect_uri_mismatch` and no hint which side is wrong. This caught both staging
   misconfigurations in one line each.

### The thing that will bite

**Everyone holding a Supabase session is signed out once.** The Supabase JWT branch in `parseAuth`
is commented out on `final_deploy`, so a Supabase token becomes an unknown credential. That is
correct on staging and it is a real customer-visible event in production. Either announce it, or
restore the fallback for the first week — it was written to make the changeover invisible and only
removed so the staging tests could not pass through it.

### What was verified on staging, and how

- Google sign-in end to end: `[GOOGLE] signed in | user=3`, four times, with a matching session row
  half a second later.
- Every failure path fails closed: bogus session token → 401; bogus handoff code → 401; **forged
  `state` → redirect home with `adc_auth_error=expired_or_replayed`, authenticating nobody.**
- The outbound Google URL carries `state` (43 chars), `code_challenge` (43 chars, S256),
  `response_type=code`, and the correct `redirect_uri`.

### Still unverified anywhere

- **A brand-new phone number signing up.** Only an existing account was tested.
- **Cart survival across sign-in.** `authId` is returned by `/auth/me` as the original Supabase uuid
  precisely so `CartContext` does not read a change and empty every basket — but that has not been
  watched happening.
- Four staging Google sign-ins produced one session. Either three logouts, or three handoff
  exchanges that silently failed. Unresolved.

---

## Cleanup, last

Once production has run on our own sessions long enough to trust:

- Delete the commented Supabase blocks: the OTP half in `auth.routes.ts`, the `parseAuth` JWT
  branch, both `absorbAccount` auth-record deletions, both `user_metadata` mirrors, and the
  frontend fallbacks in `lib/api.ts` and `AuthContext`.
- Then `verifySupabaseToken`, `findAuthUserIdByEmail`, `syncUser`'s `authId` plumbing, the synthetic
  `phone_<number>@phone.adccookies.app` address, `lib/supabase.ts` and `@supabase/supabase-js` on
  the frontend all become dead and can go.
- **`src/config/supabase.ts` STAYS**, along with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
  Supabase **Storage** uses the same `adminClient()` for the `adc-media` bucket. This retires
  Supabase Auth, not Supabase — which is also why the Supabase projects must not be deleted.

## Open, unrelated to the cutover

- **Staging and production share a database password and a Google client secret.** A staging leak
  reaches production. Rotate once this settles; not mid-cutover, since the running services read
  them.
- **Vercel still builds `main` to its production target** while `adoughcookie.com` points at
  Railway. Two production frontends, one of them unwatched.
- The commented Resend transport and `RESEND_API_KEY` were due for deletion after 2026-09-09.

## One habit worth keeping

Every misconfiguration in this migration was found by a **boot line that printed a value rather
than a status**, or by a **query that measured rather than asked**. `DB=supabase-pooler` was a
hardcoded string and cost a wrong conclusion. `GOOGLE_REDIRECT_URI` printed in full caught a
cross-environment mistake instantly. `tup_returned` settled which database was serving traffic when
nothing else could. Prefer values over `set`/`MISSING` wherever a value is not a secret.
