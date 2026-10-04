# 2. Architecture Constraints

## Technical constraints

| Constraint | Consequence |
|------------|-------------|
| Server repo is a sibling checkout, not a submodule | `WO_SERVER_DIR` env → `../server` fallback → hard exit; all scripts resolve through this contract |
| The default `python3` shim on the dev host is broken | always `/usr/bin/python3`; PyYAML unavailable there → features.yaml parsed by regex |
| Two editor stacks must both pass gates until sunset | `reconcile.py --docserver rust\|python` (rust canonical); DUAL-STACK-VERIFIED marker |
| OnlyOffice reference capture needs a real DS | rig-side docker recipe (`census/rig/`): JWT off, `allowPrivateIPAddress`, host callback ACK; committed captures refreshed deliberately |
| WASM crates can't run host `cargo test` | host gates exclude `wo-pdf-render` (pdfium lib missing), `wo-renderer-wasm`, `wo-x2t-wasm`; wasm surfaces verified via browser census instead |
| Playwright pinned (1.61.1 / chromium-1228) | deterministic captures; browser builds from system cache on Windows hosts |
| Census runtime deps are gitignored | `census/node_modules` installed ad-hoc (`npm install --no-save playwright`); committed artifacts added explicitly (`git add -f`) |
| Repo is **private** on GitHub | CI runs via `workflow_dispatch`; dispatch uses the **remote** ref — always check run `headSha` against the local commit (stale-dispatch hazard, hit once) |
| Rust nightly on the server repo | CI caches a shared Cargo registry; docserver/mcp-server builds per job |

## Organizational constraints

- **Loud-failure doctrine**: any census that silently reports zero rows is a
  bug in the census (see the file-menu trigger regression that hid the whole
  surface for months).
- **Recapture-as-PR**: committed measurement artifacts (graph.json, ledgers,
  OO reference censuses, geometry goldens) change only deliberately.
- **Census scripts never fix the MAP**: pairing/promotion goes through
  `reconcile.py`'s audited flow (capture more, never hand-edit).

## Windows-host variant

The gate runs on a Windows host inside `opencloud-docserver`'s uv venv
(`uv sync --frozen`), driven from PowerShell (MSYS2 mangles env vars for native
python); geometry goldens are per-`sys.platform` (`geom-wo.<platform>.json`).
