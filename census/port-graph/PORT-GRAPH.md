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
| react dialogs | `census/census/census-react-dialogs.json` | react editor dialogs: 15 right-rail panels (PG-8), the deployed surface |
| WO dialogs | `census/census/census-wo-dialogs.json` | legacy wysiwyg capture (65 dialogs) — fallback for modals the panels census does not reach |
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
4. `dialogs` — one control per **unique** OO dialog title matched against the
   **react panels census first** (the deployed editor), the **legacy wysiwyg
   census as fallback** (modals the panels census does not reach: Symbol,
   Page setup, Columns, Hyphenation). Match order (all in `build.py`):
   direct action → react route alias → react title match → legacy combined
   alias → legacy title match. Route aliases are verified against the deployed
   `word-commands.ts`: `insertToc`/`insertBookmark`/`insertCaption`/
   `insertCrossReference`/`insertTableOfFigures` all route to the react
   `Cross-Reference` panel; `macros` routes to `Plugins`; `insertDateTime`
   inserts a DATETIME field directly (documented divergence, no dialog by
   design). Matched → `done` (route aliases carry the routing reason);
   unmatched → `diverged` (documented: no counterpart in either census —
   not `missing`, because the gap is census coverage, not undocumented
   editor debt).
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

Current state (PG-9 build): 386 control nodes — done=360, diverged=26,
missing=0, iconOnly=69 (+534 ledger features). The 26 diverged: 5 filemenu
(documented backstage divergences), 1 dialogs (Date & time — react inserts
directly, no dialog), 20 shortcuts (3 diverged + 17 browser-native).

## Regenerate & query

```sh
/usr/bin/python3 census/port-graph/build.py    # rebuild graph.json, print totals
/usr/bin/python3 census/port-graph/report.py   # PG-2: coarse overview / --tab detail
/usr/bin/python3 census/port-graph/done-gate.py  # PG-3: exit 1 on undocumented missing
```

A surface/tab is **done** when every OO control is `done` or `diverged`.
