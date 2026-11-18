#!/usr/bin/env bash
# run-react-rig.sh — boot the REACT word editor on a REAL wo-docserver
# (local), ready for censuses. This is rig v4: the deployed substrate since
# 2026-11-16 (python-lineage wysiwyg retired).
#
# Serves documenteditor-react/dist at /word/ with the REAL /demo/info,
# /demo/document and /api/conversion endpoints — no stubs (unlike
# run-react-census.py, which stubs conversion for Windows use).
#
# Usage: bash run-react-rig.sh [port]     # default 8931
#   then: CENSUS_REACT_URL=http://127.0.0.1:<port>/word/ node census-react-deep.cjs
set -euo pipefail
PORT="${1:-8931}"
# SERVER_DIR: override for CI (harness checked out as a sibling of the server
# repo, not inside World-Office/ like the dev box)
REPO="${SERVER_DIR:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/../server}"
REPO="$(readlink -f "$REPO")"
APP="$REPO/apps/web/apps/documenteditor-react"
BIN="$REPO/target/debug/wo-docserver"
[ -x "$BIN" ] || BIN="$REPO/target/release/wo-docserver"
STAGE="/tmp/editor-ui-react-rig"

[ -d "$APP/dist" ] || { echo "dist missing — cd $APP && pnpm build" >&2; exit 1; }
[ -x "$BIN" ] || { echo "wo-docserver binary missing (cargo build -p wo-docserver)" >&2; exit 1; }

rm -rf "$STAGE" && mkdir -p "$STAGE/word" && cp -r "$APP/dist/." "$STAGE/word/"

EDITOR_UI_DIR="$STAGE" \
DEMO_DOC_PATH="$(dirname "$0")/rig/demo.docx" \
JWT_SECRET=rig-secret \
DOCSERVER_HOST=127.0.0.1 DOCSERVER_PORT="$PORT" \
"$BIN"
