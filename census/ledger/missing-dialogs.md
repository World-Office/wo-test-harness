# Missing WO Dialogs (vs OO)

## Dialog ID Comparison

### OO Dialogs (from census-oo-dialogs.cjs)
Total: 61 dialogs identified in OO

### WO Dialogs (from DIALOG_IDS registry in editor.js line 2038)
Total: 61 dialogs in WO

## Analysis

The WO DIALOG_IDS registry at editor.js:2038 contains 61 entries:
```
const DIALOG_IDS = {
  'about': 'about-dialog',
  'advanced-settings': 'advanced-settings-dialog',
  'anchor': 'anchor-dialog',
  'autocorrect': 'autocorrect-dialog',
  'cc': 'cc-dialog',
  'chart': 'chart-dialog',
  ... (61 total)
}
```

### OO Dialogs NOT in WO:

1. **mail-merge** - Mail merge functionality
2. **mail-merge-field** - Mail merge field selection
3. **mail-merge-recipients** - Mail merge recipients
4. **macro** - Macro editor/manager
5. **macro-organize** - Organize macros
6. **macro-run** - Run macro dialog
7. **plug-ins** - Plugin management
8. **plug-ins-install** - Install plugins
9. **speech** - Speech-to-text
10. **speech-settings** - Speech settings

### WO Dialogs NOT in OO:
(None - WO dialog set is a subset + some custom)

## Recommended Actions

1. **Implement Mail Merge**: Create mail-merge-dialog.html + wiring in editor.js
2. **Implement Macro Support**: Create macro-dialog.html for recording/running macros
3. **Implement Plugin System**: Create plug-ins-dialog.html for plugin management
4. **Implement Speech**: Create speech-dialog.html for voice input

## Priority
- **High**: Macro support (enterprise feature)
- **Medium**: Mail Merge (common business use case)
- **Low**: Plugins, Speech (nice to have)
