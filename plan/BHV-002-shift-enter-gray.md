# BHV-002 — Fix Shift+Enter gray-background (soft-break lines past sheet bottoms)

**Status: DONE** — server commit `0dfa571d6` (branch `main`,
`World-Office/server`), acceptance gate green.

## Root cause

"Shift+Enter gray background" = soft-break lines (`<br>` from Shift+Enter)
rendering past a sheet's bottom onto the gray editor backdrop; typing on them
put text in the gray area. Repro: `hello` + 60×Shift+Enter → one `.wo-page`
with the `<p>` overflowing +535px.

`trySplitLines` could only find split points through TEXT CHARACTERS
(binary search over text offsets). A `<br>`-only line carries no chars, so a
paragraph padded past a sheet's content height read as unsplittable;
`paginateView`'s alone-on-sheet path "tolerated the overflow" and the soft
lines bled onto the gray backdrop.

## Fix (editor.js, all in `trySplitLines`)

- `total < 2` no longer rejects br-bearing blocks (pure-br paragraphs).
- Split point now also resolves at a CHILD BOUNDARY: the first child (text
  node, `<br>`, inline element) that OPENS a line at/after the fit line.
  Element children report via `getBoundingClientRect` — range rects are
  EMPTY for `<br>` (second layer of the bug).
- Children that WRAP across the split line keep the char binary search
  (ordinary wrapped text, unchanged path).
- br-only continuation fragments count as content and move to the next
  sheet instead of being restored into the overflowing head.

New static gate: `shiftenter-split-gate.test.mjs` (50 lines, pins all four
fix shapes + the wrapped-text regression path), committed with the fix.

## Verification (at the committed state, `git archive` — no working-tree race)

```sh
node shift-enter-behavior.test.mjs   # PASS  (BHV-001 chain pins)
node shiftenter-split-gate.test.mjs  # PASS  (BHV-002 fix pins)
node grayvoid-gate.test.mjs          # PASS
```

Deployed: `curl :8082/word/editor.js` and `:8086/word/editor.js` both carry
`childLineSpan` (the fix). Commit message additionally records live
route-override verification (mash-Shift+Enter, pure-br, text+soft-break mix,
list/table/page-bottom; flatHtml round-trip intact).

Acceptance gate:

```sh
cd /home/weiss/git/World-Office/server && grep -q Shift \
  apps/web/apps/documenteditor-wysiwyg/editor.js && echo OK
# → OK  (fix comment at the child-boundary walk, ~line 5945)
```

## Why this worktree commit only records (no server-repo edits)

- The fix + gate are already committed on server `main` (`0dfa571d6`).
  Attempt 1 did that server work but committed nothing in its own worktree
  → af verdict "0 commits ahead of main". This record closes that gap.
- The server checkout is SHARED by the live campaign: DEPLOY-001 and
  FINAL-001 agents were mid-flight editing `editor.js` (+23 uncommitted)
  and rewriting `shift-enter-behavior.test.mjs` into the jest+playwright
  suite (with root `jest.config.cjs`) while this attempt ran. Those edits
  are THEIR deliverables (FINAL-001's gate runs jest on that file) — left
  untouched, verified against the committed state via `git archive`
  instead of the racing working tree.
