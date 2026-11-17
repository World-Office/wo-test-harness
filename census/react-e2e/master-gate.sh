#!/usr/bin/env bash
# master-gate.sh — the port-100% definition of done (supervisor-level, host gate).
# Green only when: engine suite + react suite + E2E probes + coverage all pass.
# The rig must serve the CURRENT server HEAD (fresh build) — run build-first.
set -u
SERVER="${SERVER_DIR:-/home/weiss/git/World-Office/server}"
HARNESS="$(cd "$(dirname "$0")/../.." && pwd)"
rc=0
fail() { echo "MASTER GATE: FAIL — $1"; rc=1; }

echo "── 1. engine suite (wo-renderer-wasm)"
(cd "$SERVER" && timeout 900 cargo test -p wo-renderer-wasm >/dev/null 2>&1) \
  || fail "engine tests"

echo "── 2. react unit suite (documenteditor-react)"
(cd "$SERVER/apps/web/apps/documenteditor-react" && timeout 300 npx vitest run >/dev/null 2>&1) \
  || fail "react tests"

echo "── 3. E2E probes + coverage gate (fresh build on the rig)"
bash "$HARNESS/census/react-e2e/run-react-e2e.sh" || fail "e2e/coverage"

[ $rc -eq 0 ] && echo "MASTER GATE: PASS — port 100% verified E2E"
exit $rc
