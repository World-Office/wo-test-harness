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
| react census | `census/census/census-react-deep.json` | `ribbon` dict (tab name → flat labels), `fileMenu` list, `statusbar` list |
| divergences | `census/react-e2e/divergences.json` | `{Tab: {"norm-label" or "_tab": reason}}` |
| ledger | `census/census/ledger.json` | features: cluster / kind / level (1–4) |
| contracts | `census/react-e2e/contract-results.json` | probe ids (health, ribbon, roundtrip, coverage-gate) |
| ctx contract | `census/ctx-contracts.json` | `_meta.source` + 5 contexts (`text`, `misspelled` lists; `table`, `image`, `shape` `{live, rows}`) |
| OO dialogs | `census/census/census-oo-dialogs.json` | rig-captured dialogs (18 rows, duplicates = same dialog from two triggers) |
| WO dialogs | `census/census/census-wo-dialogs.json` | **legacy wysiwyg** capture (65 dialogs; react dialog census pending) |
| shortcuts | `census/census/census-shortcuts.json` | OO `Shortcuts.js` vs WO keydown handler (147, static parse, per-row verdict + totals) |

## Hierarchy

- **Surface → Tab → Control** (ribbon, filemenu, statusbar, dialogs, ctx, shortcuts)
- **Surface → Cluster → Feature** (ledger)

Seven surfaces:

1. `ribbon` — every OO tab except `file`; tab id = OO census key (contextual
   tabs live under uuid keys, label carried through).
2. `filemenu` — OO `file` backstage as a single tab (`filemenu`). Ribbon-nav
   buttons embedded in the backstage are chrome and dropped, as in
   `react-e2e/coverage-check.py`.
3. `statusbar` — **real compare** since PG-4/PG-5: OO `statusBar` labels vs
   the react `statusbar` census (`label_match` as everywhere). OO repeats a
   segment per layout slot (Word count ×4) → one node per unique label;
   empty segments count as `iconOnly`. Two alias pairs in `build.py`
   (`STATUSBAR_ALIASES`) bridge OO's captured slot **values** to react's
   control **titles**: `Word count`→`Words: N`, `English – United States`→
   `Language`. An unmatched labeled segment is `missing` (loud).
4. `dialogs` — one control per **unique** OO dialog title vs the WO dialog
   census. **Caveat** (in the JSON): the WO side is the legacy wysiwyg
   capture; a react dialog census is pending. WO titles mix i18n keys
   (`Toolbar.Find`, `TableOfFigures.Title`) with resolved strings (`Insert
   symbol`) — the comparison indexes every norm variant (leading `Insert `
   stripped, dotted segments, first/last joins, plural `s`). Two explicit
   aliases map OO dialogs into the WO dialog that combines them (`Margins`,
   `Page size` → `Page setup`). Matched → `done` (with the caveat); unmatched
   → `diverged` (documented: no counterpart in the legacy census — not
   `missing`, because the gap is the legacy capture's coverage, not an
   undocumented editor debt).
5. `ctx` — the live-verified context-menu contract (`ctx-contracts.json`,
   5 scenarios): one tab per context, one control per canonical row key,
   all `done`. This surface documents the contract that was verified live
   on the seeded OO rig; it is not a fresh diff.
6. `shortcuts` — the shortcut census (147): `matched`→`done`, `nav`→`done`
   (reason `navigation`), `diverged`→`diverged`, `browser-native`→`diverged`
   (reason `browser-native`), `missing`→`missing`. `build.py` cross-checks
   its per-status counts against the census `totals` and exits loudly on
   drift.
7. `ledger` — the feature ledger grouped by cluster (18 clusters), with
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

`totals` aggregates all surfaces and carries per-surface counts under
`totals.surfaces`; `probes` lists the e2e contract probe ids.

Current state (PG-5 build): 386 control nodes — done=358, diverged=28,
missing=0, iconOnly=69 (+534 ledger features). The 28 diverged: 5 filemenu
(documented backstage divergences), 3 dialogs (Date & time, Insert caption,
Macros — no legacy-census counterpart), 20 shortcuts (3 diverged + 17
browser-native).

## Regenerate & query

```sh
/usr/bin/python3 census/port-graph/build.py    # rebuild graph.json, print totals
/usr/bin/python3 census/port-graph/report.py   # PG-2: coarse overview / --tab detail
/usr/bin/python3 census/port-graph/done-gate.py  # PG-3: exit 1 on undocumented missing
```

A surface/tab is **done** when every OO control is `done` or `diverged`.
