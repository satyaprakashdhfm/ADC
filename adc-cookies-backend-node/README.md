# ADC Cookies — API

TypeScript on Express, Postgres via Supabase. Compiled to `dist/` before it runs.

```bash
npm install
npm run dev          # tsc --watch alongside node --watch dist/server.js
npm run build        # tsc -> dist/
npm start            # node dist/server.js
npm run typecheck
npm test
```

Copy `.env.example` to `.env` first. `src/config/env.ts` refuses to start when an outbound host is
ambiguous, on purpose — a wrong host is silent in both directions, and staging booking real courier
parcels is not a thing you want to find out about from a customer.

## Deploying

**There is no `railway.toml` here any more, and that is deliberate.**

Railway deprecated Config as Code: new services cannot use it, and existing ones stop reading it on
2026-12-01. The build command, start command, healthcheck and restart policy now live **on the
service** in Railway, for both `adc-backend` (production, `main`) and `adc-backend Copy` (staging,
`final_deploy`).

What is set, and why, is written down in [`../DEPLOYMENT.md`](../DEPLOYMENT.md). Read that before
changing anything about how this deploys — particularly the note that both backend services need the
same settings, since nothing enforces that now that the shared file is gone.

Two things learned the hard way, both worth knowing before you touch a deploy setting:

- **Nixpacks bakes the start command into the image.** Changing it on the service does nothing to an
  existing image, and Railway's "redeploy" reuses that image — so the old command keeps running and
  the failure looks like the setting was ignored. A real rebuild (a commit touching this folder) is
  what applies it.
- **The healthcheck is what makes a deploy zero-downtime.** With one, a broken release never takes
  traffic and the previous container keeps serving. Without one, Railway routes to a process that may
  not have finished booting. It has already saved production once.
