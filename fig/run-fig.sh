#!/bin/bash
# fig/run-fig.sh — strangler-fig status run: boot wo-docserver, probe every
# DocumentServer capability, join oracles, write fig-status + plan/FIG_STATUS.md
set -e
FIG="$(cd "$(dirname "$0")" && pwd)"
node "$FIG/fig-check.cjs" "$@"
