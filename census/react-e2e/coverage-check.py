#!/usr/bin/env python3
"""coverage-check.py — OO↔react ribbon-label parity coverage.

Compares census/census-oo-deep.json (golden) against a react deep census
(default census/census/census-react-deep.json) and prints per-tab coverage
of OO labels present in the react ribbon. Exit 0 (with --gate) only when
coverage over non-declared labels is 100% and no tab is pending activation
capture without a declared reason.

Divergences: react-e2e/divergences.json = {"Tab|normalized-label": reason}.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CENSUS = HERE.parent

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


def load_divergences() -> dict:
    p = HERE / "divergences.json"
    return json.loads(p.read_text()) if p.exists() else {}


def main() -> int:
    react_path = Path(sys.argv[sys.argv.index("--react") + 1]) if "--react" in sys.argv \
        else CENSUS / "census" / "census-react-deep.json"
    gate = "--gate" in sys.argv
    oo = json.loads((CENSUS / "census" / "census-oo-deep.json").read_text())
    re_ = json.loads(react_path.read_text())
    div = load_divergences()
    react_ribbon = {t: {norm(b.get("label", "")) for b in rows if b.get("label")} for t, rows in re_.get("ribbon", {}).items()}
    # File menu is captured as fileMenu entries, not a ribbon tab
    react_ribbon["File"] = {norm(b.get("label", "")) for b in re_.get("fileMenu", []) if b.get("label")}
    
    # Build normalized tab name lookup: map normalized names to original names
    react_tab_norm = {norm(t): t for t in react_ribbon.keys()}

    results = {}
    for key, tab in oo["tabs"].items():
        # resolve react tab name: mapped key, or own label for contextual tabs
        rname = TAB_MAP.get(key) or tab.get("label", "")
        if CHART_KEY in key.lower() or (tab.get("contextual") and rname not in react_ribbon):
            rname = rname or key
        rows = [b["label"] for b in tab.get("buttons", []) if b.get("label")]
        # OO File backstage embeds ribbon-nav buttons (tab names) — chrome, not features
        if key == "file":
            nav = {norm(v) for v in TAB_MAP.values()} | {"editing"}
            rows = [l for l in rows if norm(l) not in nav]
        # Try normalized lookup first
        rlabels = react_ribbon.get(rname)
        if rlabels is None:
            # Try case-insensitive lookup via normalized name
            norm_rname = norm(rname)
            original_rname = react_tab_norm.get(norm_rname)
            if original_rname:
                rlabels = react_ribbon.get(original_rname)
        if rlabels is None:
            results[tab.get("label", key)] = {"status": "pending-activation", "oo": len(rows), "missing": rows}
            continue
        missing = [l for l in rows if not label_match(l, rlabels)]
        declared = [l for l in missing if f"{rname}|{norm(l)}" in div or norm(l) in div.get(rname, {})]
        undeclared = [l for l in missing if l not in declared]
        results[tab.get("label", key)] = {
            "status": "ok" if not undeclared else "gap",
            "oo": len(rows), "covered": len(rows) - len(undeclared),
            "coverage": round(100 * (len(rows) - len(undeclared)) / len(rows), 1) if rows else 100.0,
            "declared": declared, "missing": undeclared,
        }

    overall_missing = sum(len(v.get("missing", [])) for v in results.values())
    pending = [k for k, v in results.items() if v["status"] == "pending-activation"]
    for name, v in sorted(results.items()):
        if v["status"] == "ok":
            print(f"  {name}: 100% ({v['oo']} labels)")
        elif v["status"] == "pending-activation":
            print(f"  {name}: PENDING ACTIVATION ({v['oo']} labels not captured)")
        else:
            print(f"  {name}: {v['coverage']}% — missing: {', '.join(v['missing'][:6])}")
    print(f"\noverall: {overall_missing} undeclared missing labels, {len(pending)} pending-activation tabs")

    if gate:
        if overall_missing > 0 or pending:
            print("GATE FAIL: coverage incomplete")
            return 1
        print("GATE PASS: 100% non-declared coverage")
    return 0


if __name__ == "__main__":
    sys.exit(main())
