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

**Corrected 2026-09-08, on doing the work.** The paragraph here used to claim all six were
cosmetic `user_metadata` mirrors that `claims.sub` would replace. That was wrong, and only one
of the six actually fits it. What they really are:

| Sites | What it does | Why `claims.sub` does not solve it |
|---|---|---|
| `auth.routes.ts:218` | mirrors the caller's own name/phone | — it does, this is the one |
| `admin/users.routes.ts:90` | mirrors a customer an **admin** edited | `claims.sub` is the admin's id, not the customer's |
| `auth.middleware.ts:52`, `auth.routes.ts:62` | deletes the **absorbed** account's auth record | the absorbed account is not the caller |
| `auth.routes.ts:329`, `:350` | phone-OTP find-or-create, and the name | runs *before* any token exists |

The fix that covers all six is to **store the association instead of re-deriving it**: a new
`users.supabase_user_id`, backfilled while `auth` and `public` still share a database, and kept
current by `syncUser` from the verified `claims.sub` on every authenticated request.

It is better than what it replaces, not merely equivalent. Matching on an email string re-guessed
the association on every request and got it wrong exactly where it mattered — a phone-OTP user has
no email, so the lookup had to *reconstruct* a synthetic address to find them, and the admin-edit
mirror was gated on `row.email` and so silently never ran for phone-only customers, who are most
of them.

**One trap, found only by querying production first.** A local row can map to *two* auth accounts:
14 accounts match by real email, 66 by synthetic address, and **3 customers have both**. For those
three the column holds whichever they signed in with first. Had the OTP route trusted it, it would
have reset the password on their Google account and then tried to sign in as the synthetic address
— login broken outright. So the OTP route resolves by the synthetic address through GoTrue's admin
API (`?filter=`, verified against the live API, not assumed), and the column is used only where the
account is unambiguous.

Still ships independently. No cutover, and it is revertible by ignoring one column.

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

---

# Backups and disaster recovery

Added 2026-09-08. Railway's native capability taken from their docs, not assumed.

## The rule the industry actually follows: 3-2-1

- **3** copies of the data
- **2** different storage types
- **1** off-site, on infrastructure that can fail independently

The modern extension is **3-2-1-1-0**: one copy **immutable**, and **0** unverified restores.
That last digit is the one people skip and the one that bites — an untested backup is a hope,
not a backup.

Two numbers frame every decision:

| | Question | Ours |
|---|---|---|
| **RPO** | How much data can we afford to lose? | A day of orders is survivable now; it stops being survivable as volume grows |
| **RTO** | How fast must we be serving again? | 14 MB restores in minutes. The constraint is decision time, not transfer time |

## What Railway gives natively — more than expected

- **Point-in-time recovery.** The Postgres image archives every WAL segment with **pgBackRest**,
  taking weekly full and daily incremental base backups. The last 4 fulls are retained, so the
  restore window is **roughly 4 weeks**, to any timestamp inside it — not just to snapshot
  boundaries.
- **Volume snapshots**, incremental and copy-on-write, billed only for data unique to each.
- No separate PITR fee: it bills through bucket storage and egress.

This is competitive with Supabase Pro and far better than Supabase Free, which has **no
automated backups at all**. Turning PITR on is the highest-value action in this document.

## The gap it does not close

**All of it lives inside Railway.** The WAL archive goes to *a private Railway storage bucket*.
That covers everything except the scenario actually worth planning for:

- the account is suspended (a failed card, a billing dispute, a false abuse positive)
- credentials are compromised and someone deletes the project
- Railway has a catastrophic failure, or stops trading

A backup stored inside the system it is backing up is not the off-site copy. It is the second
copy at best.

## The off-site layer to build

**One encrypted dump a day, pushed somewhere that is not Railway.**

- **Produce**: `pg_dump -Fc` (custom format, compressed). At 14 MB this takes seconds.
- **Encrypt before it leaves**: the dump holds customer names, phone numbers, delivery addresses
  and order history. That is personal data under the DPDP Act. Use `age` or `gpg`, encrypting at
  the source, never writing plaintext to disk.
- **Ship to a different provider.** Cloudflare **R2** is the natural fit: DNS is already there,
  and R2 charges **no egress** — which matters precisely on the day of a restore. Backblaze B2
  and AWS S3 are equivalent. The only hard requirement is that it is not Railway.
- **Separate credentials.** The bucket key must not be one the app already holds, or a single
  compromise takes the database and its backups together. Write-only where the provider allows.
- **Object lock / versioning**, so a deletion cannot propagate into the backups.

**Retention — REVISED 2026-09-08, on building it.** This said grandfather-father-son: 7 daily, 4
weekly, 12 monthly. That is the right shape for a database where storage costs something, and it
was over-engineering here — three lifecycle rules and three code paths bought for nothing. The
dump is ~150 KB, so **30 days of history is 4.5 MB** against R2's 10 GB free tier. There is no
saving available to pay for the moving parts.

**What shipped: one prefix, one rule, delete after 30 days.**

Two things that changed my mind beyond simplicity:

- Dropping the 400-day tier is a **privacy gain, not a loss**. The dumps carry customer names,
  phone numbers and delivery addresses; holding personal data longer than it is useful is a DPDP
  negative rather than prudence.
- 30 days rather than the 2 that first felt sufficient, because the failure retention actually
  saves you from is **slow corruption** — a bug writing bad rows for a fortnight before anyone
  notices. A two-day window means every copy you hold already contains the damage, and PITR
  already covers the crash-you-notice-immediately case.

**Cloudflare has two separate features that are easy to confuse, and they do opposite things.**
*Object Lifecycle* rules DELETE after N days (this is retention). *Bucket Lock* rules PREVENT
deletion and overwrite for N days (this is immutability — the "1" in 3-2-1-1-0, and the best
defence against a leaked token being used to wipe the backups rather than read them). If both are
ever set, the lifecycle delete must be LONGER than the lock or it fails silently against locked
objects.

**Where the job runs.** A Railway cron in the same project keeps the database on the private
network and is simplest. A GitHub Actions schedule has the virtue of living outside the thing it
backs up, but needs the database publicly reachable through a TCP proxy — a real security cost
for a modest independence gain. Start with the Railway cron; what matters is that the *storage*
is elsewhere.

## Two failure modes that ruin real recoveries

**1. The key dies with the platform.** Encrypted backups in R2, decryption key only in Railway's
environment variables. Railway is gone, so the key is gone, so the backups are noise. **The
decryption key belongs in a password manager plus one offline copy** — never solely inside the
platform being backed up.

**2. Silent failure.** The job stops working in March and nobody notices until August. The check
must **alert on absence**, not only on error: a dead cron writes no error. Confirm the object
landed and that its size is sane, and shout when it did not.

## Verification — the "0" in 3-2-1-1-0

**Monthly**: restore the newest dump into a scratch database and assert row counts per table
against production, plus every sequence's `last_value`. Automate it. A restore that has never
been run is an assumption, and sequences are exactly where a restore quietly goes wrong.

Recognised enough that tooling exists for it specifically — e.g.
`Kjudeh/railway-postgres-backups`, whose whole pitch is "backups you've actually restored, with
daily restore verification".

## Runbook: Railway is gone

What this buys is a bounded, rehearsed recovery. Three things are needed, held by three
deliberately separate custodians: the **dump** (R2), the **key** (password manager), the **code**
(GitHub).

1. Provision Postgres anywhere — Neon, RDS, another Railway account, a VPS.
2. Pull the newest dump from R2; decrypt with the offline key.
3. `pg_restore --no-owner --no-acl`; verify row counts and sequences.
4. Deploy the backend from GitHub; point `DATABASE_URL` at the new host.
5. Re-point DNS.

Rehearse it once, on a quiet afternoon, before needing it.

## Right-sizing — what NOT to build

At 14 MB and 19 orders, streaming replicas, multi-region failover and an hourly RPO are
over-engineering that will not be maintained. **Daily encrypted dump to R2, PITR on, monthly
verified restore, alert on absence.** Revisit when order volume makes a day's loss unacceptable.

## Order of work

1. **Turn PITR on**, the moment Postgres exists on Railway — biggest win for the least effort.
2. **Daily encrypted dump to R2**, separate credentials, key in a password manager.
3. **Alerting on absence.**
4. **Monthly automated restore test.**
5. **Rehearse the runbook once.**

Steps 1 and 2 are the difference between "we have backups" and "we have backups that survive
losing the vendor". Do not migrate production onto Railway until at least those two are in place.
