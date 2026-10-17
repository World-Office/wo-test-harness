#!/bin/bash
# fig/run-fig.sh — full strangler-fig status run. Server chain: the census
# boots the docserver (child survives the script), golden reuses it, fig-check
# kills any stale listener, reboots and probes. collab runs its own
# coauthoring-service instance on :8004 (kills stale listeners first).
# Final artifacts: fig/census/fig-{census,collab,golden,status}.json
#                  + plan/FIG_STATUS.md
set -e
FIG="$(cd "$(dirname "$0")" && pwd)"
node "$FIG/fig-ui.cjs"
node "$FIG/fig-census.cjs"
node "$FIG/fig-collab.cjs"
node "$FIG/fig-auth.cjs"
node "$FIG/fig-contracts.cjs"
node "$FIG/fig-wopi.cjs"
"${PYTHON:-/usr/bin/python3}" "$FIG/fig-golden.py"
node "$FIG/fig-check.cjs" "$@"
