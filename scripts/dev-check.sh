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

echo "[3/3] register drift (seed.py --check)"
: "${WO_SERVER_DIR:=../server}"
WO_SERVER_DIR="$WO_SERVER_DIR" $PY harness-graph/seed.py --check >/dev/null

echo "dev-check: OK"
