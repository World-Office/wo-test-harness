#!/usr/bin/python3
"""done-gate.py — undocumented-missing detector + rollup over graph.json.

A control is *undocumented-missing* when its status is `missing`: absent from
the react census without a divergence reason (PORT-GRAPH.md). Diverged rows
are documented debt and pass.

  /usr/bin/python3 done-gate.py                  rollup, GATE OK/FAIL, exit 0
  /usr/bin/python3 done-gate.py --surface ribbon one surface, per-tab lines
  /usr/bin/python3 done-gate.py --strict         exit 1 on undocumented missing (CI)

Reads only census/port-graph/graph.json (committed, derived). Never edits it.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
GRAPH = HERE / "graph.json"
STATUSES = ("done", "diverged", "missing", "iconOnly")


def main() -> int:
    argv = sys.argv[1:]
    strict = "--strict" in argv
    surface = None
    if "--surface" in argv:
        i = argv.index("--surface")
        if i + 1 >= len(argv):
            print("error: --surface needs an id", file=sys.stderr)
            return 2
        surface = argv[i + 1]

    graph = json.loads(GRAPH.read_text())
    surfaces = graph["surfaces"]
    if surface:
        surfaces = [s for s in surfaces if s["id"] == surface]
        if not surfaces:
            known = ", ".join(s["id"] for s in graph["surfaces"])
            print(f"error: unknown surface {surface!r} (known: {known})", file=sys.stderr)
            return 2

    missing_total = 0
    undocumented = []
    for s in surfaces:
        tabs = s.get("tabs", [])
        if not tabs and "clusters" in s:  # ledger surface: features, no controls
            feats = sum(c["counts"]["features"] for c in s["clusters"])
            print(f"{s['id']:12} {len(s['clusters'])} clusters, {feats} features (no control nodes)")
            continue
        c = {k: sum(t["counts"][k] for t in tabs) for k in STATUSES}
        print(f"{s['id']:12} {sum(c.values()):4} controls  "
              f"done={c['done']} diverged={c['diverged']} "
              f"missing={c['missing']} iconOnly={c['iconOnly']}")
        for t in tabs:
            miss = [x for x in t["controls"] if x["status"] == "missing"]
            bad = [x for x in t["controls"] if x["status"] not in STATUSES]
            if bad:
                print(f"error: {s['id']}/{t['id']}: unknown status "
                      f"{[x['status'] for x in bad]}", file=sys.stderr)
                return 2
            if surface or miss:
                print(f"    {t['id'][:24]:24} done={t['counts']['done']:3} "
                      f"diverged={t['counts']['diverged']} "
                      f"missing={t['counts']['missing']}")
            for x in miss:
                documented = bool((x.get("reason") or "").strip())
                tag = "GAP (documented)" if documented else "MISSING"
                print(f"      {tag} {t['id']}/{x['ooLabel']}")
                if not documented:
                    missing_total += 1
                    undocumented.append(f"{s['id']}/{t['id']}/{x['ooLabel']}")

    if missing_total:
        print(f"GATE FAIL — {missing_total} undocumented-missing control(s):")
        for u in undocumented[:10]:
            print(f"      {u}")
    else:
        print("GATE OK — no undocumented-missing controls "
              "(documented gaps are listed, not failed)")
    return 1 if (strict and missing_total) else 0


if __name__ == "__main__":
    sys.exit(main())
