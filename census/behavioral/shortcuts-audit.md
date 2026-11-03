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
- **Ctrl+Shift+L**: Show/hide formatting marks

## Lists
- **Ctrl+Shift+8**: Bulleted list
- **Ctrl+Shift+7**: Numbered list
- **Ctrl+Shift+9**: Remove indentation decrease list level
- **Ctrl+Shift+0**: Remove indentation increase list level

## Insert Operations
- **Ctrl+Enter**: Page break
- **Shift+Enter**: Line break
- **Ctrl+Tab**: Insert tab
- **Ctrl+;**: Insert date
- **Ctrl+Shift+;**: Insert time
- **Alt+Shift+D**: Insert endnote
- **Ctrl+Alt+D**: Insert date field
- **Ctrl+Alt+T**: Insert time field
- **Ctrl+Shift+F12**: Insert page number field

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
- **Ctrl+Alt+M**: Insert comment
- **Ctrl+Alt+E**: Track Changes toggle
- **Ctrl+Alt+A**: Accept change
- **Ctrl+Alt+R**: Reject change
- **Ctrl+Alt+D**: Delete comment

## Tools
- **Ctrl+Alt+I**: Insert citation
- **Ctrl+Alt+B**: Insert bibliography
- **F7**: Spell check
- **Ctrl+Alt+C**: Toggle spell check as you type
- **Ctrl+Alt+H**: Replace with suggested correction

## Window
- **Ctrl+K**: Clear formatting
- **Ctrl+F6**: Next window
- **Ctrl+Shift+F6**: Previous window
- **Ctrl+Tab**: Next tab/document
- **Ctrl+Shift+Tab**: Previous tab/document

## Special
- **Ctrl+Meta+X**: Strikethrough (shortcut variant)
- **Ctrl+Shift+Minus**: Non-breaking hyphen
- **Ctrl+Shift+Underscore**: Insert non-breaking space

---

## WO Implementation Status

| Shortcut | OO | WO | Status | Notes |
|----------|-----|-----|--------|-------|
| Ctrl+N | New document | ✅ | Implemented | Creates new doc |
| Ctrl+O | Open | ✅ | Implemented | Opens file picker |
| Ctrl+S | Save | ✅ | Implemented | Saves current doc |
| Ctrl+Shift+S | Save As | ✅ | Implemented | Opens save dialog |
| Ctrl+P | Print | ✅ | Implemented | Opens print dialog |
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
| Ctrl+Shift+X | Strikethrough | ❌ | Missing | No direct shortcut |
| Ctrl+Meta+X | Strikethrough | ❌ | Missing | No alternative |
|Ctrl+L | Align Left | ✅ | Implemented | Works |
| Ctrl+E | Align Center | ✅ | Implemented | Works |
| Ctrl+R | Align Right | ✅ | Implemented | Works |
| Ctrl+J | Justify | ✅ | Implemented | Works |
| Ctrl+M | Indent | ✅ | Implemented | Increases left margin |
| Ctrl+Shift+M | Outdent | ✅ | Implemented | Decreases left margin |
| Ctrl+Shift+8 | Bulleted list | ✅ | Implemented | Creates unordered list |
| Ctrl+Shift+7 | Numbered list | ✅ | Implemented | Creates ordered list |
| Ctrl+1 | Single spacing | ❌ | Missing |  |
| Ctrl+2 | Double spacing | ❌ | Missing |  |
| Ctrl+5 | 1.5 spacing | ❌ | Missing |  |
| Ctrl+Enter | Page break | ✅ | Implemented | Inserts page break |
| Shift+Enter | Line break | ✅ | Implemented | Soft line break |
| Ctrl+Period | Subscript | ✅ | Implemented | Works |
| Ctrl+Comma | Superscript | ✅ | Implemented | Works |
| Ctrl+[ | Decrease font size | ❌ | Missing |  |
| Ctrl+] | Increase font size | ❌ | Missing |  |
| Tab | Next cell (table) | ✅ | Implemented |  |
| Shift+Tab | Previous cell (table) | ✅ | Implemented |  |
| Escape | Close dialog | ✅ | Implemented | Most dialogs support |
| F7 | Spell check | ❌ | Missing | No spell check |
| Ctrl+Alt+E | Track Changes | ❌ | Missing | No track changes yet |
| Ctrl+Alt+M | Insert comment | ❌ | Missing | No comments yet |
| Ctrl+G | Go to page | ✅ | Implemented | Opens go-to dialog |

## Category Summary

| Category | Total | Implemented | Missing |
|----------|-------|-------------|---------|
| File | 7 | 7 | 0 |
| Edit | 7 | 7 | 0 |
| Format | 16 | 8 | 8 |
| Insert | 6 | 6 | 0 |
| Paragraph | 8 | 4 | 4 |
| Table | 4 | 4 | 0 |
| Navigation | 8 | 8 | 0 |
| Tools | 4 | 0 | 4 |
| View | 4 | 4 | 0 |
| **Total** | **64** | **48** | **16** |
