#!/usr/bin/env bash
# wo-test-harness fast dev suite — seconds, offline, no browsers, no docker.
# Full release gate (slow): see census/reconcile.py --check ... in AGENTS.md.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=/usr/bin/python3

echo "[1/3] py_compile census + harness-graph"
$PY -m py_compile census/*.py harness-graph/*.py

echo "[2/3] offline self-tests (ledger-gap, visual-triage, reconcile)"
$PY census/ledger-gap.py --self-test >/dev/null
$PY census/visual-triage.py --self-test >/dev/null
$PY census/reconcile.py --self-test >/dev/null
$PY census/artifact-check.py --self-test >/dev/null

# deterministic ledger assertions (fails loudly on census artifacts / modal gaps)
$PY census/artifact-check.py >/dev/null && echo "  ledger asserts: pass"

# T-002 heading parity: formatting.heading-{1,2,3} rows must exist in the
# ledger at L3 (roundtrip-proven), not merely exist — presence alone would
# let a stale/dummy artifact or a level-downgraded rebuild pass silently.
# (Same contract as the campaign acceptance gate, hardened; build.py's loud
# guard covers the rebuild path — this checks the committed artifact.)
$PY - <<'EOF'
import json, sys
d = json.load(open("census/ledger/ledger.json"))
rows = {f.get("feature"): f for f in d["features"]}
for fid in ("formatting.heading-1", "formatting.heading-2", "formatting.heading-3"):
    row = rows.get(fid)
    if row is None:
        sys.exit("dev-check: heading row missing from ledger.json: " + fid)
    if row.get("level", 0) < 3:
        sys.exit(f"dev-check: {fid} at L{row.get('level')} — expected L3 (roundtrip-proven)")
EOF
echo "  heading rows: pass"

echo "[3/3] register drift (seed.py --check)"
: "${WO_SERVER_DIR:=../server}"
WO_SERVER_DIR="$WO_SERVER_DIR" $PY harness-graph/seed.py --check >/dev/null

echo "dev-check: OK"
