# Table Features Audit (WO vs OO)

Ground truth for this audit: the OnlyOffice document-editor bundle on the OO
container (`docker exec nc-ooh-onlyonlyonlyoffice-1`), files
`/var/www/onlyoffice/documentserver/web-apps/apps/documenteditor/main/app.js`
and `.../app/view/TableSettingsAdvanced.js`. Every claim below cites either a
WO line anchor or an OO-bundle grep verdict. Rows that could not be grounded
in the OO bundle are retracted to the out-of-census section — they were
written from MS Word / LibreOffice knowledge, not from the census, and are
NOT parity gaps.

## Implemented in WO (verified)

Core table surface (previously verified, still current in
`apps/web/apps/documenteditor-wysiwyg/editor.js`):

- [x] Insert table
- [x] Delete table
- [x] Add row above/below
- [x] Delete row
- [x] Add column left/right
- [x] Delete column
- [x] Merge cells (basic)
- [x] Split cells (basic)
- [x] Select row/column/table
- [x] Table borders
- [x] Table background color
- [x] Cell alignment
- [x] Table properties dialog

Rows that were stale under "Missing in WO" — the features EXIST in WO's
`apps/web/apps/documenteditor-wysiwyg/editor.js`:

- [x] **Convert table to text** — `openTableToTextDialog`, cmd
      `convertTableToText` (~editor.js:1544)
- [x] **Convert text to table** — `text-to-table-dialog` (~editor.js:2218)
- [x] **Table formulas** — `formulaCellValue` (~editor.js:2455);
      `table-formula.test.mjs` exists
- [x] **Alternating row colors** (banded rows) — `applyTableBanded`, class
      `table-banded`
- [x] **Insert row/column at end** — covered by the existing add-row-below /
      add-column-right handlers (same mechanism as OO's context menu)

## Out-of-census (fabricated rows retracted)

Each row below was listed as "Missing in WO" based on MS Word / LibreOffice
knowledge, NOT the OnlyOffice census. Grep against the OO document-editor
bundle shows OnlyOffice does not ship these either, so they are not parity
gaps:

- **Table sorting** — OO-bundle grep `sortTable|SortRange|"Sort"` → ZERO
  matches → OO document editor has NO table sorting.
- **Header row repeat** — OO-bundle grep `RepeatHeadingRows|repeat` → ZERO
  matches → no header-row-repeat in OO.
- **AutoFit column width** — OO-bundle grep `autofit|AutoFit|TableLayout` in
  app.js → ZERO matches → no AutoFit toggle in OO.
- **AutoFormat table** (one-click styling) — Word/LibreOffice feature; no
  OO-bundle evidence of any equivalent → out of census.
- **Distribute rows/columns** (equal spacing) — Word/LibreOffice feature; no
  OO-bundle evidence → out of census.

## Genuinely open (OO-bundle evidence exists)

- **Banded columns** — the one OO table-styler capability WO did not have at
  capture time. OO's `TableSettingsAdvanced.js` DOES contain
  `tableStylerRows` AND `tableStylerColumns` (banded rows/columns); WO ships
  banded rows only (`applyTableBanded`). A separate task lands banded
  columns.

## Partial Implementation (UI-level observations)

- [~] **Merge cells** - Works for 2+ cells but not multi-selection merge
- [~] **Split cells** - Works but limited to simple cases
- [~] **Cell padding** - Basic support, missing fine controls
- [~] **Cell spacing** - Basic support, missing fine controls

(These are WO-side UI observations; they are not re-verified against the OO
bundle in this audit.)

## Code References

### WO Table Implementation
- **editor.js** (`apps/web/apps/documenteditor-wysiwyg/`): table toolbar
  handlers; `convertTableToText` ~line 1544, text-to-table dialog ~line 2218,
  `formulaCellValue` ~line 2455, `applyTableBanded` (banded rows)
- **table-dialog.html**: Basic table insertion
- **table-properties-dialog.html**: Table styling
- **table-formula.test.mjs**: Existing tests

### OO Table Features Reference
- OO ships banded rows/columns via `tableStylerRows` / `tableStylerColumns`
  in `app/view/TableSettingsAdvanced.js`.
- OO does NOT ship table sorting, header-row repeat, or AutoFit (grep verdicts
  above).

## OO Shortcut Mapping

| Action | OO Shortcut | WO Status |
|--------|-------------|-----------|
| Insert Table | Ctrl+Alt+T | ❌ Missing |
| Next Cell | Tab | ✅ Implemented |
| Previous Cell | Shift+Tab | ✅ Implemented |
| Next Row | Down Arrow | ✅ Implemented |
| Previous Row | Up Arrow | ✅ Implemented |
| Select Row | Alt+5 (numpad) | ❌ Missing |
| Select Column | Alt+Shift+5 (numpad) | ❌ Missing |
| Select Table | Alt+5,5 (numpad) | ❌ Missing |

(Note: the "❌ Missing" shortcut statuses are from the original audit and were
not re-verified against the OO bundle here.)
