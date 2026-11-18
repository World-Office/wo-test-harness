# PORT-GRAPH.md — port-state graph spec

`graph.json` is the committed, hierarchical port-state graph: what of the
OnlyOffice (OO) editor surface the react editor has, per control. Coarse →
detail drill-down for reports and done-gating.

**Derived artifact.** Built by `python3 census/port-graph/build.py` from
committed census artifacts (pure stdlib — no node, no playwright, no network,
no server-repo paths). Regenerate after a census capture; **never hand-edit**.

## Union rule (v3)

The OO-side **baseline of every surface is the UNION** of the source
manifests (`census/oo-source/*.json`, dug from OO's own templates and pinned
to OO build `252.232.451.526`) with the runtime censuses. The source
manifests are the larger truth — the runtime censuses only see what rendered.
`build.py` **self-asserts union completeness** (a manifest row without a graph
row is a hard build failure) and prints per-surface baseline sizes with
resolved done/diverged/missing counts.

Honesty rule: a baseline row with **no react-side evidence is `missing`** —
the documented honest gap. Statuses are never massaged to keep the done-gate
green; `done-gate.py` output for the current build is quoted verbatim below.

## Sources

Runtime censuses (what rendered):

| source | path | provides |
|---|---|---|
| OO golden | `census/census/census-oo-deep.json` | `tabs` dict (id → label, contextual, buttons), `statusBar` list |
| OO backstage labels | `census/census/census-oo.json` | portal-mode backstage capture — anchors the filemenu id→label map |
| react census | `census/census/census-react-deep.json` | `ribbon` dict (tab name → flat labels), `fileMenu` list, `statusbar` list |
| divergences | `census/react-e2e/divergences.json` | `{Tab: {"norm-label" or "_tab": reason}}` |
| ledger | `census/census/ledger.json` | features: cluster / kind / level (1–4) |
| contracts | `census/react-e2e/contract-results.json` | probe ids (health, ribbon, roundtrip, coverage-gate) |
| ctx contract | `census/ctx-contracts.json` | `_meta.source` + 5 contexts (`text`, `misspelled` lists; `table`, `image`, `shape` `{live, rows}`) |
| OO dialogs | `census/census/census-oo-dialogs.json` | rig-captured dialogs (18 rows, duplicates = same dialog from two triggers) |
| react dialogs | `census/census/census-react-dialogs.json` | react editor dialogs: 15 right-rail panels (PG-8), the deployed surface |
| WO dialogs | `census/census/census-wo-dialogs.json` | legacy wysiwyg capture (65 dialogs) — fallback for modals the panels census does not reach |
| shortcuts | `census/census/census-shortcuts.json` | OO `Shortcuts.js` vs WO keydown handler (147, static parse, per-row verdict + totals) |

Source manifests (what OO's templates declare; `census/oo-source/`):

| source | provides |
|---|---|
| `oo-dialogs.json` | 36 dialogs (`file`, `component`, `id` like `window-bookmarks`, `title` = i18n KEY) |
| `oo-filemenu.json` | 19 backstage button ids + 10 panel ids |
| `oo-statusbar.json` | 17 statusbar template ids + js-wired ids |
| `oo-ctx-manifest.json` | ctx menu constructor counts per menu (237 constructors; counts only, no labels) |
| `oo-reference.json` | ribbon source counts (4 tabs, 39 buttons, 78 slot ids) + `rightPanel`: 10 section ids |
| `oo-shortcuts.json` | 142 runtime shortcut actions (all ⊆ the 147-row shortcut census) |

## Hierarchy

- **Surface → Tab → Control** (ribbon, filemenu, statusbar, dialogs, rightpanel, ctx, shortcuts)
- **Surface → Cluster → Feature** (ledger)

Eight surfaces:

1. `ribbon` — every OO runtime tab except `file`; tab id = OO census key
   (contextual tabs live under uuid keys, label carried through). The 4
   source-template tabs (home/ins/layout/links) are ⊆ the runtime tabs
   (asserted); source button/slot counts ride as surface `sourceManifest` meta.
2. `filemenu` — **v3: baseline = the source manifest** (19 buttons + 10
   panels as two tabs, `filemenu-buttons` / `filemenu-panels`). The old
   runtime file-tab capture was quick-access chrome (Find/Copy/Paste), not
   the backstage. React evidence: the react `fileMenu` census labels + the
   13 react backstage panel components (`src/components/FileMenu/panels/`,
   verified PG-10, pinned in `build.py` since it only reads committed
   artifacts).
3. `statusbar` — **v3: baseline = union(17 source template ids, runtime
   census rows)**; runtime rows join by DOM id and carry the captured OO
   slot labels. Id → semantics table in `build.py` (`STATUSBAR_SEMANTICS`,
   reproduced below). React evidence: the react `statusbar` census.
4. `dialogs` — **v3: baseline = 36 source dialogs ∪ runtime-only titles**
   (Symbol, Table of figures, Macros — captured at runtime, not in the
   template scan). Runtime titles join source rows by the
   `RUNTIME_TITLE_JOIN` table and act as display label + evidence. React
   evidence chain (react first): direct action → react route alias →
   react panel alias → react panel title match → legacy component alias →
   legacy title match. **No evidence at any tier → `missing`.**
5. `rightpanel` — **v3 NEW**: OO's 10 right-panel section ids
   (`oo-reference.json`: paragraph-settings, table-settings, image-settings,
   shape-settings, mail-merge-settings, textart-settings,
   signature-settings, form-settings, send-for-signing-settings,
   filling-status-settings) vs the react editor's 15 right-rail panels.
   React-only panels (comments, review, ai-assistant, chart, crossreference,
   plugins, theme) are a superset — noted in the surface, not debt rows.
6. `ctx` — the live-verified context-menu contract (`ctx-contracts.json`,
   5 scenarios, 75 rows): one tab per context, one control per canonical row
   key, all `done`. The source ctx manifest (constructor counts only) rides
   as surface `manifest` meta — no controls invented from counts.
7. `shortcuts` — the shortcut census (147): `matched`→`done`, `nav`→`done`
   (reason `navigation`), `diverged`→`diverged`, `browser-native`→`diverged`
   (reason `browser-native`), `missing`→`missing`. Cross-checked against
   the census `totals`; every oo-source action absent from the census would
   append a `missing` row (all 142 are present today).
8. `ledger` — the feature ledger grouped by cluster (18 clusters), with
   per-level counts (`byLevel`: 1 core … 4 fidelity).

## Statuses (exactly three)

| status | definition |
|---|---|
| `done` | OO label present in the react evidence (battle-tested matcher from `react-e2e/coverage-check.py`: normalized equality or token-subset with shared token ≥ 4 chars; explicit alias tables where the matcher can't see the identity) |
| `diverged` | absent from react evidence **and** documented — verified routing/action evidence (e.g. react inserts a DATETIME field where OO opens a dialog) or a `divergences.json` entry |
| `missing` | absent from react evidence without documentation = undocumented debt — **the honest gap the union baseline exists to expose** |

Empty OO labels (icon-only chrome) carry no label-parity burden: counted per
tab as `counts.iconOnly`, no control nodes emitted.

Tab `counts` roll up consistently: `done + diverged + missing + iconOnly == total`.

`totals` aggregates all surfaces and carries per-surface counts under
`totals.surfaces`; `probes` lists the e2e contract probe ids.

## Mapping tables (v3 — the id→semantics dictionaries in `build.py`)

Controls carry `ooId` (the source-manifest row id) so the union is auditable.

**filemenu** (`FILEMENU_LABELS` — label from the portal-mode runtime backstage
capture where captured, else derived from the id suffix):

| id | label | id | label |
|---|---|---|---|
| fm-btn-return | Back | fm-btn-save-copy | Save Copy As |
| fm-btn-create | Create New | fm-btn-save-desktop | Save to Desktop |
| fm-btn-recent | Open Recent | fm-btn-print-with-preview | Print with Preview |
| fm-btn-save | Save | fm-btn-rename | Rename |
| fm-btn-download | Download As | fm-btn-history | Version History |
| fm-btn-print | Print | fm-btn-rights | Access Rights |
| fm-btn-protect | Protect | fm-btn-back | Go to Documents |
| fm-btn-info | Info | fm-btn-edit | Edit Document |
| fm-btn-settings | Advanced Settings | fm-btn-suggest | Suggest a Feature |
| fm-btn-help | Help | | |

Panels: panel-saveas→Save As, panel-savecopy→Save Copy, panel-recentfiles→
Recent Files, panel-createnew→Create New, panel-info→Document Info,
panel-rights→Access Rights, panel-settings→Advanced Settings, panel-help→
Help, panel-protect→Protect Document, panel-print→Print. Evidence targets
(`FILEMENU_PANEL_TARGETS`): each id → its react backstage panel component
(fm-btn-create→CreateNew, …, panel-print→PrintPreview).

**statusbar** (`STATUSBAR_SEMANTICS`, id → label; alias = the react control
the matcher needs pointed at it): label-pages→Page count (alias Page N of M),
status-goto-box/-page→Go to page (alias react pager), slot-status-btn-info→
Word count (alias Words: N), label-action→Action status, btn-cnt-lang→
Language container (alias Language), btn-doc-lang→Language, btn-doc-spell→
Spell check, btn-doc-review→Track changes, status-btn-select-tool→Select
tool, status-btn-hand-tool→Hand tool, status-btn-multiple-pages→Multiple
pages, btn-zoom-topage→Fit to page, btn-zoom-towidth→Fit to width,
btn-zoom-down→Zoom out, label-zoom→Zoom (alias 100%), btn-zoom-up→Zoom in.

**dialogs** (`DIALOG_COMPONENT_ALIASES` → legacy WO title; `REACT_PANEL_ALIASES`
→ react panel; `REACT_ROUTE`/`REACT_DIRECT` → word-commands.ts routing): see
the dicts in `build.py` — every entry names its evidence source verbatim.

**rightpanel** (`RIGHTPANEL_SEMANTICS`): paragraph-settings→react `paragraph`
panel, table-settings→`table`, image-settings→`image`, shape-settings→
`shape`, mail-merge-settings→`mailmerge`, textart-settings→`textart`,
signature-settings→`signature`, form-settings→`form`; send-for-signing and
filling-status have no react counterpart (missing).

## Current state (PG-10 build) — done-gate output verbatim

462 control nodes — done=423, diverged=21, missing=18, iconOnly=58
(+534 ledger features). Diverged: 1 dialogs (Date & time — react inserts
directly), 20 shortcuts (3 diverged + 17 browser-native).

```
ribbon        203 controls  done=145 diverged=0 missing=0 iconOnly=58
filemenu       29 controls  done=27 diverged=0 missing=2 iconOnly=0
    filemenu-buttons         done= 17 diverged=0 missing=2
      MISSING filemenu-buttons/Edit Document
      MISSING filemenu-buttons/Save to Desktop
statusbar      17 controls  done=15 diverged=0 missing=2 iconOnly=0
    statusbar                done= 15 diverged=0 missing=2
      MISSING statusbar/Action status
      MISSING statusbar/Multiple pages
dialogs        39 controls  done=26 diverged=1 missing=12 iconOnly=0
    dialogs                  done= 26 diverged=1 missing=12
      MISSING dialogs/Cells Add
      MISSING dialogs/Control Settings
      MISSING dialogs/Edit List Item
      MISSING dialogs/List Settings
      MISSING dialogs/List Types
      MISSING dialogs/Mail Merge Email
      MISSING dialogs/Notes Remove
      MISSING dialogs/Role Delete
      MISSING dialogs/Role Edit
      MISSING dialogs/Roles Manager
      MISSING dialogs/Save Form
      MISSING dialogs/Style Title
rightpanel     10 controls  done=8 diverged=0 missing=2 iconOnly=0
    rightpanel               done=  8 diverged=0 missing=2
      MISSING rightpanel/Send for signing
      MISSING rightpanel/Filling status
ctx            75 controls  done=75 diverged=0 missing=0 iconOnly=0
shortcuts     147 controls  done=127 diverged=20 missing=0 iconOnly=0
ledger       18 clusters, 534 features (no control nodes)
GATE FAIL — 18 undocumented-missing control(s)
```

The 18 missing rows ARE the honest gap the v3 union was built to expose
(source truth ⊃ runtime truth ⊃ react coverage). GATE FAIL here is correct
reporting, not a regression — the gap closes by porting features or
documenting divergences, never by editing statuses.

## Regenerate & query

```sh
/usr/bin/python3 census/port-graph/build.py    # rebuild graph.json, print totals + union baselines
/usr/bin/python3 census/port-graph/report.py   # PG-2: coarse overview / --tab detail
/usr/bin/python3 census/port-graph/report.py --status missing   # the honest gap, renderable
/usr/bin/python3 census/port-graph/done-gate.py  # PG-3: exit 1 on undocumented missing
```

A surface/tab is **done** when every OO control is `done` or `diverged`.
