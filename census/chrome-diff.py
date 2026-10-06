#!/usr/bin/env python3
"""chrome-diff.py — ribbon-chrome pixel gate (WO vs OnlyOffice).

Compares the top UI strip (tabs + ribbon) captured from the two GUIs at the
same viewport (1440 px, deviceScaleFactor 1). Unlike pixel-diff.py (document
surface, cross-engine fonts), the chrome is a UI both projects paint
themselves, so this diff is a real look-parity signal, not a flood line.

Alignment: widths are cropped to the narrower capture; heights to the shorter.
No content-bbox alignment (the chrome is fixed-position). Reports mean channel
diff, % of pixels differing beyond --thresh, and (with --bands N) a per-band
breakdown so a single divergent tab is visible.

Gate: recorded baseline (census/chrome-baselines.json, keyed by oo png name)
+ SLACK points; CHROME_GATE/--gate overrides. Report-only if no baseline.
Exit 0 iff gate (if any) holds.
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops

SLACK = 3.0  # points of slack above the recorded WO-vs-OO floor


def _baseline(oo_name: str) -> dict:
    bl_path = Path(__file__).parent / "chrome-baselines.json"
    try:
        return json.loads(bl_path.read_text()).get(oo_name, {})
    except Exception:
        return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wo", required=True, help="WO chrome png")
    ap.add_argument("--oo", required=True, help="OO chrome png")
    ap.add_argument("--thresh", type=int, default=40, help="per-pixel diff threshold (0-255)")
    ap.add_argument("--gate", type=float, default=None, help="fail if diff%% > gate (default: baseline + slack)")
    ap.add_argument("--bands", type=int, default=0, help="if >0, report diff%% per horizontal band")
    a = ap.parse_args()

    wo_p, oo_p = Path(a.wo), Path(a.oo)
    if not wo_p.exists() or not oo_p.exists():
        print(f"chrome-diff: missing input ({wo_p} / {oo_p})")
        return 2
    wo = Image.open(wo_p).convert("RGB")
    oo = Image.open(oo_p).convert("RGB")
    w, h = min(wo.width, oo.width), min(wo.height, oo.height)
    wo, oo = wo.crop((0, 0, w, h)), oo.crop((0, 0, w, h))

    diff = ImageChops.difference(wo, oo).convert("L")
    hist = diff.histogram()
    total = w * h
    differing = sum(hist[a.thresh:])
    bad = 100.0 * differing / total
    mean = sum(i * n for i, n in enumerate(hist)) / total

    gate = a.gate
    if gate is None:
        bl = _baseline(oo_p.name)
        if bl.get("diff_px") is not None:
            gate = bl["diff_px"] + SLACK
    verdict = "" if gate is None else ("  -> OK" if bad <= gate else "  -> FAIL")
    print(f"chrome-diff: {wo_p.name} vs {oo_p.name}  size {w}x{h}  "
          f"mean={mean:.1f}/255  diff_px={bad:.1f}% (thresh {a.thresh})"
          f"{f'  gate={gate:.1f}%' if gate is not None else ''}{verdict}")
    if a.bands:
        bh = max(1, h // a.bands)
        for i in range(a.bands):
            t, b = i * bh, min(h, (i + 1) * bh)
            sub = diff.crop((0, t, w, b)).histogram()
            tot = w * (b - t)
            d = 100.0 * sum(sub[a.thresh:]) / tot
            print(f"  band {i} y={t:-4d}-{b:-4d}: diff_px={d:5.1f}%")
    if gate is not None and bad > gate:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())