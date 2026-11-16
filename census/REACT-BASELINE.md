# React-substrate parity baseline (2026-11-16)

**Substrate switch:** since 2026-11-16, prod `/word`
(editor.cloud.graphwiz.ai) serves the **React canvas editor**
(`documenteditor-react`: docx → wasm → canvas, typed ops) — the
architecture the D1–D7 boundary decisions (see `server/plan/oo-port/PORT-PLAN.md`)
were written for. The python-lineage wysiwyg editor
(contenteditable + execCommand) is retired from deployment; its source and
test corpus stay in-tree as legacy until the gates migrate.

This is the FIRST parity measurement of the deployed editor. The
wysiwyg-era ledger (534 features, L1=9/L2=455/L3=37/L4=33) does NOT
describe this app — it measures the retired substrate. Numbers below
are the new baseline.

## Method

`census-react-deep.cjs` against live prod (1440×900, de labels normalized
like the interact-ledger: strip `(...)`/`[...]`, trim, lowercase), diffed
against the OO 9.4 rig goldens (`census/census-oo-deep.json` per-tab
button labels). Exact-label matching; no override layer yet.

## Boot (verified this date)

- A4 canvas 793×1123 renders; 12+1 tabs visible (File Home Insert Layout
  References Collaboration Protection Draw View Forms Plugins AI + contextual Chart Design)
- Typing reaches the engine and re-renders the canvas (pixel-diff proof);
  caret = canvas-drawn overlay with 530ms blink; drag-select with OO-style
  highlight; Home/End navigation works
- **0 page errors** on live prod
- File menu opens (mobx observer path): 23–24 buttons, all enabled

## Ribbon label coverage vs OO 9.4 goldens

| Tab | OO labels | React labels | Coverage | Notable missing |
|---|---|---|---|---|
| Home | 30 | 71 | 97% | font size |
| Insert | 20 | 41 | 75% | comment, date & time, field, header & footer |
| Draw | 2 | 35 | 100% | — |
| Layout | 16 | 50 | 100% | — |
| References | 9 | 39 | 89% | link |
| Collaboration | 14 | 40 | 93% | co-editing mode |
| Protection | 2 | 27 | 100% | — |
| View | 10 | 30 | 70% | dark document, headings, multiple pages |
| Plugins | 12 | 44 | 58% | background plugins, highlight code, photo editor, plugin manager |
| Chart Design* | 9 | 31 | 22% | chart elements, edit data, advanced settings, 3d rotation |
| HeaderFooter* | 6 | 0 | 0% | not reachable without entering header/footer edit |
| **TOTAL** | **130** | — | **78%** (101/130) | |

\* contextual tabs: need activation state (chart selected / header-footer
editing). Chart Design 22% and HeaderFooter 0% are capture artifacts as
much as gaps — activation-aware census is follow-up work.

React tabs with no OO golden: **Forms**, **AI** (WO-only surfaces; OO 9.4
shows Forms contextually — needs activation-aware comparison).

## Known engine-side gaps (from the flip-day probe)

- spellchecker wasm: `aff_bytes are empty` (console warn) — dictionaries not wired
- two dictionary-path 404s on boot
- ORM-01 scoreboard still applies: 967/970 `asc_*` rows uncovered;
  the UI achieves coverage through React-side state, not engine push frames

## What this baseline replaces / what migrates

- `census/census-react-deep.json` = the new chrome golden (supplements the
  File-menu-only `census-react.json`)
- `run-react-rig.sh` = rig v4 (Linux, real wo-docserver; the Windows
  `run-react-census.py` stubs conversion and stays for workstation use)
- Next increments (campaign-shaped):
  1. activation-aware census (contextual tabs, dialogs) → per-tab coverage
     with overrides layer, like the wysiwyg one
  2. command liveness probes on the react app (click B/Italic/font-size →
     engine op applied → canvas re-render) — the L2-equivalent layer
  3. ORM-02 push frames (15 events) so ribbon state comes from the engine
  4. L3/L4 roundtrip: react app save → flatHtml/docx → reload (needs the
     save/download flow, which demo mode intentionally blocks)
