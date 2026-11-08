
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
