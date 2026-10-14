# DESIGN — Renderer paragraph box merging (conformance case 14)

Status: proposal / design sketch (no code change yet)
Author: Wo harness
Dates: 2026

## 1. Problem statement

Conformance case `14-justified` scores ~0.70 in default (box-level) `wo-conformance
diff`. Root cause is **box segmentation**, not text width, wrapping, or justification
(measured: justification `1ebc24705` is metric-neutral on this case; no `CHAR_WIDTH_FACTOR`
tuning reproduces the truth fold either).

- **Truth (LO / PyMuPDF projection):** `1` paragraph box, `454.3 × 27.08 pt`, containing
  `2` runs (two text lines at y=83.2 and y=97.0). PyMuPDF/LO merges the whole paragraph
  into one block.
- **Renderer (wo-docx-renderer):** `3` paragraph boxes — one per folded line
  (y≈72 / 86.4 / 100.8, each ~14 pt tall).

`score_page_boxes` (conformance/src/scoring.rs) does greedy nearest-neighbour matching and
a pair is a geometry match only if **origin AND size are both within ~2 pt**
(`approx_eq(tbox, GEOMETRY_TOLERANCE_PT)`). The 27.08 vs ~14 pt height mismatch always
fails, so geometry = 0/1 = 0.0. Even a perfectly-correct 2-line fold still yields 2 separate
~14 pt boxes vs truth's single 27.08 pt merged box, so the height mismatch is irreducible at
the wrapping/width layer.

## 2. Goal

Group consecutive line runs of one *logical paragraph* into a single emitted paragraph box:

```
truth : 1 box { origin(72.1, 72.51), size(454.3, 27.08), runs: [line1@y83.2, line2@y97.0] }
before: 3 boxes { each ~14pt tall, separate y }
after : 1 box  { origin(72.1, 72.51), size ≈ 454.3 × (n_lines × line_height), runs: line runs }
```

Constraint: **must not regress the other 38 cases.** Many truth boxes are per-line or per-run
(depending on the projection), so unconditional merging is wrong. The merge needs a guard.

## 3. Current architecture (confirmed)

- `core/crates/wo-docx-renderer/src/layout.rs`
  - `const CHAR_WIDTH_FACTOR: f32 = 0.5;` (line 55)
  - `measure_text_width` (lines ~1114-1115) = `chars × font_size_pt × 0.5`; **gross estimate,
    `wo-fonts` not wired into the layout path** (no real glyph advances).
  - Wrap loop + line measurement callers at ~813, 864, 935, 975; table `num_lines` at ~1273.
  - The line flusher (`flush_line`-equivalent) currently emits **one layout box per
    LayoutLine** — this is the exact spot that produces 3 boxes for 3 lines.
- Justification (`TextAlignment::Both`) implemented in `layout.rs` + `pipeline.rs` (does not
  alter box segmentation; word-spacing is global + invisible to the GEOMETRY/TEXT/STYLE/FONTS
  scorer breakdown).

## 4. Proposed change

### 4a. Group lines into a paragraph box at flush time (renderer)

In the line-flush path, instead of emitting a standalone box per `LayoutLine`, accumulate
the lines of one logical paragraph and emit a single box whose:

- `origin` = first line's origin (`x0`, baseline of line 1)
- `size`  = `(max_line_width + left+right insets, line_count × line_height)` — line_height
  derived from the paragraph's font size / leading, not per-line collation
- `runs`  = all line runs, in order (concatenate across lines)

Where the logical paragraph boundary comes from the parse tree (`wo-ooxml` `Paragraph`
element / `<w:p>`), i.e. merge only lines originating from the **same** paragraph run block.

### 4b. The regression guard (critical)

Merging unconditionally will break cases whose truth keeps per-line boxes. Guard on a
per-case policy (harness-side), not a renderer world-view:

- **Option A — switch case 14 to `--cross-engine` run-level mode** — **EMPIRICALLY
  REJECTED 2026.** Ran `wo-conformance diff --cross-engine` on case 14: **0.48**, LOWER
  than box mode's 0.70. Run mode's geometry = token-x proportional distribution across each
  box width (engine line boxes vs truth single box) plus y-positions → only 3/30 tokens
  within 5% page tolerance (geometry 0.1); style = 0.0 because the engine projection
  reports generic `sans-serif` while truth reports `LiberationSerif`. So cross-engine mode
  is NOT a fix — it trades the box-segmentation penalty for a font-family + token-x penalty
  and scores worse.
- **Option B — keep box-scoring but teach `score_page_boxes` to merge engine line boxes of
  the same paragraph before matching.** This keeps box semantics but is heuristic (which
  adjacent boxes are the same paragraph? proximity + same run style + no intervening block).
- **Option C — renderer groups paragraphs** (4a) **and** box-scoring stays as-is; then verify
  the other 38 cases still match (per-line truth boxes would get a merged engine box → size
  mismatch → regression). *Rejected unless 4b-Option-A/C guard shows zero regression across
  the corpus.*

## 5. Where the fix must land (authoritative)

The failure is in `score_page_boxes`'s **height** comparison
(`~14` vs `27.08`). No width/fold/justify change touches it. To move the box-level number:

1. Renderer groups line-runs into one paragraph box **(4a)** — a layout change in
   `layout.rs` flush path (structure/`LayoutBox` in `wo-docx-renderer`/`wo-ooxml`),
   OR
2. ~~Score differently — Option A (`--cross-engine`)~~ **rejected** — §7 measured it
   LOWER (0.48) on case 14 and lower on mean corpus fidelity.

## 6. Risk register

| Risk | Mitigation |
|------|-----------|
| Merging regresses 38 cases with per-line truth boxes | Per-case gate; renderer change gated on zero-regression proof (Option A rejected — §7)
| `size.height` for a merged box needs a leading model (line_height) | Reuse paragraph leading already in layout; else set height = n_lines × (font_size × leading) |
| Runs of different styles within a paragraph | Keep runs independent inside the box; scorer zips runs for style |
| `--cross-engine` geometry tolerance is looser (5% page) | Acceptable for cross-projection compare; document that absolute box geometry is box-mode's job |

## 7. Recommended next step — corrected (2026)

Option A (cross-engine) is **rejected**: measured 0.48 < box 0.70. Case 14 has THREE
independent deficits vs truth, and no single cheap lever fixes it:

1. **Box segmentation** — 3 line-boxes vs 1 merged box (size 402×14.4 vs 454.3×27.1).
2. **Font projection** — engine reports `sans-serif`, truth `LiberationSerif` (drives
   run-level style to 0.0). Not a layout bug, but a projection/scoring gap.
3. **Line y/fold positions** — engine lines at y=72.0/86.4/100.8 vs truth run baselines
   y=83.2/97.0; engine wraps into 3 lines where truth merges to 2.

**CORPUS-WIDE MEASURED (2026): cross-engine is NOT a parity improvement overall.** Ran
`wo-conformance diff` (box) and `diff --cross-engine` on all 39 cases:

| metric | box | cross-engine |
|--------|-----|--------------|
| mean fidelity | **0.6836** | 0.6383 |
| cross>box / cross<box / tie | — | 18 / 17 / 4 |

Box mode wins on average by ~0.045. Cross-engine helps exactly ONE case substantially
(28 font-per-page: 0.36 → 0.589, +0.23) and six cases marginally (+0.05), but it HURTS 8
cases badly (−0.21 to −0.25: 14 justified, 17 multi-page, 27 long-line-wrapping, 31/
33/36/37/38 ODT alignment/spacing/wrapping — all multi-paragraph/wrap/alignment cases, the
same class as case 14). So switching the gate to cross-engine mode would LOWER mean
fidelity and regress the alignment/wrap family; it is not a lever for parity. The box-mode
gate stays. Case-14 improvement remains deferred: it needs real renderer work (merge runs
into one paragraph box) + font-family resolution + correct wrapping — Option C, a genuine
layout-engine change, not a scoring/width tweak. Do NOT ship a scoring-mode switch.

## 8. Success criteria

- Case 14 fidelity meaningfully above box-level 0.70 under the chosen mode, with **0
  regressions** across the other 38 cases.
- Harness conformance gate (reconcile/regression) stays green.
- Server `cargo test -p wo-docx-renderer --lib` stays green (55 baseline) if renderer touched.
