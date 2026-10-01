#!/usr/bin/env bash
# Build wo-eval-formula against a local server checkout, evaluate cases.json, score.
#   WO_SERVER_DIR=~/git/World-Office/server sheet-oracle/run-engine.sh [--update-baseline]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/.."
: "${WO_SERVER_DIR:?set WO_SERVER_DIR}"
export PATH="$HOME/.cargo/bin:$PATH"
cd "$ROOT"
/usr/bin/python3 "$HERE/oracle.py" cases
cargo build -q -p wo-eval-formula --config \
  "patch.\"https://github.com/World-Office/server.git\".wo-formula.path=\"$WO_SERVER_DIR/core/crates/wo-formula\""
OUT="${TMPDIR:-/tmp}/wo-engine.json"
"$ROOT/target/debug/wo-eval-formula" "$HERE/cases.json" "$OUT"
/usr/bin/python3 "$HERE/oracle.py" score "$OUT" "$@"
