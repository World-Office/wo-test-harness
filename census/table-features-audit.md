# Table Features Audit (WO vs OO)

## OO Table Features

### ✅ Implemented in WO
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

### ❌ Missing in WO
- [ ] **Table Styles** - Pre-defined formatting styles
- [ ] **Alternating row colors** - Zebra striping
- [ ] **Header row repeat** - Repeat header on each page
- [ ] **Table sorting** - Sort by column
- [ ] **Table formulas** - =SUM(), =AVERAGE() in cells
- [ ] **Convert table to text** - With various delimiters
- [ ] **Convert text to table** - With various delimiters
- [ ] **AutoFit column width** - Auto size columns to content
- [ ] **Distribute rows/columns** - Equal spacing
- [ ] **AutoFormat table** - One-click styling
- [ ] **Insert row at end** - Quick row addition
- [ ] **Insert column at end** - Quick column addition

### 🟡 Partial Implementation
- [~] **Merge cells** - Works for 2+ cells but not multi-selection merge
- [~] **Split cells** - Works but limited to simple cases
- [~] **Cell padding** - Basic support, missing fine controls
- [~] **Cell spacing** - Basic support, missing fine controls

## Code References

### WO Table Implementation
- **editor.js**: ~Line 5000-6000 - Table toolbar handlers
- **table-dialog.html**: Basic table insertion
- **table-properties-dialog.html**: Table styling
- **table-formula.test.mjs**: Existing tests

### OO Table Features Reference
- OO supports all listed features via:
  - Home > Table ribbon group
  - Table Design ribbon tab
  - Table Layout ribbon tab
  - Right-click context menu on tables

## Recommended Implementation Order

1. **High Priority**:
   - Table Styles (visual parity)
   - Alternating row colors (common request)
   - AutoFit column width (UX improvement)

2. **Medium Priority**:
   - Header row repeat (print queries)
   - Convert table/text ( readability)
   - AutoFormat (quick styling)

3. **Low Priority**:
   - Table formulas (advanced feature)
   - Table sorting (advanced feature)
   - Distribute rows/columns (edge case)

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
