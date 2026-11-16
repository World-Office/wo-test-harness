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
  (cd "$CENSUS" && URL_BASE="$BASE" /usr/bin/node census-react-deep.cjs) || exit 1
fi

rc=0
for probe in "$HERE"/probe-*.cjs; do
  echo "── $(basename "$probe")"
  /usr/bin/node "$probe" || rc=1
done

echo "── coverage"
/usr/bin/python3 "$HERE/coverage-check.py" --gate || rc=1
exit $rc
