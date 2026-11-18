#!/usr/bin/env python3.12
"""PG-2 — drill-down port report from graph.json.

  report.py                        coarse overview (surfaces + per-tab rollup)
  report.py --tab Home             control-level detail for one tab
  report.py --tab Home --status missing   filter controls by status
  report.py --json [--tab ...] [--status ...]   machine view (always .surfaces)

Statuses: done | diverged | missing (see PORT-GRAPH.md).
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
GRAPH = HERE / "graph.json"

STATUSES = ("done", "diverged", "missing")


def load_graph() -> dict:
    if not GRAPH.is_file():
        sys.exit(f"graph.json not found — run build.py first ({GRAPH})")
    return json.loads(GRAPH.read_text(encoding="utf-8"))


def ci(s: str) -> str:
    return s.strip().casefold()


def find_tab(g: dict, want: str):
    """Match a tab (or ledger cluster) by id or label, case-insensitive.

    Returns (surface, tab_dict) or (None, None)."""
    w = ci(want)
    for s in g["surfaces"]:
        for t in s.get("tabs", []):
            if w in (ci(t["id"]), ci(t["label"])):
                return s, t
        for c in s.get("clusters", []):  # ledger clusters are tab-like
            if w == ci(c["id"]):
                return s, c
    return None, None


def filter_controls(controls: list, status: str | None) -> list:
    return [c for c in controls if status is None or c["status"] == status]


def counts_line(c: dict) -> str:
    return (f"{c['done']:3d} done {c['diverged']:2d} div {c['missing']:2d} miss"
            + (f" +{c['iconOnly']} icon" if c.get("iconOnly") else ""))


def overview(g: dict) -> None:
    t = g["totals"]
    print(f"port-state report — generated {g['generated']}")
    print(f"totals: {t['controls']} controls — {t['done']} done, "
          f"{t['diverged']} diverged, {t['missing']} missing, "
          f"{t['iconOnly']} iconOnly · ledger {t['ledgerFeatures']} features")
    print(f"probes: {' '.join(g['probes'])}")
    for s in g["surfaces"]:
        print(f"\n{s['id']} ({s['label']})")
        for t_ in s.get("tabs", []):
            mark = "" if t_["counts"]["missing"] == 0 else "  <-- debt"
            print(f"  {t_['id']:<38} {t_['label']:<18} {counts_line(t_['counts'])}{mark}")
        for c in s.get("clusters", []):
            lv = " ".join(f"L{k}:{v}" for k, v in sorted(c["counts"]["byLevel"].items()))
            print(f"  {c['id']:<38} {c['counts']['features']:3d} features ({lv})")
    print("\ndrill down: --tab <id> · filter: --status done|diverged|missing · --json")


def print_control(surf, tab, status) -> None:
    controls = filter_controls(tab.get("controls", []), status)
    print(f"{tab['label']} — {surf['id']}/{tab['id']}"
          + (f" [status={status}]" if status else ""))
    if not controls:
        print(f"  no controls{' with status ' + status if status else ''}")
        return
    for c in controls:
        line = f"  {c['status']:<9} {c['label']}"
        if c.get("reason"):
            line += f"  — {c['reason']}"
        print(line)
    io = tab["counts"].get("iconOnly", 0)
    if io and status is None:
        print(f"  ({io} icon-only controls carry no label-parity burden)")


def print_cluster(cluster, status) -> None:
    if status:
        sys.exit("--status applies to controls; ledger features have no status")
    print(f"ledger cluster {cluster['id']} — {cluster['counts']['features']} features")
    for f in cluster["features"]:
        print(f"  L{f['level']} {f['kind']:<8} {f['id']}")


def json_view(g: dict, tab: str | None, status: str | None) -> dict:
    """Whole graph, or a filtered copy with the same shape (surfaces always present)."""
    if tab is None and status is None:
        return g
    out = {k: v for k, v in g.items() if k != "surfaces"}
    out["surfaces"] = []
    if tab is not None:
        surf, t = find_tab(g, tab)
        if surf is None:
            sys.exit(f"no such tab: {tab}")
        hit = dict(surf)
        hit.pop("tabs", None); hit.pop("clusters", None)
        t2 = dict(t)
        if "controls" in t2:
            t2["controls"] = filter_controls(t2["controls"], status)
        hit["tabs" if "controls" in t else "clusters"] = [t2]
        out["surfaces"].append(hit)
    else:  # --status without --tab: matching controls across every tab
        for s in g["surfaces"]:
            hit = dict(s)
            hit.pop("clusters", None)
            hit["tabs"] = [dict(t, controls=filter_controls(t.get("controls", []), status))
                           for t in s.get("tabs", [])]
            out["surfaces"].append(hit)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--tab", help="tab id or label (e.g. Home, filemenu, ledger cluster id)")
    ap.add_argument("--status", choices=STATUSES, help="filter controls by status")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    a = ap.parse_args()

    g = load_graph()

    if a.json:
        print(json.dumps(json_view(g, a.tab, a.status), indent=1, ensure_ascii=False))
        return 0

    if a.tab is None:
        if a.status:  # list matching controls across all tabs
            for s in g["surfaces"]:
                for t in s.get("tabs", []):
                    hits = filter_controls(t.get("controls", []), a.status)
                    if hits:
                        print_control(s, t, a.status)
            return 0
        overview(g)
        return 0

    surf, t = find_tab(g, a.tab)
    if surf is None:
        sys.exit(f"no such tab: {a.tab} (run without --tab to list tab ids)")
    if "controls" in t:
        print_control(surf, t, a.status)
    else:
        print_cluster(t, a.status)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
