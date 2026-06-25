# ADC — Development Conventions

These rules apply across the whole repo (frontend + backend). Follow them by default,
unless I explicitly say otherwise for a given task.

## UI & Styling Conventions

When making UI/styling changes, make ONE small change at a time and ask for confirmation
before proceeding to the next. Do not introduce new colors, backgrounds, or transitions
without explicit approval.

## Testing & Verification

Always run a typecheck after editing TypeScript files and report the result before
considering the task complete. The frontend lives in `adc-cookies-frontend`; typecheck
with `npx tsc --noEmit` from that directory. (A Stop hook runs this automatically whenever
frontend `.ts`/`.tsx` files have changed — see `.claude/hooks/frontend-typecheck.sh`.)

## Environment & Secrets

Restrict access to and never overwrite `.env` files; preserve them across sessions and
note any required environment variables separately. `.env*` files are git-ignored — never
commit them or print their contents.

## Code Style

When writing regex in code, avoid embedding literal control characters; use escaped
sequences (e.g. `\n`, `\t`, `\x1b`) and verify the file parses cleanly before moving on.
