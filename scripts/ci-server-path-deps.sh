#!/usr/bin/env bash
# Rewrite the harness's git deps on the server repo (github org) to path deps
# against a local checkout. cargo clones a git dependency's SUBMODULES too,
# and the public server repo carries a private submodule (scripts/taskfleet)
# that CI runners cannot fetch — so the cargo jobs clone the public server
# repo (no submodules) and build against it instead of cargo's own git fetch.
#
# The checkout must live OUTSIDE the harness workspace tree: cargo ignores a
# nested [workspace] and inherits `workspace = true` deps from the harness
# root manifest, which breaks wo-docx-renderer (pdf-writer etc.). CI clones
# to $RUNNER_TEMP/server; local runs may pass any path.
#
# Usage: scripts/ci-server-path-deps.sh [server-dir]   (default: server)
set -euo pipefail
cd "$(dirname "$0")/.."
SERVER="${1:-server}"
# realpath: write absolute paths into the manifest so workspace-root discovery
# never depends on symlinks or lexical `..` resolution.
SRV="$(cd "$SERVER" && pwd -P)"
ROOT="$(pwd)"

# manifest -> space-separated (package, crate-subdir)
rewrite() {
  local manifest="$1" pkgs="$2"
  for pkg in $pkgs; do
    local src="$SRV/core/crates/$pkg"
    [ -f "$src/Cargo.toml" ] || { echo "ci-server-path-deps: missing $src" >&2; exit 1; }
    # Rewrite either the git form or a previous path form (re-runs).
    sed -i "s#^\($pkg = {\) git = \"https://github.com/World-Office/server.git\", branch = \"main\", package = \"$pkg\" }#\1 path = \"$src\" }#" "$manifest"
    sed -i "s#^\($pkg = {\) path = \"[^\"]*\" }#\1 path = \"$src\" }#" "$manifest"
  done
}

rewrite conformance-docx/Cargo.toml "wo-docx-renderer wo-ooxml wo-odf"
rewrite sheet-oracle/engine/Cargo.toml "wo-formula"

# Guard: fail loudly if any git dep survives, or if a path dep is inside the
# workspace tree (that layout breaks cargo workspace-inheritance and MUST NOT
# be silently shipped).
if grep -q 'git = "https://github.com/World-Office/server.git"' conformance-docx/Cargo.toml sheet-oracle/engine/Cargo.toml; then
  echo "ci-server-path-deps: server git deps not fully rewritten" >&2
  exit 1
fi
if grep -F "path = \"$ROOT/" conformance-docx/Cargo.toml sheet-oracle/engine/Cargo.toml; then
  echo "ci-server-path-deps: deps point INSIDE the harness workspace tree (breaks cargo inheritance)" >&2
  exit 1
fi
echo "ci-server-path-deps: git deps -> path deps on $SRV"
