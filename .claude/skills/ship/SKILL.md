---
name: ship
description: Pre-deploy checklist for ADC — typecheck + build the frontend, sanity-check the backend, show the diff, then (only with confirmation) push to main so Vercel + Railway auto-deploy. Use when the user wants to ship/deploy current changes.
---

# /ship — ADC deploy checklist

**Deployment model:** pushing to `main` auto-deploys both services —
**Vercel** builds `adc-cookies-frontend`, **Railway** builds `adc-cookies-backend-node`.
There is no manual `vercel deploy` step (the Vercel CLI isn't installed; deploy = git push to `main`).

Run the steps in order. If a step fails, stop and fix it before continuing — never push a broken build.

## 1. Show what's shipping
- `git status` and `git --no-pager diff --stat` so the user sees exactly what will deploy.
- Decide which services changed (frontend / backend / both) — only run the relevant checks below.

## 2. Frontend typecheck — if `adc-cookies-frontend` changed
- From `adc-cookies-frontend`: `npx tsc --noEmit`. Fix every error.

## 3. Frontend build — if `adc-cookies-frontend` changed
- From `adc-cookies-frontend`: `npm run build` (`next build`). This catches what Vercel would fail on. Fix any failure.

## 4. Backend sanity — if `adc-cookies-backend-node` changed
- Plain Node/Express, no build step. Confirm the entrypoint parses: `node --check src/server.js` from `adc-cookies-backend-node`.
- If `.env` keys were added, remind the user to set them on Railway (env lives there, not in the repo).

## 5. Confirm BEFORE deploying
- Summarize each step and its result.
- **Ask the user to confirm before pushing** — they control deploy timing ("wait before deploying").
- On approval: commit (no `Co-Authored-By` / "Generated with" trailer — team convention), then `git push origin main`.

## 6. After the push
- Note that Vercel (frontend) and Railway (backend) auto-build from `main`.
- Offer to check the Vercel deployment status and/or tail Railway logs to confirm the deploy went green.
