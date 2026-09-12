#!/usr/bin/env python3
"""interact-diff.py — join the INTERACTION dimension into the parity ledger.

census-diff.py proves a WO button EXISTS for every OO button (structural
ledger). This joins the click-through census: for every STRUCTURALLY REAL,
interaction-relevant OO control (one that opens a surface), the WO button
must open the SAME KIND of surface. The OO->WO key is NOT re-derived here —
it reuses the audited structural ledger's `wo` mapping, so the interaction
classification rides on the already-agreed pairing.

  ok          — same kind (modal↔modal, menu↔menu, panel↔panel, none↔none)
  missing     — OO opens modal/menu/panel, WO opens NOTHING  = missing dialog
  type        — OO modal but WO menu (or reverse)            = weird overlay
  geometry    — same kind but WO surface clipped/offscreen   = weird overlay
  extra       — WO opens a surface, OO opens nothing (note only)
  organic     — OO surface-bearing control, but ledger status != real
                (covered/stub/deferred): out of scope for this pass

Output: <out>/interact-ledger.json + table on stdout. Exit 1 if any
missing/type/geometry rows exist (CI gate).

Run: /usr/bin/python3 interact-diff.py [--wo FILE] [--oo FILE] [--ledger FILE] [--out DIR]
"""
import argparse, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CENSUS = HERE / "census"
_ap = argparse.ArgumentParser(add_help=False)
_ap.add_argument("--wo", default=None)
_ap.add_argument("--oo", default=None)
_ap.add_argument("--ledger", default=None)
_ap.add_argument("--out", default=None)
_args, _ = _ap.parse_known_args()
wo = json.load(open(_args.wo or (CENSUS / "interact-wo.json")))
oo = json.load(open(_args.oo or (CENSUS / "census-oo-interactions.json")))
led = json.load(open(_args.ledger or (CENSUS / "ledger.json")))
OUT = Path(_args.out) if _args.out else HERE
DIVERGENCES = json.load(open(HERE / "interact-divergences.json"))


def main() -> int:
    # WO interactions by control key (id OR cmd — ledger's `wo` may be either)
    wo_by = {}
    for w in wo["interactions"]:
        for k in (w.get("id"), w.get("cmd")):
            if k:
                wo_by.setdefault(str(k).lower(), w)

    counts = {"ok": 0, "missing": 0, "type": 0, "geometry": 0, "extra": 0, "unmatched": 0, "organic": 0, "divergence": 0}
    rows = []
    led_lookup = {}

    def _pick(a, b):
        """on key collision keep the higher-parity structural status"""
        if a is None:
            return b
        pr = {"real": 3, "covered": 2, "stub": 1, "deferred": 1, "future-iteration": 1}
        return a if pr.get(a.get("status"), 0) >= pr.get(b.get("status"), 0) else b

    for r in led["ledger"]:
        if r.get("id"):
            k = str(r["id"]) + "|" + str(r.get("tab"))
            led_lookup[k] = _pick(led_lookup.get(k), r)
        if r.get("label"):
            k = str(r["label"]) + "|" + str(r.get("tab"))
            led_lookup[k] = _pick(led_lookup.get(k), r)

    for o in oo["interactions"]:
        oo_kind = o.get("opens", "none")
        if oo_kind == "none":
            continue  # quiet OO controls: no interaction debt (structural census covers them)
        # locate the structural row for this OO control
        tab = o.get("tab") or ""
        srow = led_lookup.get(str(o.get("id") or "") + "|" + tab) if o.get("id") else None
        if not srow and o.get("label"):
            srow = led_lookup.get(str(o["label"]) + "|" + tab)
        name = o.get("label") or o.get("id") or "?"
        if not srow or srow.get("status") != "real" or not srow.get("wo"):
            counts["organic"] += 1
            rows.append({"token": (srow or {}).get("token"), "oo": name, "opens_oo": oo_kind,
                         "opens_wo": "-", "status": "organic", "tab": tab, "note": (srow or {}).get("status")})
            continue
        w = wo_by.get(str(srow["wo"]).lower())
        if not w:
            counts["unmatched"] += 1
            rows.append({"token": srow.get("token"), "oo": name, "opens_oo": oo_kind,
                         "opens_wo": "?", "status": "unmatched", "tab": tab, "note": f"wo={srow['wo']} not in interact census"})
            continue
        w_kind = w.get("opens", "none")
        status = "ok"
        if oo_kind == "none":
            status = "extra" if w_kind != "none" else "ok"
        elif w_kind == "none" or w_kind == "error":
            status = "missing"
        elif w_kind != oo_kind:
            status = "type"
        elif not w.get("inside_vp", True):
            status = "geometry"
        if status in ("missing", "type", "geometry") and srow.get("token") in DIVERGENCES:
            status = "divergence"  # declared intentional (see interact-divergences.json)
        counts[status] += 1
        rows.append({"token": srow.get("token"), "oo": name, "opens_oo": oo_kind, "opens_wo": w_kind,
                     "status": status, "tab": tab, "wo_id": w.get("id"), "wo_cmd": w.get("cmd"),
                     "clip": None if w.get("inside_vp", True) else (w.get("clipped_x") or w.get("clipped_y"))})

    (OUT / "interact-ledger.json").write_text(json.dumps({"counts": counts, "rows": rows}, indent=1))
    print("INTERACTION:", json.dumps(counts))
    for r in rows:
        if r["status"] != "ok":
            print(f"  [{r['status']:8s}] {r['tab']:16s} {r['oo']:30s} OO={r['opens_oo']:6s} WO={r['opens_wo']:6s}"
                  + (f"  note: {r['note']}" if r.get("note") else "")
                  + (f"  #{r.get('wo_id')}" if r.get("wo_id") else ""))
    bad = counts["missing"] + counts["type"] + counts["geometry"]
    print("gate:", "PASS — interactions clear" if bad == 0 else f"FAIL — {bad} interaction gaps to resolve")
    return 0 if bad == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
