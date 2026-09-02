# Deployment

Where each part of ADC runs, and what is configured where. This file is **documentation, not
configuration** — nothing reads it. It exists because the settings below live in Railway's dashboard
rather than in this repository, and a setting nobody can find from the code is a setting that gets
changed by accident.

Keep it in step with Railway when you change a service.

## Services

| | Runs on | Branch | Root directory |
|---|---|---|---|
| **Storefront** (`adc-frontend`) | Railway | `main` | `/adc-cookies-frontend` |
| **API** (`adc-backend`) | Railway | `main` | `/adc-cookies-backend-node` |
| **API — staging** (`adc-backend Copy`) | Railway | `final_deploy` | `/adc-cookies-backend-node` |
| **Storefront — staging** | Vercel | `final_deploy` | — |

Database, auth and file storage are Supabase; production and staging are separate projects.

## Service settings

These are set **on the service** in Railway (Settings → Build / Deploy), not in this repo.

Both services previously used a `railway.toml` — Railway's "Config as Code". That format is
deprecated: new services cannot use it at all, and existing ones stop being read on **2026-12-01**.
Rather than migrate to Infrastructure as Code (`.railway/railway.ts`), which is one file per project
where *omitting a resource deletes it*, the settings were moved onto the services. Three services and
five settings do not justify that risk. Revisit IaC at roughly ten services or multiple environments.

### adc-backend AND adc-backend Copy

Both backend services, identically. They deploy the same code from different branches, so a setting
that belongs on one belongs on the other.

```
buildCommand        npm run build          # compiles TypeScript to dist/
startCommand        node dist/server.js
healthcheckPath     /                      # returns {"status":"ok"}
healthcheckTimeout  30
restartPolicyType   ON_FAILURE
watchPatterns       adc-cookies-backend-node/**
```

> **Set these on BOTH, always.** Removing `railway.toml` broke staging exactly here: the settings had
> been copied onto production only, and staging still carried a pre-TypeScript
> `startCommand = node src/server.js` in its dashboard that the file had been silently overriding.
> With the file gone the stale value took over and the container died with
> `Cannot find module '/app/src/server.js'`. Production was fine and staging was down, from one
> change, because the shared file was the only thing keeping them in step.

### adc-frontend

```
startCommand        npm run start
healthcheckPath     /
healthcheckTimeout  60                     # a cold Next start plus first render is slower than an API
restartPolicyType   ON_FAILURE
watchPatterns       adc-cookies-frontend/**
```

**The healthcheck is the setting worth protecting.** It is what makes a deploy zero-downtime: the old
container keeps serving until the new one answers. Without it, Railway can route traffic to a process
that has not finished booting, and every deploy drops requests for a second or two — silently.

`watchPatterns` stop a backend commit from rebuilding the frontend and vice versa.

## Networking

- **CDN** is enabled on both services. It is **off by default** on a new Railway service, so it has to
  be turned on deliberately — Settings → Edge.
- The storefront reaches the API over Railway's **private network**
  (`BACKEND_INTERNAL_URL=http://adc-backend.railway.internal:8080`), so the request never leaves for
  the public edge. `NEXT_PUBLIC_API_URL` remains the fallback: unset the internal one and the public
  route comes back with no code change.
- **Static outbound IPs** are enabled on `adc-backend` (three, load balanced). All three must be
  allowlisted by any partner that filters on IP — traffic is balanced across them, so allowlisting one
  would fail roughly two calls in three, intermittently.
- **Outbound IPv6 is off**, deliberately. Static outbound IPs are IPv4 only, so with IPv6 egress on, an
  IPv6-capable destination could be reached from an address that is not on a partner's allowlist —
  failing intermittently, because clients race IPv4 and IPv6. Off means there is nothing to remember.

## Caching

Both are documented where they are set, not here:

- API — `src/middlewares/cache.middleware.ts`. Everything is `no-store` unless a route opts in, because
  the admin API authenticates with `X-Admin-Token` and a shared cache has no reason to treat that as
  private.
- Storefront — `src/config/cacheHeaders.ts`. Next serves `public/` with `max-age=0`, which stops any
  CDN keeping the images.

## Things that are NOT in this repo

Set in each provider's dashboard, and worth knowing exist:

- **Supabase → Authentication → URL Configuration** — Site URL and the Redirect URLs allow list. Google
  sign-in and password reset both send the browser to a URL that must appear there, so a new frontend
  domain needs adding before either works from it.
- **Razorpay → authorised websites** — approval follows the *domain*, so moving a domain between hosts
  needs no change; adding a new domain does, and verification takes 24-48 hours.
- **Petpooja** — allowlists our outbound IPs.
- **`ALLOWED_ORIGINS`** on `adc-backend` — the CORS allow list. Entries are matched exactly, so each one
  needs its scheme (`https://`), no trailing slash.
