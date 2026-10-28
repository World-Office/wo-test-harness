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
| Count | 38+ (35 titled + panels) | 12 unique | 41 (DIALOG_IDS) | **0** |

Consequences:
- **2 false L0s**: `references.dlg-bookmarks` (WO `bookmark-dialog` +
  `openBookmarkDialog()` exist), `plugins.plugin-manager` (WO `plugins-dialog`
  is a real plugin browser/manager: `/api/plugins` catalog + per-plugin
  enable persisted per user). The ledger can't see dialogs it never censused.
- Needed: `census-wo-dialogs.cjs` (mirror of oo-dialogs against WO) +
  dialog joins in `ledger/build.py`.

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

## Recommended next steps (ordered)

1. `census-wo-dialogs.cjs` + dialog join in `ledger/build.py` → retires 2
   false L0s, makes 41 WO dialogs measurable.
2. Shortcut census (`census-shortcuts.cjs`): read OO locale table, walk WO
   keydown → shortcut ledger cluster.
3. Campaign: List suite (4 dialogs + `start` value through converter —
   one vertical), Advanced settings trio, table convert/formula, forms
   mode (big — own epic), macro engine (own epic).
4. OO dialogs census refresh: walk ALL dialog entry points (incl. right
   panel "advanced" links + context menus), not only the 12 menu paths.
