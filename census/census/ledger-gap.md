# Parity gap report (AI advisory)

generated: 2026-10-31T18:11:36+00:00 · model: local/deepseek-v4-flash/local
sources: ledger.json + interact-ledger.json + MAP deferrals · 59 rows
ADVISORY: promotion into MAP/register is a human act. Nothing here edits a gate.


## Priority 1

### content-controls — missing-feature (- tab, map-deferred)
- context: deferred · declared in census-diff.py MAP
- value high · effort XL
- spec: Implement content controls (SDT) in the wasm renderer/editor core: parse w:sdt/w:sdtPr/w:sdtContent on docx import, render controls in the React editor, and add wo-command(s) to insert/edit/remove them.
- first step: Open the docx import parser and add w:sdt handling.


## Priority 3

### allow-edit-ranges — missing-feature (- tab, map-deferred)
- context: deferred · declared in census-diff.py MAP
- value medium · effort L
- spec: Add range-level protection to the editor core: parse w:permStart/w:permEnd/w:editRange in docx, enforce read-only outside allowed ranges, and expose a wo-command to manage ranges.
- first step: Open the current protection implementation and add w:permStart/w:permEnd parsing.


## Priority 4

### table — census-artifact (insert tab, interact)
- context: unmatched · wo=btn-table not in interact census
- value low · effort S
- spec: No editor change; add wo=btn-table to the interact census for insert/table so the existing button is visible to parity triage.
- first step: Fix census row: token=table, wo_id=btn-table.

### image — census-artifact (insert tab, interact)
- context: unmatched · wo=btn-image not in interact census
- value low · effort S
- spec: No editor change; add wo=btn-image to the interact census for insert/image.
- first step: Fix census row: token=image, wo_id=btn-image.

### shape — census-artifact (insert tab, interact)
- context: unmatched · wo=insertObject not in interact census
- value low · effort S
- spec: No editor change; add wo=insertObject to the interact census for insert/shape.
- first step: Fix census row: token=shape, wo_id=insertObject.

### smartart — census-artifact (insert tab, interact)
- context: unmatched · wo=btn-smartart not in interact census
- value low · effort S
- spec: No editor change; add wo=btn-smartart to the interact census for insert/smartart.
- first step: Fix census row: token=smartart, wo_id=btn-smartart.

### chart — census-artifact (insert tab, interact)
- context: unmatched · wo=insertObject not in interact census
- value low · effort S
- spec: No editor change; add wo=insertObject to the interact census for insert/chart.
- first step: Fix census row: token=chart, wo_id=insertObject.

### link — census-artifact (insert tab, interact)
- context: unmatched · wo=btn-link not in interact census
- value low · effort S
- spec: No editor change; add wo=btn-link to the interact census for insert/link.
- first step: Fix census row: token=link, wo_id=btn-link.

### header-footer — census-artifact (insert tab, interact)
- context: unmatched · wo=btn-header not in interact census
- value low · effort S
- spec: No editor change; add wo=btn-header to the interact census for insert/header-footer.
- first step: Fix census row: token=header-footer, wo_id=btn-header.

### pagenumber — census-artifact (insert tab, interact)
- context: unmatched · wo=btn-pagenumber not in interact census
- value low · effort S
- spec: No editor change; add wo=btn-pagenumber to the interact census for insert/pagenumber.
- first step: Fix census row: token=pagenumber, wo_id=btn-pagenumber.

### textbox — census-artifact (insert tab, interact)
- context: unmatched · wo=insertObject not in interact census
- value low · effort S
- spec: No editor change; add wo=insertObject to the interact census for insert/textbox.
- first step: Fix census row: token=textbox, wo_id=insertObject.

### textart — census-artifact (insert tab, interact)
- context: unmatched · wo=insertObject not in interact census
- value low · effort S
- spec: No editor change; add wo=insertObject to the interact census for insert/textart.
- first step: Fix census row: token=textart, wo_id=insertObject.

### linenumbers — census-artifact (layout tab, interact)
- context: unmatched · wo=toggleLineNumbers not in interact census
- value low · effort S
- spec: No editor change. Add the existing toggleLineNumbers command to the interaction census for linenumbers so it is no longer unmatched.
- first step: Add census row: token=linenumbers, wo_cmd=toggleLineNumbers.

### hyphenation — census-artifact (layout tab, interact)
- context: unmatched · wo=toggleHyphenation not in interact census
- value low · effort S
- spec: No editor change. Add the existing toggleHyphenation command to the interaction census for hyphenation so it is no longer unmatched.
- first step: Add census row: token=hyphenation, wo_cmd=toggleHyphenation.

### watermark — census-artifact (layout tab, interact)
- context: unmatched · wo=toggleWatermark not in interact census
- value low · effort S
- spec: No editor change. Add the existing toggleWatermark command to the interaction census for watermark so it is no longer unmatched.
- first step: Add census row: token=watermark, wo_cmd=toggleWatermark.

### pagecolor — census-artifact (layout tab, interact)
- context: unmatched · wo=pagecolor not in interact census
- value low · effort S
- spec: No editor change. Add the existing pagecolor command to the interaction census for pagecolor so it is no longer unmatched.
- first step: Add census row: token=pagecolor, wo_cmd=pagecolor.

### colors — census-artifact (layout tab, interact)
- context: unmatched · wo=themecolors not in interact census
- value low · effort S
- spec: No editor change. Add the existing themecolors command to the interaction census for colors so it is no longer unmatched.
- first step: Add census row: token=colors, wo_cmd=themecolors.

### table-ofcontents — census-artifact (references tab, interact)
- context: unmatched · wo=btn-toc not in interact census
- value low · effort S
- spec: No editor change. Add the existing btn-toc command to the interaction census for table-ofcontents so it is no longer unmatched.
- first step: Add census row: token=table-ofcontents, wo_cmd=btn-toc.

### add-text — census-artifact (references tab, interact)
- context: unmatched · wo=btn-addtext not in interact census
- value low · effort S
- spec: No editor change. Add the existing btn-addtext command to the interaction census for add-text so it is no longer unmatched.
- first step: Add census row: token=add-text, wo_cmd=btn-addtext.

### update-table — census-artifact (references tab, interact)
- context: unmatched · wo=updateToc not in interact census
- value low · effort S
- spec: No editor change. Add the existing updateToc command to the interaction census for update-table so it is no longer unmatched.
- first step: Add census row: token=update-table, wo_cmd=updateToc.

### footnote — census-artifact (references tab, interact)
- context: unmatched · wo=btn-footnote not in interact census
- value low · effort S
- spec: No editor change. Add the existing btn-footnote command to the interaction census for footnote so it is no longer unmatched.
- first step: Add census row: token=footnote, wo_cmd=btn-footnote.

### asc-gen885 — census-artifact (references tab, interact)
- context: unmatched · wo=btn-bookmark not in interact census
- value low · effort S
- spec: No editor change. Add the existing btn-bookmark command to the interaction census for asc-gen885 so it is no longer unmatched.
- first step: Add census row: token=asc-gen885, wo_cmd=btn-bookmark.

### asc-gen887 — census-artifact (references tab, interact)
- context: unmatched · wo=btn-field not in interact census
- value low · effort S
- spec: No editor change; add the existing wo=btn-field button to the interaction census for this token so the Caption modal is paired correctly.
- first step: Add asc-gen887 -> btn-field to the interaction census.

### asc-gen889 — census-artifact (references tab, interact)
- context: unmatched · wo=btn-field not in interact census
- value low · effort S
- spec: No editor change; add the existing wo=btn-field button to the interaction census for Cross-reference.
- first step: Add asc-gen889 -> btn-field to the interaction census.

### asc-gen891 — census-artifact (references tab, interact)
- context: unmatched · wo=openCrossref not in interact census
- value low · effort S
- spec: No editor change; add the existing wo=openCrossref button to the interaction census for Table of Figures.
- first step: Add asc-gen891 -> openCrossref to the interaction census.

### trackchanges — census-artifact (collaboration tab, interact)
- context: unmatched · wo=btn-track-changes not in interact census
- value low · effort S
- spec: No editor change; add the existing wo=btn-track-changes button to the interaction census for TrackChanges.
- first step: Add trackchanges -> btn-track-changes to the interaction census.

### displaymode — census-artifact (collaboration tab, interact)
- context: unmatched · wo=displayMode not in interact census
- value low · effort S
- spec: No editor change; add the existing wo=displayMode button to the interaction census for DisplayMode.
- first step: Add displaymode -> displayMode to the interaction census.

### compare — census-artifact (collaboration tab, interact)
- context: unmatched · wo=compareVersion not in interact census
- value low · effort S
- spec: No editor change; add the existing wo=compareVersion button to the interaction census for Compare.
- first step: Add compare -> compareVersion to the interaction census.

### combine — census-artifact (collaboration tab, interact)
- context: unmatched · wo=compareVersion not in interact census
- value low · effort S
- spec: No editor change; add the existing wo=compareVersion button to the interaction census for Combine.
- first step: Add combine -> compareVersion to the interaction census.

### mailmerge — census-artifact (collaboration tab, interact)
- context: unmatched · wo=btn-mailmerge not in interact census
- value low · effort S
- spec: No editor change; add the existing wo=btn-mailmerge button to the interaction census for MailMerge.
- first step: Add mailmerge -> btn-mailmerge to the interaction census.

### backgroundplugins — census-artifact (plugins tab, interact)
- context: unmatched · wo=btn-bgplugins not in interact census
- value low · effort S
- spec: No editor change; add the existing wo=btn-bgplugins button to the interaction census for Backgroundplugins.
- first step: Add backgroundplugins -> btn-bgplugins to the interaction census.

### photoeditor — census-artifact (plugins tab, interact)
- context: unmatched · wo=photoEditor not in interact census
- value low · effort S
- spec: No editor change; add the existing wo=photoEditor button to the interaction census for PhotoEditor.
- first step: Add photoeditor -> photoEditor to the interaction census.

### ocr — census-artifact (plugins tab, interact)
- context: unmatched · wo=btn-ocr not in interact census
- value low · effort S
- spec: Census-only fix: add wo=btn-ocr to the interact census mapping for token ocr; no editor/command/docserver change.
- first step: Add wo=btn-ocr to the interact census row for token ocr.

### speech — census-artifact (plugins tab, interact)
- context: unmatched · wo=btn-readaloud not in interact census
- value low · effort S
- spec: Census-only fix: add wo=btn-readaloud to the interact census mapping for token speech; no editor/command/docserver change.
- first step: Add wo=btn-readaloud to the interact census row for token speech.

### speechinput — census-artifact (plugins tab, interact)
- context: unmatched · wo=btn-dictate not in interact census
- value low · effort S
- spec: Census-only fix: add wo=btn-dictate to the interact census mapping for token speechinput; no editor/command/docserver change.
- first step: Add wo=btn-dictate to the interact census row for token speechinput.

### asc-gen4608 — census-artifact (ai tab, interact)
- context: unmatched · wo=btn-ai-assistant not in interact census
- value low · effort S
- spec: Census-only fix: add wo=btn-ai-assistant to the interact census mapping for token asc-gen4608; no editor/command/docserver change.
- first step: Add wo=btn-ai-assistant to the interact census row for token asc-gen4608.

### asc-gen4610 — census-artifact (ai tab, interact)
- context: unmatched · wo=btn-ai-assistant not in interact census
- value low · effort S
- spec: Census-only fix: add wo=btn-ai-assistant to the interact census mapping for token asc-gen4610; no editor/command/docserver change.
- first step: Add wo=btn-ai-assistant to the interact census row for token asc-gen4610.

### asc-gen4612 — census-artifact (ai tab, interact)
- context: unmatched · wo=btn-ai-assistant not in interact census
- value low · effort S
- spec: Census-only fix: add wo=btn-ai-assistant to the interact census mapping for token asc-gen4612; no editor/command/docserver change.
- first step: Add wo=btn-ai-assistant to the interact census row for token asc-gen4612.

### translation — census-artifact (ai tab, interact)
- context: unmatched · wo=aiTranslate not in interact census
- value low · effort S
- spec: Census-only fix: add wo=aiTranslate to the interact census mapping for token translation; no editor/command/docserver change.
- first step: Add wo=aiTranslate to the interact census row for token translation.

### grammar-spelling — census-artifact (ai tab, interact)
- context: unmatched · wo=btn-ai-grammar not in interact census
- value low · effort S
- spec: Census-only fix: add wo=btn-ai-grammar to the interact census mapping for token grammar-spelling; no editor/command/docserver change.
- first step: Add wo=btn-ai-grammar to the interact census row for token grammar-spelling.

### asc-gen4628 — census-artifact (ai tab, interact)
- context: unmatched · wo=btn-ai-assistant not in interact census
- value low · effort S
- spec: Census-only fix: add wo=btn-ai-assistant to the interact census mapping for token asc-gen4628; no editor/command/docserver change.
- first step: Add wo=btn-ai-assistant to the interact census row for token asc-gen4628.

### asc-gen673 — census-artifact (header-footer tab, interact)
- context: unmatched · wo=btn-hf-close not in interact census
- value low · effort S
- spec: Census-only fix: add wo=btn-hf-close to the interact census mapping for token asc-gen673; no editor/command/docserver change.
- first step: Add wo=btn-hf-close to the interact census row for token asc-gen673.

### create — census-artifact (backstage tab, interact)
- context: unmatched · wo=btn-new not in interact census
- value low · effort S
- spec: Add btn-new to the interaction census as the WO counterpart for backstage Create New; no editor change.
- first step: Add btn-new to the interact census mapping for create.

### recent — census-artifact (backstage tab, interact)
- context: unmatched · wo=btn-open not in interact census
- value low · effort S
- spec: Add btn-open to the interaction census as the WO counterpart for backstage Open Recent; no editor change.
- first step: Add btn-open to the interact census mapping for recent.

### download — census-artifact (backstage tab, interact)
- context: unmatched · wo=btn-export not in interact census
- value low · effort S
- spec: Add btn-export to the interaction census as the WO counterpart for backstage Download As; no editor change.
- first step: Add btn-export to the interact census mapping for download.

### protect — census-artifact (backstage tab, interact)
- context: unmatched · wo=btn-fileprotect not in interact census
- value low · effort S
- spec: Add btn-fileprotect to the interaction census as the WO counterpart for backstage Protect; no editor change.
- first step: Add btn-fileprotect to the interact census mapping for protect.

### info — census-artifact (backstage tab, interact)
- context: unmatched · wo=btn-fileinfo not in interact census
- value low · effort S
- spec: Add btn-fileinfo to the interaction census as the WO counterpart for backstage Info; no editor change.
- first step: Add btn-fileinfo to the interact census mapping for info.

### settings — census-artifact (backstage tab, interact)
- context: unmatched · wo=btn-filesettings not in interact census
- value low · effort S
- spec: Add btn-filesettings to the interaction census as the WO counterpart for backstage Advanced Settings; no editor change.
- first step: Add btn-filesettings to the interact census mapping for settings.

### help — census-artifact (backstage tab, interact)
- context: unmatched · wo=btn-filehelp not in interact census
- value low · effort S
- spec: Add btn-filehelp to the interaction census as the WO counterpart for backstage Help; no editor change.
- first step: Add btn-filehelp to the interact census mapping for help.


## Priority 5

### dropcap — ? (insert tab, interact)
- context: unmatched · wo=toggleDropcap not in interact census
- value ? · effort ?

### text-fromfile — ? (insert tab, interact)
- context: unmatched · wo=btn-textfile not in interact census
- value ? · effort ?

### insertfield — ? (insert tab, interact)
- context: unmatched · wo=btn-field not in interact census
- value ? · effort ?

### equation — ? (insert tab, interact)
- context: unmatched · wo=btn-equation not in interact census
- value ? · effort ?

### symbol — ? (insert tab, interact)
- context: unmatched · wo=btn-symbol not in interact census
- value ? · effort ?

### contentcontrols — ? (insert tab, interact)
- context: unmatched · wo=btn-contentcontrol not in interact census
- value ? · effort ?

### margins — ? (layout tab, interact)
- context: unmatched · wo=btn-page-setup not in interact census
- value ? · effort ?

### orientation — ? (layout tab, interact)
- context: unmatched · wo=btn-page-setup not in interact census
- value ? · effort ?

### size — ? (layout tab, interact)
- context: unmatched · wo=btn-page-setup not in interact census
- value ? · effort ?

### columns — ? (layout tab, interact)
- context: unmatched · wo=btn-columns not in interact census
- value ? · effort ?
### page-color-none — missing-feature (layout tab, interact)
- context: missing · L0 ledger row page.none ([menu-item]); WO page-color dialog lacks the OO "no color" preset
- value medium · effort S
- spec: Extend the existing WO page-color control (editor.js pagecolor input + openPageColorDialog) with the OO "No Color" menu item: clicking it clears the page background override (remove the --paper style / set it to transparent) so the page renders with default white paper. Wire via a wo-command (lib/word-commands.ts) and expose the item in the page-color dialog.
- first step: In editor.js openPageColorDialog(), add a "no color" action that clears editor.style --paper and marks the doc dirty.
### page-color-automatic — missing-feature (layout tab, interact)
- context: missing · L0 ledger row page.automatic ([menu-item]); WO page-color dialog lacks the OO "Automatic" preset
- value medium · effort S
- spec: Extend the same page-color control with the OO "Automatic" menu item: clicking it resets the page background to the default (white/automatic — remove any explicit color) and keeps the page-color dialog in sync (show Automatic as the current value when --paper is unset). Wire via a wo-command and add the item to the page-color dialog.
- first step: In editor.js openPageColorDialog(), add an "automatic" action that clears --paper and reflects it in the color input.

## L0 project (Phase 5, 2026-11-01) — the remaining 18 L0 rows

### ctx-distribute-columns — OO table ctx "Distribute columns equally" (L0, real)
- value medium · effort M
- spec: OO table context menu offers "Distribute columns equally" (equalizes the widths of the selected columns, or all columns when the caret is in a table). WO's table ctx menu (index.html ~1525, data-showif="table" rows) has insert/delete/merge/split but no distribute. Add two ctx rows "Distribute columns" (data-ctx="DistributeColumns", data-showif="table") + "Distribute rows" (data-ctx="DistributeRows") and wire them in the ctx dispatch if/else (editor.js ~9197: `const action = btn.dataset.ctx`) to a real table layout op: compute the table's total width, divide equally across the columns, and write the widths through the exact column-width channel the editor already uses for column resizing (look for the colgroup/margin-left table-width machinery — colgroup appears around editor.js 5417/5433; the table ops that set column widths are the model). Animate nothing; apply instantly; captureHistory(); markDirty(); scheduleCollabSync(); notifyHost("editing"). No stubs: the operation must visibly equalize the column widths.
- first step: Open apps/web/apps/documenteditor-wysiwyg/index.html around line 1525 and add the two ctx rows next to TableMergeCells/TableSplitCell, then find the existing column-width-set path in editor.js (grep "colgroup" / column resize) and write an equalize function on top of it.

### ctx-distribute-rows — OO table ctx "Distribute rows equally" (L0, real)
- value medium · effort M
- spec: Same as ctx-distribute-columns but for ROW HEIGHTS: add ctx rows "Distribute rows" (data-ctx="DistributeRows", data-showif="table"), wire it in the ctx dispatch (editor.js ~9197) to equalize the heights of the selected rows / all rows in the table, writing through the existing row-height channel the editor uses (grep the row-height setter / cell height style the table machinery already applies). Apply instantly, captureHistory(); markDirty(); scheduleCollabSync(); notifyHost("editing").
- first step: find where the editor sets row heights (grep editor.js for height / row) and add an equalize-rows function beside ctx-distribute-columns; then add the ctx row + dispatch arm.

### ctx-distribute-horizontally — OO multi-object "Distribute horizontally" (L0, real)
- value medium · effort L
- spec: OO's Arrange > "Distribute horizontally" equalizes the horizontal gaps between >=2 selected drawing/floating objects. WO currently has single-object selection only (selectedObject() ~editor.js 3232); floating objects are divs with class .object / .obj-square / .obj-behind / .obj-right / .obj-center (OBJ_LAYOUT_CLASSES ~3246) carrying data-type (shape/textbox/chart/equation/textart/spreadsheet) or img elements. Implement: (1) Shift+click on a floating object adds/removes it from a selection set (visual cue via a selected class, e.g. .obj-selected) — keep single-click = clear+select; (2) an "Arrange" ctx submenu or directly "Distribute horizontally" ctx row (data-ctx="DistributeHorizontally", data-showif="object") that, with >=2 selected objects, computes their bounding boxes (getBoundingClientRect) and sets equal left gaps (evenly spaced) via style.left/position left values, preserving each object's width; (3) clear the multi-selection after applying; captureHistory(); markDirty(); scheduleCollabSync(); notifyHost("editing"). If a totally different object-positioning mechanism exists, route through it — but the op must actually move the objects so they are evenly distributed horizontally.
- first step: look at how floating objects are positioned today (grep obj-square / style.left / position absolute in editor.js + the applyObjectOp layout branch ~3280), then add shift-click multi-select and the distribute op.

### ctx-distribute-vertically — OO multi-object "Distribute vertically" (L0, real)
- value medium · effort L
- spec: Vertical counterpart of ctx-distribute-horizontally: with >=2 selected floating objects, equalize the vertical gaps between them (same multi-select machinery). Add ctx row data-ctx="DistributeVertically" next to the horizontal one; same dirty/history/sync/notify pattern.
- first step: mirror the horizontal implementation; reuse the shared multi-select helper from ctx-distribute-horizontally.

### ctx-edit-object — OO "Edit object" on an OLE/drawing object (L0, real)
- value high · effort M
- spec: OO context menu on an OLE object has "Edit object". WO's inserted placeholders (confirmObjectDialog ~3400 writes `<div class="object" data-type="..." data-label="..." [data-content]>`) are edited today only by deleting + re-inserting. Add a ctx row data-ctx="EditObject" (data-showif="object") that runs ONLY for .object divs (not img) and opens the SAME Insert-object dialog (openObjectDialog ~3379) PRE-FILLED from the placeholder's data-type/data-label/content, and on OK (confirmObjectDialog) updates the EXISTING placeholder in place instead of inserting a new one (data-type changes swap the object's rendering class/label/content; keep the element, update attributes + inner content). captureHistory(); markDirty(); scheduleCollabSync(); notifyHost("editing"). The dialog must preselect the object's current type.
- first step: extend openObjectDialog/confirmObjectDialog to accept an optional target element (editing mode), then add the ctx row + dispatch arm (editor.js ~9197).

### ctx-convert-to-shape — OO "Convert to shape" on a drawing object (L0, real)
- value medium · effort M
- spec: OO turns a drawing/OLE object into a shape with "Convert to shape". WO placeholder objects carry data-type; "convert" = replace the placeholder with the shape placeholder of the user's choosing. Add ctx row data-ctx="ConvertToShape" (data-showif="object") that opens the existing shape picker (openShapePicker — the WO-10-shape shape-dialog); on picking a shape, replace the target placeholder div (or convert it in place) to `<div class="object drawing-shape" data-type="shape" data-shape="<picked>" ...>` matching what insertShape produces (~3472). Keep position if the placeholder was positioned; captureHistory(); markDirty(); scheduleCollabSync(); notifyHost("editing").
- first step: read how insertShape builds the shape div (~3460-3480) and how applyObjectOp targets the selected object, then write the convert path + ctx row/dispatch.

### ctx-in-front-of-text — OO wrap "In front of text" (L0, real)
- value medium · effort M
- spec: OO wrap "In front of text" floats the object over the text (no text flow around it). WO already has wrap classes inline/square/behind (OBJ_LAYOUT_CLASSES ~3246, wrap branch of applyObjectOp ~3294: values wrap-inline/wrap-square/wrap-behind). Extend the wrap set with value "wrap-front" + a new OBJ_LAYOUT_CLASSES entry "obj-front": the object keeps its size/position but detaches from the text flow and layers above it (absolute positioning over the page text, higher stacking). Add the ctx row data-ctx="WrapFront" (data-showif="object") beside WrapInline/WrapSquare/WrapBehind (index.html ~1586-1588) + the matching applyObjectOp branch + (if the Layout menu / right-panel wrapping select enumerate wrap values — grep for the select that offers inline/square/behind — add obj-front there too). Document the honest rendering behavior in a comment (web text doesn't reflow around it; it layers by z-index like obj-behind but above the text).
- first step: read the wrap branch (~3290-3300), add obj-front class + wrap-front value, add the ctx row + any layout-menu option, update the wrap Select if one exists.

### ctx-resize-to-cell — OO "Resize to cell" on a table object (L0, real)
- value medium · effort M
- spec: OO table wakes a row "Resize to cell" for an object inside a table cell — it resizes the object to the cell's inner size. WO floating objects inside table cells are .object divs (or imgs). Add ctx row data-ctx="ResizeToCell" (data-showif="object") + dispatch arm: find the object's nearest td, compute its content box (clientWidth/clientHeight minus padding), set the object width/height to fit it (preserving aspect ratio if the object has an intrinsic ratio via naturalWidth/Height or data attrs — otherwise fill the box), captureHistory(); markDirty(); scheduleCollabSync(); notifyHost("editing"). If the caret/object isn't inside a table cell, setStatus a "no table cell" message and do nothing.
- first step: grep how object sizes are stored/set (applyObjectOp size branch or style.width/height on .object), then add the ctx row + handler.

### ctx-through — OO wrap "Through" (L0, real)
- value low · effort M
- spec: OO wrap "Through" lets text pass through an object (typically a shape with no/transparent fill, layered above the text). WO wrap classes are inline/square/behind (OBJ_LAYOUT_CLASSES ~3246). Add value "wrap-through" + class "obj-through": same absolute layering as obj-front but with a transparent appearance (the object's placeholder keeps its content; CSS makes the box background transparent and the text cross it). Add the ctx row data-ctx="WrapThrough" (data-showif="object") + applyObjectOp branch + any wrap select. Honest comment: web text cannot flow "through" a box — we approximate OO's Through as an above-text transparent layer.
- first step: mirror the ctx-in-front-of-text change; add obj-through class + wrap-through value + ctx row.

### ctx-tight — OO wrap "Optimal / Tight" (L0, real)
- value low · effort S
- spec: OO "Optimal (tight)" wraps text closely around the shape contour. WO placeholder objects are rectangular (no vector contour); for rectangles OO itself aliases tight to square, so the honest web equivalent IS the existing obj-square behavior. Implement "Tight" as an explicit wrap option: add value "wrap-tight" + ctx row data-ctx="WrapTight" (data-showif="object") that applies the obj-square class for non-vector placeholders and sets a marker attribute data-wrap="tight" so the surface (ctx/Layout/right-panel) records the user's wrap choice; add a code comment documenting that tight==square for rectangular placeholders until a real vector contour exists. captureHistory(); markDirty(); scheduleCollabSync(); notifyHost("editing").
- first step: add the ctx row + dispatch arm applying obj-square with data-wrap="tight".

### ctx-edit-points — OO "Edit points" shape-contour editor (L0, register as divergence)
- value low · effort XL
- spec: Vector-specific: OO "Edit points" opens an interactive bezier-point editor on a shape (drag anchor/control points). The WO editor has NO vector path/contour model — shapes are CSS/SVG placeholders with no editable geometry, so a real editor is a new subsystem (out of scope like the macros/plugins parks). The honest deliverable is the loud-limited pattern already used in this codebase (index.html data-stub="<ref>" buttons report the ref via setStatus): add ctx row data-ctx="EditPoints" (data-showif="object") labeled "Edit points…" whose dispatch arm calls setStatus(t("Status.NotAvailable"))-style feedback ("Edit points: shape contour editing is not available in the web editor") and dispatches a passive wo:edit-points CustomEvent marker. NO silent no-op, NO fake editor. Deliverable merged by the gate: ctx row + dispatch + the test asserting the row exists and the handler reports unavailable.
- first step: mirror how an existing loud stub reports unavailability (grep data-stub / setStatus in index.html/editor.js), add the ctx row + handler + test.

### ctx-edit-wrap-boundary — OO "Edit wrap boundary" contour editor (L0, register as divergence)
- value low · effort XL
- spec: Vector-specific: OO "Edit wrap boundary" edits the wrap-polygon contour around an object. Same absence as ctx-edit-points (no vector contour model) — same loud-limited deliverable: ctx row data-ctx="EditWrapBoundary" (data-showif="object") labeled "Edit wrap boundary…" reporting unavailability via setStatus(t("Status.NotAvailable"))-style feedback + a passive wo:edit-wrap-boundary CustomEvent marker. Test asserts row + unavailable behavior. Document the park reason in a code comment.
- first step: mirror ctx-edit-points.

### shortcut-closefile — OO Cmd/Ctrl+W closes the document (L0, real)
- value medium · effort M
- spec: OO binds Cmd/Ctrl+W to close the current document (Ctrl+W on Win). WO has no handler (Chromium reserves Cmd+W for closing the browser tab). Implement in the C1 keydown block (editor.js ~10101): intercept (ev.ctrlKey||ev.metaKey)&&!ev.altKey&&!ev.shiftKey && (ev.key==="w"||ev.key==="W"), ev.preventDefault() (stops the browser/tab close), and run the editor's document-close flow: if the doc is dirty (markDirty state), show the existing save/close confirmation path the app uses elsewhere (grep for a dirty/close/save confirm + the "saved"/"editing" notifyHost events ~652/941/1016); otherwise dispatch the close sequence — the backstage has no dedicated close pane, so reuse the app's exit/close contract: emit a CustomEvent "wo:close-document" on window with {dirty} detail and call notifyHost("close") or the nearest existing close/exit function the app exposes (grep notifyHost to find the host event names). Behavior must be: Ctrl+W does NOT close the browser tab and DOES attempt a document close with dirty protection. Add the binding to shortcuts-gate.test.mjs-style pins only if that gate enumerates it (the C1 block is where all shortcut pins live).
- first step: find the notifyHost event list + any existing close/exit/confirm-dirty flow in editor.js, then add the keydown intercept in the C1 block.

### shortcut-opencommentfield — OO Alt+Meta+A opens the comment field (L0, real)
- value medium · effort S
- spec: OO binds Alt+Meta(+A) (Mac: Opt+Cmd+A) to open/insert a comment field at the caret. WO already has openCommentDialog() (used by the AddComment ctx arm ~9230 and insertComment command). Add to the C1 keydown block (editor.js ~10101, the Alt-combos section that runs before the !altKey guard): Alt+Meta+A (ev.altKey&&ev.metaKey&&!ev.ctrlKey, key a/A) -> ev.preventDefault(); openCommentDialog(). Add matching i18n hint if a shortcut help surface lists the combo. The gate's node test asserts the binding exists.
- first step: find the Alt-combo sub-block in the C1 keydown area (em-dash/currency combos live there) and add the binding.

### shortcut-openexistingfile — OO Cmd/Ctrl+O opens an existing file (L0, real)
- value high · effort S
- spec: OO binds Cmd/Ctrl+O to open the Open dialog. WO already has openBackstage("open") (backstage panes: new/open/save/export..., openBackstage ~9734; default pane is "open"). Add to the C1 keydown block: (ev.ctrlKey||ev.metaKey)&&!ev.altKey&&!ev.shiftKey && key o/O -> ev.preventDefault(); openBackstage("open"). This is the standard web Open™ flow. Test asserts the binding.
- first step: add the binding in the C1 block near the Ctrl+Shift+S Save-As binding (~10127).

### shortcut-openfilepanel — OO Ctrl+Alt+F focuses the file/navigation panel (L0, real)
- value low · effort S
- spec: OO binds Ctrl+Alt+F to focus the file panel (recent files list / open pane). WO is a single-document editor; the honest file panel is the backstage file menu with its Recent/Open list (openBackstage("open") shows the recent documents rail — the default landing pane). Add to the C1 keydown block: (ev.ctrlKey||ev.metaKey)&&ev.altKey&&!ev.shiftKey && key f/F -> ev.preventDefault(); openBackstage("open"); then focus the recent-files list container (find its id in the backstage markup). If a persistent left file rail exists elsewhere, focus that instead — but openBackstage("open") is the correct default. Test asserts the binding.
- first step: locate the recent-files rail id in the backstage HTML, add the keydown binding + focus() call.

### shortcut-replaceunicodetosymbol — OO Alt+X replaces a unicode escape with its symbol (L0, real)
- value low · effort M
- spec: OO binds Alt+X (Mac Alt+Meta+X) to convert a typed unicode escape sequence under/left of the caret into the corresponding character (e.g. "\\u2013" -> "–", also \\u{...} form). WO has no handler. Implement in the C1 keydown block: on Alt+Meta+X (ev.altKey&&ev.metaKey, key x/X; also accept Ctrl+Alt+X on PC per OO's platform variants): ev.preventDefault(); scan left of the selection start (or expand selection to a matching escape token) for /\\(u\{[0-9a-fA-F]{1,6}\}|u[0-9a-fA-F]{4})/ and if found replace the token text with String.fromCodePoint of the hex (guard invalid >0x10FFFF as no-op with a status message), keep the caret after the inserted char, captureHistory(); markDirty(); scheduleCollabSync(); notifyHost("editing"). If no escape token is adjacent, beep/status "no unicode escape found". Test asserts the handler regex + replacement logic.
- first step: locate the em-dash/currency Alt-combo sub-block in the C1 area and add the handler with a small local function replacing the escape.

### shortcut-strikeout — OO Shift+Meta+X toggles strikethrough (L0, real)
- value medium · effort S
- spec: OO binds Shift+Meta+X (Mac; Ctrl+Shift+X PC variant) to toggle strikethrough. WO already has the strikethrough command: emitCommand("strikeThrough") (ctx arm ~9268, Toolbar.Strikethrough i18n exists). Add to the C1 keydown block's shift-group: (ev.ctrlKey||ev.metaKey)&&ev.shiftKey&&!ev.altKey && key x/X -> ev.preventDefault(); emitCommand("strikeThrough"). Test asserts the binding.
- first step: add the binding in the C1 shift-group block (near the en-dash/small-caps bindings ~10111-10120).
