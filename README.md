# wo-test-harness

> **Status 2026-10-04 — ACTIVE, canonical-stack.** Default measurement mode is the
> **Rust docserver** (`core/crates/wo-docserver`, deployed at `editor.cloud.graphwiz.ai`);
> the Python mode is kept for parity verification until sunset (DUAL-STACK-VERIFIED).
> CI green: all 6 conformance.yml jobs (run 37188756476 @ c8c7b7f).
> The 2026-09-24 "do not retarget" decision in `DEPRECATED.md` was superseded —
> the harness now boots the Rust stack, the React editor census, and the live
> prod shell (`fx-prod.cjs`).

Cross-engine conformance harness, parity ledger, and feature-register tooling
for **World-Office**. Everything test/verification-side that lives outside the
production repo (`World-Office/server`).

| Unit | Purpose |
|------|---------|
| `conformance/` | `wo-conformance` crate — corpus of real `.docx`, entropy test-driver, scoring, cross-engine comparison (wo-docx-renderer vs LibreOffice). |
| `conformance-docx/` | `wo-conformance-docx` crate — `DocxConformanceAdapter` + `wo-render-ir` binary. Git-depends on the server repo. |
| `harness-graph/` | Feature register → test graph (`features.yaml`, `seed.py`). **111 stable `F-###` ids** (F-001..F-153) with honest parity/fidelity tags. |
| `tf-test-harness/` | Unified shell test orchestrator + generation/coverage tooling. |
| `census/` | The parity pipeline: structural census (WO vanilla + React + OO rig), interaction click-through, functional loud-stub gate (local + live prod), geometry drift, visual pixel gate vs OnlyOffice goldens, AI spec-contract-test pyramid, and the `reconcile.py` one-run orchestrator. |

## Current state (snapshot)

- **Register:** 111 features, `graph.json` in sync (1383 tests, 1632 edges); drift gate green.
- **Ledger:** 152 OO rows covered / 119 real / 83 deferred — deferred rows grouped by reason, printed loudly on every run (a green gate never hides the gap).
- **Full gate (one command, rc=0 today):**
  ```sh
  WO_SERVER_DIR=/path/to/server /usr/bin/python3 census/reconcile.py \
    --check --seed-check --interactions --fx --geometry --visual --ai
  ```
- **AI pyramid (F-148..F-153):** spec (register) → contract (`ai-contracts.py` — rust-docserver HTTP probes + `services/mcp-server` stdio JSON-RPC, pinned green, 15 tools) → test (gates + CI). 5 contracts unimplemented, loud.
- **Live-prod functional census:** 108 controls across 11 tabs, 0 silent / 0 unclickable (2026-09-26).

## Path resolution contract

`WO_SERVER_DIR` env → sibling `../server` → legacy layout → hard `SystemExit`.
Server-side e2e reads `WO_HARNESS_GRAPH` / `WO_CONFORMANCE_CORPUS` the same way.

## Quick start

```sh
# Register drift gate
WO_SERVER_DIR=/path/to/server /usr/bin/python3 harness-graph/seed.py --check

# Full CI-parity gate (ledger + interactions + fx + geometry + visual + AI pyramid)
WO_SERVER_DIR=/path/to/server /usr/bin/python3 census/reconcile.py \
  --check --seed-check --interactions --fx --geometry --visual --ai

# Unified self-test
WO_SERVER_DIR=/path/to/server bash tf-test-harness/test-harness.sh --self-test

# Cross-engine fidelity
cd conformance && ./scripts/run-pipeline.sh <corpus-cases-dir>
```

Windows host: run the gate via PowerShell inside `opencloud-docserver`'s uv venv
(`uv sync --frozen` once); browser builds come from the system Playwright cache
(chromium-1228 = pin 1.61.1). See `AGENTS.md`.

## Conformance

`conformance-docx` git-depends on the server's `wo-docx-renderer`/`wo-ooxml`
(`branch = "main"`) — regenerate `Cargo.lock` after server-side dep changes.
See `conformance/README.md` and `conformance/scripts/onlyoffice-image.env`.

## CI (`.github/workflows/conformance.yml`, private repo, 6 jobs)

`unit-tests`, `harness-graph` (cross-repo checkout + drift gate), `census-ledger`
(parity gate: reconcile `--check --seed-check --interactions --fx --geometry
--ai`, builds `wo-docserver` + `mcp-server`), `cross-engine-fidelity`,
`scope-and-sheet-oracle`, `onlyoffice-oracle` (pinned DS).

## Architecture

This repo is documented with [arc42](https://arc42.org) — one file per section
under [`docs/arc42/`](docs/arc42/README.md). The product side has its own set:
`server/docs/arc42/` (Rust cloud+AI, historical record) and
`server/opencloud-docserver/docs/arc42/` (deprecated Python rewrite).

## License

AGPL-3.0-or-later. Corpus `.docx` files are generated fixtures.
