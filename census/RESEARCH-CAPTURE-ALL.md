# Research: capturing ALL of OO's feature surface in the WO port

> Session 2026-11-15, in response to "we still do not cover many elements of the OO
> software in our port — the right click menu is totally different, the blue border for
> the content is not there in OO (and it is buggy on top of that), etc."

## TL;DR

The port's capture machinery (census, oo-source extracts, parity contracts) is
**control-inventory driven** — it proves each OO *button/slot* has a WO twin. It is
**not behavior-context driven** — it does not check that OO's *menus*, *dialog flows*,
*hover/focus chrome*, and *state-dependent surfaces* behave the same. Two concrete
defects fall out of that blind spot:

1. **Right-click context menu**: WO shows a 74-row, mostly-ALWAYS single menu on plain
   text; OO shows a short ~15-row context-gated menu. Structural mismatch, not cosmetic.
2. **Content focus ring**: WO draws a 2px accent box-shadow around `#editor` on focus;
   OO draws **nothing** around the content surface on focus (verified live:
   `#id_viewer box-shadow:none`, no blue halos anywhere). WO's ring is wrong *and*
   reads as a bug (a giant blue frame around the whole scroll surface).

Root cause for both: WO ported the *control list*, not the *interaction rules*.

---

## 1. Context menu — live OO vs live WO (same spot, same doc)

**OO text context menu** (live capture, 15 rows on misspelled word; 14 on clean text):
suggestion rows / Ignore / Ignore all / ▸ Sprachauswahl | Cut / Copy / Paste | Print
selection | Page break above | Keep lines together | Paragraph advanced settings |
Add comment | Link | ▸ Formatting as style | ▸ AI

Authoritative source order (`DocumentHolderExt.js`, `textMenu` items, v252.232.451.526):
spell suggestion, More, sep, Ignore, Ignore all, To dictionary, ▸ Language, sep, Cut,
Copy, Paste, Print selection, sep(review), Accept, Reject, sep(equation), remove
control, control settings, sep, refresh field, edit field, field codes, sep, TOC
settings, TOC refresh(▸ all/pages), sep, Page break before, Keep lines, VAlign(in-shape
only), ▸ Text direction(in-shape only), Paragraph advanced, Frame advanced, Drop cap
advanced, ▸ Equation, sep, Add comment, sep, Add hyperlink, ▸ Edit/Copy/Remove link,
sep, Follow move (tracked), sep, Start new list / Start numbering from / Continue
numbering / List indents (list members only), sep, ▸ Formatting as style (save/update).

**OO pictureMenu** (37) and **tableMenu** (45) are separate scenarios — everything is
hidden/shown per click context. OO never shows character formatting (bold/italic),
bullet toggles, or insert rows in the *text* menu until context demands it.

**WO context menu** (live capture, plain text — 70+ rows shown):
Cut Copy Paste | TextDirection.. | AI.. | Undo Redo | Bold Italic Underline
StrikeThrough RemoveFormat KeepLines ParagraphSettings FormattingAsStyle | BulletList
NumberedList StartNewList ContinueNumbering SetNumberingValue AdjustListIndents
BulletsAndNumbering | HorizontalRule HorizontalLineSettings Caption Footnote Endnote
Symbol Date PageNumber | AddComment Link EditLink RemoveLink UpdateTOC TocSettings
UpdateField EditField ToggleFieldCodes PageBreakBefore AcceptChange RejectChange |
DropcapSettings FrameSettings EquationSettings ContentControlSettings
RemoveContentControl | PrintSelection SelectAll.

Static gating audit (`index.html` ctx-menu block): 40 rows are `data-showif`-free
(ALWAYS): Cut/Copy/Paste, TextDirection + its 3 children, AI + 3 children, Undo/Redo,
the whole formatting block (Bold…FormattingAsStyle, KeepLines, ParagraphSettings),
the whole list block (BulletList…BulletsAndNumbering), the whole insert block
(HorizontalRule…PageNumber), AddComment/Link/EditLink/RemoveLink. Only 34 rows carry
`data-showif` (misspelled/table/trackchanges/image/object/link/field) gated by JS. So
the formatting block, list block, insert block, and Undo/Redo/AI/TextDirection groups
**show on every right-click regardless of context** (and always-expanded submenus add
~a dozen more). That is the "totally different" menu.

## 2. Content focus border — WO has it, OO does not

- `style.css:1616  #editor:focus { box-shadow: 0 0 0 2px var(--accent); }`
- Live WO: focusing #editor → computed `box-shadow: rgb(55,96,143) 0 0 0 2px` around a
  1648×746 element = a giant blue frame around the *whole scroll surface* (all pages,
  backdrop, empty space), not around the page/selection.
- Live OO: `#id_viewer` computed `box-shadow:none`, `outline: none`, and the
  `blueHalos` scan (any 300×300+ element with a bluish shadow) returned **empty**.
- OO's actual focus affordance: the *caret* + blue *selection highlight inside the
  canvas*, not a shell ring.
- "Buggy on top": the ring spans the entire editor area and clips/pulses weirdly
  while typing/selecting (it is a focus ring on a 1648px-wide element, not on a page);
  on scroll the ring stays at the top of the container — reads as broken.

Fix (root cause, one line): **delete the `#editor:focus` box-shadow rule.** OO has no
content-surface ring. Selection/caret highlight is the correct focus signal (already
present via browser `::selection`). A11y: `#editor` already has an accessible name
(`role="textbox"`, aria-label), so removing the ring costs nothing.

## 3. Why the capture machinery missed these

Existing artifacts (all control-inventory): `oo-reference.json` (ribbon slots),
`oo-filemenu.json`, `oo-shortcuts.json`, `oo-statusbar.json`, `oo-dialogs.json`,
`oo-ctx-manifest.json` (6 menus, item *counts* only), `ledger.json` (534 features,
L0-L4). The ctx manifest stores `{items: 51, chars: 18515}` — it proved "51 items
extracted" but was never turned into a *WO behavior requirement*.

Missing surfaces/behaviors with **no contract at all**:
- Context-menu **per-scenario content + order + gating** (text vs table vs picture vs
  header/footer vs view-mode).
- **Hover/focus chrome** (tooltips, focus rings, hover states of every control).
- **Selection/caret visuals** (page-level selection color, caret, find-highlight).
- **State-driven row visibility** (accept/reject only in revisions, field rows only in
  fields, list rows only inside numbered/bulleted list, TOC rows only in TOC, equation
  rows only in equation, Ai submenu parity).
- Scripted **click-through flows** (menu → dialog → apply → backstage) — partially in
  `tests/parity/surfaces/*` but not for ctx submenus.

## 4. How to actually capture ALL features — method

The port needs a second axis: **behavior-context capture**, layered on the existing
control inventory. Concretely:

### A. Scenario walkers (add to `wo-test-harness/census`)
One probe per *interaction scenario*, walking the DOM in each engine at a fixed
viewport and emitting a normalized JSON:
```
scenario: text, table, image, shape, equation, content-control, field, toc,
          header-footer, tracked-changes-off/on, misspelled, selection, multi-select
output:   [{ surface, group, caption, state(visible/enabled/checked), order, submenu }]
```
`oo-source/oo-ctx-extract.cjs` already parses OO's source for item order; the missing
piece is a **live scenario runner** (`ctx-scenarios.cjs`) that right-clicks per scenario
and captures both engines' *visible* menus, plus a `ctximage`/`ctxtable` canvas fixture
(the Bericht.docx has no image; Notizen.docx needs a generated picture/table doc).

### B. Normalize to a behavior contract
Each scenario becomes a contract file (like the parity overrides): expected visible
rows in order, expected hidden rows, expected enabled/disabled. WO's ctx JS then gates
rows against these — replacing the current ALWAYS-default with per-context defaults.

### C. Close the chrome gap
Add a small live-probe surface (`chrome-surface.cjs`) that diffs, per control:
`box-shadow`, `outline`, `cursor`, hover `background`, focus behavior, tooltip text.
This catches rings like `#editor:focus` that a control inventory cannot see.

### D. Keep OO 9.4 pinned until re-baselined
10.0.0 (2026-10-12) adds a Download toolbar button + SVG→shape conversion + AI-tab
restructure; every gold/contract above would move. Pin `onlyoffice/documentserver:9.4.0`
in `wo-website/demo/docker-compose.yml` (currently `:latest` — silently drifted once).

## 5. Immediate fix list (from this research)

| # | Item | Change | Effort |
|---|------|--------|--------|
| 1 | Blue focus border | Remove `#editor:focus` box-shadow (style.css:1616) | 1 line |
| 2 | Text ctx menu parity | Invert defaults: hide formatting/list/insert/TOC/accept-reject rows unless context true; add OO order (Cut/Copy/Paste → Print → Page break → Keep lines → Paragraph settings → Add comment → Link → Style → AI) | Medium (JS gating) |
| 3 | Scenario runners | `ctx-scenarios.cjs` emitting per-scenario JSON from both engines | Medium |
| 4 | Behavior contracts | Per-scenario contract files + WO gating update | Medium |
| 5 | Chrome probe | `chrome-surface.cjs` (focus/hover/outline/tooltip diff) | Small |
| 6 | Pin OO 9.4.0 | compose `:latest` → `:9.4.0` | 1 line |

## Task (a) complete — seeded OO rig for table/image/shape ctx menus (2026-05-30)

Live OO 9.4 demo now yields ALL 7 ctx scenarios (text 11 / selection 15 /
multi-selection 15 / misspelled 15 / **table 19 / image 17 / shape 15**).

Prereq fixes (wo-website demo, `6370ec0`): unique doc key per open
(`openKey`) + preset guest `editorConfig.user` — the collab-name modal
prompted on EVERY edit otherwise and its input cannot be automated.

Verified recipes (in `seedOOObject`, ctx-scenarios.cjs):
- table: Insert → table btn → dimension-picker CANVAS (10x8), hover cell
  (3,3) until label reads "3 x 3" → click inserts. Caret lands in cell.
- image: Insert → image btn MAIN part → "Bild aus Datei" → filechooser →
  setFiles(census/chrome-oo.png). Image stays selected.
- shape: Insert → shape btn MAIN part → first .item-shape tile → DRAG on
  canvas (draw mode, single click inserts nothing).
- capture: Shift+F10 opens the ctx menu AT THE SELECTION — no coordinate
  hunt. Each seeded scenario re-opens a FRESH doc (right-click scenarios
  poison ribbon-dropdown state).
- menu DOM: ul.dropdown-menu inside body-level menu-container-asc-gen*;
  extractor now prefers dropdown-menu class and excludes [role=tablist].

Key engine-diff results (reconcile): WO table ctx lacks MergeCells,
SplitCell, TableProperties, InsertRow*/Column* (11 rows vs OO 19); WO image
ctx has granular wrap entries while OO uses one "Textumbruch" submenu
(single-menu-model divergence, contract approx).

Carry-over: 7 ledger dialog L4 tests fail on WO title drift ("Insert
bookmark"→"Bookmark" etc.) — pre-existing, unrelated to ctx.
