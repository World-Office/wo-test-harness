# Census — WO editor observability + gates

Pure-observation captures of the WO editor, diffs against committed goldens,
and honest gates. All scripts are Playwright drivers or small Python gates;
goldens live under `golden/`.

## Pixel gate (visual parity flood line)

The geometry census proves structure; the pixel gate proves the rendered
surface isn't blank/broken. It compares a WO editor screenshot against the
LibreOffice golden render of the **same committed .docx**.

**Honesty contract** (read before trusting a number):
- WO renders a **continuous HTML flow** (`#editor`), LO renders **paginated
  A4** — the two layout models never pixel-match. So the diff% is a *flood
  line*, not a similarity claim: it catches regressions (blank, collapsed
  layout, missing table/images), not cross-engine antialiasing.
- Each golden records its cross-engine **baseline** (`golden/docs/baselines.json`);
  the effective gate = baseline + 10pt. A clean re-render must stay near the
  baseline; a regression pushes diff% past it. Override with `--gate`.
- **INK-FAIL**: if the WO capture has <25% of the golden's ink, it's a blank
  render and fails immediately (before any % diff matters).

### Run it

```sh
# 1. LO golden for a committed doc (soffice -> pdf -> pdftoppm)
soffice --headless --convert-to pdf golden/docs/<doc>.docx --outdir golden/docs
pdftoppm -png -r 110 golden/docs/<doc>.pdf golden/docs/pg

# 2. WO capture: register the doc in a scratch docserver, then. The editor
#    renders body text at 12pt Liberation Serif by default (the same face LO
#    uses), so a plain capture is already at a fair scale — no overrides
#    needed. VISUAL_ZOOM / VISUAL_FONT remain available as explicit overrides.
VISUAL_BASE=http://127.0.0.1:8891 VISUAL_DOC=<doc>.docx \
  VISUAL_OUT=/tmp/wo-<doc>.png node visual-wo.cjs

# 3. compare (default gate = recorded baseline + 10)
python3 pixel-diff.py --wo /tmp/wo-<doc>.png --gold golden/docs/pg-1.png
```

Adding a doc: add the `.docx` + its `pg-N.png` to `golden/docs/`, do one
baseline run with `--gate 100`, and record the measured `diff_px` AND WO ink
into `golden/docs/baselines.json` (`{"pg-1.png": {"diff_px": X, "mean": Y, "wo_ink": Z}}`).

> The editor paginates into fixed A4 sheets (`.wo-page` — LO/OO/Word page
> model, paginateView/flatHtml in `web/editor.js`), so the gate compares
> sheet vs sheet. Break points still differ from LO's engine (own font
> metrics, no reflow-on-mutation yet): the gate stays a regression flood
> line, not a similarity meter. The ink flood line is baseline-relative:
> WO 96dpi text weighs ~2.8%% vs the golden's 12.5%% at 110dpi, so a fixed
> fraction of golden ink false-fails healthy renders — record `wo_ink`
> (percent) per doc. The capture viewport must be taller than a sheet
> (~1123px + toolbar): an element taller than the viewport gets its
> below-viewport pixels filled with the page backdrop instead of its own
> paint.

> The editor paginates into fixed A4 sheets (`.wo-page` — LO/OO/Word page
> model, paginateView/flatHtml in `web/editor.js`), so the gate compares
> sheet vs sheet. Break points still differ from LO's engine (own font
> metrics, no reflow-on-mutation yet): the gate stays a regression flood
> line, not a similarity meter. Capturing without zoom/font hits the 8px
> default, which the golden reads as blank (INK-FAIL) — expected; the
> documented capture args are the gate contract.

### Current golden

| doc | WO render | LO golden | recorded baseline | gate |
|-----|-----------|-----------|-------------------|------|
| visual-gate.docx (headings, mixed inline styling, 3×3 table) | 794×1123 sheet @ 12pt serif | pg-1.png 935×1210 @110dpi | 8.6% | 18.6% |
| image-gate.docx (heading, intro, embedded 5" picture, caption + tail) | 794×1123 sheet @ 12pt serif | image-gate.png 935×1210 @110dpi | 27.8% | 37.8% |

Image docs gate looser (engine metric/DPI shifts misalign the picture block):
27.8%% vs the text page's 8.6%% is expected. The ink flood line still catches
a silently dropped image (it carries most of the page's ink -> INK-FAIL).
