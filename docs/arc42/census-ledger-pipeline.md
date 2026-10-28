# Deep Dive — the census → ledger pipeline

> arc42 annex. The heart of the harness: how an OO feature surface becomes a
> scored ledger row, and how a campaign turns that row green. Written
> 2026-10-27 against harness @ `42db8d5`.

## The pipeline at a glance

```
                     ┌──────────── OO side (read-only truth) ────────────┐
 rig (pinned OO DS)  │ census-oo.cjs → census-oo.json                   │
 docker              │ census-oo-deep.cjs → census-oo-deep.json          │
                     │ census-oo-dialogs.cjs → census-oo-dialogs.json    │
                     │ interact-oo.cjs → census-oo-interactions.json     │
                     └───────────────────────┬───────────────────────────┘
                                             │ join (fuzzy + aliases)
 WO editor  ── census-wo-deep.cjs ──────────▶│
 (local /   ── interact-wo.cjs ─────────────▶│
  prod)     ── fx-wo/fx-prod.cjs (L2) ──────▶│
            ── ledger/roundtrip.cjs (L3) ───▶│
                                             ▼
                          ledger/build.py ──▶ ledger.json
                                             + LEDGER-REPORT.md
                                             + gap reports (deep-gap.py)
                                             ▼
                        agentflow campaign ──▶ server fixes + in-repo gates
                                             ▼
                        re-run census + roundtrip ──▶ re-score (L0 shrinks)
```

## Stage 1 — ground truth (OO side, rig-run, committed)

Four capture scripts run against the **pinned OnlyOffice rig** (docker,
`rig/local.json` + `rig-server.py`). Outputs are committed under
`census/census/` and treated as immutable:

| JSON | Granularity |
|------|-------------|
| `census-oo.json` | tab → control labels (the original 2026-07 census) |
| `census-oo-deep.json` | + ribbon groups, menus, backstage, statusbar items |
| `census-oo-dialogs.json` | every dialog: field inventory (inputs/buttons/selects/checkboxes with ids) |
| `census-oo-interactions.json` | per control: what it opens (modal/menu/panel/none) |

Known quirks are encoded in the **scripts**, never patched into the JSONs:
backstage tab indexing, dialog frame ONE-SHOT lookup, vector-object
rasterization (`data:image/png;base64`).

## Stage 2 — WO inventory (same extraction, our editor)

`census-wo.cjs` / `census-wo-deep.cjs` mirror the extraction against the WO
editor (vanilla word editor; React editors have their own pinned censuses).
`interact-wo.cjs` performs the same click-through classification. Because
both sides use the same extraction vocabulary, the join is label-level.

## Stage 3 — the join (`ledger/build.py`)

Per OO surface:

1. **Normalize**: `norm()` (case, diacritics, punctuation) + `toks()` tokens.
2. **Match**: `fuzzy()` label match, then **cluster-scoped aliases**
   (`wo_match(label, cluster)`) — explicit, auditable OO→WO label mapping.
3. **Filter noise**: `noisy()` regex + backstage exclusion list + raw
   statusbar ids (e.g. `asc-gen991`) — noise never becomes a fake gap.
4. **Level assignment**:
   - no WO match → **L0**
   - control/dialog exists → **L1**
   - behavior evidence (fx/interact artifacts) → **L2**
   - row in `roundtrip-results.json` with `survived` → **L3**
   - (L4 reserved for conformance-scored fidelity)
5. **Emit**: `ledger.json` (242 rows / 16 clusters) + `LEDGER-REPORT.md`
   with per-cluster counts, e.g. `statusbar — 13 features (L0:11 L1:2 L3:0)`.

## Stage 4 — persistence proof (`ledger/roundtrip.cjs`)

13 PROBE commands, each run through the REAL stack:

1. Fresh editor via Playwright; command applied with synthetic events.
2. Read `flatHtml` (editor DOM serialization).
3. `POST /api/conversion/convert` html→docx (**verbatim** — no sanitization).
4. Same endpoint docx→html.
5. Load the round-tripped HTML in a fresh editor instance.
6. Assert the feature's marker survived (exact attribute checks; failure
   records phase + lost attribute into `ROUNDTRIP-GAPS.md`).

Passing probes write `roundtrip-results.json`, which `build.py` merges as L3.
Failures are classified by phase (apply / convert / reload) — that
classification drove the LEDGER2 root-cause work (entities, run styling,
sup/sub, alignment, lists, hyperlinks → all fixed in the server converters
2026-10-27, gates 10/10 + 13/13).

**Target selection discipline**: point `WO_CONVERT_URL` at a **freshly
built** local docserver (`:18087`); never trust staging/prod containers of
unknown age (ADR-18).

## Stage 5 — campaign burn-down (the loop that closes gaps)

```
deep-gap.py report  ──▶  server/config/tasks.json (agentflow campaign)
   workers in isolated worktrees, policy "NO CHANGE IS NOT SUCCESS"
   acceptance: count-agnostic gates (in-repo: static JS pins, cargo suites;
               cross-repo: this harness's re-runs)
   ──▶ merge to server main ──▶ redeploy prod (pageerror sweep) ──▶ re-score
```

Historical arc: parity deficit 152 → 3 (L1 era) → ledger v1 exposed L0:44 →
campaigns LEDGER3/LEDGER2 + chrome/gray-void fixes → **L0:1**
(insert-spreadsheet remains), roundtrip 13/13 verbatim.

## Operating cheatsheet

```sh
# one-run full gate
WO_SERVER_DIR=../server /usr/bin/python3 census/reconcile.py \
  --check --seed-check --interactions --fx --geometry --visual --ai

# ledger re-score
cd census && /usr/bin/python3 ledger/build.py

# persistence probe (fresh local docserver on :18087)
cd census/ledger && NO_PROXY='127.0.0.1,localhost' \
  WO_CONVERT_URL=http://127.0.0.1:18087/api/conversion/convert \
  /usr/bin/node roundtrip.cjs

# register drift
WO_SERVER_DIR=../server /usr/bin/python3 harness-graph/seed.py --check
```
