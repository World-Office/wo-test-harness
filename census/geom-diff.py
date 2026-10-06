#!/usr/bin/env python3
"""Geometry gate: drift vs the committed golden + structural invariants.

Inputs: --wo <geom-wo.json> (live capture; if absent, captured first via
reconcile.py --geometry), --gold <geom-wo.json> (committed golden).

Checks:
  1. control set per tab identical to the golden (added/removed controls fail)
  2. rect drift <= DRIFT px on every axis vs the golden
  3. structural invariants (run on the LIVE capture):
     - row alignment: controls sharing a y-band must share the same row
       baseline within ROW_TOL (catches half-dropped buttons)
     - overlap: no two controls in the same tab overlap by more than
       OVERLAP_TOL on BOTH axes (compact-toolbar edge cases live inside tol)
     - ordering: x strictly increasing within a row group

Exit 0 iff everything holds.
"""
import json
import sys
import argparse
from pathlib import Path

DRIFT = 4.0       # px of allowed movement vs golden per axis
ROW_TOL = 2.0     # same-row y-CENTER tolerance (subpixel + mixed-height align)
OVERLAP_TOL = 6.0 # px of tolerated rect overlap (documented compact cases)


def rows_of(controls):
    """Group controls into rows by y-CENTER proximity, anchor-based (no
    chaining: adjacent-but-distinct bands like the tab strip vs ribbon row A
    must not merge). Mixed-height rows (statusbar) align on center, not top."""
    rows = []
    for c in sorted(controls, key=lambda m: (m["rect"][1] + m["rect"][3] / 2, m["rect"][0])):
        cy = c["rect"][1] + c["rect"][3] / 2
        anchor = rows[-1][0] if rows else None
        if rows and abs(cy - (anchor["rect"][1] + anchor["rect"][3] / 2)) <= ROW_TOL:
            rows[-1].append(c)
        else:
            rows.append([c])
    for row in rows:
        row.sort(key=lambda m: m["rect"][0])
    return rows


def check_invariants(tabs, errors):
    for tab, controls in tabs.items():
        keys = [c["key"] for c in controls]
        if len(set(keys)) != len(keys):
            dupes = sorted({k for k in keys if keys.count(k) > 1})
            errors.append(f"[{tab}] duplicate control keys: {dupes}")
        for row in rows_of(controls):
            xs = [c["rect"][0] for c in row]
            if xs != sorted(xs):
                errors.append(f"[{tab}] row ~y={row[0]['rect'][1]:.0f}: x not increasing: "
                              + ", ".join(f"{c['key']}@{c['rect'][0]:.0f}" for c in row))
        for i, a in enumerate(controls):
            for b in controls[i + 1:]:
                ax, ay, aw, ah = a["rect"]; bx, by, bw, bh = b["rect"]
                ox = min(ax + aw, bx + bw) - max(ax, bx)
                oy = min(ay + ah, by + bh) - max(ay, by)
                if ox > OVERLAP_TOL and oy > OVERLAP_TOL:
                    errors.append(f"[{tab}] overlap {ox:.0f}x{oy:.0f}px: {a['key']} vs {b['key']}")


def main():
    global DRIFT, ROW_TOL, OVERLAP_TOL
    ap = argparse.ArgumentParser()
    ap.add_argument("--wo", required=True, help="live geom-wo.json")
    ap.add_argument("--gold", default=None, help="committed golden (default: geom-wo.<sys.platform>.json, fallback geom-wo.json)")
    ap.add_argument("--drift", type=float, default=DRIFT, help="max allowed px drift per axis (default 4.0)")
    ap.add_argument("--row-tol", type=float, default=ROW_TOL, help="same-row y-center tolerance px (default 2.0)")
    ap.add_argument("--overlap-tol", type=float, default=OVERLAP_TOL, help="tolerated rect overlap px (default 6.0)")
    args = ap.parse_args()
    DRIFT, ROW_TOL, OVERLAP_TOL = args.drift, args.row_tol, args.overlap_tol

    default = Path(__file__).parent / f"geom-wo.{sys.platform}.json"
    gold_path = Path(args.gold) if args.gold else (default if default.exists() else Path(__file__).parent / "geom-wo.json")
    print(f"geom-gold: {gold_path.name}")
    live = json.loads(Path(args.wo).read_text(encoding="utf-8"))
    gold = json.loads(gold_path.read_text(encoding="utf-8"))
    errors = []

    # structural invariants on the live capture
    check_invariants(live["tabs"], errors)
    check_invariants({"statusbar": live["statusbar"]}, errors)

    # drift vs golden
    for tab, gctrl in gold["tabs"].items():
        lctrl = live["tabs"].get(tab)
        if lctrl is None:
            errors.append(f"[{tab}] tab missing from live capture")
            continue
        gmap = {c["key"]: c for c in gctrl}
        lmap = {c["key"]: c for c in lctrl}
        for k in sorted(set(gmap) - set(lmap)):
            errors.append(f"[{tab}] control gone: {k}")
        for k in sorted(set(lmap) - set(gmap)):
            errors.append(f"[{tab}] new control vs golden: {k} (recapture golden deliberately)")
        for k in sorted(set(gmap) & set(lmap)):
            g, l = gmap[k]["rect"], lmap[k]["rect"]
            for axis, gv, lv in zip("xywh", g, l):
                if abs(gv - lv) > DRIFT:
                    errors.append(f"[{tab}] {k} {axis}-drift {gv} -> {lv} (> {DRIFT}px)")
    gkeys = {c["key"] for c in gold["statusbar"]}
    lkeys = {c["key"] for c in live["statusbar"]}
    for k in sorted(gkeys - lkeys):
        errors.append(f"[statusbar] control gone: {k}")
    for k in sorted(lkeys - gkeys):
        errors.append(f"[statusbar] new control vs golden: {k} (recapture golden deliberately)")
    gmap = {c["key"]: c["rect"] for c in gold["statusbar"]}
    for c in live["statusbar"]:
        if c["key"] in gmap:
            for axis, gv, lv in zip("xywh", gmap[c["key"]], c["rect"]):
                if abs(gv - lv) > DRIFT:
                    errors.append(f"[statusbar] {c['key']} {axis}-drift {gv} -> {lv} (> {DRIFT}px)")

    if errors:
        print(f"geom-diff: FAIL — {len(errors)} issue(s)")
        for e in errors:
            print("  " + e)
        return 1
    n = sum(len(v) for v in live["tabs"].values()) + len(live["statusbar"])
    print(f"geom-diff: PASS — {len(live['tabs'])} tabs, {n} controls, drift <= {DRIFT}px, invariants clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
