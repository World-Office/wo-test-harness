# OO Keyboard Shortcuts Audit

## File Operations
- **Ctrl+N**: New document
- **Ctrl+O**: Open document
- **Ctrl+S**: Save
- **Ctrl+Shift+S**: Save As
- **Ctrl+P**: Print
- **Ctrl+Z**: Undo
- **Ctrl+Y**: Redo
- **Ctrl+Q**: Quit/Close

## Edit Operations
- **Ctrl+C**: Copy
- **Ctrl+X**: Cut
- **Ctrl+V**: Paste
- **Ctrl+A**: Select All
- **Ctrl+F**: Find
- **Ctrl+H**: Replace
- **Ctrl+G**: Find Next
- **Ctrl+Shift+G**: Find Previous
- **Delete**: Delete selection
- **Backspace**: Backspace
- **Ctrl+Backspace**: Delete word before cursor
- **Delete**: Delete word after cursor

## Format Operations
- **Ctrl+B**: Bold
- **Ctrl+I**: Italic
- **Ctrl+U**: Underline
- **Ctrl+Shift+X**: Strikethrough
- **Ctrl+.**: Subscript
- **Ctrl+,**: Superscript
- **Ctrl+[**: Decrease font size
- **Ctrl+]**: Increase font size
- **Ctrl+Shift+<**: Decrease font size
- **Ctrl+Shift+>**: Increase font size

## Paragraph Format
- **Ctrl+L**: Align Left
- **Ctrl+E**: Align Center
- **Ctrl+R**: Align Right
- **Ctrl+J**: Justify
- **Ctrl+M**: Indent (increase left margin)
- **Ctrl+Shift+M**: Outdent (decrease left margin)
- **Ctrl+1**: Single spacing
- **Ctrl+2**: Double spacing
- **Ctrl+5**: 1.5 spacing
- **Ctrl+Shift+8**: Show/hide formatting marks (OO ShowAll)

## Lists
- **Ctrl+Shift+L**: Bulleted list (OO ApplyListBullet)
- **Ctrl+Shift+7**: Numbered list (Google Docs combo; OO-free slot)

## Insert Operations
- **Ctrl+Enter**: Page break
- **Shift+Enter**: Line break
- **Ctrl+Tab**: Insert tab
- **Ctrl+;**: Insert date
- **Ctrl+Shift+;**: Insert time
- **Alt+Shift+D**: Insert endnote
- **Ctrl+Alt+D**: Insert date field
- **Ctrl+Alt+T**: Insert time field
- **Ctrl+Shift+P**: Insert page number field (OO census combo)

## Navigation
- **Ctrl+Home**: Go to beginning of document
- **Ctrl+End**: Go to end of document
- **Ctrl+Page Up**: Go to previous page
- **Ctrl+Page Down**: Go to next page
- **Ctrl+G**: Go to page
- **Home**: Go to beginning of line
- **End**: Go to end of line
- **Ctrl+Left Arrow**: Go to previous word
- **Ctrl+Right Arrow**: Go to next word
- **Ctrl+Up Arrow**: Go up one paragraph
- **Ctrl+Down Arrow**: Go down one paragraph

## View
- **Ctrl+Alt+1**: Single page view
- **Ctrl+Alt+2**: Multiple pages view
- **Ctrl+Alt+5**: Draft view
- **Ctrl+F10**: Toggle ruler
- **F12**: Save As
- **Alt+F4**: Close window

## Tables
- **Tab**: Move to next cell in table
- **Shift+Tab**: Move to previous cell in table
- **Enter**: Move to next cell (in table)
- **Shift+Enter**: Move to previous cell (in table)
- **Alt+5** (on numpad): Select entire table
- **Alt+Shift+F1**: Insert table formula

## Review
- **Ctrl+Shift+H**: Open comments panel (OO census combo)
- **Alt+Meta+A**: Insert comment at caret (OO census combo, Mac-canonical)
- Track changes / accept / reject: no OO shortcut combos — ribbon buttons only

## Tools
- **F7**: Spell check toggle (Word convention; WO bonus binding — not an OO census combo)
- **Ctrl+Alt+C**: Copy format / format painter (OO convention — NOT spellcheck)

## Window
- **Ctrl+K**: Insert hyperlink (OO convention — NOT clear formatting)
- **Ctrl+Shift+Tab**: Previous file tab (WO: no file-tabs UI yet)

## Special
- **Ctrl+Meta+X**: Strikethrough (shortcut variant)
- **Ctrl+Shift+Minus**: Non-breaking hyphen
- **Ctrl+Shift+Underscore**: Insert non-breaking space

---

## WO Implementation Status

Verified against editor.js (C1 shortcut parity block) and the live census
probe on 2026-11-03. Rows marked **realigned** changed combo to match the OO
census; rows marked **was-already** were implemented earlier — previous audit
versions wrongly reported them missing.

| Shortcut | OO | WO | Status | Notes |
|----------|-----|-----|--------|-------|
| Ctrl+N | New document | ✅ | Implemented | Creates new doc |
| Ctrl+O | Open | ✅ | Implemented | Backstage open pane |
| Ctrl+S | Save | ✅ | Implemented | Saves current doc |
| Ctrl+Shift+S | Save As | ✅ | Implemented | Export backstage pane |
| Ctrl+P | Print | ✅ | Implemented | window.print |
| Ctrl+Z | Undo | ✅ | Implemented | Full history |
| Ctrl+Y | Redo | ✅ | Implemented | Full history |
| Ctrl+C | Copy | ✅ | Implemented | Copy selection |
| Ctrl+X | Cut | ✅ | Implemented | Cut selection |
| Ctrl+V | Paste | ✅ | Implemented | Paste from clipboard |
| Ctrl+A | Select All | ✅ | Implemented | Selects all content |
| Ctrl+F | Find | ✅ | Implemented | Opens find dialog |
| Ctrl+H | Replace | ✅ | Implemented | Opens replace dialog |
| Ctrl+B | Bold | ✅ | Implemented | Toggles bold on selection |
| Ctrl+I | Italic | ✅ | Implemented | Toggles italic on selection |
| Ctrl+U | Underline | ✅ | Implemented | Toggles underline on selection |
| Ctrl+Shift+X | Strikethrough | ✅ | **was-already** | emitCommand("strikeThrough") — audit was wrong |
| Ctrl+Meta+X | Strikethrough (Mac) | ✅ | **was-already** | Same binding (Shift+Meta+X) |
| Ctrl+L | Align Left | ✅ | **realigned** | Plain Ctrl+L; freed Shift+L for OO bullets |
| Ctrl+E | Align Center | ✅ | Implemented | Works |
| Ctrl+R | Align Right | ✅ | Implemented | Works |
| Ctrl+J | Justify | ✅ | Implemented | Works |
| Ctrl+M | Indent | ✅ | Implemented | Increases left margin |
| Ctrl+Shift+M | Outdent | ✅ | Implemented | Decreases left margin |
| Ctrl+Shift+L | Bulleted list | ✅ | **realigned** | OO ApplyListBullet combo (was justifyLeft) |
| Ctrl+Shift+8 | Show formatting marks | ✅ | **realigned** | OO ShowAll combo — marks overlay toggle |
| Ctrl+Shift+7 | Numbered list | ✅ | Implemented | Google Docs combo (OO-free slot) |
| Ctrl+1 | Single spacing | ✅ | **new** | emitCommand("lineHeight","1") |
| Ctrl+2 | Double spacing | ✅ | **new** | emitCommand("lineHeight","2") |
| Ctrl+5 | 1.5 spacing | ✅ | **new** | emitCommand("lineHeight","1.5") |
| Ctrl+Shift+P | Insert page number | ✅ | **realigned** | OO combo; inserts PAGE-field span (was right panel) |
| Ctrl+Enter | Page break | ✅ | Implemented | Inserts page break |
| Shift+Enter | Line break | ✅ | Implemented | Soft line break (jest-gated) |
| Ctrl+. | Subscript | ✅ | Implemented | Works |
| Ctrl+, | Superscript | ✅ | Implemented | Works |
| Ctrl+[ | Decrease font size | ✅ | **was-already** | fontSizeDec — audit was wrong |
| Ctrl+] | Increase font size | ✅ | **was-already** | fontSizeInc — audit was wrong |
| Tab | Next cell (table) | ✅ | Implemented | |
| Shift+Tab | Previous cell (table) | ✅ | Implemented | |
| Escape | Close dialog | ✅ | Implemented | Universal via DIALOG_IDS + generic handler |
| F7 | Spell check | ✅ | **new** | Word convention bonus; toggles spell engine |
| Ctrl+G | Go to page | ✅ | Implemented | Opens go-to dialog |

### Not OO parity items (previous audit rows, corrected)

- **Ctrl+Alt+E / Ctrl+Alt+M (track changes / comment)**: NOT OO census
  combos — fabricated from Word knowledge. WO binds Ctrl+Alt+E to the Euro
  symbol (OO 9.4 convention) and comments to Ctrl+Shift+H (OO combo, matched).
  OO exposes no track-changes shortcut; the WO track-changes toggle is a
  ribbon button.

## OO Census Verdict Summary

From `census/census-shortcuts.json` (147 OO shortcut types probed from the
OO bundle):

| Verdict | Count | Meaning |
|---------|-------|---------|
| matched | 57 | Same combo bound in WO |
| browser-native | 17 | Native contenteditable/browser behavior |
| nav | 70 | Editor-internal navigation (caret/scroll/model — n/a) |
| diverged | 3 | Feature present, different combo (EmDash numpad, SpeechWorker→TTS, ordered list Ctrl+Shift+7) |
| missing | 0 | — |

## Category Summary

| Category | Total | Implemented | Missing |
|----------|-------|-------------|---------|
| File | 7 | 7 | 0 |
| Edit | 7 | 7 | 0 |
| Format | 16 | 16 | 0 |
| Insert | 6 | 6 | 0 |
| Paragraph | 12 | 12 | 0 |
| List | 3 | 3 | 0 |
| Table | 4 | 4 | 0 |
| Navigation | 8 | 8 | 0 |
| Tools | 1 | 1 | 0 |
| View | 4 | 4 | 0 |
| **Total** | **68** | **68** | **0** |
