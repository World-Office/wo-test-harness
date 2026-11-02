# VIS-002 — Right settings panel "not reducible": Root Cause & Fix

**Status:** DONE — fixed on server `main`, commit `be3546239`
("VIS-002: right settings panel can collapse again").

## Symptom

The right settings panel (`#right-panel`, the AF7 icon-rail settings sidebar
in `documenteditor-wysiwyg`) rendered visible at page load and no toggle —
View-tab button, rail icon, `toggleRightPanel` command — ever collapsed it.
"Right menu not reducible."

## Root cause

Not in `editor.js` — the toggle logic was correct (`toggleRightPanel()` at
editor.js:6604 flips the `hidden` property + `main.rp-open`). The CSS was
broken: `#right-panel { display: flex; … }` (style.css:2244) is an author
rule and **overrides the UA stylesheet's `[hidden]{display:none}`**, so the
`hidden` attribute never visually did anything. Every sibling panel
(`.side-panel[hidden]`, `#ctx-menu[hidden]`) carries an author `[hidden]`
rule; `#right-panel` was the only one missing it.

## Fix (server repo)

- `style.css`: one rule — `#right-panel[hidden] { display: none; }`
- `right-panel.test.mjs`: static pin that the rule exists (so it can't
  silently regress).

## Verification (re-run 2026-11-02, attempt 2)

- `node right-panel.test.mjs` → RIGHT-PANEL-PASS
- `node consistency-gate.test.mjs` → OK
- `node chrome-gate.test.mjs` → OK
- Acceptance gate verbatim → `grep -c 'right.*menu' …/editor.js && echo OK`
  → OK

Note: this task's fix lives in the **server** repo (its gate runs there);
the harness worktree only carries this record.
