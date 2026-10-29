# OO source-code analysis — features the census does not cover

> Generated 2026-10-28 against OO web-apps @ `f79972a4` (release/v10.0.0,
> cloned shallow to `~/git/OO/DocumentServer`), DE locale `en.json` (4479 keys),
> and WO `documenteditor-wysiwyg` editor.js/index.html @ main.
> Companion to LEDGER-REPORT.md. This is ANALYSIS, not a gate.

## Method

Census = rendered-DOM inventory (tabs/controls/menus/backstage/statusbar +
12 dialogs reachable via walked menu paths). This pass analyzed **source**:
OO locale dialog titles (`DE.Views.<View>.textTitle|textWindowTitle`),
OO view/controller sources (65 view files), WO `DIALOG_IDS` registry (41
dialogs) + command handlers, all grepped directly.

## Finding 1 — the dialog layer is under-censused on BOTH sides

| | OO dialogs | census captured | WO dialogs | census captured |
|---|---|---|---|---|
| Count | 38+ (35 titled + panels) | 12 unique | 41 (DIALOG_IDS) | **42 (T-001, 2026-10-28)** |

Consequences (as of T-001, 2026-10-28):
- **2 false L0s RETIRED**: `references.dlg-bookmarks` (WO `bookmark-dialog`),
  `plugins.plugin-manager` (WO `plugins-dialog`) — now L1 matched.
  **L0: 8 → 6.**
- Needed (in progress): dialog joins in `ledger/build.py` (done — WO dialogs
  folded into `wo_labels` + `wo_dialog_match`); field-level fidelity = L4
  concern deferred.

## Finding 2 — real OO dialogs with NO WO counterpart (verified 0-hit)

**List suite** (ties to converter ceilings):
- `ListSettingsDialog` — multilevel list type editor (WO only has
  nest/unnest item commands)
- `ListIndentsDialog` — list indent config
- `NumberingValueDialog` — set list start value (converter also doesn't
  emit `start` — full vertical gap)
- `EditListItemDialog` — edit list level text

**Advanced settings dialogs** (OO "show advanced settings"):
- `ParagraphSettingsAdvanced` — indents/spacing/line-break/borders tabs
- `TableSettingsAdvanced` — table borders/margins/positioning/repeat-header
- `ImageSettingsAdvanced` — size/position/wrapping/border/alt
  (WO has `image-dialog` insert + `image-alt-dialog` alt only)

**Table ops**:
- `CellsAddDialog` ("Insert several" rows/cols), `CellsRemoveDialog`
- `TableToTextDialog` / `TextToTableDialog` — convert commands absent
- `TableFormulaDialog` — formula in table cell (0 hits)

**Forms mode suite** (whole OO feature area absent):
- `FormSettings`, `FillingStatusSettings`, `RolesManagerDlg`,
  `RoleDeleteDlg`, `SaveFormDlg` ("Save as form"), `SendForSigningSettings`

**Misc**:
- `DateTimeDialog` — WO inserts current date (`btn-datetime`), no
  format/"update automatically" dialog
- `CaptionDialog` — partial: `insertCaption` command exists, no
  label/chapter-numbering config dialog
- `StyleTitleDialog` — rename style (styles panel exists, no rename)
- `CompareSettingsDialog` — WO has version compare view
  (`compareVersion`), no document-comparison settings
- Macros — OO has full macro dialog (Run/Debug/Copy/Rename/Delete +
  autostart); WO has honest event-marker stubs ("no macro engine exists
  yet", editor.js:5131)
- `SignatureSettings` (e-signatures) — 0 hits

## Finding 3 — keyboard shortcuts: zero census coverage

OO locale defines **317 shortcut descriptions**
(`Common.Controllers.Shortcuts.*`): headings, bullets, object moves, table
navigation, zoom, pane focus, print, save, etc. WO has ad-hoc keydown
handlers (Ctrl+B/F/S/P …) — never censused, never diffed.
Follow-up: extract OO's shortcut table (locale + `web-apps/common` key
maps) vs WO keydown handlers → shortcut gap list.

## Finding 4 — false-L0 audit of the current 8

| Ledger row | Verdict |
|---|---|
| `references.dlg-bookmarks` | **FALSE L0** — dialog exists |
| `plugins.plugin-manager` | **FALSE L0** — dialog exists |
| `insert.insert-spreadsheet` | REAL — no embedded-sheet object (object-dialog covers shape/textbox/textart/chart/smartart/equation) |
| `statusbar.btn-doc-spell` | REAL — spell engine live, no statusbar toggle |
| `file.home/layout/references/collaboration` | REAL (structural divergence decision pending) |

**Effective true L0: 6** (1 insert-spreadsheet + 1 spell toggle + 4
backstage sections) once the ledger joins dialogs.

## Pass 2 (deeper) — layers below the ribbon

Sources: `sdkjs/word/Editor/Shortcuts.js` (147 shortcut types),
`sdkjs/word/api.js` (283 `asc_*` engine methods), `web-apps` view/DocumentHolder(+Ext).js
(scenario context menus), `controller/Main.js` (`can*` capability flags),
`controller/RightMenu.js` (right-panel panes). WO verified by grep.

### P2.1 Keyboard shortcuts — the largest uncensused surface

OO defines **147 document shortcut types** (317 locale descriptions).
WO implements **~8 custom handlers**: Ctrl+F/H (find), Ctrl+S, Ctrl+Alt+0–3
(formatBlock), Ctrl+wheel zoom, Ctrl+Enter (comment confirm), Tab-in-list
indent — plus whatever the browser gives natively (B/I/U, Ctrl+Z/Y in
contentEditable).

Missing entirely (~135 types, notable): Insert page/column break
(Ctrl+Enter), non-breaking space/hyphen (Ctrl+Shift+Space/-), special-char
insert (©/®/™/€), bullet list (Ctrl+Shift+L), paragraph alignment
(Ctrl+L/E/R/J), font size +/- (Ctrl+Shift+>/<), sub/superscript (Ctrl+=,
Ctrl+Shift+=), format painter (Ctrl+Shift+C/V), insert page number, update
fields (F9), spellcheck (F7), object nudge/arrow moves, table navigation,
speech worker (dictation).

### P2.2 Scenario context menus — census walked only one scenario

Census ctx=65 covers the plain-text scenario. DocumentHolderExt defines
per-object menus; **zero-hit in WO**:
- chart suite: primary/secondary axes, axis titles, major/minor gridlines,
  data table, legend position, **error bars**, **trendlines** (linear /
  exponential / moving average / std-dev), up/down bars, data labels
- image crop: crop / crop-fill / crop-fit / reset
- shape: **edit points** (vertex editing), convert-to-shape, arrange
  (front/back/forward/backward), shape align (6), distribute rows/cols,
  edit wrap boundary, save-as-picture
- list ops: **start numbering from…** (context entry to NumberingValueDialog
  — confirms the full vertical gap), **join/separate list** (continue ✓)
- table cells: **insert several** ("Insert N rows/cols")
- field ops: edit ✓ toggle field codes ✓ — refresh/update-all ✗

### P2.3 Engine API surface (asc_*)

283 methods in `sdkjs/word/api.js`. Feature groups absent in WO:
- **content-control types**: OO = plain/rich **+ checkbox + date-picker +
  list + picture** via API; WO cc-dialog = plain/rich/dropdown marker spans
- **signatures**: addSignatureLine, SetSignatureProps, RemoveSignature(s),
  request signatures, goto — none
- **text direction** (`btnTextDir` toolbar, onTextDirection) — 0 hits WO
- **table styles gallery**: generateTableStylesPreviews — WO has no table
  style UI
- **document compare/merge** (CompareDocumentFile/Url, MergeDocumentFile)
  — WO `compareVersion` compares revisions, not documents
- footnote/endnote props + **ConvertFootnoteType** + goto — WO notes-dialog
  covers settings, not conversion
- mail merge: full cycle (preview, highlight fields, recipients request);
  WO has CSV recipients + merge preview (depth unverified)

### P2.4 Capability flags (platform scope, not editor gaps)

`can*` in Main.js: chat, suggest mode, live viewer, forms filling,
comment permissions, cross-document reference data, sharing settings,
favorites. These are collaborative-platform features (DS/portal level) —
flag as product-scope decisions, not parity bugs.

### P2.5 Right panel — upstream note

OO right menu registers paragraph/table/image/shape/textart panes; the
**chart and header-footer panes are commented out upstream** in this
version — do not chase them.

## Ranked follow-ups after pass 2

1. Shortcut cluster (biggest single surface; static-gateable per key).
2. List vertical: context ops (start-from/join/separate) + 4 dialogs +
   converter `start`/`ilvl` — one campaign closes UI+engine.
3. Context-menu scenario census ✅ DONE (2026-10-28, `census/census-ctx.json` +
   `census-ctx.cjs`; OO view/DocumentHolderExt.js 5 scenario menus / 302
   MenuItems → 166 captions vs WO #ctx-menu 75 data-ctx; ledger scores P2.2:
   **53 new L0** = 9 chart groups (C3) + object ops (arrange/crop/edit
   points/group-merge/rotate/save-as-picture/replace/wrap-tight-through-top-
   bottom-infront/shape-align×6/distribute) + table (insert-several,
   distribute rows/cols, delete-cell) + field (clear/update-all) + styles
   (create/update). Priority order for the object-ops cluster:
   arrange + crop are the most-used mouse surfaces of the 53.
4. Chart advanced suite (error bars, trendlines, axes/gridlines/data
   table) — 9 grouped L0 rows in the ledger (C3 epic). WO chart-dialog
   covers type+data only; OO right-panel + ctx both absent in WO.
5. cc types (checkbox/date-picker/list/picture), signatures, text
   direction, table styles — small standalone items.
6. Image crop + shape edit-points — canvas work, own tasks.


1. `census-wo-dialogs.cjs` + dialog join in `ledger/build.py` → retires 2
   false L0s, makes 41 WO dialogs measurable.
2. Shortcut census (`census-shortcuts.cjs`): read OO locale table, walk WO
   keydown → shortcut ledger cluster.
3. Campaign: List suite (4 dialogs + `start` value through converter —
   one vertical), Advanced settings trio, table convert/formula, forms
   mode (big — own epic), macro engine (own epic).
4. OO dialogs census refresh: walk ALL dialog entry points (incl. right
   panel "advanced" links + context menus), not only the 12 menu paths.
