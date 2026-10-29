# Feature Ledger v1 — real completeness map

Generated from: census-oo-deep + census-oo-dialogs + census-wo-deep. 
L3 layer: ledger/roundtrip.cjs (13/13 commands survive html->docx->html).
Levels: **L0** missing · **L1** surface exists (visual parity — the old
census ceiling, 'deficit 3' lives here) · **L2** acts (behavior probe) ·
**L3** persists (round-trip) · **L4** fidelity vs OO output.

## file — 39 features (L0:9 L1:30 L3:0)
- ❌ L0 **file.home** [control] 
- ❌ L0 **file.layout** [control] 
- ❌ L0 **file.references** [control] 
- ❌ L0 **file.collaboration** [control] 
- ❌ L0 **shortcut.opencontextmenu** [shortcut] 
- ❌ L0 **shortcut.openfilepanel** [shortcut] 
- ❌ L0 **shortcut.opencommentfield** [shortcut] 
- ❌ L0 **shortcut.openexistingfile** [shortcut] 
- ❌ L0 **shortcut.closefile** [shortcut] 
- 🔲 L1 **file.file** [control] → WO: btn-textfile
- 🔲 L1 **file.insert** [control] → WO: insertBlankPage
- 🔲 L1 **file.draw** [control] → WO: toggleInk
- 🔲 L1 **file.protection** [control] → WO: protectDialog
- 🔲 L1 **file.view** [control] → WO: displayMode
- 🔲 L1 **file.plugins** [control] → WO: plugins-dialog
- 🔲 L1 **file.ai** [control] → WO: AI changes
- 🔲 L1 **file.editing** [control] → WO: coedit-mode
- 🔲 L1 **file.find-ctrl-f** [control] → WO: btn-find
- 🔲 L1 **file.copy-ctrl-insert** [control] → WO: btn-copy
- 🔲 L1 **file.paste-ctrl-v** [control] → WO: btn-paste
- 🔲 L1 **file.cut-ctrl-x** [control] → WO: btn-cut
- 🔲 L1 **file.copy-style-ctrl-alt-c** [control] → WO: btn-copy
- 🔲 L1 **file.mail-merge** [control] → WO: mailMerge
- 🔲 L1 **file.back** [backstage-item] → WO: Back
- 🔲 L1 **file.save** [backstage-item] → WO: Save
- 🔲 L1 **file.download-as** [backstage-item] → WO: Download As
- 🔲 L1 **file.protect** [backstage-item] → WO: Protect
- 🔲 L1 **file.advanced-settings** [backstage-item] → WO: chartSettings
- 🔲 L1 **file.suggest-a-feature** [backstage-item] → WO: Suggest a feature
- 🔲 L1 **shortcut.openfinddialog** [shortcut] → WO: Ctrl+F
- 🔲 L1 **shortcut.openfindandreplacemenu** [shortcut] → WO: Ctrl+H
- 🔲 L1 **shortcut.opencommentspanel** [shortcut] → WO: Ctrl+Shift+H (comments rail)
- 🔲 L1 **shortcut.save** [shortcut] → WO: Ctrl+S
- 🔲 L1 **shortcut.printpreviewandprint** [shortcut] → WO: Ctrl+P opens native print dialog (WO window.print)
- 🔲 L1 **shortcut.saveas** [shortcut] → WO: Ctrl+Shift+S (export backstage pane)
- 🔲 L1 **shortcut.openhelpmenu** [shortcut] → WO: F1 opens Help dialog
- 🔲 L1 **shortcut.closemenu** [shortcut] → WO: Escape
- 🔲 L1 **shortcut.updatefields** [shortcut] → WO: F9 (fieldOpAtSelection update)
- 🔲 L1 **shortcut.openchatpanel** [shortcut] → WO: Ctrl+Alt+Q

## shortcuts — 62 features (L0:5 L1:57 L3:0)
- ❌ L0 **shortcut.specialoptionskeepsourceformat** [shortcut] 
- ❌ L0 **shortcut.specialoptionskeeptextonly** [shortcut] 
- ❌ L0 **shortcut.specialoptionsoverwritecells** [shortcut] 
- ❌ L0 **shortcut.specialoptionsnesttable** [shortcut] 
- ❌ L0 **shortcut.replaceunicodetosymbol** [shortcut] 
- 🔲 L1 **shortcut.zoom100** [shortcut] → WO: Ctrl+0
- 🔲 L1 **shortcut.movetostartline** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetostartdocument** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetoendline** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetoenddocument** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.scrolldown** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.scrollup** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.zoomin** [shortcut] → WO: Ctrl+Plus/=
- 🔲 L1 **shortcut.zoomout** [shortcut] → WO: Ctrl+Minus
- 🔲 L1 **shortcut.movetorightchar** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetoleftchar** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetoupline** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetodownline** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.nextmodalcontrol** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.previousmodalcontrol** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetolowerheaderfooter** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetoupperheaderfooter** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetolowerheader** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetoupperheader** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.endparagraph** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.equationaddplaceholder** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.equationchangealignmentleft** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.equationchangealignmentright** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.visithyperlink** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.startindent** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.startunindent** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.mixedindent** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.mixedunindent** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.bigmoveobjectleft** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.bigmoveobjectright** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.bigmoveobjectup** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.bigmoveobjectdown** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movefocustonextobject** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movefocustopreviousobject** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetonextcell** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetopreviouscell** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetonextrow** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetopreviousrow** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.endparagraphcell** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.addnewrow** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetonextform** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetopreviousform** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.choosenextcomboboxoption** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.choosepreviouscomboboxoption** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.speechworker** [shortcut] → WO: Ctrl+Alt+Z read-aloud (OO SpeechWorker panel; WO maps to TTS)
- 🔲 L1 **shortcut.movetostartpreviouspage** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetostartnextpage** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetostartword** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetoendword** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.littlemoveobjectleft** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.littlemoveobjectright** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.littlemoveobjectup** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.littlemoveobjectdown** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetonextpage** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.movetopreviouspage** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.nextfiletab** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.previousfiletab** [shortcut] → WO: browser caret/scroll (n/a for web editor)

## formatting — 53 features (L0:3 L1:42 L3:8)
- ❌ L0 **shortcut.copyformat** [shortcut] 
- ❌ L0 **shortcut.pasteformat** [shortcut] 
- ❌ L0 **shortcut.strikeout** [shortcut] 
- 🔲 L1 **formatting.font** [control] → WO: font-family
- 🔲 L1 **formatting.font-size** [control] → WO: font-size
- 🔲 L1 **formatting.increment-font-size-ctrl** [control] → WO: font-size
- 🔲 L1 **formatting.decrement-font-size-ctrl** [control] → WO: font-size
- 🔲 L1 **formatting.highlight-color** [control] → WO: highlight-color
- 🔲 L1 **formatting.font-color** [control] → WO: text-color
- 🔲 L1 **formatting.bullets** [control] → WO: insertUnorderedList
- 🔲 L1 **formatting.numbering** [control] → WO: Numbering style options
- 🔲 L1 **formatting.multilevel-list** [control] → WO: multilevel
- 🔲 L1 **formatting.decrease-indent-ctrl-shift-m** [control] → WO: outdent
- 🔲 L1 **formatting.increase-indent-ctrl-m** [control] → WO: indent
- 🔲 L1 **formatting.paragraph-line-spacing** [control] → WO: line-spacing
- 🔲 L1 **formatting.text-direction** [control] → WO: directionRtl
- 🔲 L1 **formatting.align-left-ctrl-l** [control] → WO: justifyLeft
- 🔲 L1 **formatting.align-center-ctrl-e** [control] → WO: justifyCenter
- 🔲 L1 **formatting.align-right-ctrl-r** [control] → WO: justifyRight
- 🔲 L1 **formatting.justified-ctrl-j** [control] → WO: justifyFull
- 🔲 L1 **formatting.nonprinting-characters-ctrl-shift-8** [control] → WO: btn-home-formatmarks
- 🔲 L1 **formatting.shading** [control] → WO: Shading
- 🔲 L1 **formatting.borders** [control] → WO: openBorders
- 🔲 L1 **formatting.replace-ctrl-h** [control] → WO: btn-replace
- 🔲 L1 **formatting.select-all-ctrl-a** [control] → WO: selectAll
- 🔲 L1 **shortcut.bold** [shortcut] → WO: Ctrl+B
- 🔲 L1 **shortcut.italic** [shortcut] → WO: Ctrl+I
- 🔲 L1 **shortcut.underline** [shortcut] → WO: Ctrl+U
- 🔲 L1 **shortcut.smallcaps** [shortcut] → WO: Ctrl+Shift+K
- 🔲 L1 **shortcut.subscript** [shortcut] → WO: Ctrl+.
- 🔲 L1 **shortcut.superscript** [shortcut] → WO: Ctrl+,
- 🔲 L1 **shortcut.applylistbullet** [shortcut] → WO: Ctrl+Shift+8 (OO uses Ctrl+Shift+L)
- 🔲 L1 **shortcut.resetchar** [shortcut] → WO: Ctrl+Space (remove formatting)
- 🔲 L1 **shortcut.increasefontsize** [shortcut] → WO: Ctrl+]
- 🔲 L1 **shortcut.decreasefontsize** [shortcut] → WO: Ctrl+[
- 🔲 L1 **shortcut.centerpara** [shortcut] → WO: Ctrl+E
- 🔲 L1 **shortcut.justifypara** [shortcut] → WO: Ctrl+J
- 🔲 L1 **shortcut.rightpara** [shortcut] → WO: Ctrl+R
- 🔲 L1 **shortcut.leftpara** [shortcut] → WO: Ctrl+Shift+L
- 🔲 L1 **shortcut.indent** [shortcut] → WO: Ctrl+M
- 🔲 L1 **shortcut.unindent** [shortcut] → WO: Ctrl+Shift+M
- 🔲 L1 **shortcut.showall** [shortcut] → WO: ¶ button / View toggle (Ctrl+Shift+8 is bulleted-list in WO — OO collision kept as-is)
- 🔲 L1 **shortcut.applyheading1** [shortcut] → WO: Ctrl+Alt+1
- 🔲 L1 **shortcut.applyheading2** [shortcut] → WO: Ctrl+Alt+2
- 🔲 L1 **shortcut.applyheading3** [shortcut] → WO: Ctrl+Alt+3
- ✅ L3 **formatting.change-case** [control] → WO: Change case
- ✅ L3 **formatting.bold-ctrl-b** [control] → WO: bold
- ✅ L3 **formatting.italic-ctrl-i** [control] → WO: italic
- ✅ L3 **formatting.underline-ctrl-u** [control] → WO: underline
- ✅ L3 **formatting.strikethrough-ctrl-5** [control] → WO: strikeThrough
- ✅ L3 **formatting.superscript-ctrl** [control] → WO: superscript
- ✅ L3 **formatting.subscript-ctrl** [control] → WO: subscript
- ✅ L3 **formatting.clear-style** [control] → WO: removeFormat

## insert — 56 features (L0:2 L1:48 L3:6)
- ❌ L0 **insert.insert-spreadsheet** [menu-item] 
- ❌ L0 **shortcut.nonbreakinghyphen** [shortcut] 
- 🔲 L1 **insert.blank-page** [control] → WO: btn-multipage
- 🔲 L1 **insert.breaks** [control] → WO: Breaks
- 🔲 L1 **insert.shape** [control] → WO: insertObject
- 🔲 L1 **insert.smartart** [control] → WO: btn-smartart
- 🔲 L1 **insert.link** [control] → WO: link
- 🔲 L1 **insert.page-number** [control] → WO: insertPageNumber
- 🔲 L1 **insert.text-box** [control] → WO: insertTextbox
- 🔲 L1 **insert.text-art** [control] → WO: insertTextart
- 🔲 L1 **insert.drop-cap** [control] → WO: toggleDropcap
- 🔲 L1 **insert.text-from-file** [control] → WO: btn-textfile
- 🔲 L1 **insert.field** [control] → WO: btn-field
- 🔲 L1 **insert.equation** [control] → WO: btn-equation
- 🔲 L1 **insert.content-controls** [control] → WO: btn-contentcontrol
- 🔲 L1 **insert.select** [control] → WO: inkSelect
- 🔲 L1 **insert.eraser** [control] → WO: toggleInk
- 🔲 L1 **insert.insert-page-break** [menu-item] → WO: btn-multipage
- 🔲 L1 **insert.insert-column-break** [menu-item] → WO: Insert column break
- 🔲 L1 **insert.insert-section-break** [menu-item] → WO: Insert section break
- 🔲 L1 **insert.fractions** [menu-item] → WO: Fractions
- 🔲 L1 **insert.scripts** [menu-item] → WO: Scripts
- 🔲 L1 **insert.radicals** [menu-item] → WO: Radicals
- 🔲 L1 **insert.integrals** [menu-item] → WO: Integrals
- 🔲 L1 **insert.large-operators** [menu-item] → WO: Large operators
- 🔲 L1 **insert.brackets** [menu-item] → WO: Brackets
- 🔲 L1 **insert.functions** [menu-item] → WO: Functions
- 🔲 L1 **insert.accents** [menu-item] → WO: Accents
- 🔲 L1 **insert.limits-and-logarithms** [menu-item] → WO: Limits and logarithms
- 🔲 L1 **insert.operators** [menu-item] → WO: Operators
- 🔲 L1 **insert.matrices** [menu-item] → WO: Matrices
- 🔲 L1 **shortcut.insertlinebreak** [shortcut] → WO: Shift+Enter inserts <br> natively in contentEditable
- 🔲 L1 **shortcut.insertcolumnbreak** [shortcut] → WO: Ctrl+Shift+Enter
- 🔲 L1 **shortcut.nonbreakingspace** [shortcut] → WO: Ctrl+Shift+Space
- 🔲 L1 **shortcut.inserthyperlink** [shortcut] → WO: Ctrl+K
- 🔲 L1 **shortcut.insertpagebreak** [shortcut] → WO: Ctrl+Enter
- 🔲 L1 **shortcut.insertpagenumber** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.inserttab** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.insertendnotenow** [shortcut] → WO: Ctrl+Alt+D
- 🔲 L1 **shortcut.inserttablebreak** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.insertlinebreakmultilineform** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.copyrightsign** [shortcut] → WO: Ctrl+Alt+G
- 🔲 L1 **shortcut.eurosign** [shortcut] → WO: Ctrl+Alt+E
- 🔲 L1 **shortcut.registeredsign** [shortcut] → WO: Ctrl+Alt+R
- 🔲 L1 **shortcut.trademarksign** [shortcut] → WO: Ctrl+Alt+T
- 🔲 L1 **shortcut.insertequation** [shortcut] → WO: Ctrl+Alt+=
- 🔲 L1 **shortcut.horizontalellipsis** [shortcut] → WO: Alt+;
- 🔲 L1 **shortcut.insertfootnotenow** [shortcut] → WO: Ctrl+Alt+F
- 🔲 L1 **shortcut.emdash** [shortcut] → WO: Ctrl+Alt+Minus (OO uses Ctrl+Alt+NumpadMinus; numpad-less web adaptation)
- 🔲 L1 **shortcut.endash** [shortcut] → WO: Ctrl+Shift+Minus (OO uses Ctrl+NumpadMinus; Ctrl+Minus is zoom-out in WO)
- ✅ L3 **insert.date-time** [control] → WO: pagenumber-dialog
- ✅ L3 **insert.symbol** [control] → WO: btn-symbol
- ✅ L3 **insert.more-symbols** [menu-item] → WO: Symbols ▾
- ✅ L3 **insert.symbols** [menu-item] → WO: Symbols ▾
- ✅ L3 **insert.dlg-date-time** [dialog] (1 OO fields) → WO: pagenumber-dialog
- ✅ L3 **insert.dlg-symbol** [dialog] (2 OO fields) → WO: symbol-dialog

## statusbar — 10 features (L0:1 L1:9 L3:0)
- ❌ L0 **statusbar.btn-doc-spell** [statusbar-item] 
- 🔲 L1 **statusbar.word-count** [statusbar-item] → WO: sb-word-count
- 🔲 L1 **statusbar.english-united-states** [statusbar-item] → WO: sb-lang
- 🔲 L1 **statusbar.btn-doc-lang** [statusbar-item] → WO: sb-lang
- 🔲 L1 **statusbar.btn-doc-review** [statusbar-item] → WO: sb-track-changes
- 🔲 L1 **statusbar.status-btn-multiple-pages** [statusbar-item] → WO: btn-multipage
- 🔲 L1 **statusbar.btn-zoom-topage** [statusbar-item] → WO: btn-zoom-fit
- 🔲 L1 **statusbar.btn-zoom-towidth** [statusbar-item] → WO: btn-zoom-fit
- 🔲 L1 **statusbar.btn-zoom-down** [statusbar-item] → WO: btn-zoom-out
- 🔲 L1 **statusbar.btn-zoom-up** [statusbar-item] → WO: btn-zoom-in

## table — 10 features (L0:0 L1:7 L3:3)
- 🔲 L1 **table.table-of-contents** [control] → WO: updatetoc-dialog
- 🔲 L1 **table.update-table** [control] → WO: updateToc
- 🔲 L1 **table.table-of-figures** [control] → WO: insertToF
- 🔲 L1 **table.draw-table** [menu-item] → WO: Draw table
- 🔲 L1 **table.erase-table** [menu-item] → WO: Erase table
- 🔲 L1 **table.dlg-table-of-figures** [dialog] (7 OO fields) → WO: insertToF
- 🔲 L1 **table.dlg-table-of-contents** [dialog] (7 OO fields) → WO: updatetoc-dialog
- ✅ L3 **table.table** [control] → WO: Table ▾
- ✅ L3 **table.insert-custom-table** [menu-item] → WO: btn-table
- ✅ L3 **table.convert-text-to-table** [menu-item] → WO: Convert Text to Table…

## image — 2 features (L0:0 L1:2 L3:0)
- 🔲 L1 **image.image** [control] → WO: btn-hf-image
- 🔲 L1 **image.photo-editor** [control] → WO: photoEditor

## chart — 19 features (L0:0 L1:19 L3:0)
- 🔲 L1 **chart.chart** [control] → WO: insertObject
- 🔲 L1 **chart.chart-elements** [control] → WO: Chart elements ▾
- 🔲 L1 **chart.edit-data** [control] → WO: chartEditData
- 🔲 L1 **chart.update-data** [control] → WO: chartUpdateData
- 🔲 L1 **chart.chart-type** [control] → WO: Chart type ▾
- 🔲 L1 **chart.advanced-settings** [control] → WO: chartSettings
- 🔲 L1 **chart.wrapping** [control] → WO: Wrapping
- 🔲 L1 **chart.width** [control] → WO: chart-width-input
- 🔲 L1 **chart.height** [control] → WO: chart-height-input
- 🔲 L1 **chart.3d-rotation** [control] → WO: chart3d
- 🔲 L1 **chart.axes** [menu-item] → WO: Axes
- 🔲 L1 **chart.axis-titles** [menu-item] → WO: Axis Titles
- 🔲 L1 **chart.chart-title** [menu-item] → WO: Chart title
- 🔲 L1 **chart.data-labels** [menu-item] → WO: Data labels
- 🔲 L1 **chart.error-bars** [menu-item] → WO: Error Bars
- 🔲 L1 **chart.gridlines** [menu-item] → WO: btn-gridlines
- 🔲 L1 **chart.legend** [menu-item] → WO: Legend
- 🔲 L1 **chart.trendline** [menu-item] → WO: Trendline
- 🔲 L1 **chart.up-down-bars** [menu-item] → WO: Up/Down Bars

## review — 16 features (L0:0 L1:16 L3:0)
- 🔲 L1 **review.comment** [control] → WO: insertComment
- 🔲 L1 **review.co-editing-mode** [control] → WO: coedit-mode
- 🔲 L1 **review.add-comment** [control] → WO: btn-comment
- 🔲 L1 **review.delete** [control] → WO: deleteComment
- 🔲 L1 **review.resolve** [control] → WO: resolveComment
- 🔲 L1 **review.track-changes** [control] → WO: btn-track-changes
- 🔲 L1 **review.display-mode** [control] → WO: displayMode
- 🔲 L1 **review.previous** [control] → WO: prevTrackedChange
- 🔲 L1 **review.next** [control] → WO: nextTrackedChange
- 🔲 L1 **review.accept** [control] → WO: acceptTrackedChange
- 🔲 L1 **review.reject** [control] → WO: rejectTrackedChange
- 🔲 L1 **review.compare** [control] → WO: compareVersion
- 🔲 L1 **review.combine** [control] → WO: combineRevisions
- 🔲 L1 **review.chat** [control] → WO: toggleChat
- 🔲 L1 **review.thesaurus** [control] → WO: aiRewrite
- 🔲 L1 **review.grammar-spelling** [control] → WO: btn-ai-grammar

## headerfooter — 6 features (L0:0 L1:3 L3:3)
- 🔲 L1 **headerfooter.page-number** [control] → WO: insertPageNumber
- 🔲 L1 **headerfooter.field** [control] → WO: btn-field
- 🔲 L1 **headerfooter.close** [control] → WO: btn-hf-close
- ✅ L3 **headerfooter.header-footer** [control] → WO: insertHeaderFooter
- ✅ L3 **headerfooter.date-time** [control] → WO: pagenumber-dialog
- ✅ L3 **headerfooter.dlg-date-time** [dialog] (1 OO fields) → WO: pagenumber-dialog

## page — 49 features (L0:0 L1:49 L3:0)
- 🔲 L1 **page.margins** [control] → WO: Margins
- 🔲 L1 **page.orientation** [control] → WO: Orientation
- 🔲 L1 **page.size** [control] → WO: Size
- 🔲 L1 **page.columns** [control] → WO: Columns
- 🔲 L1 **page.breaks** [control] → WO: Breaks
- 🔲 L1 **page.line-numbers** [control] → WO: toggleLineNumbers
- 🔲 L1 **page.hyphenation** [control] → WO: Hyphenation
- 🔲 L1 **page.wrapping** [control] → WO: Wrapping
- 🔲 L1 **page.bring-forward** [control] → WO: objectOp
- 🔲 L1 **page.send-backward** [control] → WO: objectOp
- 🔲 L1 **page.align** [control] → WO: Align
- 🔲 L1 **page.group** [control] → WO: objectOp
- 🔲 L1 **page.merge-shapes** [control] → WO: btn-mergeshapes
- 🔲 L1 **page.watermark** [control] → WO: toggleWatermark
- 🔲 L1 **page.page-color** [control] → WO: btn-multipage
- 🔲 L1 **page.colors** [control] → WO: themecolors
- 🔲 L1 **page.last-custom** [menu-item] → WO: Last Custom
- 🔲 L1 **page.normal** [menu-item] → WO: Normal
- 🔲 L1 **page.narrow** [menu-item] → WO: Narrow
- 🔲 L1 **page.moderate** [menu-item] → WO: Moderate
- 🔲 L1 **page.wide** [menu-item] → WO: Wide
- 🔲 L1 **page.custom-margins** [menu-item] → WO: Custom margins
- 🔲 L1 **page.us-letter** [menu-item] → WO: Letter
- 🔲 L1 **page.us-legal** [menu-item] → WO: Legal
- 🔲 L1 **page.a4** [menu-item] → WO: A4
- 🔲 L1 **page.a5** [menu-item] → WO: A5
- 🔲 L1 **page.b5** [menu-item] → WO: B5
- 🔲 L1 **page.envelope-10** [menu-item] → WO: Envelope #10
- 🔲 L1 **page.envelope-dl** [menu-item] → WO: Envelope DL
- 🔲 L1 **page.tabloid** [menu-item] → WO: Tabloid
- 🔲 L1 **page.a3** [menu-item] → WO: A3
- 🔲 L1 **page.tabloid-oversize** [menu-item] → WO: Tabloid Oversize
- 🔲 L1 **page.roc-16k** [menu-item] → WO: ROC 16K
- 🔲 L1 **page.envelope-choukei-3** [menu-item] → WO: Envelope Choukei 3
- 🔲 L1 **page.super-b-a3** [menu-item] → WO: Super B/A3
- 🔲 L1 **page.custom-page-size** [menu-item] → WO: btn-multipage
- 🔲 L1 **page.one** [menu-item] → WO: One
- 🔲 L1 **page.two** [menu-item] → WO: Two
- 🔲 L1 **page.three** [menu-item] → WO: Three
- 🔲 L1 **page.left** [menu-item] → WO: Left
- 🔲 L1 **page.right** [menu-item] → WO: Right
- 🔲 L1 **page.custom-columns** [menu-item] → WO: Custom columns
- 🔲 L1 **page.none** [menu-item] → WO: None
- 🔲 L1 **page.automatic** [menu-item] → WO: Automatic
- 🔲 L1 **page.hyphenation-options** [menu-item] → WO: Hyphenation options
- 🔲 L1 **page.dlg-margins** [dialog] (8 OO fields) → WO: Margins
- 🔲 L1 **page.dlg-page-size** [dialog] (3 OO fields) → WO: btn-multipage
- 🔲 L1 **page.dlg-columns** [dialog] (5 OO fields) → WO: columns-dialog
- 🔲 L1 **page.dlg-hyphenation** [dialog] (2 OO fields) → WO: hyphenation-dialog

## references — 9 features (L0:0 L1:9 L3:0)
- 🔲 L1 **references.add-text** [control] → WO: btn-addtext
- 🔲 L1 **references.footnote** [control] → WO: insertFootnote
- 🔲 L1 **references.link** [control] → WO: link
- 🔲 L1 **references.bookmark** [control] → WO: bookmark-dialog
- 🔲 L1 **references.caption** [control] → WO: insertCaption
- 🔲 L1 **references.cross-reference** [control] → WO: crossref-dialog
- 🔲 L1 **references.dlg-bookmarks** [dialog] (2 OO fields) → WO: bookmark-dialog
- 🔲 L1 **references.dlg-insert-caption** [dialog] (8 OO fields) → WO: insertCaption
- 🔲 L1 **references.dlg-cross-reference** [dialog] (5 OO fields) → WO: crossref-dialog

## protect — 2 features (L0:0 L1:2 L3:0)
- 🔲 L1 **protect.encrypt** [control] → WO: protectDialog
- 🔲 L1 **protect.protect-document** [control] → WO: restrictEditing

## view — 8 features (L0:0 L1:8 L3:0)
- 🔲 L1 **view.headings** [control] → WO: btn-view-headings
- 🔲 L1 **view.fit-to-page** [control] → WO: btn-multipage
- 🔲 L1 **view.fit-to-width** [control] → WO: btn-view-fit-width
- 🔲 L1 **view.zoom-to-100** [control] → WO: btn-zoom-reset
- 🔲 L1 **view.multiple-pages** [control] → WO: btn-multipage
- 🔲 L1 **view.interface-theme** [control] → WO: view-theme-select
- 🔲 L1 **view.dark-document** [control] → WO: btn-view-darkdoc
- 🔲 L1 **view.pause-recording** [control] → WO: Pause recording

## macros — 3 features (L0:0 L1:3 L3:0)
- 🔲 L1 **macros.macros** [control] → WO: btn-macro-menu
- 🔲 L1 **macros.record-macro** [control] → WO: Record macro
- 🔲 L1 **macros.dlg-macros** [dialog] (1 OO fields) → WO: btn-macro-menu

## plugins — 10 features (L0:0 L1:10 L3:0)
- 🔲 L1 **plugins.plugin-manager** [control] → WO: plugins-dialog
- 🔲 L1 **plugins.background-plugins** [control] → WO: plugins-dialog
- 🔲 L1 **plugins.youtube** [control] → WO: pluginUnavailable
- 🔲 L1 **plugins.ocr** [control] → WO: ocrRun
- 🔲 L1 **plugins.translator** [control] → WO: aiTranslate
- 🔲 L1 **plugins.mendeley** [control] → WO: pluginUnavailable
- 🔲 L1 **plugins.highlight-code** [control] → WO: code
- 🔲 L1 **plugins.zotero** [control] → WO: pluginUnavailable
- 🔲 L1 **plugins.speech** [control] → WO: btn-speech
- 🔲 L1 **plugins.speech-input** [control] → WO: dictate

## other — 5 features (L0:0 L1:5 L3:0)
- 🔲 L1 **other.settings** [control] → WO: aiSettings
- 🔲 L1 **other.chatbot** [control] → WO: btn-ai-assistant
- 🔲 L1 **other.summarization** [control] → WO: aiSummarize
- 🔲 L1 **other.translation** [control] → WO: aiTranslate
- 🔲 L1 **other.create-ai-assistant** [control] → WO: createAiAssistant

## edit — 27 features (L0:0 L1:27 L3:0)
- 🔲 L1 **shortcut.deleteleftchar** [shortcut] → WO: Backspace
- 🔲 L1 **shortcut.deleterightchar** [shortcut] → WO: Delete
- 🔲 L1 **shortcut.editundo** [shortcut] → WO: Ctrl+Z
- 🔲 L1 **shortcut.editredo** [shortcut] → WO: Ctrl+Y / Ctrl+Shift+Z
- 🔲 L1 **shortcut.editselectall** [shortcut] → WO: Ctrl+A
- 🔲 L1 **shortcut.selecttostartline** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.selecttoendline** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.selecttostartdocument** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.selecttoenddocument** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.selectrightchar** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.selectleftchar** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.selectlineup** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.selectlinedown** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.selectpageup** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.selectpagedown** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.selecttobeginpreviouspage** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.selecttobeginnextpage** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.editshape** [shortcut] → WO: Enter edits object
- 🔲 L1 **shortcut.editchart** [shortcut] → WO: Enter edits object
- 🔲 L1 **shortcut.deleteleftword** [shortcut] → WO: Alt+Backspace
- 🔲 L1 **shortcut.deleterightword** [shortcut] → WO: Alt+Delete
- 🔲 L1 **shortcut.cut** [shortcut] → WO: Ctrl+X / Cmd+X
- 🔲 L1 **shortcut.copy** [shortcut] → WO: Ctrl+C / Cmd+C
- 🔲 L1 **shortcut.paste** [shortcut] → WO: Ctrl+V / Cmd+V
- 🔲 L1 **shortcut.pastetextwithoutformat** [shortcut] → WO: Ctrl+Shift+V
- 🔲 L1 **shortcut.selectrightword** [shortcut] → WO: browser caret/scroll (n/a for web editor)
- 🔲 L1 **shortcut.selectleftword** [shortcut] → WO: browser caret/scroll (n/a for web editor)
