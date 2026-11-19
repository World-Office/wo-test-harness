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
| `oo-engine-commands.json` | 226 sdkjs engine commands (147 `Asc.c_oAscDocumentShortcutType.*` + 10 `c_oAscContextMenuTypes.*` + 69 `word/Editor/Document.js` dispatch cases; static extraction — names, not UI labels; OO build + git rev pinned in the manifest header) |

## Hierarchy

- **Surface → Tab → Control** (ribbon, filemenu, statusbar, dialogs, rightpanel, ctx, shortcuts, engine)
- **Surface → Cluster → Feature** (ledger)

Nine surfaces:

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
9. `engine` — **v3.4 NEW (HE-3)**: the static sdkjs command universe
   (`oo-engine-commands.json`, 226 commands) vs react **dispatch** evidence —
   see [Engine surface](#engine-surface-sdkjs-command-universe).

## Engine surface (sdkjs command universe)

`engine` answers a different question from the seven UI surfaces: not "is the
button there" but "**does the react editor dispatch this engine command**". Its
baseline is the static manifest `census/oo-source/oo-engine-commands.json`
(HE-2, extracted from the pinned sdkjs checkout `9d21388`, OO build
`252.232.451.526`): 147 `Asc.c_oAscDocumentShortcutType.*` members + the 10
`c_oAscContextMenuTypes.*` kinds + the 69 `word/Editor/Document.js` dispatcher
case labels (the 47 enum-qualified shortcut cases fold into their shortcut row)
= **226 rows, one tab, no controls invented** (asserted both directions).

These are engine *names*, not labels, so the react side is a command-id join
against two pinned snapshots of the deployed editor
(`apps/web/apps/documenteditor-react` @ `990857b39`): the `RichTextCommand`
union in `src/lib/rte-command.ts` (130 ids) and the wo-command cases dispatched
in `src/lib/word-commands.ts` (202 ids). They are pinned in `build.py`
(`REACT_RICHTEXT_COMMANDS` / `REACT_WO_COMMANDS`) for the same reason
`REACT_BACKSTAGE_PANELS` is: build.py reads only committed artifacts and CI
checks out no server clone. Every react command id cited by a verdict must be
in that vocabulary or the build exits non-zero.

Statuses, in evidence priority order:

1. **`covered`** (own bucket, not `done`) — the SAME command already has a row
   on another surface. All 147 shortcut commands *are* the shortcut census's
   `type`s, and `ctx:Common` is the ctx surface's five word menus: 148 of 226
   rows cross-link (`coveredBy` names the surface/row) and are **not** counted
   in `done`/`missing` again — the engine surface catalogues the command
   universe without double-voting evidence that another surface already holds.
   Their `status` still mirrors the covering row so `done-gate.py --strict`
   keeps working on them. A weaker, secondary cross-link is appended to the
   reason instead (`also tracked at ribbon/home/Bold`) when only the command
   *name* collides with another surface's row label.
2. **`done`** — the command routes in react: a `RichTextCommand` id or a
   wo-command case (e.g. `c_oAscSectionBreakType.Continuous` →
   `insertContinuousSectionBreak`, `AscDFH.historyitem_Document_EvenAndOddHeaders`
   → `differentOddEven`, `para_Field` → `insertField`/`fieldSpan`).
3. **`diverged`** — documented difference: react ships the capability in
   another shape (`para_FootnoteReference` is the `FootnoteReference` mark, the
   `AscDFH.historyitem_*` journal is ProseMirror transactions, even/odd page
   section breaks exist in `SectionBreakType` but no command inserts them), or
   the row is not a word-engine command at all (the 8 slide/cell ctx kinds, the
   `Start`/`End` selection-walk sentinels).
4. **`missing`** — engine-only, reason citing what was searched: the
   frame-anchor/align enums (16 rows — `documentStore.alignObjects()` is a TODO
   stub), hyphenation settings (3), gutter/mirror margins (2), default tab,
   math/OMML, tab stops, hard line breaks, the note-number/caption cross-ref
   formats (4), the column section break, `selectionflag_Numbering`, the
   footnote continuation separator, the builder-script journal.

Triage is **pinned per row** in `build.py` (`ENGINE_DISPATCH`, `ENGINE_CTX`,
`ENGINE_SHORTCUT_REACT`): a manifest row with no verdict row — or a verdict row
with no manifest row — exits non-zero, so an sdkjs upgrade forces re-triage
instead of silently defaulting to `missing`.

Engine tab invariant: `done + diverged + missing + covered == total`
(`iconOnly` is 0 — engine names are never icon-only). Note the rollup tools
print the four classic statuses only: `done-gate.py`/`report.py` therefore
report the engine tab as 78 controls (16+27+35) while `counts.total` is 226 —
the other 148 are cross-links, and `totals.surfaces.engine.covered` carries
them. `totals.controls` counts all 688 rows; `done`/`diverged`/`missing` stay
un-inflated by design.

The 534-feature `ledger` surface is campaign provenance and is **not** touched
by engine rows: the engine surface is additive evidence (command names dug from
sdkjs), not a re-count of the ledger.

## Statuses (exactly three)

| status | definition |
|---|---|
| `done` | OO label present in the react evidence (battle-tested matcher from `react-e2e/coverage-check.py`: normalized equality or token-subset with shared token ≥ 4 chars; explicit alias tables where the matcher can't see the identity) |
| `diverged` | absent from react evidence **and** documented — verified routing/action evidence (e.g. react inserts a DATETIME field where OO opens a dialog) or a `divergences.json` entry |
| `missing` | absent from react evidence without documentation = undocumented debt — **the honest gap the union baseline exists to expose** |

Empty OO labels (icon-only chrome) carry no label-parity burden: counted per
tab as `counts.iconOnly`, no control nodes emitted.

Tab `counts` roll up consistently: `done + diverged + missing + iconOnly == total`
— except the engine tab, which adds the cross-link bucket `covered`
(`done + diverged + missing + covered == total`, `iconOnly` 0): a `covered` row
is the same command as a done/diverged row on another surface, so it carries no
new vote. See [Engine surface](#engine-surface-sdkjs-command-universe).

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
signature-settings→`signature`, form-settings→`form`, filling-status→react
FormPanel 'Filling status' section (PGP-9); send-for-signing has no react
counterpart (missing — DSS backend feature).

**engine** (`ENGINE_DISPATCH` / `ENGINE_CTX` / `ENGINE_SHORTCUT_REACT`, joined
against the pinned `REACT_RICHTEXT_COMMANDS` + `REACT_WO_COMMANDS` snapshots):
every one of the 226 manifest commands → (status, react command, reason) —
see [Engine surface](#engine-surface-sdkjs-command-universe) for the rules and
the per-row families (frame anchoring/alignment, hyphenation and margin
settings, cross-reference formats, section breaks, `para_*` discriminators,
review types, selection flags).

## Current state (post-HE-3 engine surface, graph build 2026-11-19) — done-gate output verbatim

688 control rows — done=451, diverged=50, missing=39, iconOnly=58
(+534 ledger features, untouched). The seven UI surfaces are unchanged from
the post-PGP-A build (520 nodes, done=435 / diverged=23 / missing=4): the new
`engine` surface (HE-3) adds the 226-command sdkjs universe, of which **148
cross-link** to rows already tracked elsewhere (`covered` — the 147 shortcut
commands plus `ctx:Common`) and 78 carry new engine evidence: 16 done,
27 diverged, 35 missing, all documented (see
[Engine surface](#engine-surface-sdkjs-command-universe)). `done-gate.py`
prints the engine tab as 78 controls because it sums the four classic
statuses; the tab's `counts.total` is 226.

```
ribbon        203 controls  done=145 diverged=0 missing=0 iconOnly=58
filemenu       29 controls  done=28 diverged=0 missing=1 iconOnly=0
    filemenu-buttons         done= 18 diverged=0 missing=1
      GAP (documented) filemenu-buttons/Edit Document
statusbar      17 controls  done=17 diverged=0 missing=0 iconOnly=0
dialogs        39 controls  done=34 diverged=3 missing=2 iconOnly=0
    dialogs                  done= 34 diverged=3 missing=2
      GAP (documented) dialogs/Role Delete
      GAP (documented) dialogs/Role Edit
rightpanel     10 controls  done=9 diverged=0 missing=1 iconOnly=0
    rightpanel               done=  9 diverged=0 missing=1
      GAP (documented) rightpanel/Send for signing
ctx            75 controls  done=75 diverged=0 missing=0 iconOnly=0
shortcuts     147 controls  done=127 diverged=20 missing=0 iconOnly=0
engine         78 controls  done=16 diverged=27 missing=35 iconOnly=0
    engine                   done= 16 diverged=27 missing=35
      GAP (documented) engine/Asc.c_oAscDocumentRefenceToType.NoteNumber
      GAP (documented) engine/Asc.c_oAscDocumentRefenceToType.NoteNumberFormatted
      GAP (documented) engine/Asc.c_oAscDocumentRefenceToType.OnlyCaptionText
      GAP (documented) engine/Asc.c_oAscDocumentRefenceToType.OnlyLabelAndNumber
      GAP (documented) engine/AscDFH.historydescription_BuilderScript
      GAP (documented) engine/AscDFH.historyitem_Document_DefaultTab
      GAP (documented) engine/AscDFH.historyitem_Document_MathSettings
      GAP (documented) engine/AscDFH.historyitem_Document_Settings_ConsecutiveHyphenLimit
      GAP (documented) engine/AscDFH.historyitem_Document_Settings_DoNotHyphenateCaps
      GAP (documented) engine/AscDFH.historyitem_Document_Settings_GutterAtTop
      GAP (documented) engine/AscDFH.historyitem_Document_Settings_HyphenationZone
      GAP (documented) engine/AscDFH.historyitem_Document_Settings_MirrorMargins
      GAP (documented) engine/c_oAscHAnchor.Margin
      GAP (documented) engine/c_oAscHAnchor.Page
      GAP (documented) engine/c_oAscHAnchor.Text
      GAP (documented) engine/c_oAscSectionBreakType.Column
      GAP (documented) engine/c_oAscVAnchor.Margin
      GAP (documented) engine/c_oAscVAnchor.Page
      GAP (documented) engine/c_oAscVAnchor.Text
      GAP (documented) engine/c_oAscXAlign.Center
      GAP (documented) engine/c_oAscXAlign.Inside
      GAP (documented) engine/c_oAscXAlign.Left
      GAP (documented) engine/c_oAscXAlign.Outside
      GAP (documented) engine/c_oAscXAlign.Right
      GAP (documented) engine/c_oAscYAlign.Bottom
      GAP (documented) engine/c_oAscYAlign.Center
      GAP (documented) engine/c_oAscYAlign.Inside
      GAP (documented) engine/c_oAscYAlign.Outside
      GAP (documented) engine/c_oAscYAlign.Top
      GAP (documented) engine/para_ContinuationSeparator
      GAP (documented) engine/para_Math
      GAP (documented) engine/para_NewLine
      GAP (documented) engine/para_Tab
      GAP (documented) engine/selectionflag_Numbering
      GAP (documented) engine/ChangeHdrFtr
ledger       18 clusters, 534 features (no control nodes)
GATE OK — no undocumented-missing controls (documented gaps are listed, not failed)
```

The 4 UI gaps are unchanged (OnlyOffice DocSpace/DSS enterprise features,
backend-scoped: per-role rights, edit-mode switch, e-signing workflows). The
35 engine gaps are the honest engine-only residual — frame anchoring/alignment
(16), hyphenation + margin + tab-stop settings (6), the note-number/caption
cross-reference formats (4), math/OMML, tab stops, hard line breaks, the
column section break, the footnote continuation separator, the numbering
selection lock and the builder-script (macro) journal. Each is documented with
the evidence searched; they close by porting engine capability, never by
editing statuses.

## Gap triage (PG-11)

Evidence-based reclassification of the 18 honest-gap rows the v3 union
exposed. Evidence dug from the deployed react editor source (server
`apps/web/apps/documenteditor-react`: `lib/word-commands.ts`, `FormPanel.tsx`,
`MailMergePanel.tsx`, `SignaturePanel.tsx`, `CrossReferencePanel.tsx`,
`FileMenu/panels/*`, `StatusBar.tsx`) and the committed censuses
(`census-react-dialogs.json`, `census-react-deep.json`, `ctx-contracts.json`).
Result: **5 promoted** (2 done, 3 diverged), **13 stay missing** — now each
with the searched evidence cited in `graph.json` instead of the generic
`no evidence in the react panels census or the legacy WO dialog census`
string. Rows close by porting features or documenting divergences, never by
editing statuses.

### Promoted — evidence found

| Row | Status | Evidence |
|-----|--------|----------|
| dialogs/Control Settings | done | react **Form Controls** right-rail panel (Required/Locked/placeholder fields, census-react-dialogs.json) is the control-settings surface |
| filemenu/Save to Desktop | done | react 'Save as…' item **is** action `save-desktop` (FileMenuItems.tsx) |
| dialogs/Mail Merge Email | diverged | react Mail Merge panel merges pasted/uploaded CSV locally (Insert-field/Preview/Reset, MailMergePanel.tsx + lib/mail-merge.ts) — no email dispatch |
| dialogs/Roles Manager | diverged | react Protect Document + Access Rights backstage panels show WOPI-derived rights (ProtectDocPanel/RightsPanel.tsx); role CRUD delegated to portal sharing |
| statusbar/Multiple pages | diverged | react ships the toggle in the **View tab** (census-react-deep ribbon 'Multiple Pages'; `toggleMultiplePages`), not the statusbar |

### Still missing — evidence cited, none found

| Row | Evidence searched and failed |
|-----|------------------------------|
| dialogs/Cells Add | table ctx = Merge/Split/Delete only (ctx-contracts.json, live-verified); no `insertCell` command |
| dialogs/Edit List Item | FormPanel edits dropdown options at **insert time** only; no edit path for a placed control |
| dialogs/List Settings | bullet/ordered/task toggles exist (word-commands.ts); no numbering-format/indent settings dialog |
| dialogs/List Types | same — no list-type picker dialog |
| dialogs/Notes Remove | Cross-Reference panel lists footnote targets; no remove-notes command (`removeHeader`/`removeFooter` only) |
| dialogs/Role Edit | rights are WOPI-derived read-only (RightsPanel.tsx); no per-role editing |
| dialogs/Role Delete | same — no per-role delete |
| dialogs/Save Form | Save-as panel exports DOCX (+pdf/txt via conversion, SaveAsPanel.tsx EXPORT_FORMATS); no save-as-form |
| dialogs/Style Title | 'Formatting as style' copies formatting (`copyStyle`); no style-naming dialog |
| filemenu/Edit Document | edit rights are WOPI-derived (UserCanWrite → Protect panel Full Access/Read-Only); no user-facing edit/view switch |
| statusbar/Action status | transient text slot; react statusbar has pager/zoom/word-count only (StatusBar.tsx) |
| rightpanel/Send for signing | react ships self-signing only (SignaturePanel.tsx); no send-for-signing workflow |
| rightpanel/Filling status | Form Controls panel inserts/edits controls; no fill-status reporting |

### Closure (2026-11-18, campaigns PGP-1..9 + PGP-A)

All portable rows above shipped — the table is historical. Shipped-and-now-`done`:
**Cells Add** (insertCells right/down, PGP-3), **Edit List Item** (FormPanel
post-insert edit, PGP-4), **List Settings / List Types** (numbering picker,
PGP-5), **Notes Remove** (removeAllFootnotes/Endnotes, PGP-2), **Save Form**
(buildFormDocx w:sdt, PGP-7), **Style Title** (style rename, PGP-6),
**statusbar Action status** (de-statusbar-status slot + setStatusMessage, PGP-8)
and **Multiple pages** (statusbar toggle, PGP-8), **Filling status**
(form-status.ts, PGP-9). The **ctx surface** (not in this table) was
rubber-stamped 75/75 and re-based to react evidence (v3.2) — all five menus
shipped (table PGP-1, text PGP-A1, image PGP-A2, shape PGP-A3, misspelled
PGP-A4). Still `missing` (all DSS/DocSpace enterprise backend features):
Edit Document, Role Edit, Role Delete, Send for signing. Ribbon builder
hardened (v3.3): an OO tab that fails to resolve a react tab now marks its
buttons `missing`, never rubber-stamps `done`.

## Regenerate & query

```sh
/usr/bin/python3 census/port-graph/build.py    # rebuild graph.json, print totals + union baselines
/usr/bin/python3 census/port-graph/report.py   # PG-2: coarse overview / --tab detail
/usr/bin/python3 census/port-graph/report.py --status missing   # the honest gap, renderable
/usr/bin/python3 census/port-graph/report.py --tab engine --status missing  # engine-only commands
/usr/bin/python3 census/port-graph/done-gate.py  # PG-3: exit 1 on undocumented missing
/usr/bin/python3 census/port-graph/done-gate.py --surface engine  # per-row engine rollup
```

A surface/tab is **done** when every OO control is `done` or `diverged`.
