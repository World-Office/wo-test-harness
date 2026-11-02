# BHV-001 — Behavioral gate: Shift+Enter text stays on the page sheet

**Status: DONE** — server commit `e82cdbbe2` (branch `main`,
`World-Office/server`), gate green.

## Deliverable

`apps/web/apps/documenteditor-wysiwyg/shift-enter-behavior.test.mjs`
(122 lines, zero-dependency `node:assert` + `readFile`, convention of the
129 sibling `*.test.mjs` gates). Acceptance gate:

```sh
test -f /home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg/shift-enter-behavior.test.mjs && echo OK
# → OK
```

Static pins over the full Shift+Enter chain:

- native `insertLineBreak` never hijacked (only Ctrl+Enter / Ctrl+Shift+Enter
  are bound to page-break commands);
- mutation-driven repagination (`MutationObserver` → `scheduleReflow` →
  `paginateView`) so text flows onto page sheets, not the gray void;
- line-boundary overflow splits with widow/orphan control (`.wo-cont` tail);
- empty-doc gray-void guard;
- `mergeSplits` in `flatHtml` keeps the `<br>` paragraph intact on save.

Verified: `node apps/web/apps/documenteditor-wysiwyg/shift-enter-behavior.test.mjs`
→ `shift-enter-behavior-PASS`.

## Why this worktree commit does not touch the inventory

`census/behavioral-inventory.md` already documents BHV-001 in `main`
(HARN-002, commit `df25980`: BEH-03 row marks the gate **merged**, LRB-01
section pins the chain). Attempt 2 of this task died in af's merge on
exactly that file (Auto-merging conflict with the HARN-002 edits that landed
in main mid-flight). Nothing to add — editing it again would only re-create
the conflict. Live keypress/pixel tier remains tracked as BEH-03's open
follow-up (BHV-002), not this task.
