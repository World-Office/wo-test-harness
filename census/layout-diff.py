#!/usr/bin/env python3
"""layout-diff.py — ribbon LAYOUT parity (rows / groups / order), OO vs WO.

Why: the label census answers "does a button with this text exist?" and
reported 78-100% while the ribbon still looked nothing like OnlyOffice. A
label SET cannot see row alignment, group boundaries or left-to-right order.
This reads the geometry both censuses already capture (census-oo-deep.json
and census-react-deep.json -> `geometry`) and scores what the eye sees.

Both sides are reduced with the SAME rule (ROW_EPS px of y = one row; a
horizontal gap > GROUP_GAP px = a new group), so the comparison is like for
like. Viewports must match — the ribbon is responsive.

Usage:  layout-diff.py [--tab Home] [--json]
        layout-diff.py --self-test          # offline, exercises the scoring
Exit:   0 ok | 1 layout regression (gate) | 2 input problem
Gate:   rows(WO) <= rows(OO) + ROW_SLACK and every OO top-row control family
        is on the WO top row. Advisory detail is printed either way.
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROW_EPS = 6      # px of y-distance that still counts as the same visual row
GROUP_GAP = 12   # px of horizontal gap that starts a new group
ROW_SLACK = 0    # extra rows tolerated vs OO


def _norm(s: str) -> str:
    """Lowercase, drop shortcut hints and punctuation: 'Bold (Ctrl+B)' -> 'bold'."""
    s = s.split("(")[0]
    return "".join(ch for ch in s.lower() if ch.isalnum())


def reduce_layout(buttons):
    """[{label,x,y,w,h}] -> {rows:int, groups:int, order:[[label..] per row]}"""
    bs = [b for b in buttons if b.get("w") and b.get("label") and _norm(b["label"])]
    S = sorted(bs, key=lambda b: (b["y"], b["x"]))
    row, last = -1, -10**9
    for b in S:
        if b["y"] - last > ROW_EPS:
            row += 1
        b["row"] = row
        last = b["y"]
    rows = row + 1
    groups = 0
    order = []
    for r in range(rows):
        cs = [b for b in S if b["row"] == r]
        right = None
        labels = []
        for b in cs:
            if right is not None and b["x"] - right > GROUP_GAP:
                groups += 1
                labels.append("|")  # group boundary marker
            labels.append(_norm(b["label"]))
            right = b["x"] + b["w"]
        if cs:
            groups += 1
        order.append(labels)
    # a row with a single tiny item is a chevron/overflow, not a content row
    content_rows = sum(1 for labels in order if len([l for l in labels if l != "|"]) > 1)
    return {"rows": rows, "content_rows": content_rows, "groups": groups, "order": order}


def score(oo_layout, wo_layout):
    """-> (ok, [findings]). Checks the two things that make a ribbon read as the same ribbon."""
    findings = []
    # Compare TOTAL rows, not content rows: a control orphaned on its own y-band
    # is exactly the breakage the eye sees, so it must not be filtered away.
    if wo_layout["rows"] > oo_layout["rows"] + ROW_SLACK:
        findings.append(
            f"rows: WO {wo_layout['rows']} > OO {oo_layout['rows']} "
            f"(+{ROW_SLACK} slack) — controls are stacked instead of sharing rows")
    # every control OO puts on its FIRST content row should be on WO's first too
    def first_content(layout):
        for labels in layout["order"]:
            fam = {l for l in labels if l != "|"}
            if len(fam) > 1:
                return fam
        return set()
    oo_top = first_content(oo_layout)
    wo_top = first_content(wo_layout)
    wo_all = [l for labels in wo_layout["order"] for l in labels if l != "|"]
    misplaced = sorted(f for f in oo_top if f in wo_all and f not in wo_top)
    if misplaced:
        findings.append(
            f"top-row placement: {len(misplaced)} control(s) OO keeps on the top row sit lower in WO: "
            + ", ".join(misplaced[:8]) + (" …" if len(misplaced) > 8 else ""))
    return (not findings), findings


def _load(oo_path, wo_path, tab):
    oo = json.loads(Path(oo_path).read_text())
    wo = json.loads(Path(wo_path).read_text())
    oo_vp = oo.get("viewport", {})
    wo_vp = wo.get("viewport", {})
    if (oo_vp.get("w"), oo_vp.get("h")) != (wo_vp.get("width"), wo_vp.get("height")):
        return None, (f"viewport mismatch: OO {oo_vp.get('w')}x{oo_vp.get('h')} vs "
                      f"WO {wo_vp.get('width')}x{wo_vp.get('height')} — the ribbon is responsive; "
                      f"recapture both at the same size (CENSUS_VIEWPORT_W/H)")
    key = next((k for k in oo["tabs"] if k.lower() == tab.lower()), None)
    if key is None:
        return None, f"tab {tab!r} not in OO golden"
    geo = wo.get("geometry", {}).get(tab)
    if geo is None:
        return None, f"no `geometry` for tab {tab!r} in the WO census (recapture with the geometry-aware census-react-deep.cjs)"
    return (reduce_layout(oo["tabs"][key]["buttons"]), reduce_layout(geo["ribbon"])), None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tab", default="Home")
    ap.add_argument("--oo", default=str(HERE / "census" / "census-oo-deep.json"))
    ap.add_argument("--wo", default=str(HERE / "census" / "census-react-deep.json"))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    pair, err = _load(a.oo, a.wo, a.tab)
    if err:
        print(f"layout-diff: {err}")
        return 2
    oo_l, wo_l = pair
    ok, findings = score(oo_l, wo_l)
    res = {"tab": a.tab, "oo": {k: oo_l[k] for k in ("rows", "content_rows", "groups")},
           "wo": {k: wo_l[k] for k in ("rows", "content_rows", "groups")}, "ok": ok, "findings": findings}
    if a.json:
        print(json.dumps(res, indent=1))
    else:
        print(f"layout-diff [{a.tab}]  OO: {oo_l['content_rows']} rows / {oo_l['groups']} groups"
              f"   WO: {wo_l['content_rows']} rows / {wo_l['groups']} groups   -> {'ok' if ok else 'LAYOUT REGRESSION'}")
        for f in findings:
            print("  - " + f)
    return 0 if ok else 1


def self_test():
    """Offline: the scorer must flag stacked rows + misplaced controls, and pass a match."""
    oo = [{"label": "Font", "x": 99, "y": 68, "w": 125, "h": 24}, {"label": "Bullets", "x": 396, "y": 68, "w": 24, "h": 24},
          {"label": "Bold (Ctrl+B)", "x": 99, "y": 104, "w": 24, "h": 24}, {"label": "Italic", "x": 127, "y": 104, "w": 24, "h": 24}]
    good = [dict(b) for b in oo]
    stacked = [{"label": "Font", "x": 99, "y": 68, "w": 125, "h": 24}, {"label": "Bullets", "x": 396, "y": 68, "w": 24, "h": 24},
               {"label": "Bold", "x": 99, "y": 104, "w": 24, "h": 24}, {"label": "Italic", "x": 127, "y": 150, "w": 24, "h": 24}]
    o = reduce_layout(oo)
    assert o["content_rows"] == 2 and o["groups"] == 3, o
    ok, f = score(o, reduce_layout(good));          assert ok, f                       # identical -> pass
    ok, f = score(o, reduce_layout(stacked));       assert not ok and any("rows" in x for x in f), f  # 3 rows -> fail
    misplaced = [dict(b) for b in oo] + [{"label": "Bullets", "x": 300, "y": 104, "w": 24, "h": 24}]
    ok, f = score(o, reduce_layout([b for b in misplaced if not (b["label"] == "Bullets" and b["y"] == 68)]))
    assert not ok and any("top-row" in x for x in f), f                                   # moved down -> fail
    assert _norm("Bold (Ctrl+B)") == "bold" and _norm("Change case") == "changecase"
    print("layout-diff: self-test ok (pass / stacked-rows fail / misplaced fail / normalisation)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
