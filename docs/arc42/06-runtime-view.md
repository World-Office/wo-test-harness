# 6. Runtime View

## 6.1 One-run parity gate (reconcile.py --check …)

```
resolve_server (WO_SERVER_DIR contract)
  └─ spawn_docserver(rust|python)  ── free port, /health wait
       ├─ capture: census-wo.cjs (CENSUS_WO_URL, no docker)
       ├─ join:    census-diff.py — OO reference JSON (committed) × MAP → ledger.json
       ├─ gate:    ledger counts + STALE-DEFERRED + menu-file>0
       ├─ interactions: interact-wo × interact-oo (committed) → interact-diff
       ├─ fx:           fx-wo.cjs — every control must do something
       ├─ geometry:     geom census vs committed golden (per-platform)
       ├─ visual:       visual-wo render → pixel-diff vs OnlyOffice goldens
       └─ ai:           ai-contracts.py (spawns its own docserver + mcp-server)
  → single exit code; throwaway dir; zero writes to committed artifacts
```

## 6.2 AI contract run (ai-contracts.py)

```
spawn rust docserver ──► HTTP probes: /ai/config, /api/documents/{id}/ai/propose,
                          /api/ai/tools, /ai/generate
                        404/405 = absent · 200 = implemented (shape-validated)
spawn mcp-server (stdio) ──► initialize → tools/list (15 tools, schemas pinned)
                            tools/call only when AI_CONTRACTS_MCP_CALL=1
                            + storage-service spawned (STORAGE_SERVICE_URL)
converter positive-pin: POST /api/conversion/convert docx→html must be Success
truth-table: PROBES dict — expect pass|absent|deferred
  mismatch ⇒ STALE (claims real) or EARLY (impl landed, not promoted) ⇒ exit 1
```

## 6.3 Live-prod functional census (fx-prod.cjs)

```
login cloud.graphwiz.ai → open .docx → editor iframe (editor.cloud.…)
→ click EVERY visible ribbon control across 11 tabs
→ classify observable effect: doc mutation | menu | dialog | panel | status |
  chrome-inline-style
→ none ⇒ silent/unclickable ⇒ exit 1 (loud-stub gate against the deployed editor)
```

## 6.4 CI run (conformance.yml, dispatch)

Cross-repo checkout of the server repo → the six jobs (unit tests, graph
drift, census-ledger gate with `--ai` + `cargo build -p wo-docserver -p
mcp-server`, scope-and-sheet oracle, cross-engine fidelity, OnlyOffice oracle
on pinned DS). Lesson learned: verify the run's `headSha` matches the pushed
commit — dispatch targets the remote ref.

## 6.5 Deliberate recapture flows

- Register growth: edit features.yaml → `seed.py` (writes graph.json) → commit
  both together; `seed.py --check` guards drift forever after.
- OO reference refresh: rig bring-up (docker recipe) → census-oo/interact-oo
  with `CENSUS_OUT` → review → commit. Never automatic.
