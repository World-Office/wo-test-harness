> ⚠️ **DEPRECATED 2026-09-24 — see ../DEPRECATED.md.** These rigs boot the deprecated Python docserver.

# Census — WO editor observability + gates

Pure-observation captures of the WO editor, diffs against committed goldens,
and honest gates. All scripts are Playwright drivers or small Python gates;
goldens live under `golden/`.

## Pixel gate (visual parity flood line)

The geometry census proves structure; the pixel gate proves the rendered
surface isn't blank/broken. It compares a WO editor screenshot against the
OnlyOffice reference render of the **same committed .docx**.

**Honesty contract** (read before trusting a number):
- WO renders a **continuous HTML flow** (`#editor`), OO renders **paginated
  A4** — the two layout models never pixel-match. So the diff% is a *flood
  line*, not a similarity claim: it catches regressions (blank, collapsed
  layout, missing table/images), not cross-engine antialiasing.
- The reference is OnlyOffice's document-server converter output (`*-oo.png`),
  captured by `capture-oo-goldens.py` from the local DS — the same engine the
  OO editor paints. (History: the reference used to be a LibreOffice PDF
  golden; rebased on OnlyOffice.)
- Each golden records its cross-engine **baseline** (`golden/docs/baselines.json`);
  the effective gate = baseline + 10pt. A clean re-render must stay near the
  baseline; a regression pushes diff% past it. Override with `--gate`.
- **INK-FAIL**: if the WO capture collapses to a fraction of THIS doc's
  recorded healthy ink, it's a blank render and fails immediately.

### Run it

```sh
# 0. (once) recapture the OO goldens from the local DS converter. Needs the
#    oo-harness-ds container (host-net, JWT off) + oo-golden-server.py serving
#    the goldens to it:
/usr/bin/python3 census/capture-oo-goldens.py --ds http://127.0.0.1:8000

# 1. WO capture: register the doc in a scratch docserver, then:
VISUAL_BASE=http://127.0.0.1:8891 VISUAL_DOC=<doc>.docx \
  VISUAL_OUT=/tmp/wo-<doc>.png node visual-wo.cjs

# 2. compare (default gate = recorded baseline + 10)
/usr/bin/python3 census/pixel-diff.py --wo /tmp/wo-<doc>.png --gold golden/docs/<doc>-oo.png
```

Adding a doc: add the `.docx` + its `*-oo.png` to `golden/docs/` (run
`capture-oo-goldens.py`), then one baseline run and record the measured
`diff_px`/`mean`/`wo_ink`/`gold_ink` into `golden/docs/baselines.json` keyed
by the golden filename.

> The editor paginates into fixed A4 sheets (`.wo-page` — LO/OO/Word page
> model, paginateView/flatHtml in `web/editor.js`), so the gate compares
> sheet vs sheet. Break points still differ from OO's engine (own font
> metrics, no reflow-on-mutation yet): the gate stays a regression flood
> line, not a similarity meter. The ink flood line is baseline-relative:
> WO 96dpi text weighs ~2.8%% vs the golden's ~10.8%% at higher dpi, so a
> fixed fraction of golden ink false-fails healthy renders — record `wo_ink`
> (percent) per doc. The capture viewport must be taller than a sheet
> (~1123px + toolbar).

### Current golden

| doc | WO render | OO golden | recorded baseline | gate |
|-----|-----------|-----------|-------------------|------|
| visual-gate.docx (headings, mixed inline styling, 3×3 table) | 794×1123 sheet @ 12pt serif | visual-gate-oo.png 816×1056 | 7.9% | 17.9% |
| image-gate.docx (heading, intro, embedded 5" picture, caption + tail) | 794×1123 sheet @ 12pt serif | image-gate-oo.png 816×1056 | 27.5% | 37.5% |
| hf-gate.docx (header/footer test) | 794×1123 sheet | hf-gate-oo.png 816×1056 | 16.2% | 26.2% |

Image docs gate looser (engine metric/DPI shifts misalign the picture block):
27.5%% vs the text page's 7.9%% is expected. The ink flood line still catches
a silently dropped image (it carries most of the page's ink -> INK-FAIL).
