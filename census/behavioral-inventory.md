# Behavioral test inventory — WO editor

**HARN-001 deliverable (campaign `behavioral-hone`).** The single source of
truth for which *behavioral* test types the harness needs. Companion rows are
added as each type lands (HARN-002+); status flips are deliberate PRs in the
recapture-as-PR spirit — never silent.

## What "behavioral" means here

A test is **behavioral** when it drives a *live editor* with real user input
(key press, click, drag, paste) and **asserts the resulting document state,
chrome state, or rendered surface is correct** — not merely that a control
exists (structural census) or that *some* surface opened (interaction census).

The register's fidelity ladder tops out at **L4 = behavior/conversion matrix**
(`harness-graph/features.yaml`). This inventory is the decomposition of L4
into concrete test types. Rules inherited from the harness apply verbatim:
loud failure over silent stub, honest parity (`full/partial/missing`),
F-### register rows for promoted features, declared divergences never hidden.

## Inventory

| id | test type | input | asserted effect | existing harness piece | status |
|----|-----------|-------|-----------------|------------------------|--------|
| BEH-01 | Plain typing insertion | type text at caret | text inserted, caret advances, doc serialization updates | — | **missing** |
| BEH-02 | Enter / paragraph break | `Enter` | new block; following text moves to it | — | **missing** |
| BEH-03 | Soft line break | `Shift+Enter` | `<br>` inserted; text stays on page (no overflow to next page); **no gray background artifact** on the break (BHV-001/BHV-002 regression) | `server/.../documenteditor-wysiwyg/shift-enter-behavior.test.mjs` (BHV-001) | partial — seed case landing with this campaign |
| BEH-04 | Deletion keys | `Backspace`, `Delete`, `Ctrl+Backspace` (word), at block boundaries | correct unit removed; no block merge corruption | — | **missing** |
| BEH-05 | Tab semantics | `Tab` in body vs in dialog/table | body: indent (or declared divergence); table: next cell; dialog: focus move | — | **missing** |
| BEH-06 | Selection | mouse drag, `Shift+Arrows`, `Ctrl+A`, triple-click | selection ranges correct across inline/block/table boundaries | — | **missing** |
| BEH-07 | Clipboard | copy/cut/paste internal, paste plain-text, paste-special | clipboard round-trips; formatting applied/stripped per mode | — | **missing** |
| BEH-08 | Undo/redo | mutate (type, format, insert) then `Ctrl+Z` / `Ctrl+Y` | each mutation type reversible to exact prior state | — | **missing** |
| BEH-09 | Find & replace | type in Find dialog, Replace / Replace All | matches highlighted; replacements land in doc state | `ledger/find-dialog-l4.*` (dialog opens + fields only) | partial — apply-effect unproven |
| BEH-10 | Autocorrect / autoformat | type `" "` after quote, `- ` + space, URL | declared substitutions fire (or loud no-op) | — | **missing** |
| BEH-11 | Ribbon command correctness | click bold / italic / align / list buttons | the **right** mutation lands (e.g. `<strong>` toggles), not just *an* effect | `fx-wo.cjs`, `fx-prod.cjs` (classify any observable effect; silent = fail) | partial — fx proves *an* effect, not the *correct* one |
| BEH-12 | Dialog apply | open dialog (`Ctrl+D`, paragraph, …), edit fields, OK | field values land in the document | `ledger/*-dialog-l4.test.mjs` (open + field presence, **not apply**) | partial — apply tier missing |
| BEH-13 | Shortcut key behavioral | press each combo from the OO shortcut table | bound feature actually fires | `census-shortcuts.cjs` (STATIC handler-vs-table join: matched/diverged/browser-native/missing) | partial — join exists, no live keypress tier |
| BEH-14 | Context menu | right-click in body / table / image | menu opens; items act on the right target | — | **missing** |
| BEH-15 | File menu / backstage actions | New, Open, Export, Print, History | real action (nav, download, panel) — not silent | `census-react.cjs`, `interact-oo.cjs` backstage (surface classification only) | partial — classification, no action assertion |
| BEH-16 | Ribbon keyboard navigation | `Tab`/arrows across ribbon tabs and controls | focus moves, tabs activate, controls reachable | RIB-002 (implementation task) | **missing** |
| BEH-17 | Contextual tabs | select chart/table/image | contextual tab (chart-design, …) auto-shows; deselect hides | RIB-003 (implementation task) | **missing** |
| BEH-18 | Reflow on mutation | edit above a page boundary | pagination recomputes (`wo-page` sheets) | `coverage-pagination.cjs` (static layout), README notes *"no reflow-on-mutation yet"* | **missing** — known engine gap |
| BEH-19 | Post-edit visual regression | perform edits, screenshot | pixel gate stays within recorded baseline | `visual-wo.cjs` + `pixel-diff.py` + `visual-triage.py` | partial — pre-edit goldens only; no edit-then-capture flow |
| BEH-20 | Field update behavior | update TOC / page numbers | rendered fields reflect current doc | `fx-*.cjs` (TOC update has an effect signal) | partial — effect classified, correctness unproven |
| BEH-21 | Edit round-trip persistence | edit → save → boot fresh editor | mutation marker survives serialization (`html→docx→html`) | `ledger/ROUNDTRIP-GAPS.md` machinery (31 commands probed) | **exists** — extend with BEH-01..12 mutations |
| BEH-22 | Autosave / WOPI save | edit, wait autosave interval | CheckFileInfo/GetFile/PutFile chain fires; content lands | `coauth-sync-check.cjs`, `nonword-wopi.cjs` | partial — chain captured, content assertion thin |
| BEH-23 | Two-client coediting sync | client A edits; observe client B | mutation arrives within timeout, converges | `coauth-sync-check.cjs` | partial — single-session only today |
| BEH-24 | Track changes flow | type with tracking on; accept/reject | insert/delete marked; accept/reject yields exact final state | — | **missing** |
| BEH-25 | Comments flow | add / reply / resolve / delete | comment store + UI agree; anchor survives edit | — | **missing** |
| BEH-26 | Sheet UI editing | type formula in Univer cell, commit | computed value + serialization correct | `sheet-oracle/` (engine-level oracle: cases.yaml → truth.json) | partial — engine oracle exists, UI typing tier missing |
| BEH-27 | Slide insert/edit | insert slide, textbox, picture | slide count / parts mutate correctly | `census-react-slide.cjs` (structural) | **missing** |
| BEH-28 | Diagram editor editing | shape insert/connect/move | vsdx parts mutate; reload preserves | `census-react-visio.cjs` (structural) | **missing** |
| BEH-29 | OO behavioral reference | run identical input script in OO | capture OO's resulting doc state → committed golden; join WO vs OO per type | `census-oo*.cjs` / `interact-oo.cjs` (click-level only) | **missing** — parity verdicts need this |

## Cross-cutting conventions

- **Tiering** (same pyramid as `ai-contracts.py`): every type gets SPEC
  (register row, honest parity) → CONTRACT (protocol/shape pin) → TEST
  (live behavior). A type ships with its TEST tier or its register row says
  `partial` — no silent stubs.
- **Seed pattern**: BHV-001's jest test (`shift-enter-behavior.test.mjs`,
  Playwright-driven, `--testTimeout=30000`) is the reference implementation
  for BEH-01..BEH-12; FINAL-001 runs it as the suite entry point.
- **Divergences declared loudly**: where WO intentionally differs from OO
  (e.g. Tab semantics, BEH-05), record in the divergence register, never let
  the test quietly skip.
- **Goldens are committed and refreshed deliberately** — behavioral OO
  references (BEH-29) follow the same recapture-as-PR rule as `graph.json`.

## Campaign task mapping

| task | types |
|------|-------|
| BHV-001 / BHV-002 | BEH-03 (test + fix) |
| RIB-001 | BEH-11 surface (visual design prerequisite) |
| RIB-002 | BEH-16 |
| RIB-003 | BEH-17 |
| HARN-001 | this document |
| HARN-002 | promote BEH-03 row from `partial` to its post-fix status |
| HARN-003 | runtime of the L4 dialog build (`ledger/build.py`) feeding BEH-12 |
| FINAL-001 | run the behavioral suite seeded by BEH-03 |
