# Supabase → Railway Postgres migration

Written 2026-09-07. Facts below were measured against the live production project
(`urngshhdmzbsfuvvtlmj`), not estimated.

## Why now

| | |
|---|---|
| Database size | **14 MB** (public 3.3 MB, auth 2.7 MB, storage 408 kB) |
| Orders | 19 |
| App users | 202 |
| Supabase auth accounts | 78 |
| Email + password accounts | **0** |
| Phone-OTP accounts (we mint these) | **64** |
| Google OAuth accounts | **14** |
| Supabase Storage | **empty — 0 objects, 0 bytes.** 0 of 39 products reference `supabase://` |

At this size it is a week of work. At 10,000 users it is a project with a customer-impact
window. The instinct to do it while the app is small is correct.

Two facts make it far cheaper than it looks:

- **There are no password accounts.** Nothing to export, no hashes to preserve.
- **The 64 phone accounts carry nothing.** We create them ourselves on every login with a
  random throwaway password (`crypto.randomBytes(24)`) under a synthetic address we invented
  (`phone_91XXXXXXXXXX@phone.adccookies.app`). The real identity is the phone number and it
  lives in our own `users.phone`. A replacement only has to accept the same number by OTP.

Only the **14 Google accounts** hold anything that must survive, and they re-link by email.

## The latency prize

```
backend   Railway sin1        (Singapore)
database  aws-1-ap-south-1    (Mumbai)
```

Every query crosses a region — roughly 40–60 ms round trip. Co-locating makes it
sub-millisecond. This compounds badly with N+1 patterns: `GET /api/admin/users` fires 319
queries through a pool capped at 10.

---

## Stage 0 — Prerequisites

Independent of the migration; do regardless.

1. **Confirm the Supabase plan.** Free has **no automated backups**, and there is real payment
   data. This is more urgent than the migration itself.
2. **Take a manual `pg_dump` of `public` now** and store it off-platform.
3. **Provision Railway Postgres** with a volume, backups enabled, private networking. Reference
   `DATABASE_URL` from the Postgres service so it resolves to `*.railway.internal` — queries
   then never leave the internal network.

## Stage 1 — Decouple from Supabase's schema

**Blocker being removed:** six raw SQL reads against `auth.users`, Supabase's own managed
schema. They work only because our tables and `auth` live in the same database. While they
exist, the database and Auth cannot move separately.

```
src/middlewares/auth.middleware.ts:52
src/routes/admin/users.routes.ts:90
src/routes/auth.routes.ts:62, 218, 329, 350
```

Every one hunts a Supabase user id in order to mirror `name`/`phone` into `user_metadata`.
**That id is already in the token as `claims.sub`.** The mirroring is cosmetic — the code says
repeatedly that our own `users` table is authoritative.

Use `claims.sub`; delete the SQL. This *removes* code, kills the cross-schema dependency, and
is worth doing on its own merits. Ships independently. No cutover, no risk.

## Stage 2 — Move Postgres

Auth keeps working untouched: `verifySupabaseToken` validates HS256 locally against
`JWT_SECRET` (with an RS256/JWKS path as fallback), and the admin calls are HTTPS. Neither
needs our database.

### Four things that break a naive `pg_dump | psql`

| Finding | Consequence |
|---|---|
| **34 tables with RLS enabled, 0 policies** | The dump carries `ENABLE ROW LEVEL SECURITY`. Harmless today (we connect as owner) but restore it knowingly, not by accident |
| Grants to `anon` / `authenticated` / `service_role` | Those roles do not exist on Railway → restore errors. Use `--no-owner --no-acl` |
| **26 sequences** | A sequence restored at the wrong value means the *next* order insert collides on its primary key. Verify every `setval` after restore. **This is the classic migration outage** |
| Extensions: `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault` | Create the first three on Railway. **Exclude `supabase_vault`** — Supabase-only, will fail |

Dump `public` **only**. Do not carry `auth` or `storage`.

### Cutover

1. Dump → restore into Railway Postgres
2. Verify: row counts per table, and every sequence's `last_value` against `max(id)`
3. Swap `DATABASE_URL` to the internal host
4. Redeploy, watch the boot log and the first `[POLL]` / `[PAYRECON]` sweeps
5. Also drop the session pooler while here — the `max: 10` cap in `db/index.ts` exists purely
   because of it

Pick a quiet hour. Writes during the window are lost; at this volume a short maintenance
window beats engineering zero downtime.

### Rollback

Point `DATABASE_URL` back at Supabase. **Keep the Supabase project alive and untouched for a
couple of weeks** — it costs nothing and it is the parachute.

## Stage 3 — Replace Supabase Auth

The real work. **13 call sites across 5 frontend files:**

```
context/AuthContext.tsx      getSession, onAuthStateChange, signInWithPassword, signUp,
                             signInWithOAuth, resetPasswordForEmail, setSession, signOut
lib/api.ts:20                getSession — supplies the Authorization header
app/reset-password/page.tsx  getSession, onAuthStateChange, updateUser
components/storefront/Chatbot.tsx:145  getSession
```

What has to be owned:

- **Client session storage + refresh** — the biggest piece. `getSession()` and
  `onAuthStateChange` currently give localStorage persistence and silent refresh for free.
- **Google OAuth** — authorize redirect → callback → code exchange → mint our own JWT. OAuth
  state and PKCE must be correct.
- **JWT issuance** — we already *verify* HS256 with `JWT_SECRET`; issuing is the easy half.
- **Phone OTP** — nearly free. Already ours end to end via Message Central; only the final
  "mint a session" is Supabase. The synthetic-email hack can be deleted entirely.
- **Email/password + reset** — **0 accounts use it. Drop it, do not rebuild it.** That deletes
  `signUp`, `signInWithPassword`, `resetPasswordForEmail`, `updateUser` and the whole
  `/reset-password` page.

### Account migration

- 64 phone accounts: **nothing to do**. Identity is the phone number, already in `users.phone`.
- 14 Google accounts: re-link by email on first sign-in — Google returns the same address and
  `syncUser` keys on it. **Verify all 14 have a non-null `users.email` before starting.** Any
  that do not would lose their order history.

### The cost to accept

After this you own authentication security: session invalidation, token refresh, OAuth state,
brute-force protection. Supabase does that for free, and it is the area where bugs are least
forgivable — see the account-merge hole found and fixed on 2026-09-03
(`PATCH /auth/me` merged accounts on an unverified phone claim).

---

## Recommended sequencing

**Stages 0–2 now; Stage 3 as a separate, later decision.** 0–2 deliver the backups, the
volume, a real database and the ~50× latency improvement with almost no risk, each revertible
in one variable. Stage 3 is where the security ownership transfers and deserves its own week.

**Never ship the database move and the auth replacement in one cutover** — a failure then
gives you two suspects instead of one.
