# 7. Deployment View

## Environments

| Environment | Where | Runs |
|-------------|-------|------|
| **Dev host** (primary) | this Linux workstation | full gate via `/usr/bin/python3`; census `node_modules` ad-hoc; rust nightly toolchain; builds wo-docserver / mcp-server / storage-service from the sibling server checkout |
| **CI** | GitHub Actions (private repo) | conformance.yml × 6 jobs, dispatch-triggered, cross-repo server checkout, shared Cargo cache |
| **OO rig** | local docker (`census/rig/` recipe) | pinned OnlyOffice DS, JWT off, `allowPrivateIPAddress`, host `rig-server.py` (:8735) serving rig-editor.html + demo.docx + save-callback ACK |
| **Production** | `cloud.graphwiz.ai` + `editor.cloud.graphwiz.ai` (VPS, traefik) | fx-prod census + nonword probes target this; Rust docserver behind the edge |
| **Windows host** (alternate) | PowerShell + uv venv | same gates; per-platform geometry goldens (`geom-wo.<sys.platform>.json`) |

## Node/npm pins

Playwright 1.61.1 (chromium-1228); pnpm 10.4.1 on the server side; census
deps installed `--no-save` into gitignored `census/node_modules`.

## Production access notes

- Prod probes log in to OpenCloud, open a real `.docx`, and drive the served
  editor iframe — they measure **what is deployed**, which has twice diverged
  from what the repo claims ships (vanilla vs React editor).
- The editor edge needs `frame-ancestors https://cloud.graphwiz.ai` (traefik
  `editor-security-headers` middleware) — DENY breaks the shell iframe; that
  fix is documented in AGENTS.md and must survive edge re-provisioning.

## Committed measurement artifacts (the deployment surface of truth)

`graph.json`, `census/census/*` (ledger.json, interact ledgers, OO reference
censuses), geometry goldens, visual goldens + baselines. All change via
deliberate recapture only; CI jobs re-derive and compare against them.
