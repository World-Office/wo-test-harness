# RIB-002 — Ribbon tab keyboard navigation (delivery receipt)

Deliverable lives in the **server repo**, not this harness worktree (the
behavioral-hone af campaign spawned worktrees from wo-test-harness while the
task gate targets `/home/weiss/git/World-Office/server`). This file is the
worktree-side record so the branch merge carries visible evidence.

## What shipped (server repo, branch `main`)

Commit `db1652028` — "RIB-002: ribbon tab keyboard navigation (WAI-ARIA tabs
pattern)":

- `apps/web/apps/documenteditor-wysiwyg/editor.js` — roving tabindex
  (`syncRibbonTabindex`: only the selected `.ribbon-tab` is tabbable);
  keydown on `.ribbon-tabs[role="tablist"]` handles ArrowLeft/ArrowRight
  (wrapping), Home/End; moves focus AND activates (automatic activation);
  skips `hidden` contextual tabs; `#btn-file` is a menu trigger, not a tab,
  so it never participates.
- `apps/web/apps/documenteditor-wysiwyg/ribbon-tab-keyboard.test.mjs` —
  static pins for the input contract and the wiring above.

## Verification (run 2026-11-02)

```
$ node apps/web/apps/documenteditor-wysiwyg/ribbon-tab-keyboard.test.mjs
OK: ribbon tab keyboard navigation pins hold

$ grep -q keyboard apps/web/apps/documenteditor-wysiwyg/editor.js && echo OK
OK
```

Acceptance gate (task RIB-002, run verbatim) passes.

## Campaign gotcha (for the operator)

af counts `commits_ahead(main, tf/<TASK>)` in these harness worktrees;
server-side commits are invisible to it. Attempts 1–2 delivered the server
commit above and were still failed as "0 commits ahead of main". Tasks in
this campaign that edit the server repo need a receipt commit like this one
on their af branch — or the campaign needs a `repos.json` mapping tasks to
the server repo.
