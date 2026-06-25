#!/usr/bin/env bash
# Stop hook — typecheck the Next.js frontend before Claude finishes a turn.
#
# Runs `tsc --noEmit` ONLY when frontend .ts/.tsx files have uncommitted changes, so
# turns that didn't touch TypeScript stay instant. On type errors it blocks the stop
# and feeds the errors back to Claude so they get fixed before the task is "done".
set -uo pipefail

# Read the hook payload from stdin. If we're already inside a stop-hook continuation
# (Claude was re-invoked because we blocked once), don't block again — avoids loops.
input="$(cat 2>/dev/null || true)"
if printf '%s' "$input" | jq -e '.stop_hook_active == true' >/dev/null 2>&1; then
  exit 0
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
FRONTEND="$ROOT/adc-cookies-frontend"
[ -d "$FRONTEND" ] || exit 0

# Any uncommitted frontend TS/TSX changes? (staged, unstaged, or untracked)
changed="$(git -C "$ROOT" status --porcelain 2>/dev/null | cut -c4- \
  | grep -E '^adc-cookies-frontend/.*\.tsx?$' || true)"
[ -z "$changed" ] && exit 0

cd "$FRONTEND" || exit 0
TSC="./node_modules/.bin/tsc"
if [ -x "$TSC" ]; then
  out="$("$TSC" --noEmit 2>&1)"; status=$?
else
  out="$(npx --no-install tsc --noEmit 2>&1)"; status=$?
fi
[ "$status" -eq 0 ] && exit 0

reason="$(printf 'TypeScript typecheck failed in adc-cookies-frontend (tsc --noEmit). Fix these before finishing:\n\n%s' "$out")"
jq -cn --arg r "$reason" '{decision:"block", reason:$r}'
exit 0
