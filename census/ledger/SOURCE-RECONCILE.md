
## Source reconciliation — 2026-11-08

OO source: **252.232.451.526** (web-apps bundle inside the reference image, extracted by
oo-refer-extract.cjs). Reference fields: 39 toolbar buttons,
45 static toolbar-source ids, 78 template
slots, 10 right-panel sections, 25
toolbar shortcut actions.

### (a) Census blind spots — OO toolbar controls the runtime walk never captured (17)

These are real OO ribbon controls for which NO census row exists, so the parity
contract set never asks WO about them. Each becomes a candidate contract row or a
deliberately-recorded known gap.
- `id-toolbar-btn-borders`
- `id-toolbar-btn-case`
- `id-toolbar-btn-colorschemas`
- `id-toolbar-btn-direction`
- `id-toolbar-btn-fontcolor`
- `id-toolbar-btn-hidenchars`
- `id-toolbar-btn-highlight`
- `id-toolbar-btn-linespace`
- `id-toolbar-btn-markers`
- `id-toolbar-btn-multilevels`
- `id-toolbar-btn-numbering`
- `id-toolbar-btn-paracolor`
- `id-toolbar-btn-print`
- `id-toolbar-btn-redo`
- `id-toolbar-btn-save`
- `id-toolbar-btn-text-from-file`
- `id-toolbar-btn-undo`

### (b) Stale/corrupt census captures (0)

Captured ids with no source counterpart (after normalizing runtime/dynamic ids).
Likely renamed or mis-parsed at capture time.
- none

### (c) Right-panel section delta — OO 10 vs WO 5

WO right panel (#right-panel rail): paragraph, table, image, chart, mailmerge.
OO source sections WO has NO right-panel counterpart:
- `shape`
- `mail-merge`
- `textart`
- `signature`
- `form`
- `send-for-signing`
- `filling-status`
(WO may route these to dedicated dialogs — verify each is otherwise contracted.)

---

## Source reconciliation — 2026-11-08

OO source: **252.232.451.526** (web-apps bundle inside the reference image, extracted by
oo-refer-extract.cjs). Reference fields: 39 toolbar buttons,
45 static toolbar-source ids, 78 template
slots, 10 right-panel sections, 25
toolbar shortcut actions.

### (a) Census blind spots — OO toolbar controls the runtime walk never captured (17)

These are real OO ribbon controls for which NO census row exists, so the parity
contract set never asks WO about them. Each becomes a candidate contract row or a
deliberately-recorded known gap. ("icon-only" = the census captured it under a
dropdown/menu component with a null id + icon class, i.e. partially captured.)
- `id-toolbar-btn-borders`
- `id-toolbar-btn-case` — icon-only capture: btn-change-case
- `id-toolbar-btn-colorschemas` — icon-only capture: btn-big-colorschemas
- `id-toolbar-btn-direction`
- `id-toolbar-btn-fontcolor` — icon-only capture: btn-fontcolor
- `id-toolbar-btn-hidenchars`
- `id-toolbar-btn-highlight` — icon-only capture: btn-highlight
- `id-toolbar-btn-linespace` — icon-only capture: btn-linespace
- `id-toolbar-btn-markers` — icon-only capture: btn-setmarkers
- `id-toolbar-btn-multilevels` — icon-only capture: btn-multilevels
- `id-toolbar-btn-numbering` — icon-only capture: btn-numbering, btn-line-numbering
- `id-toolbar-btn-paracolor` — icon-only capture: btn-paracolor
- `id-toolbar-btn-print`
- `id-toolbar-btn-redo`
- `id-toolbar-btn-save`
- `id-toolbar-btn-text-from-file` — icon-only capture: btn-text-from-file
- `id-toolbar-btn-undo`
### (b) Stale/corrupt census captures (0)

Captured ids with no source counterpart (after normalizing runtime/dynamic ids).
Likely renamed or mis-parsed at capture time.
- none

### (c) Right-panel section delta — OO 10 vs WO 5

WO right panel (#right-panel rail): paragraph, table, image, chart, mailmerge.
OO source sections WO has NO right-panel counterpart:
- `shape`
- `textart`
- `signature`
- `form`
- `send-for-signing`
- `filling-status`
(WO may route these to dedicated dialogs — verify each is otherwise contracted.)

---
### OO default shortcuts vs WO coverage (undefined) — 142 actions

Ground truth: oo-shortcuts.json (142 actions, dumped from the live editor SDK at 2026-11-08).
Name-joined to `shortcut.*` contracts: **98**; concept-mapped: **44**; **NO WO coverage: 0**.

#### No-coverage OO default shortcuts (real gap candidates)
- none

#### Concept-mapped (WO covers via other tokens)

- `openfinddialog` [Ctrl+F] -> ctrl+f, btn-find
- `openfindandreplacemenu` [Ctrl+H] -> ctrl+h — replace
- `openchatpanel` [Alt+Q] -> togglechat — chat sidebar (WO toggle), OO Alt+Q
- `save` [Ctrl+S] -> save, ctrl+s
- `closemenu` [Ctrl+Esc] -> escape — close menu/dialog
- `zoom100` [Ctrl+0] -> ctrl+0, btn-zoom-reset
- `zoomin` [Ctrl+= | Ctrl+k] -> ctrl+plus/=, btn-zoom-in — OO Ctrl+= / Ctrl+NumPlus
- `zoomout` [Ctrl+-] -> ctrl+minus, btn-zoom-out — OO Ctrl+- ; matches WO Control+Minus=zoomOut (L2O-06 canon)
- `insertcolumnbreak` [Ctrl+Shift+Enter] -> ctrl+shift+enter, breaks — column break
- `deleteleftchar` [Backspace] -> backspace
- `deleterightchar` [Delete] -> delete
- `deleteleftword` [Ctrl+Backspace] -> (skip family) — caret/word deletion — permanent-skip family (WO nav parity backlog) [SKIP]
- `deleterightword` [Ctrl+Delete] -> (skip family) — caret/word deletion — permanent-skip family [SKIP]
- `nonbreakingspace` [Ctrl+Shift+ ] -> ctrl+shift+space
- `nonbreakinghyphen` [Ctrl+Shift+-] -> ctrl+shift+minus
- `editundo` [Ctrl+Z] -> ctrl+z
- `pastetextwithoutformat` [Ctrl+Shift+V] -> ctrl+shift+v
- `inserthyperlink` [Ctrl+K] -> ctrl+k, link
- `editselectall` [Ctrl+A] -> selectall, ctrl+a
- `bold` [Ctrl+B] -> bold, ctrl+b — WO bold contract
- `italic` [Ctrl+I] -> italic, ctrl+i — WO italic contract
- `underline` [Ctrl+U] -> underline, ctrl+u — WO underline contract
- `subscript` [Ctrl+.] -> subscript, ctrl+, — OO Ctrl+, vs WO ctrl+, (same)
- `superscript` [Ctrl+,] -> superscript — OO Ctrl+. vs WO (script tools)
- `applyheading1` [Alt+1] -> applyheading1 — Alt+1
- `applyheading2` [Alt+2] -> applyheading2 — Alt+2
- `applyheading3` [Alt+3] -> applyheading3 — Alt+3
- `increasefontsize` [Ctrl+]] -> ctrl+]
- `decreasefontsize` [Ctrl+[] -> ctrl+[
- `centerpara` [Ctrl+E] -> justifycenter, ctrl+e — center align
- `justifypara` [Ctrl+J] -> justifyfull, ctrl+j — justify
- `rightpara` [Ctrl+R] -> justifyright, ctrl+r — right align
- `leftpara` [Ctrl+L] -> justifyleft, ctrl+l — left align
- `insertpagebreak` [Ctrl+Enter] -> ctrl+enter, breaks — page break
- `indent` [Ctrl+M] -> ctrl+m, indent
- `unindent` [Ctrl+Shift+M] -> ctrl+shift+m, outdent
- `insertendnotenow` [Ctrl+Alt+D] -> ctrl+alt+d, insertfootnote — endnote
- `insertfootnotenow` [Ctrl+Alt+F] -> ctrl+alt+f, insertfootnote
- `insertequation` [Alt+=] -> ctrl+alt+=, btn-equation, equation-dialog — OO default Alt+= ; WO: macro/equation dialog [SKIP]
- `copyrightsign` [Ctrl+Alt+G] -> ctrl+alt+g — insert symbol ©
- `eurosign` [Ctrl+Alt+E] -> ctrl+alt+e — insert symbol €
- `registeredsign` [Ctrl+Alt+R] -> ctrl+alt+r — insert symbol ®
- `trademarksign` [Ctrl+Alt+T] -> ctrl+alt+t — insert symbol ™
- `horizontalellipsis` [Ctrl+Alt+.] -> symbol-dialog — insert … via symbol dialog [SKIP]

---
<!-- oo-shortcuts -->
### OO default shortcuts vs WO coverage (undefined) — 142 actions

Ground truth: oo-shortcuts.json (142 actions, dumped from the live editor SDK at 2026-11-08).
Name-joined to `shortcut.*` contracts: **111**; concept-mapped: **31**; **NO WO coverage: 0**.

#### No-coverage OO default shortcuts (real gap candidates)
- none

#### Concept-mapped (WO covers via other tokens)

- `openfinddialog` [Ctrl+F] -> ctrl+f, btn-find
- `openfindandreplacemenu` [Ctrl+H] -> ctrl+h — replace
- `openchatpanel` [Alt+Q] -> togglechat — chat sidebar (WO toggle), OO Alt+Q
- `save` [Ctrl+S] -> save, ctrl+s
- `closemenu` [Ctrl+Esc] -> escape — close menu/dialog
- `zoom100` [Ctrl+0] -> ctrl+0, btn-zoom-reset
- `zoomin` [Ctrl+= | Ctrl+Np+] -> ctrl+plus/=, btn-zoom-in — OO Ctrl+= / Ctrl+NumPlus
- `zoomout` [Ctrl+-] -> ctrl+minus, btn-zoom-out — OO Ctrl+- ; matches WO Control+Minus=zoomOut (L2O-06 canon)
- `insertcolumnbreak` [Ctrl+Shift+Enter] -> ctrl+shift+enter, breaks — column break
- `deleteleftchar` [Backspace] -> backspace
- `deleterightchar` [Delete] -> delete
- `deleteleftword` [Ctrl+Backspace] -> (skip family) — caret/word deletion — permanent-skip family (WO nav parity backlog) [SKIP]
- `deleterightword` [Ctrl+Delete] -> (skip family) — caret/word deletion — permanent-skip family [SKIP]
- `nonbreakinghyphen` [Ctrl+Shift+-] -> ctrl+shift+minus
- `editundo` [Ctrl+Z] -> ctrl+z
- `inserthyperlink` [Ctrl+K] -> ctrl+k, link
- `editselectall` [Ctrl+A] -> selectall, ctrl+a
- `subscript` [Ctrl+.] -> subscript, ctrl+, — OO Ctrl+, vs WO ctrl+, (same)
- `superscript` [Ctrl+,] -> superscript — OO Ctrl+. vs WO (script tools)
- `increasefontsize` [Ctrl+]] -> ctrl+]
- `decreasefontsize` [Ctrl+[] -> ctrl+[
- `centerpara` [Ctrl+E] -> justifycenter, ctrl+e — center align
- `justifypara` [Ctrl+J] -> justifyfull, ctrl+j — justify
- `rightpara` [Ctrl+R] -> justifyright, ctrl+r — right align
- `leftpara` [Ctrl+L] -> justifyleft, ctrl+l — left align
- `indent` [Ctrl+M] -> ctrl+m, indent
- `unindent` [Ctrl+Shift+M] -> ctrl+shift+m, outdent
- `insertendnotenow` [Ctrl+Alt+D] -> ctrl+alt+d, insertfootnote — endnote
- `insertfootnotenow` [Ctrl+Alt+F] -> ctrl+alt+f, insertfootnote
- `insertequation` [Alt+=] -> ctrl+alt+=, btn-equation — OO default Alt+= ; WO: macro/equation dialog [SKIP]
- `horizontalellipsis` [Ctrl+Alt+.] -> symbol-dialog — insert … via symbol dialog [SKIP]
<!-- /oo-shortcuts -->
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
---
<!-- oo-dialogs -->
### OO source dialogs vs WO coverage (36 dialogs, 2026-11-09)

OO dialog inventory: **36** components from view/*Dialog.js|*Dlg.js. Direct token hits: **30**; declared-divergence (WO covers via other token): **6**; unmapped: **0**.


| OO dialog | file | verdict | WO token |
|---|---|---|---|
| BookmarksDialog | BookmarksDialog.js | covered | bookmark-dialog |
| CaptionDialog | CaptionDialog.js | covered | insertcaption |
| CellsAddDialog | CellsAddDialog.js | covered | table-dialog |
| ControlSettingsDialog | ControlSettingsDialog.js | covered | table-dialog |
| CrossReferenceDialog | CrossReferenceDialog.js | covered | crossref-dialog |
| CustomColumnsDialog | CustomColumnsDialog.js | covered | columns-dialog |
| DateTimeDialog | DateTimeDialog.js | covered | btn-datetime |
| DropcapSettingsAdvanced | DropcapSettingsAdvanced.js | covered | dialog.dropcap-dialog.l4 |
| EditListItemDialog | EditListItemDialog.js | diverged | WO covers via surface not tokenized as a dialog — expected: list-indents |
| HyperlinkSettingsDialog | HyperlinkSettingsDialog.js | covered | link-dialog |
| HyphenationDialog | HyphenationDialog.js | covered | hyphenation-dialog |
| ImageSettingsAdvanced | ImageSettingsAdvanced.js | covered | dialog.image-dialog.l4 |
| LineNumbersDialog | LineNumbersDialog.js | covered | dialog.linenumbers-dialog.l4, togglelinenumbers |
| ListIndentsDialog | ListIndentsDialog.js | diverged | WO covers via surface not tokenized as a dialog — expected: list-indents |
| ListSettingsDialog | ListSettingsDialog.js | covered | multilevel |
| ListTypesAdvanced | ListTypesAdvanced.js | covered | multilevel |
| MailMergeEmailDlg | MailMergeEmailDlg.js | covered | mailmerge |
| NoteSettingsDialog | NoteSettingsDialog.js | covered | insertfootnote |
| NotesRemoveDialog | NotesRemoveDialog.js | covered | insertfootnote |
| NumberingValueDialog | NumberingValueDialog.js | diverged | WO covers via surface not tokenized as a dialog — expected: setNumberingValue |
| PageMarginsDialog | PageMarginsDialog.js | covered | margins |
| PageNumberingDlg | PageNumberingDlg.js | covered | dialog.pagenumber-dialog.l4 |
| PageSizeDialog | PageSizeDialog.js | covered | size |
| ParagraphSettingsAdvanced | ParagraphSettingsAdvanced.js | covered | dialog.paragraph-settings-dialog.l4 |
| ProtectDialog | ProtectDialog.js | covered | protectdialog, restrictediting |
| RoleDeleteDlg | RoleDeleteDlg.js | covered | protectdialog |
| RoleEditDlg | RoleEditDlg.js | covered | protectdialog |
| RolesManagerDlg | RolesManagerDlg.js | covered | protectdialog |
| SaveFormDlg | SaveFormDlg.js | diverged | WO covers via surface not tokenized as a dialog — expected: saveform |
| StyleTitleDialog | StyleTitleDialog.js | diverged | WO covers via surface not tokenized as a dialog — expected: style |
| TableFormulaDialog | TableFormulaDialog.js | diverged | WO covers via surface not tokenized as a dialog — expected: table-formula |
| TableOfContentsSettings | TableOfContentsSettings.js | covered | toc-dialog |
| TableSettingsAdvanced | TableSettingsAdvanced.js | covered | table-dialog |
| TableToTextDialog | TableToTextDialog.js | covered | dialog.text-to-table-dialog.l4 |
| TextToTableDialog | TextToTableDialog.js | covered | dialog.text-to-table-dialog.l4 |
| WatermarkSettingsDialog | WatermarkSettingsDialog.js | covered | dialog.watermark-dialog.l4 |

<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---
<!-- /oo-dialogs -->
---<!-- oo-filemenu -->
## OO File menu vs WO backstage (19 buttons, 10 panels)

OO File rail buttons: direct WO row hits **16**, declared divergences **3**, unmapped **0**. Panels: hits **10**, diverged **0**, unmapped **0**.


| OO button | verdict | WO surface |
|---|---|---|
| fm-btn-return | covered | backstage.overlay |
| fm-btn-create | covered | backstage.pane-new |
| fm-btn-recent | covered | backstage.pane-open |
| fm-btn-save | covered | backstage.pane-save |
| fm-btn-edit | diverged | DIVERGE: edit = return-to-document focus; WO overlay close button serves it |
| fm-btn-download | covered | backstage.pane-export |
| fm-btn-save-copy | covered | backstage.pane-save |
| fm-btn-save-desktop | diverged | DIVERGE: desktop-save is a host-mode action; WO console editor keeps document on server |
| fm-btn-print | covered | backstage.pane-print |
| fm-btn-print-with-preview | covered | backstage.pane-print |
| fm-btn-rename | diverged | DIVERGE: rename is host-file-op (wo:file-rename channel), not a backstage row |
| fm-btn-protect | covered | backstage.pane-protect |
| fm-btn-info | covered | backstage.pane-info |
| fm-btn-history | covered | backstage.pane-history |
| fm-btn-rights | covered | backstage.pane-protect |
| fm-btn-back | covered | backstage.overlay |
| fm-btn-settings | covered | backstage.pane-settings |
| fm-btn-help | covered | backstage.pane-help |
| fm-btn-suggest | covered | backstage.pane-suggest |

| OO panel | verdict | WO surface |
|---|---|---|
| panel-saveas | covered | backstage.pane-save |
| panel-savecopy | covered | backstage.pane-save |
| panel-recentfiles | covered | backstage.pane-open |
| panel-createnew | covered | backstage.pane-new |
| panel-info | covered | backstage.pane-info |
| panel-rights | covered | backstage.pane-protect |
| panel-settings | covered | backstage.pane-settings |
| panel-help | covered | backstage.pane-help |
| panel-protect | covered | backstage.pane-protect |
| panel-print | covered | backstage.pane-print |

<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- /oo-filemenu -->
<!-- oo-statusbar -->
## OO status bar vs WO tokens (17 OO controls)

Direct WO token hits **9**; declared divergences **8**; unmapped **0**.


| OO control | verdict | WO surface |
|---|---|---|
| label-pages | diverged |  WO sb-page-count id in statusbar DOM, not contract-tokenized |
| status-goto-box | diverged |  Go-to-page input; WO covers via Find (btn-find) + page navigation |
| status-goto-page | diverged |  Go-to-page input; WO covers via Find (btn-find) + page navigation |
| slot-status-btn-info | diverged |  info slide-in = WO backstage pane-info |
| label-action | diverged |  OO transient action/status text; WO shows status in overlay toasts |
| btn-cnt-lang | covered | sb-lang |
| btn-doc-lang | covered | sb-lang |
| btn-doc-spell | covered | sb-doc-spell |
| btn-doc-review | covered | sb-track-changes |
| status-btn-select-tool | diverged |  native selection indicator; no WO control (browser native) |
| status-btn-hand-tool | diverged |  hand/pan tool; WO pans with scroll + selection cursor |
| status-btn-multiple-pages | covered | btn-multipage |
| btn-zoom-topage | covered | btn-zoom-fit |
| btn-zoom-towidth | covered | btn-zoom-fit |
| btn-zoom-down | covered | btn-zoom-out |
| label-zoom | diverged |  WO sb-zoom-label id in statusbar DOM, not contract-tokenized |
| btn-zoom-up | covered | btn-zoom-in |

<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->
<!-- /oo-statusbar -->

## Source reconciliation — 2026-11-12

OO source: **252.232.451.526** (web-apps bundle inside the reference image, extracted by
oo-refer-extract.cjs). Reference fields: 39 toolbar buttons,
45 static toolbar-source ids, 78 template
slots, 10 right-panel sections, 25
toolbar shortcut actions.

### (a) Census blind spots — OO toolbar controls the runtime walk never captured (0)

These are real OO ribbon controls for which NO census row exists, so the parity
contract set never asks WO about them. Each becomes a candidate contract row or a
deliberately-recorded known gap. ("icon-only" = the census captured it under a
dropdown/menu component with a null id + icon class, i.e. partially captured.)
- none
### (b) Stale/corrupt census captures (0)

Captured ids with no source counterpart (after normalizing runtime/dynamic ids).
Likely renamed or mis-parsed at capture time.
- none

### (c) Right-panel section delta — OO 10 vs WO 5

WO right panel (#right-panel rail): paragraph, table, image, chart, mailmerge.
OO source sections WO has NO right-panel counterpart:
- none
(WO may route these to dedicated dialogs — verify each is otherwise contracted.)

---

## Source reconciliation — 2026-11-12

OO source: **252.232.451.526** (web-apps bundle inside the reference image, extracted by
oo-refer-extract.cjs). Reference fields: 39 toolbar buttons,
45 static toolbar-source ids, 78 template
slots, 10 right-panel sections, 25
toolbar shortcut actions.

### (a) Census blind spots — OO toolbar controls the runtime walk never captured (0)

These are real OO ribbon controls for which NO census row exists, so the parity
contract set never asks WO about them. Each becomes a candidate contract row or a
deliberately-recorded known gap. ("icon-only" = the census captured it under a
dropdown/menu component with a null id + icon class, i.e. partially captured.)
- none
### (b) Stale/corrupt census captures (0)

Captured ids with no source counterpart (after normalizing runtime/dynamic ids).
Likely renamed or mis-parsed at capture time.
- none

### (c) Right-panel section delta — OO 10 vs WO 5

WO right panel (#right-panel rail): paragraph, table, image, chart, mailmerge.
OO source sections WO has NO right-panel counterpart:
- none
(WO may route these to dedicated dialogs — verify each is otherwise contracted.)

---
