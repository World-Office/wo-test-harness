# PORT-GRAPH.md — port-state graph spec

`graph.json` is the committed, hierarchical port-state graph: what of the
OnlyOffice (OO) editor surface the react editor has, per control. Coarse →
detail drill-down for reports and done-gating.

**Derived artifact.** Built by `python3 census/port-graph/build.py` from
committed census artifacts (pure stdlib — no node, no playwright, no network,
no server-repo paths). Regenerate after a census capture; **never hand-edit**.

## Sources

| source | path | provides |
|---|---|---|
| OO golden | `census/census/census-oo-deep.json` | `tabs` dict (id → label, contextual, buttons), `statusBar` list |
| react census | `census/census/census-react-deep.json` | `ribbon` dict (tab name → flat labels), `fileMenu` list |
| divergences | `census/react-e2e/divergences.json` | `{Tab: {"norm-label" or "_tab": reason}}` |
| ledger | `census/census/ledger.json` | features: cluster / kind / level (1–4) |
| contracts | `census/react-e2e/contract-results.json` | probe ids (health, ribbon, roundtrip, coverage-gate) |

## Hierarchy

- **Surface → Tab → Control** (ribbon, filemenu, statusbar)
- **Surface → Cluster → Feature** (ledger)

Four surfaces:

1. `ribbon` — every OO tab except `file`; tab id = OO census key (contextual
   tabs live under uuid keys, label carried through).
2. `filemenu` — OO `file` backstage as a single tab (`filemenu`). Ribbon-nav
   buttons embedded in the backstage are chrome and dropped, as in
   `react-e2e/coverage-check.py`.
3. `statusbar` — OO statusbar segments; duplicate labels collapse to one
   node, empty segments count as `iconOnly`. **Caveat** (in the JSON): react
   statusbar census is not in the artifacts; items are `done` on ledger
   evidence (statusbar cluster).
4. `ledger` — the feature ledger grouped by cluster (18 clusters), with
   per-level counts (`byLevel`: 1 core … 4 fidelity).

## Statuses (exactly three)

| status | definition |
|---|---|
| `done` | OO label present in the react census (battle-tested matcher from `react-e2e/coverage-check.py`: normalized equality or token-subset with shared token ≥ 4 chars) |
| `diverged` | absent from react census **and** documented — per-label entry in `divergences.json`, or a whole-tab `"_tab"` entry (reason string carried) |
| `missing` | absent from react census without documentation = undocumented debt |

Empty OO labels (icon-only chrome) carry no label-parity burden: counted per
tab as `counts.iconOnly`, no control nodes emitted.

Tab `counts` roll up consistently: `done + diverged + missing + iconOnly == total`.

`totals` aggregate all surfaces; `probes` lists the e2e contract probe ids.

## Regenerate & query

```sh
/usr/bin/python3 census/port-graph/build.py    # rebuild graph.json, print totals
/usr/bin/python3 census/port-graph/report.py   # PG-2: coarse overview / --tab detail
/usr/bin/python3 census/port-graph/done-gate.py  # PG-3: exit 1 on undocumented missing
```

A surface/tab is **done** when every OO control is `done` or `diverged`.
