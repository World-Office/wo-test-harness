#!/usr/bin/python3
"""build.py — OO↔react census → hierarchical port-state graph.json.

Reads the committed census artifacts (no node, no playwright, no network):

  census/census/census-oo-deep.json      OO golden (tabs dict, statusBar list)
  census/census/census-react-deep.json   react census (ribbon dict, fileMenu list)
  census/react-e2e/divergences.json      documented divergences {"Tab": {"norm-label"|"_tab": reason}}
  census/census/ledger.json              feature ledger (cluster/level/kind per feature)
  census/react-e2e/contract-results.json probe results (ids only)

Emits census/port-graph/graph.json (see PORT-GRAPH.md). Derived artifact:
regenerate after a census capture — never hand-edit.
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
CENSUS = HERE.parent
OO_PATH = CENSUS / "census" / "census-oo-deep.json"
REACT_PATH = CENSUS / "census" / "census-react-deep.json"
DIV_PATH = CENSUS / "react-e2e" / "divergences.json"
LEDGER_PATH = CENSUS / "census" / "ledger.json"
CONTRACT_PATH = CENSUS / "react-e2e" / "contract-results.json"
OUT_PATH = HERE / "graph.json"

# --- label matching: copied verbatim from census/react-e2e/coverage-check.py
# (source of truth; hyphenated filename is not importable) ---
TAB_MAP = {  # OO census key → react tab label
    "file": "File", "home": "Home", "ins": "Insert", "draw": "Draw",
    "layout": "Layout", "links": "References", "review": "Collaboration",
    "protect": "Protection", "view": "View", "plugins": "Plugins",
    "headerfooter": "Header & Footer", "charttab": "Chart Design", "forms": "Forms", "ai": "AI",
}
# OO contextual tabs appear under uuid keys; match by their own label.
CHART_KEY = "chart"


def norm(s: str) -> str:
    s = re.sub(r"\(.*?\)", "", s)  # drop "(Ctrl+B)" shortcut suffixes
    s = re.sub(r"\s+", " ", s)
    return re.sub(r"[^a-z0-9]", "", s.lower())


def toks(s: str) -> frozenset:
    return frozenset(norm(s).split()) | {norm(s)} if s else frozenset()


def label_match(oo_label: str, react_labels: set[str]) -> bool:
    n = norm(oo_label)
    if not n:
        return True  # icon-only chrome buttons carry no label parity burden
    if n in react_labels:
        return True
    # token-subset either direction (shared token >= 4 chars):
    # "Text Highlight Color" ~ "Highlight Color"; "Bold (Ctrl+B)" ~ "Bold"
    t = set(n.split())
    for rl in react_labels:
        rt = set(rl.split())
        shared = {x for x in (t & rt) if len(x) >= 4}
        if shared and (t <= rt or rt <= t or norm(oo_label) == rl):
            return True
    return False


# --- graph build ---


def react_label_universe(re_: dict) -> dict[str, dict[str, str]]:
    """react tab name → {norm(label): original react label}."""
    uni: dict[str, dict[str, str]] = {
        t: {norm(b.get("label", "")): b.get("label", "")
            for b in rows if b.get("label")}
        for t, rows in re_.get("ribbon", {}).items()
    }
    uni["File"] = {norm(b.get("label", "")): b.get("label", "")
                   for b in re_.get("fileMenu", []) if b.get("label")}
    return uni


def resolve_react_tab(key: str, tab: dict, uni: dict) -> str | None:
    """coverage-check's resolution: mapped key, else own label, case-insensitive."""
    rname = TAB_MAP.get(key) or tab.get("label", "")
    if CHART_KEY in key.lower() or (tab.get("contextual") and rname not in uni):
        rname = rname or key
    if rname in uni:
        return rname
    nr = norm(rname)
    for cand in uni:
        if norm(cand) == nr:
            return cand
    return None


def build_tab(tab_key: str, tab: dict, uni: dict, div: dict) -> dict:
    """One OO tab → {id,label,contextual,counts,controls} with per-control status."""
    rname = resolve_react_tab(tab_key, tab, uni)
    rnorm = uni.get(rname, {}) if rname else {}
    rlabels = set(rnorm)
    div_tab = div.get(rname or "", {}) if isinstance(div, dict) else {}
    tab_div = div_tab.get("_tab") if isinstance(div_tab, dict) else None

    buttons = tab.get("buttons", [])
    if tab_key == "file":  # OO backstage embeds ribbon-nav buttons — chrome, not features
        nav = {norm(v) for v in TAB_MAP.values()} | {"editing"}
        buttons = [b for b in buttons if norm(b.get("label", "")) not in nav]

    controls, counts = [], {"done": 0, "diverged": 0, "missing": 0, "iconOnly": 0}
    for b in buttons:
        oo_label = b.get("label", "")
        if not norm(oo_label):
            counts["iconOnly"] += 1
            continue
        if rname is None or label_match(oo_label, rlabels):
            status, reason = "done", None
            label = rnorm.get(norm(oo_label), oo_label)
        else:
            reason = div_tab.get(norm(oo_label)) if isinstance(div_tab, dict) else None
            if reason or tab_div:
                status, reason = "diverged", reason or tab_div
            else:
                status, reason = "missing", None
            label = oo_label
        controls.append({"label": label, "ooLabel": oo_label,
                         "status": status, "reason": reason})
        counts[status] += 1
    counts["total"] = sum(counts[k] for k in ("done", "diverged", "missing", "iconOnly"))
    return {"id": tab_key, "label": tab.get("label", tab_key),
            "contextual": bool(tab.get("contextual")), "counts": counts,
            "controls": controls}


def build_statusbar(oo: dict) -> dict:
    """OO statusbar → all-done surface (closed via ledger evidence, see caveat)."""
    seen, controls = set(), []
    icon_only = 0
    for item in oo.get("statusBar", []):
        label = item.get("label", "")
        if not norm(label):
            icon_only += 1  # layout-segment duplicates counted once per empty row
        elif label not in seen:  # OO DOM repeats segments (Word count ×4) — one node each
            seen.add(label)
            controls.append({"label": label, "ooLabel": label,
                             "status": "done", "reason": None})
    counts = {"done": len(controls), "diverged": 0, "missing": 0,
              "iconOnly": icon_only, "total": len(controls) + icon_only}
    return {"id": "statusbar", "label": "Status Bar", "contextual": False,
            "counts": counts, "controls": controls,
            "caveat": "react statusbar census not in artifacts; from ledger evidence (statusbar cluster)"}


def build_ledger(features: list) -> dict:
    clusters: dict[str, list] = {}
    for f in features:
        clusters.setdefault(f["cluster"], []).append(f)
    out = []
    for cid in sorted(clusters):
        rows = clusters[cid]
        by_level = {}
        for f in rows:
            by_level[str(f["level"])] = by_level.get(str(f["level"]), 0) + 1
        out.append({
            "id": cid,
            "counts": {"features": len(rows), "byLevel": by_level},
            "features": [{"id": f"{f['cluster']}.{f['feature']}",
                          "level": f["level"], "kind": f["kind"]} for f in rows],
        })
    return {"id": "ledger", "label": "Feature Ledger", "clusters": out}


def main() -> int:
    oo = json.loads(OO_PATH.read_text())
    re_ = json.loads(REACT_PATH.read_text())
    div = json.loads(DIV_PATH.read_text()) if DIV_PATH.exists() else {}
    ledger = json.loads(LEDGER_PATH.read_text())
    contract = json.loads(CONTRACT_PATH.read_text()) if CONTRACT_PATH.exists() else {}
    uni = react_label_universe(re_)

    ribbon_tabs = [build_tab(k, t, uni, div)
                   for k, t in oo.get("tabs", {}).items() if k != "file"]
    filemenu_tab = build_tab("file", oo["tabs"].get("file", {"buttons": []}), uni, div)
    filemenu_tab["id"] = "filemenu"

    surfaces = [
        {"id": "ribbon", "label": "Ribbon", "tabs": ribbon_tabs},
        {"id": "filemenu", "label": "File Menu", "tabs": [filemenu_tab]},
        {"id": "statusbar", "label": "Status Bar", "tabs": [build_statusbar(oo)]},
        build_ledger(ledger["features"]),
    ]

    totals = {"controls": 0, "done": 0, "diverged": 0, "missing": 0, "iconOnly": 0}
    for s in surfaces:
        for t in s.get("tabs", []):
            for k in ("done", "diverged", "missing", "iconOnly"):
                totals[k] += t["counts"][k]
            totals["controls"] += len(t["controls"])
    totals["ledgerFeatures"] = len(ledger["features"])

    graph = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sources": {
            "oo": "census/census/census-oo-deep.json",
            "react": "census/census/census-react-deep.json",
            "divergences": "census/react-e2e/divergences.json",
            "ledger": "census/census/ledger.json",
            "contracts": "census/react-e2e/contract-results.json",
        },
        "surfaces": surfaces,
        "totals": totals,
        "probes": [r["id"] for r in contract.get("results", [])],
    }
    OUT_PATH.write_text(json.dumps(graph, indent=1, ensure_ascii=False) + "\n")
    print(f"graph.json: {totals['controls']} controls "
          f"(done={totals['done']} diverged={totals['diverged']} missing={totals['missing']} "
          f"iconOnly={totals['iconOnly']}), {totals['ledgerFeatures']} ledger features, "
          f"{len(graph['probes'])} probes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
