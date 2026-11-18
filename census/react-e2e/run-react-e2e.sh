#!/usr/bin/env bash
# run-react-e2e.sh — react editor E2E suite (probes + coverage gate).
# Boot order: assumes the react rig (run-react-rig.sh) unless --no-rig;
# with --capture it re-captures the deep census first (after a rebuild).
# Exit 0 only when every probe passes AND coverage gate passes.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
CENSUS="$HERE/.."
PORT="${E2E_PORT:-8932}"
BASE="http://127.0.0.1:$PORT/word/"
export E2E_BASE_URL="$BASE"

if [ "${1:-}" != "--no-rig" ]; then
  if ! curl -s -o /dev/null -w '%{http_code}' "$BASE" | grep -q 200; then
    echo "[e2e] rig down — booting on :$PORT"
    (cd "$CENSUS" && setsid nohup bash run-react-rig.sh "$PORT" > /tmp/react-rig.log 2>&1 < /dev/null &)
    for i in $(seq 1 30); do
      sleep 2
      curl -s -o /dev/null "$BASE" && break
    done
    sleep 5
  fi
fi

if [ "${1:-}" = "--capture" ] || [ "${2:-}" = "--capture" ]; then
  echo "[e2e] capturing fresh deep census → census/census-react-deep.json"
  (cd "$CENSUS" && CENSUS_REACT_URL="$BASE" node census-react-deep.cjs) || exit 1
fi

rc=0
results=""
sep=""
emit() { # emit <id> <ok>
  results+="${sep}{\"id\":\"$1\",\"name\":\"$1\",\"ok\":$2}"
  sep=","
}
for probe in "$HERE"/probe-*.cjs; do
  id="$(basename "$probe" .cjs)"
  echo "── $id"
  if node "$probe"; then emit "$id" true; else emit "$id" false; rc=1; fi
done

echo "── coverage"
if /usr/bin/python3 "$HERE/coverage-check.py" --gate; then emit coverage-gate true; else emit coverage-gate false; rc=1; fi

# fig oracle artifact (fig/fig-check.cjs parity-contracts reads results[].ok).
# CONSUMER: server CI copies this to tests/parity/contract-results.json.
printf '{"generated":"%s","results":[%s]}\n' "$(date -u +%FT%TZ)" "$results" > "${CONTRACT_RESULTS_OUT:-$HERE/contract-results.json}"
exit $rc
