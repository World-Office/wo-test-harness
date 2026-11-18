#!/usr/bin/python3
"""build.py — OO↔react census → hierarchical port-state graph.json.

Reads the committed census artifacts (no node, no playwright, no network):

  census/census/census-oo-deep.json      OO golden (tabs dict, statusBar list)
  census/census/census-react-deep.json   react census (ribbon dict, fileMenu list,
                                         statusbar list)
  census/react-e2e/divergences.json      documented divergences {"Tab": {"norm-label"|"_tab": reason}}
  census/census/ledger.json              feature ledger (cluster/level/kind per feature)
  census/react-e2e/contract-results.json probe results (ids only)
  census/ctx-contracts.json              live-verified context-menu contract (5 contexts)
  census/census/census-oo-dialogs.json   OO dialogs (rig capture, 18 rows)
  census/census/census-wo-dialogs.json   WO dialogs (LEGACY wysiwyg capture, 65)
  census/census/census-shortcuts.json    OO Shortcuts.js vs WO keydown (147, static)

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
CTX_PATH = CENSUS / "ctx-contracts.json"
OO_DLG_PATH = CENSUS / "census" / "census-oo-dialogs.json"
WO_DLG_PATH = CENSUS / "census" / "census-wo-dialogs.json"
SHORTCUTS_PATH = CENSUS / "census" / "census-shortcuts.json"
OUT_PATH = HERE / "graph.json"


def require(path: Path) -> dict:
    if not path.exists():
        sys.exit(f"missing census artifact: {path} — capture it; the graph is derived, never faked")
    return json.loads(path.read_text())

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


# OO's statusbar census captured slot VALUES where react's captured control
# TITLES; these norm-keyed pairs are the same control (see PORT-GRAPH.md).
STATUSBAR_ALIASES = {"wordcount": "words0", "englishunitedstates": "language"}


def build_statusbar(oo: dict, re_: dict) -> dict:
    """OO statusBar vs react statusbar — real label compare (PG-4 capture)."""
    rmap = {norm(i.get("label", "")): i.get("label", "")
            for i in re_.get("statusbar", []) if i.get("label")}
    seen, controls, icon_only = set(), [], 0
    for item in oo.get("statusBar", []):
        label = item.get("label", "")
        if not norm(label):
            icon_only += 1  # layout-segment duplicates counted once per empty row
        elif label not in seen:  # OO DOM repeats segments (Word count ×4) — one node each
            seen.add(label)
            n = STATUSBAR_ALIASES.get(norm(label), norm(label))
            if n in rmap or label_match(label, set(rmap)):
                status, reason = "done", None
                label_out = rmap.get(n, label)
            else:
                status, reason, label_out = "missing", None, label
            controls.append({"label": label_out, "ooLabel": label,
                             "status": status, "reason": reason})
    counts = {"done": sum(1 for c in controls if c["status"] == "done"),
              "diverged": 0, "missing": sum(1 for c in controls if c["status"] == "missing"),
              "iconOnly": icon_only, "total": len(controls) + icon_only}
    return {"id": "statusbar", "label": "Status Bar", "contextual": False,
            "counts": counts, "controls": controls,
            "note": "real compare vs react statusbar census; aliases for OO slot values "
                    "vs react control titles (Word count→Words: N, doc language→Language)"}


# OO dialog title → (WO dialog it is combined into, why) — legacy WO census.
DIALOG_ALIASES = {
    "Margins": ("Page setup", "combined into WO 'Page setup' (fields: Size, Margins)"),
    "Page size": ("Page setup", "combined into WO 'Page setup' (fields: Size, Margins)"),
}
LEGACY_DLG_REASON = ("no counterpart in legacy WO dialog census; "
                     "react dialog census pending (see caveat)")


def build_dialogs(oo_dlgs: list, wo_dlgs: list) -> dict:
    """OO dialogs vs (legacy) WO dialogs — one control per unique OO title."""
    # WO titles mix i18n keys ('Toolbar.Find', 'TableOfFigures.Title') with
    # resolved strings ('Insert symbol'): index every norm variant → original.
    wv: dict[str, str] = {}
    for d in wo_dlgs:
        t = d.get("title", "")
        if not t:
            continue
        cands = [t]
        if t.startswith("Insert "):
            cands.append(t[len("Insert "):])
        if "." in t:
            parts = t.split(".")
            cands += parts + [".".join(parts[:-1])] + ["".join(parts[1:])]
        for c in cands:
            wv.setdefault(norm(c), t)

    seen, controls = set(), []
    for d in oo_dlgs:
        title = (d.get("dialog") or {}).get("title", "")
        if not title or title in seen:  # same dialog from two triggers → one node
            continue
        seen.add(title)
        alias = DIALOG_ALIASES.get(title)
        n = norm(alias[0]) if alias else norm(title)
        hit = wv.get(n) or (n.endswith("s") and wv.get(n[:-1])) or None  # Bookmarks→'Insert bookmark'
        if hit:
            status, label = "done", hit
            reason = alias[1] if alias else None
        else:
            status, label, reason = "diverged", title, LEGACY_DLG_REASON
        controls.append({"label": label, "ooLabel": title,
                         "status": status, "reason": reason})
    counts = {"done": sum(1 for c in controls if c["status"] == "done"),
              "diverged": sum(1 for c in controls if c["status"] == "diverged"),
              "missing": 0, "iconOnly": 0, "total": len(controls)}
    return {"id": "dialogs", "label": "Dialogs",
            "caveat": "WO side = legacy wysiwyg census; react dialog census pending",
            "tabs": [{"id": "dialogs", "label": "Dialogs", "contextual": False,
                      "counts": counts, "controls": controls}]}


def build_ctx(ctx: dict) -> dict:
    """Live-verified context-menu contract → one all-done tab per context."""
    tabs = []
    for name in ("text", "misspelled", "table", "image", "shape"):
        v = ctx.get(name, [])
        rows = v["rows"] if isinstance(v, dict) else v
        controls = [{"label": r, "ooLabel": r, "status": "done", "reason": None}
                    for r in rows]
        counts = {"done": len(controls), "diverged": 0, "missing": 0,
                  "iconOnly": 0, "total": len(controls)}
        tab = {"id": name, "label": name.title(), "contextual": False,
               "counts": counts, "controls": controls}
        if isinstance(v, dict) and v.get("live"):
            tab["live"] = v["live"]
        tabs.append(tab)
    return {"id": "ctx", "label": "Context Menus", "tabs": tabs,
            "note": "verified live via ctx-scenarios — " + ctx.get("_meta", {}).get("source", "")}


def build_shortcuts(sc: dict) -> tuple[dict, dict]:
    """Shortcut census verdicts → statuses; cross-checks against its totals."""
    src = sc.get("source", "")
    rows = sc.get("shortcuts", [])
    controls, counts = [], {"done": 0, "diverged": 0, "missing": 0, "iconOnly": 0}
    for s in rows:
        v = s.get("verdict")
        if v == "matched":
            status, reason = "done", None
        elif v == "nav":
            status, reason = "done", "navigation"
        elif v == "diverged":
            status, reason = "diverged", f"see census-shortcuts source: {src}"
        elif v == "browser-native":
            status, reason = "diverged", "browser-native"
        elif v == "missing":
            status, reason = "missing", None
        else:
            sys.exit(f"unknown shortcut verdict {v!r} in {SHORTCUTS_PATH}")
        label = f"{s.get('combo', '')} {s.get('type', '')}".strip()
        controls.append({"label": label, "ooLabel": label,
                         "status": status, "reason": reason})
        counts[status] += 1
    counts["total"] = len(controls)

    t = sc.get("totals", {})
    expect = {"done": t.get("matched", 0) + t.get("nav", 0),
              "diverged": t.get("diverged", 0) + t.get("browser-native", 0),
              "missing": t.get("missing", 0), "total": t.get("total", 0)}
    got = {k: counts[k] for k in expect}
    if got != expect:
        sys.exit(f"shortcuts cross-check FAIL: graph {got} != source totals {t}")
    surface = {"id": "shortcuts", "label": "Keyboard Shortcuts",
               "tabs": [{"id": "shortcuts", "label": "Keyboard Shortcuts",
                         "contextual": False, "counts": counts,
                         "controls": controls}]}
    return surface, {"graph": got, "source": t}


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
    ctx = require(CTX_PATH)
    oo_dlg = require(OO_DLG_PATH)
    wo_dlg = require(WO_DLG_PATH)
    shortcuts = require(SHORTCUTS_PATH)
    uni = react_label_universe(re_)

    ribbon_tabs = [build_tab(k, t, uni, div)
                   for k, t in oo.get("tabs", {}).items() if k != "file"]
    filemenu_tab = build_tab("file", oo["tabs"].get("file", {"buttons": []}), uni, div)
    filemenu_tab["id"] = "filemenu"
    shortcuts_surface, sc_check = build_shortcuts(shortcuts)

    surfaces = [
        {"id": "ribbon", "label": "Ribbon", "tabs": ribbon_tabs},
        {"id": "filemenu", "label": "File Menu", "tabs": [filemenu_tab]},
        {"id": "statusbar", "label": "Status Bar", "tabs": [build_statusbar(oo, re_)]},
        build_dialogs(oo_dlg.get("dialogs", []), wo_dlg.get("dialogs", [])),
        build_ctx(ctx),
        shortcuts_surface,
        build_ledger(ledger["features"]),
    ]

    totals = {"controls": 0, "done": 0, "diverged": 0, "missing": 0,
              "iconOnly": 0, "surfaces": {}}
    for s in surfaces:
        st = {"controls": 0, "done": 0, "diverged": 0, "missing": 0, "iconOnly": 0}
        for t in s.get("tabs", []):
            for k in ("done", "diverged", "missing", "iconOnly"):
                st[k] += t["counts"][k]
            st["controls"] += len(t["controls"])
        if s.get("tabs"):
            totals["surfaces"][s["id"]] = st
        for k in ("done", "diverged", "missing", "iconOnly"):
            totals[k] += st[k]
        totals["controls"] += st["controls"]
    totals["ledgerFeatures"] = len(ledger["features"])

    graph = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sources": {
            "oo": "census/census/census-oo-deep.json",
            "react": "census/census/census-react-deep.json",
            "divergences": "census/react-e2e/divergences.json",
            "ledger": "census/census/ledger.json",
            "contracts": "census/react-e2e/contract-results.json",
            "ctx": "census/ctx-contracts.json",
            "ooDialogs": "census/census/census-oo-dialogs.json",
            "woDialogs": "census/census/census-wo-dialogs.json",
            "shortcuts": "census/census/census-shortcuts.json",
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
    print(f"shortcuts cross-check OK: {sc_check['graph']} == source totals {sc_check['source']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
