# 6. Runtime View

## R1 — One-run parity gate (reconcile.py)

```
resolve_server (WO_SERVER_DIR contract)
  └─ spawn_docserver (rust; free port; /health wait)
       ├─ capture:  census-wo.cjs / census-react*.cjs  (CENSUS_WO_URL)
       ├─ join:     census-diff.py — OO reference JSON (committed) × MAP
       ├─ gates:    ledger counts + STALE-DEFERRED + menu-file>0
       ├─ interact: interact-wo.cjs → interact-diff.py
       ├─ fx:       fx-wo.cjs (local) and/or fx-prod.cjs (LIVE prod WOPI)
       ├─ geometry: geom-wo.cjs → geom-diff.py
       ├─ visual:   visual-wo.cjs → pixel-diff.py vs OO goldens
       └─ ai:       ai-contracts.py (HTTP probes + mcp-server stdio JSON-RPC)
rc=0 = the whole gate passed; any FAIL exits non-zero with phase detail.
```

## R2 — Ledger build (completeness re-score)

```
census/ $ /usr/bin/python3 ledger/build.py
  reads:  census/census-oo-deep.json + census-oo-dialogs.json
          + census-oo-interactions.json + census-wo-deep.json
          + ledger/roundtrip-results.json (if present)
  join:   normalize → fuzzy match (norm/toks + matcher aliases per cluster)
          → noise filter (NOISE regex, backstage exclusion, statusbar raw ids)
  writes: ledger.json + LEDGER-REPORT.md
```

## R3 — Persistence round-trip probe (L3 evidence)

```
census/ledger/ $ NO_PROXY='127.0.0.1,localhost' \
  WO_CONVERT_URL=http://127.0.0.1:18087/api/conversion/convert \
  /usr/bin/node roundtrip.cjs
   → "roundtrip: 13/13 survived, level3=13"
   → roundtrip-results.json (committed evidence)
```
Against a LOCAL fresh build: `cd server && cargo build -p wo-docserver`,
run with `JWT_SECRET=dev-secret DOCSERVER_PORT=18087`. Against staging/prod:
point `WO_CONVERT_URL` at :8086/:8082. Payloads go through **verbatim** —
a converter regression must fail loudly, not be sanitized away.

## R4 — Campaign loop (agent-driven gap burn-down)

```
deep census (census-oo-deep × census-wo-deep)
  → deep-gap.py → gap report (implementation backlog, NOT a gate)
  → agentflow campaign (server/config/tasks.json, workers in worktrees,
     policy: NO CHANGE IS NOT SUCCESS, count-agnostic accept gates)
  → fixes land on server main (+ static JS gates / cargo gates in-repo)
  → re-run R1–R3 → ledger/build.py re-score → LEDGER-REPORT.md shrinks L0
```

## R5 — Deep census refresh (ground-truth maintenance)

`census-oo-deep.cjs` / `census-oo-dialogs.cjs` run **rig-side** against the
pinned OnlyOffice DS docker rig (`rig/`); outputs are committed read-only.
WO-side deep census mirrors the same extraction against our editor. Quirks
(e.g. OO backstage tab indexing, dialog frame ONE-SHOT lookup) are handled
inside the scripts — never by editing the OO JSONs.

## R6 — Register drift gate

`harness-graph/seed.py --check` regenerates `graph.json` from `features.yaml`
and diffs — committed graph may never drift from the register.
