# 5. Building Block View

## Level 1

```
wo-test-harness/
├── register/ + harness-graph/    SPEC: features.yaml (111 F-###) → graph.json
├── conformance/ + conformance-docx/   FIDELITY: corpus, entropy driver,
│                                   NormalizedRender scoring vs LibreOffice
├── census/                        PARITY: OO/WO inventory + ledger + gates
├── tf-test-harness/               unified shell orchestrator + self-test
├── sheet-oracle/ + scope/         spreadsheet oracle, scope checks
├── docs/, plan/, fig/, scripts/   this documentation, planning, figures
└── .github/workflows/conformance.yml   6 CI jobs
```

## Level 2 — census/ (the parity pipeline)

Three layers, each machine-checkable:

**Capture (Playwright `.cjs`, browser side)**

| Script | Captures |
|--------|----------|
| `census-oo.cjs` / `census-oo-deep.cjs` | OO reference: tabs/controls/menus/backstage/statusbar (deep adds dialogs entry points + field structures) |
| `census-oo-dialogs.cjs` | every OO dialog → FIELD inventory (inputs, buttons, checkboxes) |
| `interact-oo.cjs` / `interact-wo.cjs` | click-through: what each control opens (modal/menu/panel/none) |
| `census-wo.cjs` / `census-wo-deep.cjs` | WO vanilla editor structure (deep mirrors oo-deep) |
| `census-react-{word,sheet,slide,pdf,visio}.cjs` | React editors structural census (regression-pinned) |
| `fx-wo.cjs` / `fx-prod.cjs` | functional loud-stub gate — local docserver / LIVE prod WOPI session |
| `chrome-{oo,wo}.cjs`, `chrome-struct.cjs` | window chrome (ribbons/toolbars/statusbar) geometry |
| `geom-wo.cjs`, `visual-wo.cjs`, `pixel-diff.py` | geometry drift, golden-doc screenshots, PIL flood-line visual gate |
| `nonword-{probe,wopi}.cjs` | sheet/slide/vsdx WOPI chain probes |
| `coauth-sync-check.cjs`, `modal-ok-check.cjs`, `menucut.cjs`, `pagestatus.cjs`, … | point probes |
| `ledger/roundtrip.cjs` | **THE persistence gate**: drives the real editor (Playwright), applies 13 document-level commands, serializes via flatHtml, converts html→docx→html through the conversion endpoint, reloads a fresh editor, asserts marker survival |

**Join/build (Python, `/usr/bin/python3`)**

| Script | Role |
|--------|------|
| `reconcile.py` | ONE-RUN orchestrator: spawn docserver → capture → join → gates (`--check --seed-check --interactions --fx --geometry --visual --ai`) |
| `census-diff.py` | OO↔WO join via audited MAP → old-style ledger |
| `deep-gap.py` | deep-census diff: oo-deep × wo-deep → gap report for campaigns |
| `ledger/build.py` | **ledger v1 builder**: merges oo-deep + oo-dialogs + wo-deep (+ roundtrip results) into `ledger.json` — one row per OO feature surface with L0–L4 level, cluster, WO counterpart |
| `interact-diff.py` | interaction join (never re-derives pairing) |
| `chrome-gate.py` / `chrome-diff.py` | chrome parity gate (translation-scroll ribbon, etc.) |
| `ai-contracts.py` | F-148..153 AI pyramid contract probes (docserver HTTP + mcp-server stdio) |
| `artifact-check.py`, `ledger-gap.py`, `visual-triage.py` (advisory) | committed-artifact invariants, LLM-classified gap copy specs, pixel-FAIL triage (never gates) |

**Committed artifacts (`census/census/`)** — the comparison substrate:

`census-oo.json` · `census-oo-deep.json` · `census-oo-dialogs.json` ·
`census-oo-interactions.json` (read-only OO ground truth) ↔
`census-wo.json` · `census-wo-deep.json` · `interact-wo.json` ·
`fx-prod.json` · `geom-wo.json` · `chrome-{oo,wo}.{png,box.json}` ·
`ledger.json`, `ledger-gap.{json,md}`, `oo-deep-gap.md`.

**Ledger outputs (`census/ledger/`)**

| Artifact | Content |
|----------|---------|
| `ledger.json` (80 KB) | 242 features / 16 clusters, each with level, oo_surface, wo counterpart |
| `LEDGER-REPORT.md` | human completeness map per cluster ("statusbar — 13 features (L0:11 L1:2 L3:0)") |
| `roundtrip.cjs` + `roundtrip-results.json` | persistence probe + its committed results (13/13) |
| `ROUNDTRIP-GAPS.md` | documented endpoint deviations history (workarounds section now retired) |

## Level 3 — roundtrip.cjs internals (the L3 engine)

```
PROBES (13 commands: bold/italic/underline/strike/sub/sup/symbols/datetime/
        header-footer/change-case/table/text-to-table/remove-format)
 for each probe:
   1. launch editor (local or WO_CONVERT_URL endpoint)
   2. apply command via synthetic events (rb-menu → page.evaluate(el.click()))
   3. read flatHtml (editor DOM serialization)
   4. POST /api/conversion/convert { html → docx }   (NO sanitization — verbatim)
   5. POST /api/conversion/convert { docx → html }
   6. reload fresh editor with round-tripped html
   7. assert marker attributes survived (phase-lost detail on failure)
 → ledger/build.py merges roundtrip-results.json as L3 PERSISTS
```

## Register + conformance (unchanged core)

- `harness-graph/`: `features.yaml` → `seed.py` → `graph.json`
  (111 stable F-### ids, 1383 tests / 1632 edges, `--check` drift gate).
- `conformance/` (`wo-conformance`): real-docx corpus, entropy test-driver,
  NormalizedRender cross-engine scoring (wo-docx-renderer vs LibreOffice).
- `conformance-docx/`: `DocxConformanceAdapter` + `wo-render-ir` binary,
  git-depends on the server repo.
