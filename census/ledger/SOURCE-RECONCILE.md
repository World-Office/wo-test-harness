
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
- `zoomin` [Ctrl+= | Ctrl+Np+] -> ctrl+plus/=, btn-zoom-in — OO Ctrl+= / Ctrl+NumPlus
- `zoomout` [Ctrl+-] -> ctrl+minus, btn-zoom-out — OO Ctrl+- ; matches WO Control+Minus=zoomOut (L2O-06 canon)
- `insertcolumnbreak` [Ctrl+Shift+Enter] -> ctrl+shift+enter, breaks — column break
- `deleteleftchar` [Backspace] -> backspace
- `deleterightchar` [Delete] -> delete
- `deleteleftword` [Ctrl+Backspace] -> (skip family) — caret/word deletion — permanent-skip family (WO nav parity backlog) [SKIP]
- `deleterightword` [Ctrl+Delete] -> (skip family) — caret/word deletion — permanent-skip family [SKIP]
- `nonbreakingspace` [Ctrl+Shift+Space] -> ctrl+shift+space
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
<!-- /oo-shortcuts -->
---
