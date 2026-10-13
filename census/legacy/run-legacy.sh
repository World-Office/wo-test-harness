#!/bin/bash
# legacy/run-legacy.sh — the whole legacy-codebase parity pipeline (slices A-E).
# Usage: run-legacy.sh [WO_ROOT]   (WO_ROOT = World-Office workspace, default ../..)
set -e
L="$(cd "$(dirname "$0")" && pwd)"
WO="${1:-$L/../../..}"
C="$L/census"; OD="$WO/server/opencloud-docserver"; CU="$WO/server/apps/web/apps/documenteditor-wysiwyg"
PY="${PYTHON:-/usr/bin/python3}"

node "$L/extract-ui.cjs" --root "$OD/web" --out "$C/legacy-ui.json" --name legacy
node "$L/extract-ui.cjs" --root "$CU" --out "$C/current-ui.json" --name current
"$PY" "$L/extract-api.py" --legacy "$OD/src" --rust "$WO/server" --out "$C/legacy-api.json"
node "$L/extract-fns.cjs" --file "$OD/web/editor.js" --out "$C/legacy-fns.json" --name legacy
node "$L/extract-fns.cjs" --file "$CU/editor.js" --out "$C/current-fns.json" --name current
"$PY" "$L/diff-legacy.py" --legacy-e2e "$OD/e2e" "$OD/tests" --report "$WO/plan/LEGACY_PARITY.md"
