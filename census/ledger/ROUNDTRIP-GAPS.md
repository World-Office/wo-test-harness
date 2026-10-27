# LEDGER2-ROUNDTRIP: persistence gaps

Generated: 2026-10-27T11:52:50.172Z
Conversion endpoint: `http://192.168.42.42:8086/api/conversion/convert` (html -> docx -> html)
Editor: `/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg`
Probed: 38 document-level commands — survived: 5, lost: 33

A feature reaches **L3 (persists)** only when its mutation marker is present
in the editor serialization *and* still present after booting a fresh editor
from the round-tripped (html->docx->html) document.

## Non-surviving commands (exact lost attribute)

### bookmark — ledger features: references.bookmark

- **Lost at phase:** `apply`
- **Lost attribute:** mutation did not take effect (apply marker missing from flat HTML)
- HTML after apply: `<p><span style="background-color: rgb(255, 248, 225); font-size: 12pt;">ROUNDTRIPBM</span>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### code — ledger features: plugins.highlight-code

- **Lost at phase:** `apply`
- **Lost attribute:** mutation did not take effect (apply marker missing from flat HTML)
- HTML after apply: `<p>ROUNDTRIP <span style="font-family: Consolas;">sentinel</span> alpha text.</p><p>Second paragraph body here.</p>`

### directionRtl — ledger features: formatting.text-direction

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /rtl/)
- HTML after apply: `<p dir="rtl" style="direction: rtl;">ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### font-family — ledger features: formatting.font

- **Lost at phase:** `error`
- **Lost attribute:** command not dispatched (no button, no runCommand)

### font-size — ledger features: formatting.font-size, formatting.increment-font-size-ctrl, formatting.decrement-font-size-ctrl

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /font-size/)
- HTML after apply: `<p>ROUNDTRIP <span style="font-size: large;">sentinel</span> alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### highlight-color — ledger features: formatting.highlight-color

- **Lost at phase:** `error`
- **Lost attribute:** command not dispatched (no button, no runCommand)

### indent — ledger features: formatting.increase-indent-ctrl-m

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /margin-left\s*:|<blockquote\b/)
- HTML after apply: `<blockquote style="margin: 0 0 0 40px; border: none; padding: 0px;"><p>ROUNDTRIP sentinel alpha text.</p></blockquote><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### insertBlankPage — ledger features: file.insert, insert.blank-page

- **Lost at phase:** `convert`
- **Lost attribute:** html->docx failed: parse error: Parse error in html: Failed to parse HTML: unknown entity reference 'nbsp' at 1:25
- HTML after apply: `<p>ROUNDTRIP&nbsp;</p><div class="page-break"><br></div><p><br></p><p>&nbsp;alpha text.</p><p>Second paragraph body here.</p>`

### insertCaption — ledger features: references.caption, references.dlg-insert-caption

- **Lost at phase:** `convert`
- **Lost attribute:** html->docx failed: parse error: Parse error in html: Failed to parse HTML: unknown entity reference 'nbsp' at 1:25
- HTML after apply: `<p>ROUNDTRIP&nbsp;<em style="text-align: center; font-size: 12pt;">Caption</em><span style="font-size: 12pt;">&nbsp;alpha text.</span></p><p>Second paragraph body here.</p>`

### insertColumnBreak — ledger features: insert.insert-column-break

- **Lost at phase:** `convert`
- **Lost attribute:** html->docx failed: parse error: Parse error in html: Failed to parse HTML: unknown entity reference 'nbsp' at 1:25
- HTML after apply: `<p>ROUNDTRIP&nbsp;</p><div class="column-break"><br></div><p><br></p><p>&nbsp;alpha text.</p><p>Second paragraph body here.</p>`

### insertComment — ledger features: review.comment

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /comment/)
- HTML after apply: `<p>ROUNDTRIP <span class="comment" data-id="61d0bc68-14b1-47da-bc6a-8461462e4f83" data-author="You" data-comment="Roundtrip comment.">sentinel</span> alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### insertFootnote — ledger features: references.footnote

- **Lost at phase:** `convert`
- **Lost attribute:** html->docx failed: parse error: Parse error in html: Failed to parse HTML: unknown entity reference 'nbsp' at 1:25
- HTML after apply: `<p>ROUNDTRIP&nbsp;<sup class="footnote-citation">[1]</sup><span class="footnote">Footnote text</span>&nbsp;alpha text.</p><p>Second paragraph body here.</p>`

### insertObject — ledger features: insert.shape, chart.chart

- **Lost at phase:** `apply`
- **Lost attribute:** mutation did not take effect (apply marker missing from flat HTML)
- HTML after apply: `<p>ROUNDTRIP&nbsp;</p><div class="object" data-type="shape"></div><p><br></p><p>&nbsp;alpha text.</p><p>Second paragraph body here.</p>`

### insertPageBreak — ledger features: insert.insert-page-break

- **Lost at phase:** `convert`
- **Lost attribute:** html->docx failed: parse error: Parse error in html: Failed to parse HTML: unknown entity reference 'nbsp' at 1:25
- HTML after apply: `<p>ROUNDTRIP&nbsp;</p><div class="page-break"><br></div><p><br></p><p>&nbsp;alpha text.</p><p>Second paragraph body here.</p>`

### insertSectionBreak — ledger features: insert.insert-section-break

- **Lost at phase:** `convert`
- **Lost attribute:** html->docx failed: parse error: Parse error in html: Failed to parse HTML: unknown entity reference 'nbsp' at 1:25
- HTML after apply: `<p>ROUNDTRIP&nbsp;</p><hr class="section-break"><p><br></p><p>&nbsp;alpha text.</p><p>Second paragraph body here.</p>`

### insertTextart — ledger features: insert.text-art

- **Lost at phase:** `apply`
- **Lost attribute:** mutation did not take effect (apply marker missing from flat HTML)
- HTML after apply: `<p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### insertTextbox — ledger features: insert.text-box

- **Lost at phase:** `apply`
- **Lost attribute:** mutation did not take effect (apply marker missing from flat HTML)
- HTML after apply: `<p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### insertToF — ledger features: table.table-of-figures, table.dlg-table-of-figures

- **Lost at phase:** `convert`
- **Lost attribute:** html->docx failed: parse error: Parse error in html: Failed to parse HTML: unknown entity reference 'nbsp' at 1:25
- HTML after apply: `<p>ROUNDTRIP&nbsp;</p><nav class="toc" data-kind="figures" data-title="List of Figures"></nav><p><br></p><p>&nbsp;alpha text.</p><p>Second paragraph body here.</p>`

### insertUnorderedList — ledger features: formatting.bullets

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /<ul\b/)
- HTML after apply: `<p><ul><li>ROUNDTRIP sentinel alpha text.</li></ul></p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>Second paragraph body here.</p>`

### justifyCenter — ledger features: formatting.align-center-ctrl-e

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /text-align[^">]*center|<center\b|class="[^"]*center/)
- HTML after apply: `<p style="text-align: center; ">ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### justifyFull — ledger features: formatting.justified-ctrl-j

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /text-align[^">]*justify/)
- HTML after apply: `<p style="text-align: justify; ">ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### justifyLeft — ledger features: formatting.align-left-ctrl-l

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /text-align[^">]*left|align="left"/)
- HTML after apply: `<p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### justifyRight — ledger features: formatting.align-right-ctrl-r

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /text-align[^">]*right/)
- HTML after apply: `<p style="text-align: right; ">ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### line-spacing — ledger features: formatting.paragraph-line-spacing

- **Lost at phase:** `error`
- **Lost attribute:** command not dispatched (no button, no runCommand)

### link — ledger features: insert.link, references.link

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /<a\b[^>]*href/)
- HTML after apply: `<p><a href="https://roundtrip.example" style="font-size: 12pt;">https://roundtrip.example</a>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p><u>https://roundtrip.example (https://roundtrip.example)</u>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### multilevel — ledger features: formatting.multilevel-list

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /<ol\b|<ul\b|data-level|list-level/)
- HTML after apply: `<p><ol><li>ROUNDTRIP sentinel alpha text.</li></ol></p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>Second paragraph body here.</p>`

### subscript — ledger features: formatting.subscript-ctrl

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /<sub\b|vertical-align[^>]*\bsub\b/)
- HTML after apply: `<p>ROUNDTRIP <sub>sentinel</sub> alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### superscript — ledger features: formatting.superscript-ctrl

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /<sup\b|vertical-align[^>]*super/)
- HTML after apply: `<p>ROUNDTRIP <sup>sentinel</sup> alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### text-color — ledger features: formatting.font-color

- **Lost at phase:** `error`
- **Lost attribute:** command not dispatched (no button, no runCommand)

### toggleDropcap — ledger features: insert.drop-cap

- **Lost at phase:** `apply`
- **Lost attribute:** mutation did not take effect (apply marker missing from flat HTML)
- HTML after apply: `<p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### toggleHyphenation — ledger features: page.hyphenation, page.hyphenation-options, page.dlg-hyphenation

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /hyphen/)
- HTML after apply: `<div class="hyphenation" data-auto="1"></div><p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### toggleLineNumbers — ledger features: page.line-numbers

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /line-number|linenumber/)
- HTML after apply: `<div class="line-numbers" data-restart="continuous"></div><p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

### toggleWatermark — ledger features: page.watermark

- **Lost at phase:** `survive`
- **Lost attribute:** marker present before conversion but lost after html->docx->html (expected /watermark/)
- HTML after apply: `<div class="watermark" data-text="CONFIDENTIAL" data-color="#C0C0C0"></div><p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`
- HTML after roundtrip: ` <p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>`

## Features with wo.match but no persistence probe

These stay at L1: no document-level mutation probe is defined (UI-only,
dialog-only, or state toggles with no serialized marker).

- `file.file` (wo.match `btn-textfile`) — lost attribute: none serialized (no marker contract)
- `file.draw` (wo.match `toggleInk`) — lost attribute: none serialized (no marker contract)
- `file.view` (wo.match `displayMode`) — lost attribute: none serialized (no marker contract)
- `file.plugins` (wo.match `managePlugins`) — lost attribute: none serialized (no marker contract)
- `file.ai` (wo.match `AI changes`) — lost attribute: none serialized (no marker contract)
- `file.editing` (wo.match `coedit-mode`) — lost attribute: none serialized (no marker contract)
- `file.find-ctrl-f` (wo.match `btn-find`) — lost attribute: none serialized (no marker contract)
- `file.copy-ctrl-insert` (wo.match `btn-copy`) — lost attribute: none serialized (no marker contract)
- `file.paste-ctrl-v` (wo.match `btn-paste`) — lost attribute: none serialized (no marker contract)
- `file.cut-ctrl-x` (wo.match `btn-cut`) — lost attribute: none serialized (no marker contract)
- `file.copy-style-ctrl-alt-c` (wo.match `btn-copy`) — lost attribute: none serialized (no marker contract)
- `formatting.change-case` (wo.match `Change case`) — lost attribute: none serialized (no marker contract)
- `formatting.clear-style` (wo.match `removeFormat`) — lost attribute: none serialized (no marker contract)
- `formatting.numbering` (wo.match `Numbering style options`) — lost attribute: none serialized (no marker contract)
- `formatting.decrease-indent-ctrl-shift-m` (wo.match `outdent`) — lost attribute: none serialized (no marker contract)
- `formatting.nonprinting-characters-ctrl-shift-8` (wo.match `btn-home-formatmarks`) — lost attribute: none serialized (no marker contract)
- `formatting.shading` (wo.match `Shading`) — lost attribute: none serialized (no marker contract)
- `formatting.borders` (wo.match `openBorders`) — lost attribute: none serialized (no marker contract)
- `formatting.replace-ctrl-h` (wo.match `btn-replace`) — lost attribute: none serialized (no marker contract)
- `formatting.select-all-ctrl-a` (wo.match `selectAll`) — lost attribute: none serialized (no marker contract)
- `insert.breaks` (wo.match `Breaks`) — lost attribute: none serialized (no marker contract)
- `table.table` (wo.match `btn-table`) — lost attribute: none serialized (no marker contract)
- `image.image` (wo.match `btn-hf-image`) — lost attribute: none serialized (no marker contract)
- `insert.smartart` (wo.match `btn-smartart`) — lost attribute: none serialized (no marker contract)
- `insert.page-number` (wo.match `btn-hf-pagenumber`) — lost attribute: none serialized (no marker contract)
- `insert.date-time` (wo.match `btn-datetime`) — lost attribute: none serialized (no marker contract)
- `insert.text-from-file` (wo.match `btn-textfile`) — lost attribute: none serialized (no marker contract)
- `insert.field` (wo.match `btn-field`) — lost attribute: none serialized (no marker contract)
- `insert.equation` (wo.match `btn-equation`) — lost attribute: none serialized (no marker contract)
- `insert.symbol` (wo.match `btn-symbol`) — lost attribute: none serialized (no marker contract)
- `insert.content-controls` (wo.match `btn-contentcontrol`) — lost attribute: none serialized (no marker contract)
- `insert.select` (wo.match `inkSelect`) — lost attribute: none serialized (no marker contract)
- `page.margins` (wo.match `Margins`) — lost attribute: none serialized (no marker contract)
- `page.orientation` (wo.match `Orientation`) — lost attribute: none serialized (no marker contract)
- `page.size` (wo.match `Size`) — lost attribute: none serialized (no marker contract)
- `page.columns` (wo.match `Columns`) — lost attribute: none serialized (no marker contract)
- `page.breaks` (wo.match `Breaks`) — lost attribute: none serialized (no marker contract)
- `page.wrapping` (wo.match `Wrapping`) — lost attribute: none serialized (no marker contract)
- `page.bring-forward` (wo.match `objectOp`) — lost attribute: none serialized (no marker contract)
- `page.send-backward` (wo.match `objectOp`) — lost attribute: none serialized (no marker contract)
- `page.align` (wo.match `Align`) — lost attribute: none serialized (no marker contract)
- `page.group` (wo.match `objectOp`) — lost attribute: none serialized (no marker contract)
- `page.merge-shapes` (wo.match `btn-mergeshapes`) — lost attribute: none serialized (no marker contract)
- `page.page-color` (wo.match `pagecolor`) — lost attribute: none serialized (no marker contract)
- `page.colors` (wo.match `themecolors`) — lost attribute: none serialized (no marker contract)
- `table.table-of-contents` (wo.match `btn-toc`) — lost attribute: none serialized (no marker contract)
- `references.add-text` (wo.match `btn-addtext`) — lost attribute: none serialized (no marker contract)
- `table.update-table` (wo.match `updateToc`) — lost attribute: none serialized (no marker contract)
- `references.cross-reference` (wo.match `openCrossref`) — lost attribute: none serialized (no marker contract)
- `review.co-editing-mode` (wo.match `coedit-mode`) — lost attribute: none serialized (no marker contract)
- `review.add-comment` (wo.match `btn-comment`) — lost attribute: none serialized (no marker contract)
- `review.delete` (wo.match `deleteComment`) — lost attribute: none serialized (no marker contract)
- `review.resolve` (wo.match `resolveComment`) — lost attribute: none serialized (no marker contract)
- `review.track-changes` (wo.match `btn-track-changes`) — lost attribute: none serialized (no marker contract)
- `review.display-mode` (wo.match `displayMode`) — lost attribute: none serialized (no marker contract)
- `review.previous` (wo.match `prevTrackedChange`) — lost attribute: none serialized (no marker contract)
- `review.next` (wo.match `nextTrackedChange`) — lost attribute: none serialized (no marker contract)
- `review.accept` (wo.match `acceptTrackedChange`) — lost attribute: none serialized (no marker contract)
- `review.reject` (wo.match `rejectTrackedChange`) — lost attribute: none serialized (no marker contract)
- `review.compare` (wo.match `compareVersion`) — lost attribute: none serialized (no marker contract)
- `review.combine` (wo.match `combineRevisions`) — lost attribute: none serialized (no marker contract)
- `review.chat` (wo.match `toggleChat`) — lost attribute: none serialized (no marker contract)
- `file.mail-merge` (wo.match `mailMerge`) — lost attribute: none serialized (no marker contract)
- `protect.encrypt` (wo.match `protectDialog`) — lost attribute: none serialized (no marker contract)
- `protect.protect-document` (wo.match `restrictEditing`) — lost attribute: none serialized (no marker contract)
- `view.headings` (wo.match `btn-view-headings`) — lost attribute: none serialized (no marker contract)
- `view.fit-to-page` (wo.match `btn-view-fit`) — lost attribute: none serialized (no marker contract)
- `view.fit-to-width` (wo.match `btn-view-fit-width`) — lost attribute: none serialized (no marker contract)
- `view.zoom-to-100` (wo.match `btn-view-zoom100`) — lost attribute: none serialized (no marker contract)
- `view.multiple-pages` (wo.match `btn-view-multipages`) — lost attribute: none serialized (no marker contract)
- `view.interface-theme` (wo.match `view-theme-select`) — lost attribute: none serialized (no marker contract)
- `view.dark-document` (wo.match `btn-view-darkdoc`) — lost attribute: none serialized (no marker contract)
- `macros.macros` (wo.match `btn-macro-menu`) — lost attribute: none serialized (no marker contract)
- `macros.record-macro` (wo.match `Record macro`) — lost attribute: none serialized (no marker contract)
- `view.pause-recording` (wo.match `Pause recording`) — lost attribute: none serialized (no marker contract)
- `plugins.background-plugins` (wo.match `btn-bgplugins`) — lost attribute: none serialized (no marker contract)
- `image.photo-editor` (wo.match `photoEditor`) — lost attribute: none serialized (no marker contract)
- `plugins.youtube` (wo.match `pluginUnavailable`) — lost attribute: none serialized (no marker contract)
- `plugins.ocr` (wo.match `ocrRun`) — lost attribute: none serialized (no marker contract)
- `plugins.translator` (wo.match `aiTranslate`) — lost attribute: none serialized (no marker contract)
- `plugins.mendeley` (wo.match `pluginUnavailable`) — lost attribute: none serialized (no marker contract)
- `review.thesaurus` (wo.match `aiRewrite`) — lost attribute: none serialized (no marker contract)
- `plugins.zotero` (wo.match `pluginUnavailable`) — lost attribute: none serialized (no marker contract)
- `plugins.speech` (wo.match `btn-speech`) — lost attribute: none serialized (no marker contract)
- `plugins.speech-input` (wo.match `dictate`) — lost attribute: none serialized (no marker contract)
- `headerfooter.page-number` (wo.match `btn-hf-pagenumber`) — lost attribute: none serialized (no marker contract)
- `headerfooter.date-time` (wo.match `btn-datetime`) — lost attribute: none serialized (no marker contract)
- `headerfooter.field` (wo.match `btn-field`) — lost attribute: none serialized (no marker contract)
- `headerfooter.close` (wo.match `btn-hf-close`) — lost attribute: none serialized (no marker contract)
- `other.settings` (wo.match `aiSettings`) — lost attribute: none serialized (no marker contract)
- `other.chatbot` (wo.match `btn-ai-assistant`) — lost attribute: none serialized (no marker contract)
- `other.summarization` (wo.match `aiSummarize`) — lost attribute: none serialized (no marker contract)
- `other.translation` (wo.match `aiTranslate`) — lost attribute: none serialized (no marker contract)
- `review.grammar-spelling` (wo.match `btn-ai-grammar`) — lost attribute: none serialized (no marker contract)
- `other.create-ai-assistant` (wo.match `createAiAssistant`) — lost attribute: none serialized (no marker contract)
- `chart.chart-elements` (wo.match `Chart elements ▾`) — lost attribute: none serialized (no marker contract)
- `chart.edit-data` (wo.match `chartEditData`) — lost attribute: none serialized (no marker contract)
- `chart.update-data` (wo.match `chartUpdateData`) — lost attribute: none serialized (no marker contract)
- `chart.chart-type` (wo.match `Chart type ▾`) — lost attribute: none serialized (no marker contract)
- `chart.advanced-settings` (wo.match `chartSettings`) — lost attribute: none serialized (no marker contract)
- `chart.wrapping` (wo.match `Wrapping`) — lost attribute: none serialized (no marker contract)
- `chart.width` (wo.match `chart-width-input`) — lost attribute: none serialized (no marker contract)
- `chart.height` (wo.match `chart-height-input`) — lost attribute: none serialized (no marker contract)
- `chart.3d-rotation` (wo.match `chart3d`) — lost attribute: none serialized (no marker contract)
- `table.insert-custom-table` (wo.match `btn-table`) — lost attribute: none serialized (no marker contract)
- `insert.more-symbols` (wo.match `btn-symbol`) — lost attribute: none serialized (no marker contract)
- `insert.symbols` (wo.match `btn-symbol`) — lost attribute: none serialized (no marker contract)
- `page.normal` (wo.match `Normal`) — lost attribute: none serialized (no marker contract)
- `page.narrow` (wo.match `Narrow`) — lost attribute: none serialized (no marker contract)
- `page.moderate` (wo.match `Moderate`) — lost attribute: none serialized (no marker contract)
- `page.wide` (wo.match `Wide`) — lost attribute: none serialized (no marker contract)
- `page.custom-margins` (wo.match `Custom margins`) — lost attribute: none serialized (no marker contract)
- `page.us-letter` (wo.match `Letter`) — lost attribute: none serialized (no marker contract)
- `page.us-legal` (wo.match `Legal`) — lost attribute: none serialized (no marker contract)
- `page.a4` (wo.match `A4`) — lost attribute: none serialized (no marker contract)
- `page.a5` (wo.match `A5`) — lost attribute: none serialized (no marker contract)
- `page.b5` (wo.match `B5`) — lost attribute: none serialized (no marker contract)
- `page.envelope-10` (wo.match `Envelope #10`) — lost attribute: none serialized (no marker contract)
- `page.envelope-dl` (wo.match `Envelope DL`) — lost attribute: none serialized (no marker contract)
- `page.tabloid` (wo.match `Tabloid`) — lost attribute: none serialized (no marker contract)
- `page.a3` (wo.match `A3`) — lost attribute: none serialized (no marker contract)
- `page.tabloid-oversize` (wo.match `Tabloid Oversize`) — lost attribute: none serialized (no marker contract)
- `page.roc-16k` (wo.match `ROC 16K`) — lost attribute: none serialized (no marker contract)
- `page.envelope-choukei-3` (wo.match `Envelope Choukei 3`) — lost attribute: none serialized (no marker contract)
- `page.super-b-a3` (wo.match `Super B/A3`) — lost attribute: none serialized (no marker contract)
- `page.custom-page-size` (wo.match `Custom page size`) — lost attribute: none serialized (no marker contract)
- `page.one` (wo.match `One`) — lost attribute: none serialized (no marker contract)
- `page.two` (wo.match `Two`) — lost attribute: none serialized (no marker contract)
- `page.three` (wo.match `Three`) — lost attribute: none serialized (no marker contract)
- `page.left` (wo.match `Left`) — lost attribute: none serialized (no marker contract)
- `page.right` (wo.match `Right`) — lost attribute: none serialized (no marker contract)
- `page.custom-columns` (wo.match `Custom columns`) — lost attribute: none serialized (no marker contract)
- `chart.chart-title` (wo.match `Chart title`) — lost attribute: none serialized (no marker contract)
- `chart.data-labels` (wo.match `Data labels`) — lost attribute: none serialized (no marker contract)
- `chart.gridlines` (wo.match `btn-gridlines`) — lost attribute: none serialized (no marker contract)
- `chart.legend` (wo.match `Legend`) — lost attribute: none serialized (no marker contract)
- `insert.dlg-date-time` (wo.match `btn-datetime`) — lost attribute: none serialized (no marker contract)
- `insert.dlg-symbol` (wo.match `btn-symbol`) — lost attribute: none serialized (no marker contract)
- `page.dlg-margins` (wo.match `Margins`) — lost attribute: none serialized (no marker contract)
- `page.dlg-page-size` (wo.match `Size`) — lost attribute: none serialized (no marker contract)
- `page.dlg-columns` (wo.match `Columns`) — lost attribute: none serialized (no marker contract)
- `references.dlg-cross-reference` (wo.match `openCrossref`) — lost attribute: none serialized (no marker contract)
- `table.dlg-table-of-contents` (wo.match `btn-toc`) — lost attribute: none serialized (no marker contract)
- `macros.dlg-macros` (wo.match `btn-macro-menu`) — lost attribute: none serialized (no marker contract)
- `headerfooter.dlg-date-time` (wo.match `btn-datetime`) — lost attribute: none serialized (no marker contract)
- `file.back` (wo.match `Back`) — lost attribute: none serialized (no marker contract)
- `file.save` (wo.match `Save`) — lost attribute: none serialized (no marker contract)
- `file.download-as` (wo.match `Download As`) — lost attribute: none serialized (no marker contract)
- `file.protect` (wo.match `Protect`) — lost attribute: none serialized (no marker contract)
- `file.advanced-settings` (wo.match `chartSettings`) — lost attribute: none serialized (no marker contract)
- `file.suggest-a-feature` (wo.match `Suggest a feature`) — lost attribute: none serialized (no marker contract)
- `statusbar.word-count` (wo.match `sb-word-count`) — lost attribute: none serialized (no marker contract)
- `statusbar.status-btn-multiple-pages` (wo.match `btn-multipage`) — lost attribute: none serialized (no marker contract)

