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
