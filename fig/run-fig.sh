#!/bin/bash
# fig/run-fig.sh — full strangler-fig status run. Server chain: the census
# boots the docserver (child survives the script), golden reuses it, fig-check
# kills any stale listener, reboots and probes. collab runs its own
# coauthoring-service instance on :8004 (kills stale listeners first).
# Final artifacts: fig/census/fig-{census,collab,golden,status}.json
#                  + plan/FIG_STATUS.md
set -e
FIG="$(cd "$(dirname "$0")" && pwd)"
node "$FIG/fig-census.cjs"
node "$FIG/fig-collab.cjs"
node "$FIG/fig-auth.cjs"
node "$FIG/fig-contracts.cjs"
node "$FIG/fig-wopi.cjs"
# editor-ui-word oracle = parity-contracts (L2 contracts); the CI fig job never
# ran them, so --check saw 'no contract-results.json'. Run the L2 runner so the
# oracle evidence exists in the same workspace the check reads.
for P in "$FIG/../../server/tests/parity" "$FIG/../../tests/parity"; do
  [ -f "$P/contract-runner.cjs" ] && PARITY="$P" && break
done
[ -n "$PARITY" ] && node "$PARITY/contract-runner.cjs" 2>&1 | tail -1
"${PYTHON:-/usr/bin/python3}" "$FIG/fig-golden.py"
node "$FIG/fig-check.cjs" "$@"
