# 5. Building Block View

```
wo-test-harness/
├── harness-graph/        # SPEC layer
│   ├── features.yaml     #   111 F-### rows (parity + fidelity + divergences)
│   ├── seed.py           #   register → graph.json; --check drift gate
│   └── graph.json        #   committed artifact (deliberate recapture)
├── conformance/          # fidelity scoring (Rust)
│   └── wo-conformance    #   corpus, entropy driver, NormalizedRender scoring
├── conformance-docx/     # DocxConformanceAdapter + wo-render-ir bin
│                         #   (git-dep on server's wo-docx-renderer/wo-ooxml)
├── tf-test-harness/      # shell orchestrator + generation/coverage tooling
└── census/               # the parity pipeline
    ├── capture (Playwright)
    │   ├── census-wo.cjs       # structural: vanilla editor DOM (tabs/buttons)
    │   ├── census-react.cjs    # structural: React editor FileMenu (regression-pinned)
    │   ├── census-oo.cjs       # structural: OO rig reference (rig-side)
    │   ├── interact-wo.cjs     # click-through: classify modal/menu/panel/none
    │   ├── interact-oo.cjs     # click-through vs live OO (rig-side, committed)
    │   ├── fx-wo.cjs           # functional loud-stub (local docserver)
    │   ├── fx-prod.cjs         # functional loud-stub (LIVE prod, WOPI session)
    │   ├── visual-wo.cjs       # render golden docs → screenshots
    │   └── nonword-*.cjs       # sheet/slide/vsdx WOPI chain probes
    ├── orchestration (Python)
    │   ├── reconcile.py        # ONE-RUN: spawn → capture → join → gates
    │   ├── census-diff.py      # OO↔WO join via audited MAP → ledger.json
    │   ├── interact-diff.py    # interaction join (never re-derives pairing)
    │   ├── artifact-check.py   # committed-artifact invariants
    │   └── ds-bench.py         # rust/python docserver comparison metrics
    ├── contracts
    │   └── ai-contracts.py     # F-148..153 truth-table probes (HTTP + MCP stdio)
    ├── advisory (LLM, never gate)
    │   ├── ledger-gap.py       # ledger gaps → classified copy specs
    │   └── visual-triage.py    # pixel FAIL → broken vs cosmetics
    ├── pixel-diff.py           # THE visual gate (PIL flood-line compare)
    ├── rig/                    # OO docker rig recipe (local.json, rig-server.py)
    └── census/                 # committed artifacts: ledgers, MAP-facing JSON,
                                #   geometry goldens, OO reference captures
└── .github/workflows/conformance.yml   # 6 CI jobs (private repo, dispatch)
```

## Key responsibilities

- **`reconcile.py`** — the single entrypoint: resolves the server checkout,
  spawns the chosen docserver stack on a free port, runs capture→join→gate in
  a throwaway dir (check mode writes nothing), fans out to the dimension
  gates, propagates one exit code.
- **MAP (in census-diff.py)** — the audited OO↔WO pairing table + reason tags;
  the only place pairings live.
- **`ai-contracts.py`** — spawns docserver (HTTP probes) and mcp-server (stdio
  JSON-RPC) as real processes; STALE/EARLY hard failures; converter
  positive-pin.
- **Register (features.yaml)** — spec layer for everything; F-tags go inside
  module docstrings of server code (ids are stable).
