# RIB-001 — Ribbon tabs visual design

**Status: DONE.** Code lives in the server repo, commit
`269d8cb1f` on `World-Office/server` main (attempt 1 landed it there but
committed nothing in this worktree — the campaign reads commits here, hence
the spurious "no change" failure this record fixes).

## Acceptance gate (verbatim)

```sh
grep -q 'ribbon-tab' /home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg/style.css && echo OK || echo FAIL
# → OK
```

## What shipped (server apps/web/apps/documenteditor-wysiwyg/style.css)

- **Active tab = folder tab**: grows onto the titlebar's bottom edge (30px,
  square bottom corners, `margin-bottom: -2px`) so its face seams into the
  function band it opens — the classic ribbon affordance. An active
  contextual tab (chart-design, header-footer) keeps its 2px accent
  underline, landing exactly on the seam (Fluent-style).
- **Inactive-tab hover face**: moved from the generic `--hover`
  (near-invisible in light theme: 0.06 black over `#f7f7f7`) to
  `--ribbon-hover` (the OO group-hover gray), readable in both themes.
  Specificity (0,4,1) so it beats `.titlebar button:hover` and the
  contextual tint; `:not([aria-selected="true"])` keeps the seamed pill
  face on hover.

## Evidence

- `node scripts/rib001-geometry-check.mjs` (live Chromium probe, both
  themes) → `ALL GREEN`:
  - light/dark seam = 32.0 == 32.0 (active tab bottom == toolbar top,
    pixel-exact), radius `6px 6px 0 0`
  - hover face flips `transparent → rgb(232,232,232)` (light) /
    `rgba(255,255,255,0.1)` (dark)
  - active contextual tab keeps `2px solid` accent underline and reaches
    the band; inactive tabs stay 28px (no bleed)
  - 0 pageerrors; screenshots to `/tmp/rib001-{light,dark}.png`
- All 22 style.css static gates green.
