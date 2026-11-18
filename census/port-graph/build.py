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
  census/census/census-react-dialogs.json react editor dialogs (15 right-rail
                                         panels, PG-8; the deployed surface)
  census/census/census-wo-dialogs.json   WO dialogs (LEGACY wysiwyg capture, 65;
                                         fallback for dialogs the panels census
                                         does not reach: modals like Symbol)
  census/census/census-shortcuts.json    OO Shortcuts.js vs WO keydown (147, static)
  census/census/census-oo.json           OO runtime backstage labels (portal-mode capture;
                                         anchors the filemenu id→label map)
  census/oo-source/oo-dialogs.json       SOURCE manifest: 36 dialogs (OO build 252.232.451.526)
  census/oo-source/oo-filemenu.json      SOURCE manifest: 19 backstage buttons + 10 panels
  census/oo-source/oo-statusbar.json     SOURCE manifest: 17 statusbar template ids
  census/oo-source/oo-ctx-manifest.json  SOURCE manifest: ctx menu constructor counts (237)
  census/oo-source/oo-reference.json     SOURCE manifest: ribbon/counts + 10 rightPanel sections
  census/oo-source/oo-shortcuts.json     SOURCE manifest: 142 runtime shortcut actions

v3 UNION RULE: the OO-side baseline of every surface is the UNION of the
source manifests (oo-source/, the larger truth dug from OO's templates) with
the runtime censuses. build.py self-asserts union completeness and exits
loudly if any manifest row lacks a graph row. Rows with NO react-side
evidence are `missing` — the honest gap, never massaged to keep done-gate
green (see PORT-GRAPH.md).

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
REACT_DLG_PATH = CENSUS / "census" / "census-react-dialogs.json"
WO_DLG_PATH = CENSUS / "census" / "census-wo-dialogs.json"
SHORTCUTS_PATH = CENSUS / "census" / "census-shortcuts.json"
OO_BACKSTAGE_PATH = CENSUS / "census" / "census-oo.json"
OO_SRC = CENSUS / "oo-source"
SRC_DIALOGS_PATH = OO_SRC / "oo-dialogs.json"
SRC_FILEMENU_PATH = OO_SRC / "oo-filemenu.json"
SRC_STATUSBAR_PATH = OO_SRC / "oo-statusbar.json"
SRC_CTX_PATH = OO_SRC / "oo-ctx-manifest.json"
SRC_REF_PATH = OO_SRC / "oo-reference.json"
SRC_SHORTCUTS_PATH = OO_SRC / "oo-shortcuts.json"
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
    return {
        t: {norm(b.get("label", "")): b.get("label", "")
            for b in rows if b.get("label")}
        for t, rows in re_.get("ribbon", {}).items()
    }


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


# v3: the OO-side baseline is the UNION of the source manifests (oo-source/,
# OO build 252.232.451.526) with the runtime censuses. Every mapping table
# below is documented in PORT-GRAPH.md; every manifest row MUST appear as a
# graph row (asserted in main()).


def assert_union(surface: str, manifest: set, emitted: set) -> None:
    gap = manifest - emitted
    if gap:
        sys.exit(f"union FAIL {surface}: manifest rows missing from graph: {sorted(gap)}")


# --- statusbar (v3): union of 17 template ids + runtime census rows ----------
# oo-statusbar.json template id → (label, react alias, reason). react alias =
# the react statusbar control this id maps to when plain label match can't
# see it (slot VALUES vs control TITLES; containers; text slots).
STATUSBAR_SEMANTICS = {
    "label-pages": ("Page count", "Page 1 of 0", "react pager text 'Page N of M'"),
    "status-goto-box": ("Go to page box", "Next page", "react pager (Previous page / Next page buttons)"),
    "status-goto-page": ("Go to page button", "Next page", "react pager (Previous page / Next page buttons)"),
    "slot-status-btn-info": ("Word count", "Words: 0", "react 'Words: N' text"),
    "label-action": ("Action status", None, None),  # transient status text, no react counterpart → missing
    "btn-cnt-lang": ("Language container", "Language", "container of doc-lang + doc-spell; react ships Language + Spell Check"),
    "btn-doc-lang": ("Language", None, None),
    "btn-doc-spell": ("Spell check", None, None),
    "btn-doc-review": ("Track changes", None, None),
    "status-btn-select-tool": ("Select tool", None, None),
    "status-btn-hand-tool": ("Hand tool", None, None),
    "status-btn-multiple-pages": ("Multiple pages", None, None),  # → done (PGP-8 statusbar toggle)
    "btn-zoom-topage": ("Fit to page", None, None),
    "btn-zoom-towidth": ("Fit to width", None, None),
    "btn-zoom-down": ("Zoom out", None, None),
    "label-zoom": ("Zoom", "100%", "react zoom value text"),
    "btn-zoom-up": ("Zoom in", None, None),
}
# PG-11 gap triage — same feature shipped on a different react surface:
# PGP-1..9 shipped (campaign port-graph-parity, 2026-11-18, server main 9ba80faa4):
# rows the deployed react editor now implements on a matching surface.
STATUSBAR_SHIPPED = {
    "label-action": "react status slot de-statusbar-status + documentStore.setStatusMessage "
                     "(save/export/spellcheck events, StatusBar.tsx role=status)",
    "status-btn-multiple-pages": "react statusbar multipage toggle sharing one documentStore.multipageView "
                                   "state with the View tab (StatusBar.tsx + toggleMultiplePages)",
}
STATUSBAR_DIVERGED = {}
STATUSBAR_MISS_EVIDENCE = {
    "label-action": "transient action-status text slot; react statusbar has no status/message "
                    "text (StatusBar.tsx: pager/zoom/word-count only)",
}


def build_statusbar(oo: dict, re_: dict, src: dict) -> dict:
    """v3: baseline = union(17 source template ids, runtime census rows).

    Runtime rows join by DOM id (they carry the captured OO labels/slots);
    ids not in the template (asc-gen*, empty) are duplicates — skipped."""
    rlabels = {norm(i.get("label", "")): i.get("label", "")
               for i in re_.get("statusbar", []) if i.get("label")}
    runtime: dict[str, str] = {}  # template id → captured runtime label
    for item in oo.get("statusBar", []):
        rid = item.get("id", "")
        if rid in STATUSBAR_SEMANTICS:
            runtime.setdefault(rid, item.get("label", ""))

    controls, counts = [], {"done": 0, "diverged": 0, "missing": 0, "iconOnly": 0}
    for tid, (label, alias, reason) in STATUSBAR_SEMANTICS.items():
        target = alias if alias else label
        if label_match(target, set(rlabels)):
            status = "done"
            label_out = rlabels.get(norm(target), target)
        elif STATUSBAR_SHIPPED.get(tid):
            status, label_out = "done", label
        elif tid in STATUSBAR_DIVERGED:
            status, label_out = "diverged", label
        else:
            status, label_out = "missing", label
        reason_out = (reason if status == "done" and not STATUSBAR_SHIPPED.get(tid)
                      else STATUSBAR_SHIPPED.get(tid)
                      or STATUSBAR_DIVERGED.get(tid)
                      or STATUSBAR_MISS_EVIDENCE.get(tid)
                      or "no react statusbar counterpart — honest gap")
        controls.append({"label": label_out, "ooLabel": runtime.get(tid) or label,
                         "ooId": tid, "status": status,
                         "reason": reason_out})
        counts[status] += 1
    counts["total"] = len(controls)
    return {"id": "statusbar", "label": "Status Bar", "contextual": False,
            "counts": counts, "controls": controls,
            "note": f"v3 union: {len(src.get('templateIds', []))} source template ids "
                    f"(oo-statusbar.json, OO build pinned) ∪ runtime census rows "
                    f"(joined by DOM id); ids→semantics table in PORT-GRAPH.md"}


# --- dialogs (v3): baseline = 36 source dialogs ∪ runtime-only titles -----
# oo-dialogs.json component → (legacy WO dialog title, why) — identity-certain
# joins to the legacy wysiwyg census (fallback evidence for modals the react
# panels census does not reach).
DIALOG_COMPONENT_ALIASES = {
    "CustomColumnsDialog": ("Insert columns", "legacy 'Insert columns' dialog"),
    "HyphenationDialog": ("Hyphenation", "legacy Hyphenation dialog"),
    "PageMarginsDialog": ("Page setup", "combined into WO 'Page setup' (fields: Size, Margins)"),
    "PageSizeDialog": ("Page setup", "combined into WO 'Page setup' (fields: Size, Margins)"),
    "ParagraphSettingsAdvanced": ("Ctx.ParagraphSettings", "legacy paragraph settings dialog"),
    "DropcapSettingsAdvanced": ("Drop Cap", "legacy Drop Cap dialog"),
    "ListIndentsDialog": ("Ctx.AdjustListIndents", "legacy list-indents dialog"),
    "NumberingValueDialog": ("List.NumberingValue", "legacy numbering-value dialog"),
    "LineNumbersDialog": ("Line Numbers", "legacy Line Numbers dialog"),
    "NoteSettingsDialog": ("Footnote and Endnote", "legacy Footnote and Endnote dialog"),
    "TableFormulaDialog": ("Formula.Title", "legacy table formula dialog"),
    "TableToTextDialog": ("TableToText.Title", "legacy table-to-text dialog"),
    "TextToTableDialog": ("TextToTable.Title", "legacy text-to-table dialog"),
    "ProtectDialog": ("Prot.Title", "legacy protect dialog"),
    "HyperlinkSettingsDialog": ("Insert link", "legacy hyperlink dialog"),
    "WatermarkSettingsDialog": ("Watermark", "legacy Watermark dialog"),
    "PageNumberingDlg": ("Dialog.PageNumberTitle", "legacy page-numbering dialog"),
}
# component → react right-rail panel title, why) — advanced-settings dialogs
# the deployed editor answers with a panel (census-react-dialogs.json).
REACT_PANEL_ALIASES = {
    "TableSettingsAdvanced": ("Table Settings", "advanced settings → react Table Settings right-rail panel"),
    "ImageSettingsAdvanced": ("Image Settings", "advanced settings → react Image Settings right-rail panel"),
    "ControlSettingsDialog": ("Form Controls", "control settings → react Form Controls right-rail panel (Required/Locked/placeholder fields, census-react-dialogs.json)"),
}
# component → react routing evidence (src/lib/word-commands.ts, PG-9).
REACT_ROUTE = {
    "BookmarksDialog": ("Cross-Reference", "insertBookmark routes to the react Cross-Reference panel (word-commands.ts)"),
    "CaptionDialog": ("Cross-Reference", "insertCaption routes to the react Cross-Reference panel (word-commands.ts)"),
    "TableOfContentsSettings": ("Cross-Reference", "insertToc routes to the react Cross-Reference panel (word-commands.ts)"),
}
# PGP-1..9 shipped (campaign port-graph-parity, 2026-11-18, server main 9ba80faa4):
# rows previously missing are now DONE with shipped-evidence reasons.
REACT_SHIPPED = {
    "CellsAddDialog": "react Table Panel offers Insert Cells (Right/Down) with shift direction, "
                       "OO 'Cells Add' dialog parity (TablePanel.tsx insertCells right/down)",
    "EditListItemDialog": "react Form Controls panel edits dropdown options post-insert via contextual "
                           "'Edit Form Control' section (FormPanel.tsx editFormControl)",
    "ListSettingsDialog": "react Styles panel: list style picker incl. numbering formats — "
                           "listNumberingStyle (decimal/lowerAlpha/lowerRoman) + indent (StylesPanel.tsx, rte-command.ts)",
    "ListTypesAdvanced": "react Styles panel: bullet/ordered/task + numbering-type picker "
                          "(listNumberingStyle decimal/lowerAlpha/lowerRoman, StylesPanel.tsx)",
    "NotesRemoveDialog": "react Cross-Reference panel: Remove All Footnotes / Remove All Endnotes buttons "
                         "(CrossReferencePanel.tsx + remove-notes.ts removeAllFootnotesCommand/removeAllEndnotesCommand)",
    "SaveFormDlg": "react Save As panel: 'Form' export — buildFormDocx maps content-control spans "
                      "into a fillable DOCX (SaveAsPanel.tsx EXPORT_FORMATS id 'form', lib buildFormDocx)",
    "StyleTitleDialog": "react Styles panel: Save as Style + inline Rename on user styles "
                         "(StylesPanel.tsx handleCommitRename, user-styles registry)",
}
# components the deployed editor answers with a direct action, no dialog.
REACT_DIRECT = {
    "DateTimeDialog": "react insertDateTime inserts a DATETIME field directly — no dialog (word-commands.ts)",
}
# PG-11 gap triage — components the deployed editor answers with a DIFFERENT,
# reduced surface (diverged, evidence cited; source: server
# apps/web/apps/documenteditor-react + committed censuses):
REACT_DIVERGED = {
    "MailMergeEmailDlg": "react Mail Merge right-rail panel merges pasted/uploaded CSV locally "
                         "(Insert-field/Preview/Reset, MailMergePanel.tsx + lib/mail-merge.ts) — "
                         "no email dispatch; mailMerge routes to the panel (word-commands.ts)",
    "RolesManagerDlg": "react answers with the Protect Document + Access Rights backstage panels "
                       "(WOPI-derived Full Access/Read-Only + Owner/Can-Edit, FileMenu/panels/"
                       "ProtectDocPanel.tsx + RightsPanel.tsx) — role management delegated to portal sharing",
}
# PG-11 gap triage — rows evidence PROVES absent in the deployed editor:
# stay missing, but with the searched evidence cited instead of the generic
# honest-gap string (grep-verified against word-commands.ts, FormPanel.tsx,
# CrossReferencePanel.tsx, SaveAsPanel.tsx, ctx-contracts.json).
DLG_MISS_EVIDENCE = {
    "RoleEditDlg": "rights are WOPI-derived read-only (FileMenu/panels/RightsPanel.tsx); no per-role editing",
    "RoleDeleteDlg": "rights are WOPI-derived read-only (FileMenu/panels/RightsPanel.tsx); no per-role delete",
}
# runtime-captured OO dialog title → source component (joins census evidence).
RUNTIME_TITLE_JOIN = {
    "Date & time": "DateTimeDialog", "Margins": "PageMarginsDialog",
    "Page size": "PageSizeDialog", "Columns": "CustomColumnsDialog",
    "Hyphenation": "HyphenationDialog", "Bookmarks": "BookmarksDialog",
    "Insert caption": "CaptionDialog", "Cross-reference": "CrossReferenceDialog",
    "Table of contents": "TableOfContentsSettings",
}
# PG-9 alias that applies to a runtime-only title (no source dialog row).
RUNTIME_TITLE_REACT = {
    "Macros": ("Plugins", "macros routes to the react Plugins panel (word-commands.ts)"),
}
MISSING_DLG_REASON = "no evidence in the react panels census or the legacy WO dialog census — honest gap"


def camel_split(name: str) -> str:
    name = re.sub(r"(Dialog|Dlg|Advanced|Window)$", "", name) or name
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name)


def build_dialogs(src_dialogs: list, runtime_dlgs: list, wo_dlgs: list,
                  react_dlgs: list) -> dict:
    """v3: baseline = 36 source dialogs (oo-dialogs.json) ∪ runtime-only titles.

    Evidence chain per row (PG-9 order, react evidence first): react direct
    action → react route alias → react panel alias → react panel title match
    (via joined runtime title) → legacy component alias → legacy title match.
    No evidence at any tier → missing (the honest gap, never 'diverged')."""
    rv = {norm(d.get("title", "")): d.get("title", "")
          for d in react_dlgs if d.get("title")}
    # WO titles mix i18n keys ('Toolbar.Find') with resolved strings
    # ('Insert symbol'): index every norm variant → original.
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

    runtime_titles: dict[str, str] = {}  # unique runtime title → component | ""
    for d in runtime_dlgs:
        title = (d.get("dialog") or {}).get("title", "")
        if title:
            runtime_titles.setdefault(title, RUNTIME_TITLE_JOIN.get(title, ""))

    rows: dict[str, dict] = {}  # component (or runtime title when source-less) → row
    for s in src_dialogs:
        comp = s.get("component", "")
        rows[comp] = {"component": comp, "ooId": s.get("id") or comp,
                      "runtimeTitle": None, "status": None}
    for title, comp in runtime_titles.items():
        if comp in rows:
            rows[comp]["runtimeTitle"] = title  # evidence joins the source row
        else:
            rows[title] = {"component": None, "ooId": title,
                           "runtimeTitle": title, "status": None}  # runtime-only row

    controls = []
    for key, row in rows.items():
        comp, rt = row["component"], row["runtimeTitle"]
        display = rt or camel_split(comp)
        direct = REACT_DIRECT.get(comp)
        diverged = REACT_DIVERGED.get(comp)
        route = REACT_ROUTE.get(comp) or (RUNTIME_TITLE_REACT.get(rt) if rt else None)
        palias = REACT_PANEL_ALIASES.get(comp)
        lalias = DIALOG_COMPONENT_ALIASES.get(comp)
        if direct:
            status, label, reason = "diverged", display, direct
        elif diverged:
            status, label, reason = "diverged", display, diverged
        elif route and norm(route[0]) in rv:
            status, label, reason = "done", rv[norm(route[0])], route[1]
        elif palias and norm(palias[0]) in rv:
            status, label, reason = "done", rv[norm(palias[0])], palias[1]
        elif rt and norm(rt) in rv:
            status, label, reason = "done", rv[norm(rt)], None
        elif lalias and norm(lalias[0]) in wv:
            status, label, reason = "done", wv[norm(lalias[0])], lalias[1]
        elif rt and (wv.get(norm(rt)) or (norm(rt).endswith("s") and wv.get(norm(rt)[:-1]))):
            legacy = wv.get(norm(rt)) or wv[norm(rt)[:-1]]
            status, label, reason = "done", legacy, None
        elif REACT_SHIPPED.get(comp):
            status, label, reason = "done", display, REACT_SHIPPED[comp]
        else:
            status, label, reason = "missing", display, DLG_MISS_EVIDENCE.get(comp, MISSING_DLG_REASON)
        controls.append({"label": label, "ooLabel": display, "ooId": row["ooId"],
                         "status": status, "reason": reason})
    counts = {"done": sum(1 for c in controls if c["status"] == "done"),
              "diverged": sum(1 for c in controls if c["status"] == "diverged"),
              "missing": sum(1 for c in controls if c["status"] == "missing"),
              "iconOnly": 0, "total": len(controls)}
    return {"id": "dialogs", "label": "Dialogs",
            "caveat": "v3 baseline = 36 source dialogs (oo-dialogs.json, OO build "
                      "252.232.451.526) ∪ runtime-only titles; WO evidence = react panels "
                      "census (deployed) with the legacy wysiwyg census as fallback; "
                      "rows with no evidence = missing (honest gap)",
            "tabs": [{"id": "dialogs", "label": "Dialogs", "contextual": False,
                      "counts": counts, "controls": controls}]}


# --- filemenu (v3): baseline = 19 source buttons + 10 source panels ----------
# oo-filemenu.json id → OO label. Labels come from the committed portal-mode
# runtime backstage census (census-oo.json) where captured; the 8 buttons not
# visible there get labels derived from the id suffix (documented in PORT-GRAPH.md).
FILEMENU_LABELS = {
    "fm-btn-return": "Back", "fm-btn-create": "Create New",
    "fm-btn-recent": "Open Recent", "fm-btn-save": "Save",
    "fm-btn-download": "Download As", "fm-btn-print": "Print",
    "fm-btn-protect": "Protect", "fm-btn-info": "Info",
    "fm-btn-settings": "Advanced Settings", "fm-btn-help": "Help",
    "fm-btn-suggest": "Suggest a Feature",
    # not visible in the portal-mode runtime capture → label from id suffix:
    "fm-btn-edit": "Edit Document", "fm-btn-save-copy": "Save Copy As",
    "fm-btn-save-desktop": "Save to Desktop",
    "fm-btn-print-with-preview": "Print with Preview", "fm-btn-rename": "Rename",
    "fm-btn-history": "Version History", "fm-btn-rights": "Access Rights",
    "fm-btn-back": "Go to Documents",
}
PANEL_LABELS = {
    "panel-saveas": "Save As", "panel-savecopy": "Save Copy",
    "panel-recentfiles": "Recent Files", "panel-createnew": "Create New",
    "panel-info": "Document Info", "panel-rights": "Access Rights",
    "panel-settings": "Advanced Settings", "panel-help": "Help",
    "panel-protect": "Protect Document", "panel-print": "Print",
}
# react backstage panel components (server src/components/FileMenu/panels/,
# verified PG-10 — build.py reads only committed artifacts, so the list is
# pinned here deliberately).
REACT_BACKSTAGE_PANELS = ["CreateNew", "DocumentInfo", "FileBrowser", "Help",
                          "PrintPreview", "ProtectDoc", "RecentFiles", "Rights",
                          "SaveAs", "SaveCopy", "Settings", "Share", "VersionHistory"]
# source id → react backstage panel component (evidence when the react fileMenu
# label alone can't see the match, e.g. 'Protect' vs 'Protect Document').
FILEMENU_PANEL_TARGETS = {
    "fm-btn-create": "CreateNew", "fm-btn-recent": "RecentFiles",
    "fm-btn-save-copy": "SaveCopy", "fm-btn-protect": "ProtectDoc",
    "fm-btn-info": "DocumentInfo",
    "panel-saveas": "SaveAs", "panel-savecopy": "SaveCopy",
    "panel-recentfiles": "RecentFiles", "panel-createnew": "CreateNew",
    "panel-info": "DocumentInfo", "panel-rights": "Rights",
    "panel-settings": "Settings", "panel-help": "Help",
    "panel-protect": "ProtectDoc", "panel-print": "PrintPreview",
}
# label-level aliases where neither plain label match nor a panel applies.
FILEMENU_LABEL_ALIASES = {"Suggest a Feature": "Suggest Feature",
                         # react 'Save as…' IS action save-desktop (FileMenuItems.tsx)
                         "Save to Desktop": "Save as..."}
# PG-11 gap triage — per-id evidence overriding the generic reasons.
FILEMENU_DONE_REASONS = {
    "fm-btn-save-desktop": "react 'Save as…' item is action save-desktop (FileMenuItems.tsx)",
}
FILEMENU_MISS_EVIDENCE = {
    "fm-btn-edit": "WO edit rights are WOPI-derived (UserCanWrite → Protect Document panel "
                   "Full Access/Read-Only, ProtectDocPanel.tsx); no user-facing edit/view switch backstage",
}


def build_filemenu(src: dict, re_: dict) -> dict:
    """v3: baseline = oo-filemenu.json (19 buttons + 10 panels) as two tabs.

    React evidence: census-react-deep fileMenu labels + the pinned react
    backstage panel components. Unmatched = missing (honest)."""
    rlabels = {norm(b.get("label", "")): b.get("label", "")
               for b in re_.get("fileMenu", []) if b.get("label")}
    panels = set(REACT_BACKSTAGE_PANELS)

    def match(oo_id: str, label: str):
        target = FILEMENU_LABEL_ALIASES.get(label, label)
        if label_match(target, set(rlabels)):
            return "done", rlabels.get(norm(target), target), FILEMENU_DONE_REASONS.get(oo_id)
        panel = FILEMENU_PANEL_TARGETS.get(oo_id)
        if panel in panels:
            return "done", panel, f"react backstage panel component '{panel}'"
        return "missing", label, FILEMENU_MISS_EVIDENCE.get(
            oo_id, "no react file-menu counterpart — honest gap")

    tabs = []
    for tid, tlabel, rows in (("filemenu-buttons", "Backstage Buttons", src.get("buttons", [])),
                              ("filemenu-panels", "Backstage Panels", src.get("panels", []))):
        labels = FILEMENU_LABELS if tid == "filemenu-buttons" else PANEL_LABELS
        controls = []
        for oo_id in rows:
            status, label, reason = match(oo_id, labels.get(oo_id, oo_id))
            controls.append({"label": label, "ooLabel": labels.get(oo_id, oo_id),
                             "ooId": oo_id, "status": status, "reason": reason})
        counts = {"done": sum(1 for c in controls if c["status"] == "done"),
                  "diverged": 0,
                  "missing": sum(1 for c in controls if c["status"] == "missing"),
                  "iconOnly": 0, "total": len(controls)}
        tabs.append({"id": tid, "label": tlabel, "contextual": False,
                     "counts": counts, "controls": controls})
    return {"id": "filemenu", "label": "File Menu", "tabs": tabs,
            "note": "v3 baseline = oo-filemenu.json source manifest (19 buttons + "
                    "10 panels, OO build 252.232.451.526); the runtime file-tab "
                    "capture was quick-access chrome (Find/Copy/Paste) and is not "
                    "the backstage surface; id→label table in PORT-GRAPH.md"}


# --- rightpanel (v3, NEW): OO right-panel sections vs react right-rail panels --
# oo-reference.json rightPanel section id → (label, react panel id, why).
RIGHTPANEL_SEMANTICS = {
    "paragraph-settings": ("Paragraph settings", "paragraph", "react rail 'paragraph' panel (Styles list)"),
    "table-settings": ("Table settings", "table", None),
    "image-settings": ("Image settings", "image", None),
    "shape-settings": ("Shape settings", "shape", None),
    "mail-merge-settings": ("Mail merge settings", "mailmerge", None),
    "textart-settings": ("Text art settings", "textart", None),
    "signature-settings": ("Signature settings", "signature", None),
    "form-settings": ("Form settings", "form", None),
    "send-for-signing-settings": ("Send for signing", None, None),   # → missing
    "filling-status-settings": ("Filling status", None, None),       # → missing
}
# PG-11 gap triage — miss reasons citing what the deployed editor ships instead.
RIGHTPANEL_MISS_REASONS = {
    "send-for-signing-settings": "react ships self-signing only (SignaturePanel.tsx 'Add "
                                 "Signature'/'Sign as'); no send-for-signing workflow",
}
# PGP-9 shipped (campaign port-graph-parity, 2026-11-18, server main 9ba80faa4).
RIGHTPANEL_SHIPPED = {
    "filling-status-settings": "react FormPanel 'Filling status' section: total/answered/empty "
                                "per form control (src/lib/form-status.ts + FORM_CONTROL_LABELS)",
}


def build_rightpanel(src_ref: dict, react_dlgs: list) -> dict:
    """NEW v3 surface: OO's 10 right-panel sections (oo-reference.json) vs the
    react editor's 15 right-rail panels (census-react-dialogs.json, PG-8)."""
    panels = {d.get("id"): d.get("title") for d in react_dlgs
              if d.get("id") and d.get("title")}
    controls = []
    for sid, (label, rid, why) in RIGHTPANEL_SEMANTICS.items():
        if rid in panels:
            status, out, reason = "done", panels[rid], why
        elif RIGHTPANEL_SHIPPED.get(sid):
            status, out, reason = "done", label, RIGHTPANEL_SHIPPED[sid]
        else:
            status, out, reason = "missing", label, RIGHTPANEL_MISS_REASONS.get(
                sid, "no react right-rail counterpart — honest gap")
        controls.append({"label": out, "ooLabel": label, "ooId": sid,
                         "status": status, "reason": reason})
    counts = {"done": sum(1 for c in controls if c["status"] == "done"),
              "diverged": 0,
              "missing": sum(1 for c in controls if c["status"] == "missing"),
              "iconOnly": 0, "total": len(controls)}
    extras = sorted(set(panels) - {rid for _, rid, _ in RIGHTPANEL_SEMANTICS.values() if rid})
    return {"id": "rightpanel", "label": "Right Panel",
            "tabs": [{"id": "rightpanel", "label": "Right Panel",
                      "contextual": False, "counts": counts, "controls": controls}],
            "note": f"v3 baseline = oo-reference.json rightPanel (10 sections); react "
                    f"ships {len(panels)} right-rail panels — react-only: {', '.join(extras)} "
                    f"(superset, not debt)"}


def build_ctx(ctx: dict) -> dict:
    """Context-menu contract vs react-evidence. v3.2 FIX (2026-11-18): this
    surface previously rubber-stamped every OO live-verified row as `done` —
    but react ships right-click menus only for TABLE (PGP-1) + SPELLCHECK.
    Statuses now require react evidence per row:
      text/image/shape = missing until a menu exists (PGP-A campaign);
      browser-native rows record the browser fallback as diverged;
      commands that route to a panel/command but have NO ctx menu stay
      missing (the surface is the right-click menu, not the command)."""
    # Contract row -> react evidence. 'done': rendered in a react ctx menu.
    # None = no evidence → missing.
    # exc_note: tuple (row, note) for diverged rows (capability exists, not
    #   on this surface).
    REACT_CTX = {
        # table: PGP-1 shipped TableContextMenu with every contract row.
        "table": {r: None for r in (
            "Cut", "Copy", "Paste", "PrintSelection", "Select", "Delete",
            "MergeCells", "SplitCell", "DistributeRows", "DistributeColumns",
            "TextAlignment", "InsertCaption", "TableProperties", "Link",
            "ParagraphSettings", "FormattingAsStyle", "AI")},
        # spellcheck menu: suggestions + Ignore + AddToDictionary rendered.
        "misspelled": {"Ignore": None, "AddToDictionary": None,
                       "SelectLanguage": "dictionary/docs language cmd exists (btn-doc-lang)"},
        # PGP-A1 (text), PGP-A2 (image), PGP-A3 (shape): full ctx menus shipped
        # (server main da10808cc) — every contract row rendered + wired to a
        # real command (browser rows execCommand, command rows wo-command).
        # Reserved rows route to live commands/panels (e.g. image→right rail).
        "text": {r: None for r in (
            "Cut", "Copy", "Paste", "PrintSelection", "PageBreakBefore",
            "KeepLines", "ParagraphSettings", "AddComment", "Link",
            "FormattingAsStyle", "AI")},
        "image": {r: None for r in (
            "Cut", "Copy", "Paste", "PrintSelection", "Arrange", "Align",
            "CombineShapes", "TextWrap", "Rotate", "InsertCaption",
            "SaveAsImage", "Link", "Crop", "ActualSize", "ReplaceImage",
            "ImageSettings", "AI")},
        "shape": {r: None for r in (
            "Cut", "Copy", "Paste", "PrintSelection", "Arrange", "Align",
            "CombineShapes", "TextWrap", "Rotate", "InsertCaption",
            "SaveAsImage", "Link", "EditPoints", "ShapeSettings", "AI")},
    }
    BROWSER_NATIVE = {"Cut", "Copy", "Paste", "Select", "Delete",
                      "PrintSelection", "SelectAll"}
    tabs = []
    for name in ("text", "misspelled", "table", "image", "shape"):
        v = ctx.get(name, [])
        rows = v["rows"] if isinstance(v, dict) else v
        evidence = REACT_CTX.get(name) or {}
        controls = []
        for r in rows:
            ev = evidence.get(r)
            if name in REACT_CTX and r in evidence and ev is None:
                status, reason = "done", None
            elif name == "misspelled" and r in evidence:
                status, reason = "diverged", f"react spellcheck menu {ev} (not rendered on this surface)"
            elif r in BROWSER_NATIVE:
                status = "diverged"
                reason = f"browser-native {r.lower()} handled globally; no react {name} ctx menu yet"
            else:
                status = "missing"
                reason = f"no react {name} right-click menu (PGP-A backlog)"
            controls.append({"label": r, "ooLabel": r,
                             "status": status, "reason": reason})
        counts = {"done": sum(1 for c in controls if c["status"] == "done"),
                  "diverged": sum(1 for c in controls if c["status"] == "diverged"),
                  "missing": sum(1 for c in controls if c["status"] == "missing"),
                  "iconOnly": 0, "total": len(controls)}
        tab = {"id": name, "label": name.title(), "contextual": False,
               "counts": counts, "controls": controls}
        if isinstance(v, dict) and v.get("live"):
            tab["live"] = v["live"]
        tabs.append(tab)
    return {"id": "ctx", "label": "Context Menus", "tabs": tabs,
            "note": "verified live via ctx-scenarios — " +
                    ctx.get("_meta", {}).get("source", "") +
                    "; v3.2: statuses now require react evidence "
                    "(table=PGP-1 + spellcheck; text=PGP-A1, image=PGP-A2, "
                    "shape=PGP-A3 — server main da10808cc)"}


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
    react_dlg = require(REACT_DLG_PATH)
    wo_dlg = require(WO_DLG_PATH)
    shortcuts = require(SHORTCUTS_PATH)
    src_dialogs = require(SRC_DIALOGS_PATH)["dialogs"]
    src_filemenu = require(SRC_FILEMENU_PATH)
    src_statusbar = require(SRC_STATUSBAR_PATH)
    src_ctx = require(SRC_CTX_PATH)
    src_ref = require(SRC_REF_PATH)
    src_shortcuts = require(SRC_SHORTCUTS_PATH)
    uni = react_label_universe(re_)

    # --- v3 union self-asserts: every source-manifest row MUST be a graph row ---
    assert_union("statusbar", set(src_statusbar.get("templateIds", [])),
                 set(STATUSBAR_SEMANTICS))
    assert_union("filemenu", set(src_filemenu.get("buttons", [])) | set(src_filemenu.get("panels", [])),
                 set(FILEMENU_LABELS) | set(PANEL_LABELS))
    assert_union("rightpanel", set(src_ref.get("rightPanel", [])),
                 set(RIGHTPANEL_SEMANTICS))
    src_tabs = set(src_ref.get("ribbonTabs", []))
    assert_union("ribbon.sourceTabs", src_tabs, set(oo.get("tabs", {})) | {"file"})

    def shortcuts_union() -> list:
        """Append a missing row for every oo-source action absent from the census
        (all 142 are present today — this stays loud if a capture regresses)."""
        have = {s.get("type") for s in shortcuts.get("shortcuts", [])}
        return [s for s in src_shortcuts.get("shortcuts", [])
                if s["name"] not in have]

    ribbon_tabs = [build_tab(k, t, uni, div)
                   for k, t in oo.get("tabs", {}).items() if k != "file"]
    shortcuts_surface, sc_check = build_shortcuts(shortcuts)
    for extra in shortcuts_union():  # honest gap if the source has MORE than the census
        shortcuts_surface["tabs"][0]["controls"].append(
            {"label": extra["name"], "ooLabel": extra["name"], "ooId": extra["name"],
             "status": "missing", "reason": "in oo-shortcuts.json but not the shortcut census"})
        t = shortcuts_surface["tabs"][0]
        t["counts"]["missing"] += 1
        t["counts"]["total"] += 1

    surfaces = [
        {"id": "ribbon", "label": "Ribbon", "tabs": ribbon_tabs,
         "sourceManifest": {"tabs": len(src_ref.get("ribbonTabs", [])),
                            "buttons": len(src_ref.get("ribbonButtons", [])),
                            "slotIds": len(src_ref.get("ribbonSlotIds", [])),
                            "sourceIds": len(src_ref.get("ribbonSourceIds", [])),
                            "shortcutActions": len(src_ref.get("ribbonShortcutActions", [])),
                            "note": "source templates (4 tabs) ⊆ runtime census (14 tabs "
                                    "incl. contextual) — runtime kept as baseline, counts "
                                    "noted; per-button source ids are chrome-level detail"}},
        build_filemenu(src_filemenu, re_),
        {"id": "statusbar", "label": "Status Bar",
         "tabs": [build_statusbar(oo, re_, src_statusbar)]},
        build_dialogs(src_dialogs, oo_dlg.get("dialogs", []),
                      wo_dlg.get("dialogs", []), react_dlg.get("dialogs", [])),
        build_rightpanel(src_ref, react_dlg.get("dialogs", [])),
        build_ctx(ctx),
        shortcuts_surface,
        build_ledger(ledger["features"]),
    ]
    ctx_surface = surfaces[5]
    ctx_surface["manifest"] = {"menus": src_ctx.get("menus", {}),
                               "totals": src_ctx.get("totals", {}),
                               "note": "oo-ctx-manifest counts source menuItem "
                                       "constructors (237) — counts only, no labels; "
                                       "controls below are the 75 live-verified "
                                       "ctx-contract rows (no controls invented)"}

    # --- post-build union self-asserts: every manifest row IS a graph row ---
    def emitted_oo_ids(surface: dict) -> set:
        return {c.get("ooId") for t in surface.get("tabs", []) for c in t["controls"]}

    assert_union("filemenu", set(src_filemenu.get("buttons", [])) | set(src_filemenu.get("panels", [])),
                 emitted_oo_ids(surfaces[1]))
    assert_union("statusbar", set(src_statusbar.get("templateIds", [])),
                 emitted_oo_ids(surfaces[2]))
    dlg_rows = [c for t in surfaces[3]["tabs"] for c in t["controls"]]
    # joined runtime titles surface as ooLabel on their source row's control
    dlg_keys = {c["ooId"] for c in dlg_rows} | {c["ooLabel"] for c in dlg_rows}
    assert_union("dialogs",
                 {d.get("id") or d["component"] for d in src_dialogs}
                 | {t for t in RUNTIME_TITLE_JOIN}
                 | {(d.get("dialog") or {}).get("title", "") for d in oo_dlg.get("dialogs", [])
                    if (d.get("dialog") or {}).get("title", "")},
                 dlg_keys)
    assert_union("rightpanel", set(src_ref.get("rightPanel", [])),
                 emitted_oo_ids(surfaces[4]))

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
            "reactDialogs": "census/census/census-react-dialogs.json",
            "woDialogs": "census/census/census-wo-dialogs.json",
            "shortcuts": "census/census/census-shortcuts.json",
            "ooBackstageLabels": "census/census/census-oo.json",
            "srcDialogs": "census/oo-source/oo-dialogs.json",
            "srcFilemenu": "census/oo-source/oo-filemenu.json",
            "srcStatusbar": "census/oo-source/oo-statusbar.json",
            "srcCtxManifest": "census/oo-source/oo-ctx-manifest.json",
            "srcReference": "census/oo-source/oo-reference.json",
            "srcShortcuts": "census/oo-source/oo-shortcuts.json",
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
    print("v3 union baselines (source manifest ∪ runtime census):")
    for sid, base in (("filemenu", f"{len(src_filemenu.get('buttons', []))} buttons + "
                       f"{len(src_filemenu.get('panels', []))} panels"),
                      ("statusbar", f"{len(src_statusbar.get('templateIds', []))} template ids"),
                      ("dialogs", f"{len(src_dialogs)} source dialogs ∪ runtime-only titles"),
                      ("rightpanel", f"{len(src_ref.get('rightPanel', []))} sections"),
                      ("shortcuts", f"{src_shortcuts.get('actions', 0)} source actions ⊆ census")):
        st = totals["surfaces"].get(sid, {})
        print(f"  {sid:11} baseline={base:42} "
              f"done={st.get('done', 0)} diverged={st.get('diverged', 0)} "
              f"missing={st.get('missing', 0)}")
    print("union self-asserts OK (every manifest row is a graph row)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
