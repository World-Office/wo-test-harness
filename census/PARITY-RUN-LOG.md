# Parity Check — Local Run Log

First local execution of the `parity-check` CI workflow steps
(`server/.github/workflows/parity-check.yml`) outside GitHub Actions.

- **Date:** 2026-11-03
- **git sha (server):** `3d74e0601`
- **git sha (harness):** `a9a6bd9`
- **Executor:** manual (parity-wave4 task INFRA-PARITY-LOG; af could not
  dispatch it after a dependency bookkeeping race — see campaign notes)

## Step 1 — Build (job `build`)

| Command | Result | Duration |
|---------|--------|----------|
| `cargo build --workspace --exclude wo-pdf --exclude wo-webdav` | **PASS** (`Finished dev profile`, warnings only) | 17.5 s (cache-warm) |
| `pnpm install --frozen-lockfile` | **PASS** | 1 s (store-linked) |
| `pnpm build --filter='!@world-office/tauri-poc'` | **PASS** | 1m18s |

Note: the first `pnpm build` attempt failed with TS2307 "Cannot find module"
errors in `@world-office/pdfeditor` because `pnpm install` had not been run in
this checkout (workflow order matters — install precedes build). After
install: clean pass.

## Step 2 — Core tests (job `test-core`)

`cargo test --workspace --lib --exclude wo-pdf --exclude wo-webdav -- --test-threads=1`

- **PASS** — exit=0, 38 suites, **2688 tests passed, 0 failed**.

## Step 3 — Ledger build (job `ledger-build`)

`cd census/ledger && /usr/bin/python3 build.py`

- **PASS** — exit=0, <1 s.
- Output: `ledger: 527 features across 18 clusters` —
  **L0: 0 · L1: 388 · L2: 81 · L3: 38 · L4: 20** (L2 row elided by the
  script's summary print but present in `ledger.json`).
- Roundtrip evidence line: `roundtrip.cjs: 31/31 commands survived`.

## Step 4 — Visual diff (job `visual-diff`; CI marks continue-on-error)

`cd census/visual && node diff.js`

- **DEFECT FOUND AND FIXED:** `diff.js` required pixelmatch as a callable —
  pixelmatch v6 is a named export (`{ pixelmatch }`). Running it threw
  `TypeError: pixelmatch is not a function`. In CI this step is
  `continue-on-error`, so the breakage would have been silently swallowed.
  Fixed in `diff.js` with a v5/v6-compatible require.
- `node diff.js` itself is a library module (no CLI main) — the workflow step
  only exercises module loading. For a real comparison we drove
  `compareDialogScreenshots('chrome-editor', census/chrome-oo.png,
  census/chrome-wo.png)`:
  `match: false, diffRatio: 0.0772` (threshold 0.01) — **informational, not a
  regression**: the two chrome screenshots are different suites by design;
  pixel-level chrome parity is not a current quality target.

## Step 5 — Performance (job `performance`)

- **SKIPPED — per workflow condition** (`if: inputs.full_test == 'true'`).
- Separately: the first measured baseline landed today (commit `a9a6bd9`,
  `census/performance/baseline-wo.json` — cold load 176 ms, typing latency
  124 ms, select-all+bold 26 ms, table insert 54 ms, banded toggle 16 ms on
  staging :8086).

## Step 6 — Report (job `report`)

- **SKIPPED — CI-only** (assembles artifacts via `actions/upload-artifact`;
  no local equivalent). `census/PARITY-REPORT.md` is maintained manually.

## Extra — editor gate suite (not covered by the workflow)

`apps/web/apps/documenteditor-wysiwyg`: 131 plain-node `*.test.mjs` scripts
(+ banded-columns.test.mjs) green, `npx jest` shift-enter suite 3/3.
**Finding:** the parity-check workflow has no step for the editor JS gate
suite — the biggest regression net (132 files) is not exercised by CI.

## VERDICT

| Step | Verdict |
|------|---------|
| build (cargo + pnpm) | PASS |
| test-core (2688 tests) | PASS |
| ledger-build (527/18, L0=0) | PASS |
| visual-diff | PASS after fixing a real defect (pixelmatch v6 API); result informational |
| performance | SKIPPED (workflow condition) |
| report | SKIPPED (CI-only) |

**4 PASS / 2 SKIPPED / 0 FAIL.** Follow-ups worth filing: (1) add the editor
JS gate suite as a CI step, (2) either drop `continue-on-error` from
visual-diff or make it fail on script errors (not on diff ratio), (3) the
`diff.js` fix should be backported to the workflow's `npm install` pin
(pixelmatch v5) or kept at v6 with the fixed require (this log's fix).

**RESOLVED 2026-11-04** (server commit + harness `diff.js --self-test`):
1. ✅ `editor-gates` job added to `parity-check.yml` — runs every
   `documenteditor-wysiwyg/*.test.mjs` with plain node (131 locally green;
   `shift-enter-behavior.test.mjs` skipped: jest+CommonJS by design, drives a
   live editor via `WO_EDITOR_URL`).
2. ✅ `continue-on-error` dropped; the step now runs `node diff.js
   --self-test` (synthetic 8×8 buffers: identical=match, 3-pixel variant
   =fail) so it gates module-load + compare-core correctness. Diff-ratio
   failures remain a local/live-flow concern — CI has no screenshots.
3. ✅ Kept v6 with the fixed require; pins are now explicit:
   `pixelmatch@6.4.0 pngjs@7.0.0` (`@playwright/test` install dropped — only
   `capture.js` needs it and this job never runs capture).

Same session also repaired the L2+L4 `parity-contracts` job in `ci.yml`
(30/30 red since the ledger migration): `generate-manifest.cjs` +
`gen-gaps.cjs` ported to the `{features:[…]}` ledger schema,
`run-parity.cjs` no longer swallows the generator's exit code, overrides
rekeyed to current ids (`table.table`, `protect.encrypt`,
`formatting.paragraph-line-spacing`) with an override-only fallback, and
probes fixed against moved markup (`file-menu` → backstage overlay,
`menu-hit` skips `hidden` contextual tabs, `tab-switch-widths` asserts
chevron-reachability instead of "no rect past viewport" — the style gallery
clips by design and its dropdown keeps every style reachable). Result:
contracts 4/4 pass, surfaces 4/4 pass against the real editor.
