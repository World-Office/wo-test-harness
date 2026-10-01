#!/usr/bin/env python3
"""Pixel gate: honesty check on the rendered document surface, beyond geometry.

Compares a WO editor screenshot against the OnlyOffice reference render of the
SAME committed .docx (*-oo.png, captured by capture-oo-goldens.py from the DS
converter — the same engine the OO editor paints). Both engines render the
same document, so a large visual mismatch means a real regression (blank page,
collapsed layout, wrong glyphs/colors) that the geometry census cannot see.
(Previously the reference was a LibreOffice PDF golden; rebased on OnlyOffice.)

Honesty notes (read before raising the gate):
- Cross-engine rendering never equals: fonts, hinting, sub-pixel AA, page
  margins differ slightly. v1 aligns only to (a) common width and (b) content
  bounding box, and reports the actual diff. The gate is the recorded cross-
  engine baseline + slack (BASELINE_SLACK), a flood line — not a
  pixel-perfect claim — it catches broken renders, not antialiasing.
- Alignment is intentionally coarse: WO screenshot is center-cropped to the
  golden's aspect ratio, then scaled to the golden's width. If the WO capture
  isn't a plain full-page shot (toolbar/scroll included), diff% rises — capture
  deterministically (tall viewport > sheet height, top of page 1).

Usage:
  pixel-diff.py --wo <wo.png> --gold <golden/<doc>-oo.png> [--width 900] [--gate 25]
Outputs: mean abs channel diff, % of pixels differing beyond --thresh (default
40/255), OK/FAIL vs --gate. Exit 0 ok, 1 gate breached, 2 usage/IO error.
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops

BASELINE_SLACK = 10.0  # points of slack above the recorded cross-engine floor


def content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    """Bounding box of non-white pixels (crops empty page margins/footers drift)."""
    g = img.convert("L")
    mask = g.point(lambda v: 255 if v < 245 else 0)
    return mask.getbbox() or (0, 0, img.width, img.height)


def prep(img: Image.Image, width: int, thresh: int):
    """Scale to common width, trim to content bbox, return L-image of 'different from white'."""
    if img.width != width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    bbox = content_bbox(img)
    return img.crop(bbox), bbox


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wo", required=True, help="WO editor screenshot png")
    ap.add_argument("--gold", required=True, help="LO golden png (pg-N.png)")
    ap.add_argument("--width", type=int, default=900, help="common comparison width")
    ap.add_argument("--thresh", type=int, default=40, help="pixel diff threshold (0-255)")
    ap.add_argument("--gate", type=float, default=None,
                    help="override gate %% (default: recorded baseline + %.0f)" % BASELINE_SLACK)
    a = ap.parse_args()

    wo_p, gold_p = Path(a.wo), Path(a.gold)
    if not wo_p.exists() or not gold_p.exists():
        print(f"pixel-diff: missing input ({wo_p} / {gold_p})"); return 2
    wo = Image.open(wo_p).convert("RGB")
    gold = Image.open(gold_p).convert("RGB")

    # effective floor: recorded cross-engine baseline + slack (unless overridden)
    bl = {}
    bl_path = gold_p.parent / "baselines.json"
    if bl_path.exists():
        try:
            bl = json.loads(bl_path.read_text())
        except Exception:
            bl = {}
    gate = a.gate if a.gate is not None else bl.get(gold_p.name, {}).get("diff_px", 25.0) + BASELINE_SLACK

    wo_c, _ = prep(wo, a.width, a.thresh)
    gold_c, _ = prep(gold, a.width, a.thresh)

    # common vertical span: crop both to the shorter height, centered
    h = min(wo_c.height, gold_c.height)
    def center_v(img):
        t = max(0, (img.height - h) // 2)
        return img.crop((0, t, img.width, t + h))
    wo_c, gold_c = center_v(wo_c), center_v(gold_c)

    def ink_fraction(img):
        return img.convert("L").point(lambda v: 1 if v < 245 else 0).histogram()[1] / (img.width * img.height)
    ink_wo, ink_gold = ink_fraction(wo_c), ink_fraction(gold_c)
    # blank-render flood line. Absolute 'x% of golden ink' is useless across
    # engines (WO text renders lighter than the 110dpi golden: ~3% vs ~12.5%),
    # so when a per-doc ink baseline is recorded, fail only on collapse to a
    # fraction of THIS doc's healthy ink (or an absolute near-zero floor).
    # Without a record, fall back to the legacy 25%-of-golden rule.
    rec_ink = bl.get(gold_p.name, {}).get("wo_ink")
    if rec_ink:
        ink_fail = ink_wo < max(0.5 * rec_ink / 100.0, 0.005)  # record is percent, ink_wo is fraction
    else:
        ink_fail = ink_wo < 0.25 * ink_gold

    diff = ImageChops.difference(wo_c, gold_c)
    grey = diff.convert("L")
    hist = grey.histogram()
    differing = sum(hist[a.thresh:])
    total = wo_c.width * wo_c.height
    bad = 100.0 * differing / total
    mean = sum(i * n for i, n in enumerate(hist)) / total

    if ink_fail:
        print(f"pixel-diff: {wo_p.name} vs {gold_p.name}  INK-FAIL (wo ink "
              f"{100*ink_wo:.1f}% vs golden {100*ink_gold:.1f}%) — blank/broken render")
        return 1
    verdict = "OK" if bad <= gate else "FAIL"
    print(f"pixel-diff: {wo_p.name} vs {gold_p.name}  mean_diff={mean:.1f}/255  "
          f"diff_px={bad:.1f}% (thresh {a.thresh})  ink wo={100*ink_wo:.1f}% gold={100*ink_gold:.1f}%  "
          f"gate={gate:.1f}% baseline={bl.get(gold_p.name, {}).get('diff_px', 25.0):.1f}%  -> {verdict}")
    return 0 if verdict == "OK" else 1


if __name__ == "__main__":
    sys.exit(main())
