#!/bin/bash
# fig/run-fig.sh — full strangler-fig status run:
#   1. per-type react census (presence + drift guard) -> fig/census/fig-census.json
#   2. capability probes + oracle join -> fig/census/fig-status.json + plan/FIG_STATUS.md
set -e
FIG="$(cd "$(dirname "$0")" && pwd)"
node "$FIG/fig-census.cjs"
node "$FIG/fig-check.cjs" "$@"
