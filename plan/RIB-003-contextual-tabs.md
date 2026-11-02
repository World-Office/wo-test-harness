# RIB-003 — Ribbon contextual tabs (chart-design, etc.) auto-show/hide

**Status: DONE.** Code lives in the server repo, commit
`163b6c74e` on `World-Office/server` main (attempt 1 landed it there but
committed nothing in this worktree — the campaign reads commits here, hence
the spurious "no change" failure this record fixes).

## Acceptance gate (verbatim)

```sh
grep -q contextual /home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg/editor.js && echo OK || echo FAIL
# → OK
```

## What shipped (server apps/web/apps/documenteditor-wysiwyg/editor.js)

- **chart-design tab**: shown + activated on chart click; hidden via shared
  `hideChartDesignTab()` (falls back to Home if it was active). Auto-hide
  without a click (Delete/Backspace, Ctrl+X, undo, context-menu objectOp
  delete) via one childList-only `MutationObserver` — rerenders touch
  attributes only, so the observer stays quiet while the chart lives.
- **header-footer tab**: `enterHFMode`/`exitHFMode` toggle `hfTab.hidden`
  symmetrically (double-click header/footer enters; body dblclick, another
  tab, close button, Escape exits — with unsaved-changes confirm, asc-gen673).

## Evidence

- `node --test contextual-tabs.test.mjs` → 1 pass, 0 fail (pins: tabs start
  hidden+contextual in index.html, show/click-activate, shared hide helper,
  MutationObserver wiring, HF symmetric toggle).
- `node --test chart-design.test.mjs` → 1 pass, 0 fail (no regression).
