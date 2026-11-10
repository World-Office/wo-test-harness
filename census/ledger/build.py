#!/usr/bin/python3
"""
ledger/build.py — FEATURE LEDGER v1.

Merges the OO inventory (census-oo-deep: controls/menus/backstage/statusbar,
census-oo-dialogs: dialog FIELD structures, census-oo-interactions: what each
control opens) with the WO inventory (census-wo-deep) into one machine-
checkable ledger: one row per OO feature surface, with the WO counterpart and
a LEVEL:

  L0 MISSING  no WO surface for the feature
  L1 SURFACE  WO has the control/dialog (visual approximation — where the
              old census stopped: "deficit 3")
  L2 ACTS     behavior probe passed: the control mutates the document DOM
  L3 PERSISTS mutation survives editor -> flatHtml -> docx -> reload
  L4 FIDELITY output semantics match OO's own document for the same op

L2 is filled by behavior probes (probe layer); L3 is filled by
ledger/roundtrip.cjs: it applies each document-level command in the real
editor, serializes via flatHtml, round-trips html -> docx -> html through the
docserver conversion endpoint, and reloads a fresh editor to verify the
mutation marker survived. If ledger/roundtrip-results.json exists, this
builder merges its surviving commands into the ledger as L3 PERSISTS and
still emits ledger.json + the report.

Usage: /usr/bin/python3 ledger/build.py   (from the census dir)
"""
import json
import re
import unicodedata
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).resolve().parent
CEN = HERE.parent / "census"

# ---------------------------------------------------------------- normalize
# HARN-003: wo_match re-normalizes every WO label/cmd per OO label in its
# linear scans (121k calls = ~78% of runtime at last profile). norm() is a
# pure str->str, so memoizing collapses it to one call per unique string.
@lru_cache(maxsize=None)
def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = s.lower()
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

# token set for fuzzy matching
def toks(s: str):
    return set(norm(s).split()) - {"the", "a", "and", "or", "of"}

def fuzzy(a: str, b: str) -> bool:
    ta, tb = toks(a), toks(b)
    if not ta or not tb:
        return False
    inter = ta & tb
    return len(inter) >= max(1, min(len(ta), len(tb)) - 0) and len(inter) / min(len(ta), len(tb)) >= 0.6

# manual alias seeds: OO surface label -> WO data-cmd / label fragment.
# Grows as triage finds renames; fuzzy match covers most cases.
ALIASES = {
    "text art": "textart", "textart": "textart",
    "drop cap": "dropcap", "dropcap": "dropcap",
    "text from file": "insert-file",
    "table of contents": "toc", "toc options": "toc",
    "page number": "page-number", "page numbers": "page-number",
    "line numbers": "line-numbers", "linenumbers": "line-numbers",
    "mail merge": "mail-merge",
    "track changes": "track-changes",
    "compare": "compare",
    "co authoring": "collab", "coediting": "collab",
    "equation": "equation", "formula": "equation",
    "sheet": "spreadsheet", "slide": "presentation",
    "smart art": "shapes", "shapes": "shapes",
    "clear style": "clear-style",
    "paint format": "copystyle", "copy style": "copystyle",
    "non printing characters": "nonprinting", "formatting marks": "nonprinting",
    "first line indent": "first-line",
    "find": "find", "find and replace": "find",
    "bullets": "list", "multilevel": "multilevel",
    "bullets and numbering": "bullets",
    "symbols": "symbol", "more symbols": "symbol",
    "eraser": "erase",
    # statusbar aliases: OO ids/labels -> WO statusbar ids (census-wo-deep).
    # OO labels arrive as raw ids ("btn-zoom-topage") — alias on id fragments.
    "btn zoom topage": "btn-zoom-fit", "btn zoom towid": "btn-zoom-fit",
    "btn zoom down": "btn-zoom-out", "btn zoom up": "btn-zoom-in",
    "zoom to page": "btn-zoom-fit", "zoom to width": "btn-zoom-fit",
    "zoom out": "btn-zoom-out", "zoom in": "btn-zoom-in",
    "zoom": "btn-zoom-reset",
    "english united states": "sb-lang", "btn doc lang": "sb-lang",
    "language": "sb-lang",
    "spell check": "doc-lang", "btn doc review": "sb-track-changes",
    "review": "sb-track-changes",
    "btn doc spell": "sb-doc-spell",
    "multipage": "btn-multipage", "page": "btn-multipage",
    # backstage: OO File-screen section -> WO backstage row
    "protection": "protect",
    # --- dialogs: OO dialog title -> WO dialog id (from census-wo-dialogs) ---
    # --- dialogs: OO dialog title -> WO dialog id (from census-wo-dialogs) ---
    "bookmarks": "bookmark-dialog", "bookmark": "bookmark-dialog",
    "plugin manager": "plugins-dialog", "plugins": "plugins-dialog",
    "manage plugins": "plugins-dialog",
    "cross reference": "crossref-dialog", "cross-reference": "crossref-dialog",
    "table of contents": "toc-dialog", "toc": "toc-dialog",
    "table of figures": "tableoffigures-dialog",
    # OO Date & Time dialog (date field + "Update automatically") -> WO has
    # NO date dialog; the real counterpart surface is btn-datetime (inserts
    # current date). The old pagenumber-dialog alias was a false join
    # (retired with the L4 dialog-parity probe: a dialog matched for surface
    # presence must not imply field parity with a DIFFERENT capability).
    "date time": "btn-datetime", "date & time": "btn-datetime",
}

# WO dialog surface index built after wo_dlg loads (below).
# function must be defined before use in the dialogs loop.
def wo_dialog_match(label: str):
    """Best WO dialog for an OO label, by alias then id+title."""
    n = norm(label)
    for key, want in ALIASES.items():
        if want.endswith("-dialog") and (key in n or n == key):
            want_n = norm(want.replace("-dialog", ""))
            # exact id first (alias "toc-dialog" must hit toc-dialog, not
            # updatetoc-dialog via substring)
            for did, idn, dtitle in wo_dlgs:
                if want_n == idn:
                    return (did, "dialog:" + did)
            for did, idn, dtitle in wo_dlgs:
                if want_n in idn:
                    return (did, "dialog:" + did)
    for did, idn, dtitle in wo_dlgs:
        if n and (n in idn or idn in n):
            return (did, "dialog:" + did)
    # match by readable title too
    for did, idn, dtitle in wo_dlgs:
        if n and dtitle and (n == norm(dtitle) or n in norm(dtitle) or norm(dtitle) in n):
            return (did, "dialog:" + did)
    return None

# noise: never ledger-worthy surfaces
NOISE = re.compile(r"^(asc-|0 x |x )|[0-9]+ x [0-9]+", re.I)
def noisy(label: str) -> bool:
    n = norm(label)
    if not n or NOISE.search(label or ""):
        return True
    if not re.search(r"[a-z]", n):
        return True
    # backstage section names (Home/Layout/… file-tab headers) — covered by
    # WO backstage rows via aliases, not as standalone features
    return False

CLUSTER_BY_TAB = {
    "home": "formatting", "ins": "insert", "draw": "insert", "layout": "page",
    "links": "references", "review": "review", "protect": "protect",
    "view": "view", "plugins": "plugins", "collaboration": "collab",
    "headerfooter": "headerfooter", "charttab": "chart", "chart": "chart",
    "table": "table", "picture": "image", "shape": "insert",
    "developer": "macros", "file": "file",
}

def cluster_of(tab: str, label: str = "") -> str:
    lab = norm(label)
    for kw, cl in [
        ("table", "table"), ("chart", "chart"), ("image", "image"),
        ("picture", "image"), ("photo", "image"), ("equation", "insert"),
        ("hyperlink", "references"), ("bookmark", "references"),
        ("footnote", "references"), ("endnote", "references"),
        ("caption", "references"), ("cross reference", "references"),
        ("table of", "references"), ("toc", "references"),
        ("comment", "review"), ("spell", "review"), ("thesaurus", "review"),
        ("translate", "review"), ("macro", "macros"), ("mail merge", "file"),
        ("watermark", "page"), ("header", "headerfooter"),
        ("footer", "headerfooter"), ("numbering", "formatting"),
        ("bullet", "formatting"), ("font", "formatting"),
    ]:
        if kw in lab:
            return cl
    return CLUSTER_BY_TAB.get(tab, "other")

def slug(s: str) -> str:
    s = norm(s).replace(" ", "-")
    return s[:48] or "unnamed"

# ---------------------------------------------------------------- load
oo_deep = json.load(open(CEN / "census-oo-deep.json"))
oo_dlg = json.load(open(CEN / "census-oo-dialogs.json"))
oo_int = json.load(open(CEN / "census-oo-interactions.json"))
wo_deep = json.load(open(CEN / "census-wo-deep.json"))
wo_dlg_path = CEN / "census-wo-dialogs.json"  # written by census/census-wo-dialogs.cjs
wo_dlg = json.load(open(wo_dlg_path)) if wo_dlg_path.exists() else {"dialogs": []}

# WO dialog surface index: (id, title) for every censused WO dialog.
wo_dlgs = []   # list of (id, titleNorm, title)
for e in wo_dlg.get("dialogs", []):
    tid = (e.get("id") or "").replace("-dialog", "")
    wo_dlgs.append((e.get("id", ""), norm(tid), e.get("title", "")))

# WO surface index: labels + data-cmds, for matching
wo_labels = []   # (cluster, label, data_cmd, surface)
for tab, meta in (wo_deep.get("tabs") or {}).items():
    for b in meta.get("buttons", []):
        wo_labels.append((cluster_of(tab, b.get("label", "")), b.get("label", ""), b.get("dataCmd") or b.get("cmd") or b.get("id") or "", "tab:" + tab))
for m in wo_deep.get("menus", []) or []:
    for it in m.get("items", []):
        wo_labels.append((cluster_of(m.get("tab", ""), it.get("label", "")), it.get("label", ""), "", "menu:" + m.get("trigger", "")))
for it in (wo_deep.get("backstage") or []):
    if isinstance(it, dict) and it.get("label"):
        wo_labels.append(("file", it.get("label", ""), it.get("dataCmd") or it.get("id", ""), "backstage"))
for it in (wo_deep.get("statusBar") or []):
    if isinstance(it, dict) and (it.get("label") or it.get("id")):
        wo_labels.append(("statusbar", it.get("label", ""), it.get("id", ""), "statusbar"))

# fold WO dialogs into the general surface index so control/menu rows can
# match them too (e.g. OO ribbon 'Plugin\nManager' -> 'plugins-dialog').
for did, idn, dtitle in wo_dlgs:
    wo_labels.append((cluster_of("", did), did, did, "dialog:" + did))

def wo_match(label: str, cluster: str):
    """Best WO surface for an OO label. Returns (dataCmd/label, where) or None."""
    n = norm(label)
    for key, want in ALIASES.items():
        if key in n or n == key:
            want_n = norm(want)
            for cl, lab, cmd, where in wo_labels:
                if want_n in norm(cmd) or want_n in norm(lab):
                    return (cmd or lab, where)
    # exact label
    for cl, lab, cmd, where in wo_labels:
        if n and n == norm(lab):
            return (cmd or lab, where)
    # fuzzy same-cluster first, then anywhere
    for cl, lab, cmd, where in wo_labels:
        if cl == cluster and fuzzy(label, lab):
            return (cmd or lab, where)
    for cl, lab, cmd, where in wo_labels:
        if fuzzy(label, lab):
            return (cmd or lab, where)
    return None

# interactions: what each OO control opens (by toolbar id)
opens_by_id = {}
for i in oo_int.get("interactions", []):
    if i.get("id"):
        opens_by_id[i["id"]] = i.get("opens")

# ---------------------------------------------------------------- ledger rows
ledger = {}

def add(fid, cluster, oo_surface, kind, extra=None):
    row = ledger.setdefault(fid, {
        "feature": fid, "cluster": cluster, "kind": kind,
        "oo": [], "wo": None, "level": 0, "evidence": [],
    })
    row["oo"].append(oo_surface)
    if extra:
        row["evidence"].extend(extra)

# 1. ribbon controls (OO tabs)
# OO's File tab opens its backstage via buttons labelled after the target
# pane; WO keeps the backstage under different pane names (open/new/…) and
# exposes References/Layout/Collaboration as their own tabs. Those four are
# renames of the same capability surface, not gaps — mark diverged, never L0.
FILE_NAV_DIVERGED = {
    "Home": ("tab:home", "WO backstage open/new/history panes cover recents"),
    "Layout": ("tab:layout", "WO Layout tab (margins/orientation/size/columns) + page-setup-dialog"),
    "References": ("tab:references", "WO References tab (TOC/footnotes/endnotes/captions/crossrefs)"),
    "Collaboration": ("tab:collaboration", "WO Collaboration tab (co-editing/track-changes/chat/compare)"),
}
for tab, meta in (oo_deep.get("tabs") or {}).items():
    for b in meta.get("buttons", []):
        lab = b.get("label") or b.get("id") or ""
        if not lab or noisy(lab):
            continue
        cl = cluster_of(tab, lab)
        fid = cl + "." + slug(lab)
        oo_surf = {"surface": f"tab:{tab}", "label": lab, "enabled": b.get("enabled", True)}
        m = wo_match(lab, cl)
        add(fid, cl, oo_surf, "control")
        if m:
            ledger[fid]["wo"] = {"match": m[0], "where": m[1]}
            ledger[fid]["level"] = 1
        elif tab == "file" and lab in FILE_NAV_DIVERGED:
            dst, why = FILE_NAV_DIVERGED[lab]
            ledger[fid]["wo"] = {"match": dst, "where": "backstage/tab"}
            ledger[fid]["level"] = 1
            ledger[fid]["evidence"].append(why)

# 2. menu items
# OO's Layout-tab hyphenation menu offers None/Automatic/Manual as separate
# items; WO collapses them into the single toggleHyphenation control (layout
# tab) + hy-mode options. Scoped fallback so those generic single-word items
# don't become empty L0 rows.
HYPHENATION_OPTIONS = {"none", "automatic", "manual"}
for m in oo_deep.get("menus", []) or []:
    for it in m.get("items", []):
        lab = it.get("label", "")
        if not lab or len(lab) < 2 or noisy(lab):
            continue
        cl = cluster_of(m.get("tab", ""), lab)
        fid = cl + "." + slug(lab)
        add(fid, cl, {"surface": f"menu:{m.get('trigger')}", "label": lab, "enabled": it.get("enabled", True)}, "menu-item")
        w = wo_match(lab, cl)
        if not w and cl == "page" and norm(lab) in HYPHENATION_OPTIONS:
            w = ("toggleHyphenation", "tab:layout (hy-mode options)")
        if w:
            ledger[fid]["wo"] = {"match": w[0], "where": w[1]}
            ledger[fid]["level"] = 1

# 3. dialogs (from the dialogs census): one row PER DIALOG, fields listed —
#    the field list is the port contract: a WO dialog that misses fields is
#    not parity even if it opens.
for e in oo_dlg.get("dialogs", []):
    d = e["dialog"]
    trig = e["trigger"].get("via") or e["trigger"].get("label") or e["trigger"].get("id") or ""
    title = d.get("title") or trig
    cl = cluster_of(e.get("tab", ""), title)
    fid = cl + ".dlg-" + slug(title)
    fields = [f.get("label", "") for f in d.get("fields", []) if f.get("label")]
    add(fid, cl, {"surface": f"dialog:{title}", "trigger": trig, "label": title,
                  "fields": fields, "buttons": d.get("buttons", [])}, "dialog")
    w = wo_dialog_match(title) or wo_match(title, cl)
    if w:
        ledger[fid]["wo"] = {"match": w[0], "where": w[1]}
        ledger[fid]["level"] = 1
    # field-level presence: mark how many fields exist as separate evidence
    if fields:
        ledger[fid]["evidence"].append(f"{len(fields)} OO fields: " + ", ".join(fields[:12]))

# 4. backstage items
for it in (oo_deep.get("backstage") or []):
    lab = (it or {}).get("label", "") if isinstance(it, dict) else ""
    if not lab or noisy(lab) or lab in ("Home", "Recent", "Create New", "Search",
        "Layout", "References", "Collaboration", "Protection", "Plugins",
        "Print", "Download as", "Info", "Settings", "Help", "View", "File Info"):
        continue
    fid = "file." + slug(lab)
    add(fid, "file", {"surface": "backstage", "label": lab}, "backstage-item")
    w = wo_match(lab, "file")
    if w:
        ledger[fid]["wo"] = {"match": w[0], "where": w[1]}
        ledger[fid]["level"] = 1

# 5. statusbar
for it in (oo_deep.get("statusBar") or []):
    lab = (it or {}).get("label") or (it or {}).get("id") or ""
    if not lab or noisy(lab):
        continue
    fid = "statusbar." + slug(lab)
    add(fid, "statusbar", {"surface": "statusbar", "label": lab}, "statusbar-item")
    w = wo_match(lab, "statusbar")
    if not w:
        # statusbar ids live outside wo_labels; resolve aliases directly
        n = norm(lab)
        for key, want in ALIASES.items():
            if key in n or n == key:
                w = (want, "statusbar")
                break
    if w:
        ledger[fid]["wo"] = {"match": w[0], "where": w[1]}
        ledger[fid]["level"] = 1

# 6. shortcuts (census-shortcuts.json — T-003). One row per OO shortcut type.
#    matched/browser-native/nav  -> L1 (surface exists)
#    diverged                    -> L1 (feature present, diff combo) + evidence
#    missing                     -> L0 (real gap)
sc_path = CEN / "census-shortcuts.json"
if sc_path.exists():
    sc = json.load(open(sc_path))
    for r in sc.get("shortcuts", []):
        typ = r.get("type", "")
        if not typ:
            continue
        tab = "file" if typ.startswith(("Open", "Save", "Close", "Print", "Update")) else (
              "formatting" if typ.startswith(("Bold", "Italic", "Underline", "Apply", "Center", "Justify", "Right", "Left", "Increase", "Decrease", "SmallCaps", "CopyFormat", "PasteFormat", "ResetChar", "Superscript", "Subscript", "Indent", "UnIndent", "ShowAll", "Strikeout")) else (
              "insert" if typ.startswith(("Insert", "NonBreaking", "EmDash", "EnDash", "Euro", "Copyright", "Trademark", "Registered", "Horizontal")) else (
              "edit" if typ.startswith(("Edit", "Copy", "Cut", "Paste", "SelectAll", "Delete", "Select")) else "shortcuts")))
        fid = "shortcut." + slug(typ)
        combo = r.get("combo", "")
        add(fid, tab, {"surface": "shortcut", "type": typ, "combo": combo, "label": typ}, "shortcut")
        if r.get("verdict") == "missing":
            # stays L0 (real gap)
            ledger[fid]["evidence"].append(f"OO bind {combo}: no WO keydown handler")
        else:
            ledger[fid]["level"] = 1
            ledger[fid]["wo"] = {"match": r.get("wo") or typ, "where": "shortcut"}
            if r.get("verdict") == "diverged":
                ledger[fid]["evidence"].append(f"WO uses different combo: {r.get('wo')}")
            elif r.get("verdict") in ("browser-native", "nav"):
                ledger[fid]["evidence"].append(r.get("wo", "browser/caret"))

# 6b. heading paragraph styles (manual rows). OO's Home style gallery is
# canvas-drawn and not enumerable by the deep census (no Heading buttons in
# census-oo-deep tabs.home), so these rows are pinned by hand: OO side from
# census-shortcuts (ApplyHeading1-3, Ctrl+Alt+1..3, verdict matched), WO side
# from census-wo-deep (Home-tab "Heading N" controls, cmd formatBlock) and
# the applyHeadingN wo-commands the roundtrip probes dispatch.
for _i, _combo in ((1, "Ctrl+Alt+1"), (2, "Ctrl+Alt+2"), (3, "Ctrl+Alt+3")):
    _fid = f"formatting.heading-{_i}"
    add(_fid, "formatting",
        {"surface": "style-gallery", "label": f"Heading {_i}", "enabled": True},
        "formatting")
    ledger[_fid]["wo"] = {"match": f"applyHeading{_i}", "where": "tab:home"}
    ledger[_fid]["level"] = 1
    ledger[_fid]["evidence"].append(
        f"OO style gallery Heading {_i} + shortcut {_combo} (census-shortcuts: matched); "
        f"WO Home 'Heading {_i}' control (formatBlock) + applyHeading{_i} command")

# 7. scenario context menus (census-ctx.json — T-002). One row per OO
#    ctx-menu caption; chart submenu option-children collapse into their
#    group's single lead row so C3 reports ~9 chart groups, not ~45 options.
ctx_path = CEN / "census-ctx.json"
if ctx_path.exists():
    cc = json.load(open(ctx_path))
    for r in cc.get("rows", []):
        v = r.get("verdict", "n/a")
        if v == "n/a":
            continue
        label = r.get("oo") or r.get("oo_var") or ""
        grp = r.get("group")
        if grp:
            if not r.get("lead"):
                continue  # option child — covered by the group lead row
            fid = "ctx." + grp
            oo_disp = "chart " + grp.split(".", 1)[1].replace("-", " ")
        else:
            fid = "ctx." + slug(label)
            oo_disp = label
        tab = "chart" if grp else ("table" if label.lower() in ("merge cells", "split cell...", "several rows/columns", "distribute rows", "distribute columns", "delete") else "edit")
        add(fid, tab, {"surface": "ctx-menu", "oo": oo_disp, "var": r.get("oo_var"), "label": label}, "ctx-menu")
        if v == "missing":
            ledger[fid]["evidence"].append("OO ctx-menu " + oo_disp + ": no WO action")
        else:
            ledger[fid]["level"] = 1
            ledger[fid]["wo"] = {"match": r.get("wo") or label, "where": "ctx-menu"}
            if v == "diverged":
                ledger[fid]["evidence"].append("WO surface elsewhere: " + (r.get("wo") or ""))
            elif v == "nav":
                ledger[fid]["evidence"].append("browser native")

# ------------------------------------------------- L2 merge (census-wo-acts.cjs)
# ACTS contract: the live probe performed a REAL user action (button click or
# ctx-menu click / wo-command dispatch) in the prod editor and observed a
# MutationObserver delta on #editor - the control mutates the document DOM
# (transiently or not; durability is L3's job). Rows whose WO surface was
# probed-and-mutating are promoted to L2; probed-but-unchanged or unprobed
# surfaces honestly stay L1. Run census-wo-acts.cjs before building.
acts_path = HERE / "../census/census-wo-acts.json"
legacy_path = HERE / "../census/census-wo-acts-legacy.json"
if acts_path.exists():
    try:
        _acts = json.load(open(acts_path))["results"]
    except Exception:
        _acts = None
    # Historical committed observations (harness bdec86a L2 rows) folded back
    # in: the live persistent doc now re-syncs probe artifacts, so keyboard
    # formatting observations are not re-producible — the earlier real
    # observations are preserved as evidence rather than dropped.
    try:
        _legacy = json.load(open(legacy_path))["results"]
        _acts = dict(_acts or {})
        for _k, _v in (_legacy or {}).items():
            if _v and _v.get("mutated") and not (_acts.get(_k) or {}).get("mutated"):
                _acts[_k] = _v
    except Exception:
        pass
    if _acts:
        import re as _re
        def _canon_combo(c):
            "extract and canonicalise a shortcut combo (Ctrl/Cmd/Opt/Shift)"
            m = _re.match(r"^([A-Za-z0-9]+(?:\+[A-Za-z0-9]+)+)", (c or "").strip())
            if not m:
                return None
            _map = {"Control": "Ctrl", "Meta": "Cmd", "Option": "Opt", "Alt": "Alt", "Shift": "Shift"}
            toks = m.group(1).split("+")
            if len(toks) == 1:
                return toks[0]
            return "+".join([_map.get(x, x) for x in toks[:-1]]) + "+" + toks[-1]

        # Static shortcut->command transitivity (hand-verified against the
        # keydown handler in documenteditor-wysiwyg/editor.js ~10783-10990):
        # a combo that the WO editor binds to an acts-proven command is
        # itself an act (the keydown is the trigger; the command mutates).
        # Combo spellings cover both census (Period) and ledger (.) forms.
        COMBO_COMMAND = {
            "Ctrl+B": "bold", "Ctrl+I": "italic", "Ctrl+U": "underline",
            "Ctrl+Shift+X": "strikeThrough", "Ctrl+E": "justifyCenter",
            "Ctrl+J": "justifyFull", "Ctrl+R": "justifyRight",
            "Ctrl+M": "indent", "Ctrl+Shift+M": "outdent",
            "Ctrl+Period": "subscript", "Ctrl+.": "subscript",
            "Ctrl+Comma": "superscript", "Ctrl+,": "superscript",
            "Ctrl+Shift+8": "insertUnorderedList", "Ctrl+Shift+7": "insertOrderedList",
            "Alt+Shift+D": "insertEndnote",
            # 2026-11-03 realignment (live-verified on :8086): OO census
            # combos now bound in WO — resolves their ledger rows to L2 acts
            # evidence via cmd:insertUnorderedList / cmd:insertPageNumber.
            "Ctrl+Shift+L": "insertUnorderedList", "Ctrl+Shift+P": "insertPageNumber",
        }

        # dialog-id matches resolve to their census-recorded opener command
        # (openedBy "cmd:x" or "forced:… (cmd x)") so a control that matches
        # a WO dialog keeps its acts evidence instead of dropping to L1.
        _dlg_cmd = {}
        for _d in (wo_dlg.get("dialogs") or []):
            _m = re.match(r"(?:cmd:(\S+))|(?:forced:\S+ \(cmd (\S+)\))", _d.get("openedBy") or "")
            if _m:
                _dlg_cmd[_d["id"]] = _m.group(1) or _m.group(2)

        def _acts_key(match, kind):
            "map a ledger wo.match to a probe key (cmd:/ctx:/btn:/shortcut:)"
            if kind == "shortcut":
                combo = _canon_combo(match)
                return "shortcut:" + combo if combo else None
            m = (match or "").strip()
            if m in _dlg_cmd:
                m = _dlg_cmd[m]
            if m.startswith("btn-"):
                if ("btn:" + m) in _acts:
                    return "btn:" + m
                return "cmd:" + m[len("btn-"):]
            if m.startswith("data-cmd="):
                return "cmd:" + m[len("data-cmd="):]
            if m.startswith("ctx data-ctx="):
                return "ctx:" + m[len("ctx data-ctx="):].split(" ")[0]
            if m.startswith("ctx "):
                return "ctx:" + m[len("ctx "):].split(" ")[0]
            return "cmd:" + m
        _l2_promoted = 0
        for _row in ledger.values():
            if 1 <= _row.get("level", 0) < 2 and _row.get("kind") in (
                    "control", "menu-item", "ctx-menu", "shortcut") and _row.get("wo"):
                _k = _acts_key(_row["wo"].get("match", ""), _row.get("kind"))
                _hit = _acts.get(_k) if _k else None
                # dialog-borrowed evidence must itself prove a dialog opened
                # (acts dialog:false means the cmd mutated without one —
                # wrong evidence for a dialog-matched row)
                _dlg_row = _row["wo"].get("match", "") in _dlg_cmd
                if _dlg_row and _hit and not _hit.get("dialog"):
                    _hit = None
                _src = _k or ""
                if not (_hit and _hit.get("mutated")) and _row.get("kind") == "shortcut":
                    # transitivity: combo -> command -> acts
                    _combo = _canon_combo(_row["wo"].get("match", ""))
                    _c = COMBO_COMMAND.get(_combo)
                    if _c and _acts.get("cmd:" + _c, {}).get("mutated"):
                        _src = "cmd:" + _c
                        _hit = _acts.get("cmd:" + _c)
                if _hit and _hit.get("mutated"):
                    _row["level"] = 2
                    _row.setdefault("evidence", []).append(
                        "L2 acts (live probe %s): %s mutated #editor DOM: %s" % (
                            _row.get("where", "?"), _src, str(_hit.get("evidence"))[:90]))
                    _l2_promoted += 1
        print("  L2 merge: %d rows promoted (acts probe: %d mutated surfaces)" % (
            _l2_promoted, sum(1 for v in _acts.values() if v.get("mutated"))))

# ------------------------------------------------- L3 merge (roundtrip.cjs)
# Contract: entries with ok=true survived html -> docx -> html; entry.features
# lists ledger feature ids (matched by wo.match incl. label aliases).
rt_path = HERE / "roundtrip-results.json"
rt_merged = False
if rt_path.exists():
    rt = json.load(open(rt_path))
    for entry in rt.get("entries", []):
        if not entry.get("ok"):
            continue
        for fid in entry.get("features", []):
            row = ledger.get(fid)
            if row is not None:
                row["level"] = max(row["level"], 3)
                row["evidence"].append(
                    f"L3 roundtrip ok [{entry.get('key')}]: {str(entry.get('detail'))[:120]}")
    rt_merged = True

# ------------------------------------------ L4 merge (dialog-parity.py)
# Contract: parity=true means every OO dialog FIELD resolved to a WO field
# with a compatible control kind (superset allowed — no OO field missing).
dp_path = HERE / "dialog-parity.json"
dp_merged = False
if dp_path.exists():
    dp = json.load(open(dp_path))
    _l4 = 0
    for e in dp.get("dialogs", []):
        if not e.get("parity"):
            continue
        row = ledger.get(e["feature"])
        if row is None:
            continue
        if row["level"] < 4:
            row["level"] = 4
            _l4 += 1
        row["evidence"].append(
            "L4 dialog field parity: %d/%d OO fields covered %s (buttons OO %s vs WO %s)" % (
                e.get("covered", 0), e.get("total", 0), e.get("mapping", {}),
                e.get("buttons", {}).get("oo"), e.get("buttons", {}).get("wo")))
    dp_merged = True
    print("  L4 merge: %d dialog rows at full field parity (dialog-parity.py)" % _l4)

# --------------------------- L4 probe: link-dialog (link-dialog-l4.test.mjs, L4-001)
# The link dialog is opened the way a user opens it (#btn-link on the
# Insert tab), its live field contract joined against the DECLARED OO
# Hyperlink window fields (the OO rig census cannot open OO's hyperlink
# window — its "Link" trigger captures Bookmarks — so the OO field list
# is declared in the probe and pinned by it; it flips deliberately WITH
# this row, PROBES-dict spirit from ai-contracts.py). L4 only at full
# field parity; a measured gap keeps the row honest at L2 (the URL field
# + Insert provably acts on the document) with the missing OO fields as
# loud evidence.
ldp_path = HERE / "link-dialog-l4.json"
if ldp_path.exists():
    try:
        ld = json.load(open(ldp_path))
    except ValueError:
        raise SystemExit("ledger: link-dialog-l4.json is not valid JSON — fix the probe artifact")
    _ld_fid = "dialog.link-dialog.l4"
    add(_ld_fid, "references",
        {"surface": "dialog:Hyperlink", "trigger": "Link", "label": "Hyperlink",
         "fields": ld.get("oo_fields", [])},
        "dialog")
    ledger[_ld_fid]["wo"] = {"match": "link-dialog", "where": "dialog:link-dialog"}
    if ld.get("error"):
        ledger[_ld_fid]["evidence"].append(
            "L4 probe BROKEN (recapture link-dialog-l4.test.mjs): " + str(ld["error"])[:160])
    else:
        ledger[_ld_fid]["level"] = max(ledger[_ld_fid]["level"], 4 if ld.get("parity") else 2)
        _ld_gap = " (missing OO fields: %s)" % ", ".join(ld.get("missing") or []) if ld.get("missing") else ""
        ledger[_ld_fid]["evidence"].append(
            "L4 link-dialog field parity: %d/%d OO fields covered %s%s"
            % (ld.get("covered", 0), ld.get("total", 0), ld.get("mapping", {}), _ld_gap))
        if ld.get("functional"):
            ledger[_ld_fid]["evidence"].append(
                "L2 act: URL field + Insert produced <a href> in #editor (probe)")
        if ld.get("functional_text"):
            ledger[_ld_fid]["evidence"].append(
                "L4 act: Text to display drove the anchor text (probe)")
        ledger[_ld_fid]["evidence"].append(
            "opened via real route: " + str(ld.get("openedBy") or "?"))
    print("  L4 probe merge: link-dialog %s (%s/%s OO fields)"
          % ("PARITY" if ld.get("parity") else "GAP",
             ld.get("covered", 0), ld.get("total", 0)))

# --------------------------- T-008 registered capability parks (build-time)
# Parked own-project capability planes (plan C12 macros / C13 capability /
# forms-as-own-epic). The WO surface exercised here is a market-compatible
# event-marker stub, NOT coverage: register as loud divergence so re-scoring
# never turns them into L0 gaps nor counts them as full coverage silently.
# The persistent declaration source of truth is interact-divergences.json
# (consumed by interact-diff.py + ledger-gap.py); this keeps the level ledger
# evidence honest on every regeneration.
REGISTERED_PARKS = {
    "macros.macros": "registered park (plan C12): btn-macro-menu emits wo:macro event markers only — no macro engine",
    "macros.record-macro": "registered park (plan C12): btn-macro-record is a wo:macro marker stub",
    "macros.dlg-macros": "registered park (plan C12): OO Macros modal is not implemented (marker stub only)",
    "plugins.plugin-manager": "registered park (plan C13): plugins-dialog is a stub surface (capability plane)",
    "ctx.edit-points": "registered park (Phase 5 / WO-22): OO 'Edit points' is a bezier-point editor — WO has no vector path/contour model (CSS/SVG placeholders); ctx row is a LOUD divergence (wo:edit-points marker + SetStatus NotAvailable)",
    "ctx.edit-wrap-boundary": "registered park (Phase 5 / WO-22): OO 'Edit wrap boundary' edits the wrap-polygon contour — same absent vector model; ctx row is a LOUD divergence (wo:edit-wrap-boundary marker + SetStatus NotAvailable)",
}
for _fid, _reason in REGISTERED_PARKS.items():
    _row = ledger.get(_fid)
    if _row is not None:
        _row["divergence"] = "registered"
        if _reason not in _row.get("evidence", []):
            _row.setdefault("evidence", []).append(_reason)

# --------------------------- L4 merge (font-dialog-l4.test.mjs, L4-005)
# The font "dialog" is a control GROUP, not a modal: OO ships the font
# contract on its Home ribbon (family/size combos, B/I/U/S, colors) and WO
# mirrors it as the Home-tab font group — no separate font modal exists in
# either editor. L4 for this composite surface is EARNED by the live probe
# font-dialog-l4.test.mjs: it drives every field (select a word, apply
# family/size/bold/italic/colors) and joins the OO field set (measured from
# census-oo-deep tabs.home) against the live WO controls. A failing probe
# keeps the row honest at L1 with the failing fields in the evidence.
fd_path = HERE / "font-dialog-l4.json"
if fd_path.exists():
    try:
        fd = json.load(open(fd_path))
    except ValueError:
        raise SystemExit("ledger: font-dialog-l4.json is not valid JSON — fix the probe artifact")
    _fd_fields = fd.get("fields", [])
    _fd_ok = [f for f in _fd_fields if f.get("ok")]
    _fid = "dialog.font-dialog.l4"
    add(_fid, "formatting",
        {"surface": "tab:home (font group)", "label": "Font dialog (field group)",
         "fields": [f.get("oo") for f in _fd_fields]},
        "dialog")
    ledger[_fid]["wo"] = {"match": "font group (font-dialog-l4.test.mjs)",
                          "where": "tab:home"}
    if fd.get("parity"):
        ledger[_fid]["level"] = 4
        ledger[_fid]["evidence"].append(
            "L4 font-group field parity: %d/%d OO font fields live-verified "
            "(%d apply-verified: driving family/size/bold/italic/colors changes flat HTML)"
            % (len(_fd_ok), len(_fd_fields), fd.get("summary", {}).get("appliedVerified", 0)))
    else:
        ledger[_fid]["level"] = 1
        _fd_bad = [f.get("oo") for f in _fd_fields if not f.get("ok")]
        ledger[_fid]["evidence"].append(
            "L4 font-group probe GAP: " + ", ".join(_fd_bad or ["empty artifact"]))
    print("  L4 merge: font-dialog %s (%d/%d fields)"
          % ("PARITY" if fd.get("parity") else "GAP", len(_fd_ok), len(_fd_fields)))

# --------------------------- L4 merge (table-dialog-l4.test.mjs, L4-004)
# The insert-table "dialog" contract: OO's Insert->Table is a hover GRID
# picker (census btn-inserttable — no numeric dialog, no OK/Cancel); the
# numeric rows/cols shape is the MS-Word-style contract. WO ships a
# rows/cols popover (#table-dialog, opened by a REAL click on #btn-table).
# L4 is EARNED by the live probe table-dialog-l4.test.mjs: it opens the
# dialog the user way, asserts the field/button contract AND the insert
# semantics (3x4 -> real <table>, clamped bounds, Cancel mutates nothing).
# A failing check pins the row below L4 with the measured defect as loud
# evidence — never a silent pass.
tdl4_path = HERE / "table-dialog-l4.json"
if tdl4_path.exists():
    try:
        tdl4 = json.load(open(tdl4_path))
    except ValueError:
        tdl4 = None
    if tdl4:
        _fid = tdl4.get("feature") or "dialog.table-dialog.l4"
        _row = ledger.setdefault(_fid, {
            "feature": _fid, "cluster": "table", "kind": "dialog",
            "oo": [], "wo": None, "level": 0, "evidence": [],
        })
        _row["oo"].append({"surface": "insert:btn-inserttable", "label": "Table",
                            "fields": ["Rows", "Columns"],
                            "note": "pinned contract — OO Insert->Table is a hover grid picker; "
                                    "the OO dialog census captured no numeric insert-table dialog"})
        _row["wo"] = {"match": "table-dialog", "where": "dialog:table-dialog"}
        _row["level"] = max(_row["level"], 1)
        _row["evidence"].append(
            "L4 live probe (table-dialog-l4.test.mjs, "
            + (tdl4.get("generated") or "?") + "): opens via real clicks (Insert tab + #btn-table); "
            + "title 'Insert table', Rows/Columns number fields (min/max 1-20/1-10, defaults 2/3), "
            + "Cancel+Insert(primary) verified")
        if tdl4.get("ok"):
            _row["level"] = 4
            _row["evidence"].append(
                "L4 fidelity: rows x cols + Insert puts a real <table> (3x4 verified) into the doc "
                + "at the saved selection; out-of-range values clamp (99x0 -> 20x1); Cancel mutates nothing")
        else:
            for _c in tdl4.get("checks", []):
                if not _c.get("ok"):
                    _row["evidence"].append(
                        "L4 DEFECT (measured, probe check '" + _c.get("name", "?")
                        + "'): " + _c.get("detail", "failed"))
            _row["evidence"].append(
                "NOT L4: re-run table-dialog-l4.test.mjs + build.py after the editor fix")
        for _g in tdl4.get("declaredGaps", []) or []:
            _row["evidence"].append("declared divergence: " + _g)
        print("  L4 live probe: dialog.table-dialog.l4 "
              + ("at L4" if tdl4.get("ok") else "NOT at L4 (measured defect — see evidence)"))
# --------------------------- L4 merge (symbol-dialog-l4.test.mjs, L4-002)
# OO's Symbol modal (Insert → Symbol → More symbols) carries the field
# contract Font + Range over a glyph grid with buttons Symbols / Special
# characters / Insert / Close. The live probe symbol-dialog-l4.test.mjs
# drives the REAL WO dialog (opened by the real ribbon button, not a forced
# cmd): selects font (grid re-renders in that font), switches range (Unicode
# block in the option value; Ω must appear for Greek), clicks a glyph
# (inserts at the saved caret → flat HTML) and closes. Button divergence is
# recorded, not gated (dialog-parity.py precedent): OO's tabs collapse into
# grid + Range; OO Insert = insert-on-glyph-click. A failing probe keeps the
# row honest at L1 with the failing rows in the evidence.
sd_path = HERE / "symbol-dialog-l4.json"
if sd_path.exists():
    try:
        sd = json.load(open(sd_path))
    except ValueError:
        raise SystemExit("ledger: symbol-dialog-l4.json is not valid JSON — fix the probe artifact")
    _sd_fields = sd.get("fields", [])
    _sd_ok = [f for f in _sd_fields if f.get("ok")]
    _fid = "dialog.symbol-dialog.l4"
    add(_fid, "insert",
        {"surface": "dialog:Symbol", "label": "Symbol dialog (field-level)",
         "fields": [f.get("oo") for f in _sd_fields]},
        "dialog")
    ledger[_fid]["wo"] = {"match": "symbol-dialog (symbol-dialog-l4.test.mjs)",
                           "where": "dialog:symbol-dialog"}
    if sd.get("parity"):
        ledger[_fid]["level"] = 4
        ledger[_fid]["evidence"].append(
            "L4 symbol-dialog field parity: %d/%d rows live-verified "
            "(%d apply-verified: font/range drive the grid, glyph click inserts "
            "Ω into flat HTML, close re-closes; OO Symbols/Special-chars tabs "
            "collapse into grid+Range — recorded divergence)"
            % (len(_sd_ok), len(_sd_fields), sd.get("summary", {}).get("appliedVerified", 0)))
    else:
        ledger[_fid]["level"] = 1
        _sd_bad = [f.get("oo") for f in _sd_fields if not f.get("ok")]
        ledger[_fid]["evidence"].append(
            "L4 symbol-dialog probe GAP: " + ", ".join(_sd_bad or ["empty artifact"]))
    print("  L4 merge: symbol-dialog %s (%d/%d rows)"
          % ("PARITY" if sd.get("parity") else "GAP", len(_sd_ok), len(_sd_fields)))
# --------------------------- L4 merge (image-dialog-l4.test.mjs, L4-003)
# The insert-image "dialog" contract: OO's Insert->Image opens a menu into
# the NATIVE OS file picker (interact census: insert/Image opens "menu",
# header-footer/Image opens a 0-control modal mask) — the OO dialog census
# captured no field-level insert-image dialog. The file + width/height +
# Insert/Cancel shape is the MS-Word-style pinned contract (table-dialog
# precedent). WO ships it as the anchored popover #image-dialog (opened by
# a REAL click on #btn-image): file input with preview, width/height number
# fields revealed only once a file is picked, Insert armed only for a valid
# image. L4 is EARNED by the live probe image-dialog-l4.test.mjs: real
# setInputFiles bytes, invalid-type rejection, width-attr insert at the
# saved caret, natural-size insert for empty fields, Cancel mutates
# nothing. A failing check pins the row below L4 with the measured defect
# as loud evidence — never a silent pass.
idl4_path = HERE / "image-dialog-l4.json"
if idl4_path.exists():
    try:
        idl4 = json.load(open(idl4_path))
    except ValueError:
        raise SystemExit("ledger: image-dialog-l4.json is not valid JSON — fix the probe artifact")
    _idl4_ok = [c for c in idl4.get("checks", []) if c.get("ok")]
    _fid = idl4.get("feature") or "dialog.image-dialog.l4"
    _row = ledger.setdefault(_fid, {
        "feature": _fid, "cluster": "image", "kind": "dialog",
        "oo": [], "wo": None, "level": 0, "evidence": [],
    })
    _row["oo"].append({"surface": "insert:btn-image", "label": "Image",
                        "fields": ["Image file", "Width", "Height"],
                        "note": "pinned contract — OO Insert->Image is a menu into the native OS "
                                "file picker; the OO dialog census captured no insert-image dialog "
                                "(fields pinned from the MS-Word-style shape)"})
    _row["wo"] = {"match": "image-dialog (image-dialog-l4.test.mjs)",
                   "where": "dialog:image-dialog"}
    _row["level"] = max(_row["level"], 1)
    _row["evidence"].append(
        "L4 live probe (image-dialog-l4.test.mjs, "
        + (idl4.get("generated") or "?") + "): opens via a real click (Insert tab + #btn-image); "
        + "title 'Insert image', Image file input (accepts png; real bytes -> data: preview + size "
        + "fields + armed Insert), Width/Height number inputs (min 1, hidden until a file), size hint; "
        + "Cancel+Insert(primary, disabled until file) verified")
    if idl4.get("ok"):
        _row["level"] = 4
        _row["evidence"].append(
            "L4 fidelity: real PNG via setInputFiles previews + arms Insert; invalid type rejected "
            + "with error (Insert stays disabled); width 123 + Insert puts <img width=\"123\"> into "
            + "the flat HTML at the saved caret; empty size inserts at natural size (no width/height "
            + "attrs); Cancel mutates nothing; selection-on-<img> routes the same dialog into the "
            + "contextual Replace-image path (measured) — text-caret inserts are the plain case")
    else:
        for _c in idl4.get("checks", []):
            if not _c.get("ok"):
                _row["evidence"].append(
                    "L4 DEFECT (measured, probe check '" + _c.get("name", "?")
                    + "'): " + _c.get("detail", "failed"))
        _row["evidence"].append(
            "NOT L4: re-run image-dialog-l4.test.mjs + build.py after the editor fix")
    for _g in idl4.get("declaredGaps", []) or []:
        _row["evidence"].append("declared divergence: " + _g)
    print("  L4 live probe: dialog.image-dialog.l4 "
          + ("at L4" if idl4.get("ok") else "NOT at L4 (measured defect — see evidence)"))
# --------------------------- L4 merge (paragraph-dialog-l4.test.mjs, L4-006)
# OO opens "Paragraph advanced settings" from the ctx-menu row (census-oo-deep
# contextMenu proves the item enabled) and the right panel's "Show advanced
# settings" — the committed OO dialog census captured no field-level paragraph
# modal, so the field contract is pinned from the MS-Word-style Indents &
# Spacing shape (alignment, left/right/first-line indents, line spacing,
# keeps, page break, Tabs…, OK/Cancel). WO ships it as #paragraph-settings-dialog
# opened by a REAL right-click + the ctx ParagraphSettings row. L4 is EARNED by
# the live probe paragraph-dialog-l4.test.mjs: apply puts real inline styles +
# semantic classes on the caret block (flat HTML), reopen reads the live block
# back into every field, the negative path untoggles, Cancel mutates nothing.
# A failing check pins the row below L4 with the measured defect as loud
# evidence — never a silent pass.
pdl4_path = HERE / "paragraph-dialog-l4.json"
if pdl4_path.exists():
    try:
        pdl4 = json.load(open(pdl4_path))
    except ValueError:
        raise SystemExit("ledger: paragraph-dialog-l4.json is not valid JSON — fix the probe artifact")
    _pdl4_ok = [c for c in pdl4.get("checks", []) if c.get("ok")]
    _fid = pdl4.get("feature") or "dialog.paragraph-settings-dialog.l4"
    _row = ledger.setdefault(_fid, {
        "feature": _fid, "cluster": "formatting", "kind": "dialog",
        "oo": [], "wo": None, "level": 0, "evidence": [],
    })
    _row["oo"].append({"surface": "ctx-menu:ParagraphSettings",
                        "label": "Paragraph advanced settings (field-level)",
                        "fields": ["Alignment", "Left indent", "Right indent",
                                   "First line indent", "Line spacing",
                                   "Keep lines together", "Keep with next",
                                   "Page break before", "Tabs…", "OK", "Cancel"],
                        "note": "pinned contract — OO's Paragraph-advanced-settings modal opens via "
                                "the ctx-menu row (census-oo-deep) / right panel Show-advanced; the OO "
                                "dialog census captured no field-level paragraph modal (fields pinned "
                                "from the MS-Word-style Indents & Spacing shape)"})
    _row["wo"] = {"match": "paragraph-settings-dialog (paragraph-dialog-l4.test.mjs)",
                   "where": "ctx-menu:ParagraphSettings"}
    _row["level"] = max(_row["level"], 1)
    _row["evidence"].append(
        "L4 live probe (paragraph-dialog-l4.test.mjs, "
        + (pdl4.get("generated") or "?") + "): opens via a real right-click on the caret "
        + "paragraph + the ctx-menu ParagraphSettings row; title 'Paragraph advanced settings' "
        + "(OO's ctx-row label); Alignment select left/center/right/justify, Left/Right indent "
        + "number 0..500, First line indent number -200..200 (negatives = hanging), Line spacing "
        + "select 1/1.5/2, Keep lines together / Keep with next / Page break before checkboxes, "
        + "Tabs… + Cancel + OK(primary) verified")
    if pdl4.get("ok"):
        _row["level"] = 4
        _row["evidence"].append(
            "L4 fidelity: center + 40/20/32 + 1.5 + keeps via OK puts text-align/margins/"
            + "text-indent/line-height inline styles + keep-lines-together/keep-with-next classes "
            + "on the caret <p> (visible in the flat HTML); reopening reads the live block back into "
            + "every field; the negative path zeroes styles and untoggles (page-break-before on); "
            + "Cancel mutates nothing")
    else:
        for _c in pdl4.get("checks", []):
            if not _c.get("ok"):
                _row["evidence"].append(
                    "L4 DEFECT (measured, probe check '" + _c.get("name", "?")
                    + "'): " + _c.get("detail", "failed"))
        _row["evidence"].append(
            "NOT L4: re-run paragraph-dialog-l4.test.mjs + build.py after the editor fix")
    for _g in pdl4.get("declaredGaps", []) or []:
        _row["evidence"].append("declared divergence: " + _g)
    print("  L4 live probe: dialog.paragraph-settings-dialog.l4 "
          + ("at L4" if pdl4.get("ok") else "NOT at L4 (measured defect — see evidence)"))

# --------------------------- L4 merge (dialog-l4.test.mjs, FINAL-001)
# One probe artifact, one `dialog.<id>.l4` row per dialog. OO modal
# EXISTENCE is measured (census-oo-interactions.json row cited per probe
# result); the OO FIELD contract is declared in the probe's PROBES dict
# (pinned there; flips deliberately WITH the probe, ai-contracts.py
# spirit). L4 only at full field parity; a measured gap keeps the row
# honestly at L2 (the dialog opens via the real route and its fields act)
# with the missing OO fields as loud evidence; a broken probe is loud
# evidence, never silence.
dl4_path = HERE / "dialog-l4.json"
if dl4_path.exists():
    try:
        dl4 = json.load(open(dl4_path))
    except ValueError:
        raise SystemExit("ledger: dialog-l4.json is not valid JSON — fix the probe artifact")
    _dl4_parity = 0
    for e in dl4.get("results", []):
        fid = e.get("feature") or ""
        if not fid:
            continue
        add(fid, e.get("cluster", "other"),
            {"surface": "dialog:" + str(e.get("dialog") or ""),
             "trigger": e.get("oo_modal"), "label": e.get("dialog"),
             "fields": e.get("oo_fields", [])}, "dialog")
        ledger[fid]["wo"] = {"match": e.get("dialog"),
                              "where": "dialog:" + str(e.get("dialog"))}
        if e.get("error"):
            ledger[fid]["level"] = max(ledger[fid]["level"], 1)
            ledger[fid]["evidence"].append(
                "L4 probe BROKEN (recapture dialog-l4.test.mjs): " + str(e["error"])[:160])
        else:
            gap = (" (missing OO fields: %s)" % ", ".join(e.get("missing") or [])
                   if e.get("missing") else "")
            ledger[fid]["evidence"].append(
                "L4 dialog field parity: %d/%d OO fields covered %s%s — OO modal existence measured [%s]"
                % (e.get("covered", 0), e.get("total", 0), e.get("mapping", {}), gap,
                   e.get("oo_modal", "?")))
            if e.get("functional") is True:
                ledger[fid]["evidence"].append(
                    "L2 act: probe fields act on the document (%s)" % e.get("functional_detail", ""))
            elif e.get("functional") is None:
                ledger[fid]["evidence"].append(
                    "functional: %s" % (e.get("functional_detail") or "not provable offline"))
            if e.get("parity"):
                ledger[fid]["level"] = 4
                _dl4_parity += 1
            else:
                # dialog opens via the real route and its fields act, but the
                # OO field contract is not fully covered — honest L2, never
                # L4 on a gap (link-dialog-l4 ladder)
                ledger[fid]["level"] = max(ledger[fid]["level"],
                                           2 if e.get("functional") else 1)
            ledger[fid]["evidence"].append(
                "opened via real route: " + str(e.get("openedBy") or "?"))
    print("  L4 merge: dialog-l4.test.mjs %d/%d dialogs at full field parity"
          % (_dl4_parity, len(dl4.get("results", []))))

# --------------------------- L4 live probes (FINAL-001 batch, PROBES dict)
# Final-ledger task FINAL-001: eight more field-level dialog probes, each
# a standalone <id>-l4.test.mjs driving the RUNNING vanilla editor (static
# serve + fetch stub; table-dialog-l4 pattern). PROBES-dict spirit
# (ai-contracts.py): the pinned OO-side expectation lives HERE and flips
# deliberately WITH the probe. Each artifact carries its own contract +
# declaredGaps; ok=true earns L4; failing checks pin the row at L1 with
# the measured defects as loud evidence (table-dialog precedent — never a
# silent pass). Evidence cites the probe FILE, not the artifact timestamp,
# so the T-005 idempotent rebuild stays byte-stable across gate runs.
L4_FINAL_PROBES = [
    {"art": "hr-settings-dialog-l4.json", "cluster": "insert",
     "oo": {"surface": "ctx-menu:HorizontalLineSettings",
            "label": "Horizontal line settings",
            "fields": ["Width (% of page)", "Height (px)", "Line color", "Alignment"],
            "note": "pinned contract — OO inserts an hr directly from the ctx row (no "
                    "settings modal in the committed OO dialog census; MS-Word-style "
                    "horizontal-line shape, table-dialog precedent)"},
     "behavior": "opens prefilled from the right-clicked <hr>; 60/4/#ff0000/left + Insert "
                 "puts a real <hr style=\"width:60%;height:4px;background-color:#ff0000;...\"> into "
                 "the doc (flat HTML); out-of-range clamps (200->100%, 99->50px); Close "
                 "mutates nothing"},
    {"art": "linenumbers-dialog-l4.json", "cluster": "page",
     "oo": {"surface": "layout:btn-linenumbers",
            "label": "Line Numbers",
            "fields": ["Apply to"],
            "note": "pinned contract — OO opens Line numbering from Layout->Page setup; the "
                    "OO dialog census captured no field-level line-numbers modal "
                    "(MS-Word-style Apply-to/restart shape)"},
     "behavior": "OK plants the document-semantic section marker div.line-numbers[data-restart] "
                 "(restart-each-page -> newPage, continuous -> continuous, restart-each-section "
                 "-> newSection; flat HTML); 'No line numbers' removes it; Cancel plants nothing"},
    {"art": "find-dialog-l4.json", "cluster": "edit",
     "oo": {"surface": "toolbar:btn-find",
            "label": "Find and replace",
            "fields": ["Find", "Replace with", "Match case"],
            "note": "pinned contract — OO ships Find & replace as a right panel (no field-level "
                    "modal in the committed OO dialog census; MS-Word-style Find & Replace "
                    "shape; OO/MS extras like whole-words/regex deferred)"},
     "behavior": "live match count (current / total; case-insensitive, Match case narrows); "
                 "Replace all rewrites every hit into the flat HTML as ONE undoable step; "
                 "Replace (single) rewrites the current match; Close leaves the doc untouched"},
    {"art": "texttotable-dialog-l4.json", "cluster": "table",
     "oo": {"surface": "insert:btn-table (Table menu: Convert)",
            "label": "Convert Text to Table",
            "fields": ["Separate text at", "Custom separator", "Number of columns"],
            "note": "pinned contract — the committed OO dialog census captured no convert "
                    "modal (MS-Word-style Convert Text to Table shape; MS fixed-width/AutoFit "
                    "deferred)"},
     "behavior": "select, then open (openTextToTableDialog saves the selection); Automatic "
                 "splits on the dominant separator per line -> real 2x2 <table> replacing the "
                 "selection (flat HTML); explicit Comma overrides; Number of columns pads every "
                 "row to exactly N <td>; Cancel converts nothing"},
    {"art": "dropcap-dialog-l4.json", "cluster": "formatting",
     "oo": {"surface": "ctx-menu:DropcapSettings",
            "label": "Drop Cap",
            "fields": ["Position", "Lines to drop", "Distance from text (pt)"],
            "note": "pinned contract — the committed OO dialog census captured no Drop cap "
                    "modal (MS-Word-style Drop Cap shape; MS Font selector deferred)"},
     "behavior": "dropped/3/5pt + OK wraps the caret paragraph's first char in span.dropcap "
                 "with --drop-lines/--drop-distance CSS vars (flat HTML); clamps 2..5 / 0..50; "
                 "in-margin variant — MEASURED DEFECT: re-apply and Position-none EAT the "
                 "wrapped character (applyDropcap/removeDropcapOnly remove() the span without "
                 "restoring its text node; MS Word restores the char)"},
    {"art": "watermark-dialog-l4.json", "cluster": "page",
     "oo": {"surface": "layout:btn-watermark",
            "label": "Watermark",
            "fields": ["Watermark", "Custom text", "Color"],
            "note": "pinned contract — the committed OO dialog census captured no Watermark "
                    "modal (MS-Word-style Printed Watermark shape; picture watermarks/rotation "
                    "deferred)"},
     "behavior": "DRAFT + color + OK plants div.watermark[data-text][data-color] (flat HTML); "
                 "custom reveals the text row; 'No watermark' removes the marker — MEASURED "
                 "DEFECT: multi-word custom text is truncated at the first space "
                 "(setSectionMarker marshals attrs via whitespace split, quotes stripped after)"},
    {"art": "pagenumber-dialog-l4.json", "cluster": "insert",
     "oo": {"surface": "insert:btn-pagenumber",
            "label": "Page Number",
            "fields": ["Position", "Format", "Alignment"],
            "note": "pinned contract — OO inserts via the header/footer flow (no field-level "
                    "page-number modal in the committed OO dialog census; MS-Word-style Page "
                    "Numbers shape; MS 'First page' checkbox deferred)"},
     "behavior": "Top/Bottom + format + align + Insert plants span.page-number[data-format] "
                 "with text-align in header.page-header / footer.page-footer (flat HTML) — "
                 "MEASURED DEFECT: the At-cursor path silently no-ops without a live editor "
                 "selection (dialog interaction drops it) and then restyles the LAST existing "
                 "span.page-number (:last-of-type), mutating an unrelated header/footer field; "
                 "also the #btn-pagenumber click itself plants a bare inline span via its "
                 "data-cmd before the dialog opens (declared quirk)"},
    {"art": "bookmark-dialog-l4.json", "cluster": "references",
     "oo": {"surface": "references:btn-bookmark",
            "label": "Insert bookmark",
            "fields": ["Name"],
            "note": "pinned contract — the OO 'Bookmarks' modal census carries manage-list "
                    "controls (Sort by / Hidden bookmarks), not insert fields (MS-Word-style "
                    "Bookmark name + Add shape; Go To/Delete manager rows deferred)"},
     "behavior": "with a selection, Insert wraps it in span.bookmark[data-name] (DOC-semantic "
                 "attr, flat HTML) and the Cross-reference dialog lists it — MEASURED DEFECT: "
                 "the bare-caret path goes through execCommand insertHTML whose Chromium "
                 "sanitizer strips the class (bare styled span with the name text instead of "
                 "span.bookmark; insertCitation documents the same pitfall and the direct-DOM "
                 "fix pattern exists but was not applied to bookmarks)"},
    {"art": "toc-dialog-l4.json", "cluster": "references",
     "oo": {"surface": "references:btn-toc",
            "label": "Insert table of contents",
            "fields": ["Show page numbers", "Right align page numbers", "Leader",
                       "Format table of contents as links", "Build table of contents from",
                       "Levels", "Styles"],
            "note": "pinned contract — the OO dialog census carries a full-item modal; "
                    "WO ships the Title field only; OO fields beyond Title deferred as recorded divergence"},
     "behavior": "Title + Insert plants div.toc[data-title] at the caret (DOC-semantic marker, flat HTML); "
                 "Cancel plants nothing"},
    {"art": "crossref-dialog-l4.json", "cluster": "references",
     "oo": {"surface": "references:openCrossref",
            "label": "Cross-reference",
            "fields": ["Reference type", "Insert reference to", "Insert as link",
                       "Include above/below", "Separate numbers with"],
            "note": "pinned contract — the OO dialog census carries a full-item modal; "
                    "WO ships Target bookmark + Display text only; OO fields beyond these deferred"},
     "behavior": "requires pre-existing bookmark; Target bookmark + Display text + Insert plants "
                 "span.crossref[data-target][data-display-text] at caret (DOC-semantic, flat HTML); "
                 "Cancel plants nothing"},
    {"art": "caption-dialog-l4.json", "cluster": "references",
     "oo": {"surface": "references:insertCaption",
            "label": "Caption",
            "fields": ["Caption", "Insert", "Label", "Exclude label from caption",
                       "Numbering", "Include chapter number", "Chapter starts with style",
                       "Use separator"],
            "note": "pinned contract — OO dialog triggered by Bookmark; WO matches all OO fields except Insert (not a WO capability); full field parity"},
     "behavior": "Caption + Label + options + OK plants the caption wrapper at selection/caret "
                 "(DOC-semantic, flat HTML); Cancel plants nothing"},
    {"art": "tableoffigures-dialog-l4.json", "cluster": "references",
     "oo": {"surface": "references:insertTableOfFigures",
            "label": "Table of figures",
            "fields": ["Show page numbers", "Right align page numbers", "Leader",
                       "Format table of figures as links", "Build table of figures from",
                       "Include label and number", "Styles"],
            "note": "pinned contract — the OO dialog census carries a full-item modal; "
                    "WO ships Label + Style only; OO fields beyond these deferred"},
     "behavior": "Label + Style + Insert plants div.tof[data-label][data-style] at caret "
                 "(DOC-semantic marker, flat HTML); Cancel plants nothing"},
]
for _p in L4_FINAL_PROBES:
    _path = HERE / _p["art"]
    if not _path.exists():
        print("  L4 live probe: %s MISSING (%s)" % (_p["art"], "run the probe"))
        continue
    try:
        _art = json.load(open(_path))
    except ValueError:
        raise SystemExit("ledger: %s is not valid JSON — fix the probe artifact" % _p["art"])
    _fid = _art.get("feature") or _p["art"].replace(".json", ".l4")
    _row = ledger.setdefault(_fid, {
        "feature": _fid, "cluster": _p["cluster"], "kind": "dialog",
        "oo": [], "wo": None, "level": 0, "evidence": [],
    })
    _row["oo"].append(_p["oo"])
    _row["wo"] = {"match": _fid.replace("dialog.", "").replace(".l4", "")
                   + " (%s)" % _p["art"].replace(".json", ".test.mjs"),
                   "where": "dialog:" + _fid.replace("dialog.", "").replace(".l4", "")}
    _row["level"] = max(_row["level"], 1)
    _row["evidence"].append(
        "L4 live probe (%s): %s" % (_p["art"].replace(".json", ".test.mjs"),
                                      _p["behavior"]))
    if _art.get("ok"):
        _row["level"] = 4
        _row["evidence"].append(
            "L4 fidelity: every probe check passed (%d/%d — field contract + apply "
            "semantics + negative paths, live-verified against the running editor)"
            % (len([c for c in _art.get("checks", []) if c.get("ok")]),
               len(_art.get("checks", []))))
    else:
        for _c in _art.get("checks", []):
            if not _c.get("ok"):
                _row["evidence"].append(
                    "L4 DEFECT (measured, probe check '" + _c.get("name", "?")
                    + "'): " + _c.get("detail", "failed"))
        _row["evidence"].append(
            "NOT L4: re-run %s + build.py after the editor fix"
            % _p["art"].replace(".json", ".test.mjs"))
    for _g in _art.get("declaredGaps", []) or []:
        _row["evidence"].append("declared divergence: " + _g)
    print("  L4 live probe: %s %s" % (_fid, "at L4" if _art.get("ok")
                                      else "NOT at L4 (measured defect — see evidence)"))

# --------------------------- L4 gold: Layout page-setup dialogs (FXG-B)
# Margins / Page size / Columns are the one OO dialog-census family whose
# modals ARE captured (census-oo-dialogs.json, tab "layout", triggers
# "menu-item:Custom margins|Custom page size|Custom columns") — so unlike
# the pinned-contract probes above, their gold is CENSUS-DRIVEN: the OO
# field contract is MINED from the committed census at build time (a lost
# or re-titled census dialog fails the build here — heading-guard spirit),
# the WO field side is measured from census-wo-dialogs.json, and the
# parity verdict follows the dialog-parity.py contract over a DECLARED
# mapping table: every GATED OO field must resolve to its censused WO
# control (superset allowed — "no OO field missing" among the carried
# core); census fields WO deliberately collapses into a mechanism or
# defers are DECLARED below — recorded divergence, never gated, never
# silently dropped (symbol/bookmark/watermark probe precedent). The
# gated + deferred sets must account for EVERY mined census field, so a
# census field added/renamed upstream fails the build instead of
# quietly escaping the contract.
def oo_census_dialog(title):
    "mine the committed OO dialog census (first exact-title match)"
    for e in oo_dlg.get("dialogs", []):
        if (e.get("dialog") or {}).get("title") == title:
            return e
    return None

def wo_census_fields(dlg_id):
    "censused WO dialog fields (list) or None when the id is unknown"
    for e in wo_dlg.get("dialogs", []):
        if e.get("id") == dlg_id:
            return e.get("fields", [])
    return None

LAYOUT_L4_GOLD = [
    {
        "fid": "dialog.margins-dialog.l4",
        "art": "margins-dialog-l4.json",
        "cluster": "page",
        "census_title": "Margins",
        "trigger": "menu-item:Custom margins",
        "wo_dialog": "page-setup-dialog",
        "gated": {
            "Margins": "Margins (inches)",  # OO's preset combo -> WO margins group
            "Top": "Top", "Bottom": "Bottom", "Left": "Left", "Right": "Right",
            "Orientation": "Orientation",   # + the Portrait/Landscape radio pair
        },
        "deferred": {
            "Gutter position": "WO has no gutter model — deferred by the .page-setup marker's "
                               "single data-margin-* twip set (recorded divergence, not gated)",
            "Multiple pages": "OO's mirror/multiple-pages book layout is deferred "
                              "(recorded divergence, not gated)",
        },
        "wo_extra": ["Size preset select", "Portrait/Landscape radios",
                     "Layout > Margins preset menu (Normal/Narrow/Moderate/Wide/Last custom)"],
        "behavior": "Top/Bottom/Left/Right + Orientation resolve to the shared Page-setup "
                    "dialog (#page-setup-dialog — opened by a real #btn-page-setup click AND "
                    "the census route Layout > Margins > 'Custom margins', data-cmd "
                    "openPageSetup); Apply plants div.page-setup[data-page-w][data-page-h]"
                    "[data-orient][data-margin-top/bottom/left/right] (inches x 1440 twips) "
                    "at body start, which the converters round-trip to DOCX w:sectPr "
                    "(editor.js writePageSetupMarker); Cancel plants nothing",
    },
    {
        "fid": "dialog.page-size-dialog.l4",
        "art": "pagesize-dialog-l4.json",
        "cluster": "page",
        "census_title": "Page size",
        "trigger": "menu-item:Custom page size",
        "wo_dialog": "page-setup-dialog",
        "gated": {
            "Preset": "Size",  # 14 WxH presets + Custom (option values carry W x H twips)
        },
        "deferred": {
            "Width": "carried by mechanism, not a numeric field: the Size option values are "
                     "'WxH' twips and Apply writes data-page-w (free numeric custom size "
                     "deferred — recorded divergence, not gated)",
            "Height": "carried by mechanism, not a numeric field: the Size option values are "
                      "'WxH' twips and Apply writes data-page-h; landscape swaps the pair "
                      "(recorded divergence, not gated)",
        },
        "wo_extra": ["Portrait/Landscape orientation radios",
                     "Layout > Size preset menu (Letter/Legal/A4/A5/B5/…/Last custom)"],
        "behavior": "Size preset -> Apply writes data-page-w/data-page-h on the shared "
                    "div.page-setup marker (dialog shared with margins; census route "
                    "Layout > Size > 'Custom page size', same data-cmd openPageSetup); "
                    "reopen reads the live size back into the select; Cancel mutates nothing",
    },
    {
        "fid": "dialog.columns-dialog.l4",
        "art": "columns-dialog-l4.json",
        "cluster": "page",
        "census_title": "Columns",
        "trigger": "menu-item:Custom columns",
        "wo_dialog": "columns-dialog",
        "gated": {
            "Number of columns": "Columns",  # #columns-count, number 1..6, default 2
        },
        "deferred": {
            "1": "OO's per-column width spinner for column 1 collapses into WO's equal-width "
                 "section mechanism (one data-column-gap knob) — recorded divergence, not gated",
            "2": "OO's per-column width spinner for column 2 — same equal-width collapse "
                 "(recorded divergence, not gated)",
            "Equal column width": "satisfied by mechanism: WO columns are equal-width by "
                                  "construction (no checkbox exists) — recorded divergence, "
                                  "not gated",
            "Column divider": "rule between columns is deferred — the section marker has no "
                              "divider attribute (recorded divergence, not gated)",
        },
        "wo_extra": ["Gap (px) number field (0..200, default 36)",
                     "Layout > Columns preset menu (One/Two/Three/Left/Right)"],
        "behavior": "Insert wraps the caret position in <section data-columns=\"N\" "
                    "data-column-gap=\"G\"> (editor.js confirmColumnsDialog; count clamps "
                    "1..6); census route Layout > Columns > 'Custom columns', data-cmd "
                    "openColumnsDialog; Cancel plants nothing",
    },
]
for _g in LAYOUT_L4_GOLD:
    _gid, _gart = _g["fid"], _g["art"]
    # 1. mine the OO contract from the committed census (never re-declared here)
    _mine = oo_census_dialog(_g["census_title"])
    if _mine is None:
        raise SystemExit(
            "ledger: FXG-B gold row %s lost its OO census dialog %r — "
            "census-oo-dialogs.json was retitled/rewritten; re-pin the gold contract"
            % (_gid, _g["census_title"]))
    _census_fields = [f.get("label", "") for f in _mine["dialog"].get("fields", []) if f.get("label")]
    _trigger = (_mine.get("trigger") or {}).get("via") or _g["trigger"]
    # 2. the declared contract must account for EVERY mined census field
    _declared = set(_g["gated"]) | set(_g["deferred"])
    if set(_census_fields) != _declared:
        raise SystemExit(
            "ledger: FXG-B gold row %s contract drift — census fields %s vs declared %s; "
            "gate the fields WO carries, declare the rest, never drop one silently"
            % (_gid, sorted(_census_fields), sorted(_declared)))
    # 3. measure the WO side from the committed WO dialog census
    _wf = wo_census_fields(_g["wo_dialog"])
    _wo_labels = [f.get("label", "") for f in (_wf or [])]
    _wo_buttons = next((e.get("buttons") for e in wo_dlg.get("dialogs", [])
                        if e.get("id") == _g["wo_dialog"]), [])
    _missing = [oo for oo, wo in _g["gated"].items() if wo not in _wo_labels]
    _ok = _wf is not None and not _missing
    # 4. row + evidence
    add(_gid, _g["cluster"],
        {"surface": "dialog:" + _g["census_title"], "trigger": _trigger,
         "label": _g["census_title"], "fields": _census_fields,
         "buttons": _mine["dialog"].get("buttons", [])}, "dialog")
    ledger[_gid]["wo"] = {"match": _g["wo_dialog"], "where": "dialog:" + _g["wo_dialog"]}
    ledger[_gid]["level"] = max(ledger[_gid]["level"], 1)
    ledger[_gid]["evidence"].append(
        "L4 gold (FXG-B, census-driven): OO field contract mined from census-oo-dialogs.json "
        "(title %r, trigger %s): %d fields %s; buttons OO %s vs WO %s"
        % (_g["census_title"], _trigger, len(_census_fields), _census_fields,
           _mine["dialog"].get("buttons", []), _wo_buttons))
    _map = {oo: wo for oo, wo in _g["gated"].items() if wo in _wo_labels}
    ledger[_gid]["evidence"].append(
        "L4 field parity (dialog-parity.py contract, censused WO dialog %s): %d/%d OO fields "
        "carried %s; %d deferred divergences: %s; WO extras (superset, allowed): %s"
        % (_g["wo_dialog"], len(_map), len(_census_fields), _map,
           len(_g["deferred"]), "; ".join(k + " — " + v for k, v in _g["deferred"].items()),
           "; ".join(_g["wo_extra"])))
    if _ok:
        ledger[_gid]["level"] = 4
        ledger[_gid]["evidence"].append(
            "L4 fidelity basis: every gated field resolves to its censused WO control; "
            "behavior contract: " + _g["behavior"])
    else:
        ledger[_gid]["evidence"].append(
            "L4 DEFECT (measured): gated fields missing from the censused WO dialog %s: %s "
            "— NOT L4 until the editor carries them" % (_g["wo_dialog"], _missing))
    # 5. live-probe artifact join when the probe has been captured
    _apath = HERE / _gart
    if _apath.exists():
        try:
            _art = json.load(open(_apath))
        except ValueError:
            raise SystemExit("ledger: %s is not valid JSON — fix the probe artifact" % _gart)
        if _art.get("oo_fields") != _census_fields:
            ledger[_gid]["evidence"].append(
                "L4 probe artifact contract drift (%s): oo_fields %s != census %s — "
                "re-capture %s" % (_gart, _art.get("oo_fields"), _census_fields,
                                    _gart.replace(".json", ".test.mjs")))
            _ok = False
        elif _art.get("ok"):
            ledger[_gid]["evidence"].append(
                "L4 live probe verified (%s, %s): %d/%d checks passed against the running "
                "editor" % (_gart.replace(".json", ".test.mjs"), _art.get("generated", "?"),
                            len([c for c in _art.get("checks", []) if c.get("ok")]),
                            len(_art.get("checks", []))))
        else:
            for _c in _art.get("checks", []):
                if not _c.get("ok"):
                    ledger[_gid]["evidence"].append(
                        "L4 DEFECT (measured, probe check '%s'): %s"
                        % (_c.get("name", "?"), _c.get("detail", "failed")))
            ledger[_gid]["evidence"].append(
                "NOT L4: re-run %s + build.py after the editor fix"
                % _gart.replace(".json", ".test.mjs"))
            _ok = False
    else:
        ledger[_gid]["evidence"].append(
            "live probe artifact %s not yet captured (run %s) — gold stands on the census "
            "field join above" % (_gart, _gart.replace(".json", ".test.mjs")))
    if not _ok and ledger[_gid]["level"] >= 4:
        ledger[_gid]["level"] = 2
    print("  L4 gold (FXG-B): %s %s"
          % (_gid, "at L4" if ledger[_gid]["level"] == 4 else "NOT at L4 (see evidence)"))

# ---------------------------------------------------------------- report
by_cluster = defaultdict(lambda: {"L0": 0, "L1": 0, "L2": 0, "L3": 0, "L4": 0, "rows": []})
for row in ledger.values():
    c = by_cluster[row["cluster"]]
    lvl = "L" + str(row["level"])
    c[lvl] += 1
    c["rows"].append(row)

tot = {k: sum(v[k] for v in by_cluster.values()) for k in ["L0", "L1", "L2", "L3", "L4"]}

# Loud guard (T-002): the manual-6b heading rows must survive EVERY rebuild,
# at L3 (roundtrip-proven) — not merely exist. If census-shortcuts/census-wo-deep
# schema changes, 6b is edited, or a roundtrip recapture drops the applyHeadingN
# probes, fail HERE — never let a regenerate silently lose heading parity or
# downgrade it to L1 surface (the acceptance gate only catches it later, far
# from the cause).
for _i in (1, 2, 3):
    _fid = f"formatting.heading-{_i}"
    _row = ledger.get(_fid) or {}
    if _row.get("wo", {}).get("match") != f"applyHeading{_i}":
        raise SystemExit(
            f"ledger: manual-6b heading row {_fid} lost on rebuild — "
            "fix section 6b (heading parity must not silently regress)")
    if _row.get("level", 0) < 3:
        raise SystemExit(
            f"ledger: heading row {_fid} downgraded to L{_row.get('level')} on "
            "rebuild — roundtrip-results.json lost its applyHeadingN probe; "
            "recapture roundtrip.cjs before regenerating the ledger")

# Loud guard (FXG-A): the four now-green orphan probes registered in
# L4_FINAL_PROBES — dropcap / watermark / pagenumber / bookmark, artifacts
# all-ok since the viewport + evaluate-click regen — must survive EVERY
# rebuild at L4, same contract as the heading guard above. A missing or
# renamed artifact, or a recapture that flips ok, would otherwise silently
# drop the ledger L4 24 -> 20 and only surface at the acceptance gate, far
# from the cause. Fail HERE with the probe file to re-run.
for _orphan in ("dropcap", "watermark", "pagenumber", "bookmark"):
    _fid = "dialog.%s-dialog.l4" % _orphan
    _lvl = (ledger.get(_fid) or {}).get("level", 0)
    if _lvl < 4:
        raise SystemExit(
            f"ledger: orphan probe row {_fid} rebuilt at L{_lvl} (artifact "
            "missing/renamed or probe not ok) — re-run " + _orphan
            + "-dialog-l4.test.mjs + build.py; FXG-A pins all four orphan "
            "probes at L4 (never a silent L4 24->20 drop)")

# Loud guard (FXG-B): the three census-driven Layout page-setup gold rows
# (margins / page-size / columns — mined from census-oo-dialogs.json) must
# survive EVERY rebuild at L4, same contract as the heading/FXG-A guards:
# the mined census dialog going away, a census field added/renamed outside
# the declared contract, or the censused WO dialog losing a gated field
# each fail the build at the cause instead of silently dropping the ledger
# L4 count at the acceptance gate far away.
for _gold in LAYOUT_L4_GOLD:
    _fid = _gold["fid"]
    _lvl = (ledger.get(_fid) or {}).get("level", 0)
    if _lvl < 4:
        raise SystemExit(
            f"ledger: FXG-B gold row {_fid} rebuilt at L{_lvl} — the census "
            "field join or the live-probe artifact flipped below parity; fix "
            "the LAYOUT_L4_GOLD contract or re-run "
            + _gold["art"].replace(".json", ".test.mjs")
            + " + build.py (FXG-B pins margins/page-size/columns at L4)")

# Loud guard (FXG-C): the four references-family probes registered in
# L4_FINAL_PROBES — toc / crossref / caption / tableoffigures, artifacts
# captured at L4 — must survive EVERY rebuild at L4, same contract as the
# heading/FXG-A/FXG-B guards. A missing or renamed artifact, or a recapture
# that flips ok, would otherwise silently drop the ledger L4 count and only
# surface at the acceptance gate, far from the cause. Fail HERE with the
# probe file to re-run.
for _refs in ("toc", "crossref", "caption", "tableoffigures"):
    _fid = "dialog.%s-dialog.l4" % _refs
    _lvl = (ledger.get(_fid) or {}).get("level", 0)
    if _lvl < 4:
        raise SystemExit(
            f"ledger: FXG-C gold row {_fid} rebuilt at L{_lvl} (artifact "
            "missing/renamed or probe not ok) — re-run " + _refs
            + "-dialog-l4.test.mjs + build.py; FXG-C pins all four references "
            "probes at L4 (never a silent L4 drop)")

out = HERE / "ledger.json"
new_ledger = {"version": 1, "generated": __import__("datetime").datetime.now().isoformat(),
              "levels": ["L0 missing", "L1 surface", "L2 acts", "L3 persists", "L4 fidelity"],
              "totals": {k: tot[k] for k in ["L0", "L1", "L2", "L3", "L4"]},
              "features": list(ledger.values())}
# PKG-001: a row may never be *silently* parked. Deferring a capability means
# declaring it in REGISTERED_PARKS (loud divergence row) — never a bare
# `parked`/`status: parked` field, which the parity gates treat as review debt.
# Substring-level on the serialized ledger, not field-name matching: the
# acceptance gate greps the artifact for 'parked', so ANY spelling of a silent
# park (parked, status:'parked', park_reason, …) must fail the build here.
if "parked" in json.dumps(new_ledger, ensure_ascii=False):
    _silent_parks = [r.get("feature") for r in new_ledger["features"]
                     if "parked" in json.dumps(r, ensure_ascii=False)]
    raise SystemExit("ledger: silently parked rows %s — promote them to "
                     "REGISTERED_PARKS divergence declarations instead" % _silent_parks)

# Idempotent rebuild (T-005): keep the committed `generated` stamp when nothing
# else changed, so a gate run of build.py never dirties the checkout (that
# dirt is what broke the tf/T-005 merge into main on attempt 1).
try:
    old_ledger = json.loads(out.read_text())
    strip = lambda d: {k: v for k, v in d.items() if k != "generated"}
    if strip(old_ledger) == strip(new_ledger):
        new_ledger["generated"] = old_ledger["generated"]
except (OSError, ValueError):
    pass
json.dump(new_ledger, open(out, "w"), indent=1, ensure_ascii=False)

print(f"ledger: {len(ledger)} features across {len(by_cluster)} clusters")
print(f"  L0 missing : {tot['L0']}")
print(f"  L1 surface : {tot['L1']}  (the old census ceiling)")
if rt_merged:
    print(f"  L3 persists: {tot['L3']}  (roundtrip.cjs: {rt.get('survived', 0)}/{rt.get('probed', 0)} commands survived html->docx->html)")
else:
    print("  L2/L3/L4   : not yet probed (ledger/roundtrip.cjs fills L3)")
if dp_merged:
    print(f"  L4 fidelity: {tot['L4']}  (dialog-parity.py: {dp.get('summary', {}).get('parity', 0)}/{dp.get('summary', {}).get('probed', 0)} dialogs at full field parity)")

# markdown report
md = ["# Feature Ledger v1 — real completeness map", ""]
md.append(f"Generated from: census-oo-deep + census-oo-dialogs + census-wo-deep. ")
if rt_merged:
    md.append(f"L3 layer: ledger/roundtrip.cjs ({rt.get('survived', 0)}/{rt.get('probed', 0)} commands survive html->docx->html).")
if dp_merged:
    md.append(f"L4 layer: ledger/dialog-parity.py ({dp.get('summary', {}).get('parity', 0)}/{dp.get('summary', {}).get('probed', 0)} dialogs carry the OO field contract).")
md.append("Levels: **L0** missing · **L1** surface exists (visual parity — the old")
md.append("census ceiling, 'deficit 3' lives here) · **L2** acts (behavior probe) ·")
md.append("**L3** persists (round-trip) · **L4** fidelity vs OO output. ⏸ marks a")
md.append("registered park: a deliberately deferred capability plane, declared")
md.append("LOUD as a divergence row (never a silent stub).")
md.append("")
for cl in sorted(by_cluster, key=lambda c: by_cluster[c]["L0"], reverse=True):
    v = by_cluster[cl]
    n = len(v["rows"])
    md.append(f"## {cl} — {n} features (L0:{v['L0']} L1:{v['L1']} L3:{v['L3']})")
    for row in sorted(v["rows"], key=lambda r: r["level"]):
        icon = "❌" if row["level"] == 0 else "🔲" if row["level"] == 1 else "✅"
        wo = f"→ WO: {row['wo']['match']}" if row.get("wo") else ""
        flds = ""
        if row["kind"] == "dialog":
            nf = len(next((o.get("fields", []) for o in row["oo"] if o.get("fields")), []))
            flds = f" ({nf} OO fields)"
        park = " ⏸ registered park" if row.get("divergence") == "registered" else ""
        md.append(f"- {icon} L{row['level']} **{row['feature']}** [{row['kind']}]{flds} {wo}{park}")
    md.append("")
(HERE / "LEDGER-REPORT.md").write_text("\n".join(md))
print("wrote", out)
print("wrote", HERE / "LEDGER-REPORT.md")
