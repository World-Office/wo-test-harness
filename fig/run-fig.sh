#!/bin/bash
# fig/run-fig.sh — full strangler-fig status run. Server chain: the census
# boots the docserver (child survives the script), golden reuses it, fig-check
# kills any stale listener, reboots and probes. Final artifact:
# fig/census/fig-{census,golden,status}.json + plan/FIG_STATUS.md
set -e
FIG="$(cd "$(dirname "$0")" && pwd)"
node "$FIG/fig-census.cjs"
"${PYTHON:-/usr/bin/python3}" "$FIG/fig-golden.py"
node "$FIG/fig-check.cjs" "$@"
