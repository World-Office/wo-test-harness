#!/usr/bin/env python3
"""census-diff.py — join census-oo.json against census-wo.json into the
parity ledger. Every OO control resolves to exactly one status:

  real       — WO implements it (token match via id/data-cmd)
  covered    — one WO control/behavior covers a cluster of OO controls
  stub       — loud documented stub (data-stub ref)
  deferred   — declared divergence, not permanently out of scope; a future
              iteration is where it gets fixed (reason tag records why).
  _global    — OO chrome repeated on every tab (zoom strip, statusbar)

Output: census/ledger.json + per-tab unmatched triage on stdout.
Run: /usr/bin/python3 census-diff.py
Path overrides: --oo FILE --wo FILE --ledger FILE (reconcile.py --check passes
a fresh --wo capture and a throwaway --ledger so committed files stay clean).
"""
import argparse, json, re, pathlib
from collections import Counter

HERE = pathlib.Path(__file__).parent
_ap = argparse.ArgumentParser(add_help=False)
_ap.add_argument("--oo", default=None)
_ap.add_argument("--wo", default=None)
_ap.add_argument("--ledger", default=None)
_args, _ = _ap.parse_known_args()
oo = json.load(open(_args.oo or (HERE / "census" / "census-oo.json")))
wo = json.load(open(_args.wo or (HERE / "census" / "census-wo.json")))
_LEDGER = _args.ledger or (HERE / "census" / "ledger.json")

# OO token -> WO data-cmd/id token synonyms (both sides normalized lower)
SYN = {
    "trackchanges": "track-changes",
    "table-ofcontents": "table-of-contents",
    "update-table": "update-toc",
    "insert-table-of-contents": "table-of-contents",
    "paragraph-line-spacing": "line-spacing",
    "text-direction": "ltr",
    "multilevel-list": "multilevels",
    "displaymode": "display-mode",
    "asc-gen476": "style-gallery",
    "align-left": "justifyleft", "align-center": "justifycenter",
    "align-right": "justifyright", "align-just": "justifyfull",
    "strikeout": "strikethrough", "decoffset": "outdent", "incoffset": "indent",
    "clearstyle": "removeformat", "numberedlist": "insertorderedlist",
    "line-spacing": "lineheight", "highlight": "hilitecolor", "color": "forecolor",
}

ICON_BLACKLIST = {"toolbar", "fixflex-hcenter", "fixflex-vcenter", "ic-review"}

def oo_token(c):
    """Identity: clean id -> label slug ("Track changes" -> track-changes)
    -> icon class token (unless it's a layout container class)."""
    cid = (c.get("id") or "").strip()
    if cid and " " not in cid:
        cid = re.sub(r"^(id-toolbar-(btn|combo|simple)-|tlbtn-)", "", cid)
        return re.sub(r"-\d+$", "", cid) or None
    label = (c.get("label") or "").strip()
    if label:
        slug = re.sub(r"\s*\(.*\)$", "", label)
        slug = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")
        if slug:
            return slug
    icon = (c.get("icon") or "").replace("btn-", "", 1)
    if icon and icon not in ICON_BLACKLIST:
        return icon
    return None

def wo_tokens():
    toks = {}
    pages = {**wo["tabs"], **{f"surface:{k}": v for k, v in wo["surfaces"].items()}}
    for slug, tab in pages.items():
        for b in tab.get("buttons", []):
            for tok in filter(None, [
                re.sub(r"^btn-", "", b["id"]) if b.get("id") else None,
                (b.get("cmd") or "").lower() or None,
            ]):
                toks.setdefault(tok.lower(), (slug, b))
        for c in tab.get("combos", []):
            if c.get("id"):
                toks.setdefault(re.sub(r"^(sel|cmb)-", "", c["id"]).lower(), (slug, c))
    return toks

WO_TOK = wo_tokens()
WO_STUBS = {b["stub"] for t in {**wo["tabs"], **wo["surfaces"]}.values() for b in t.get("buttons", []) if b.get("stub")}

# hand mapping for residue (filled as triage progresses): token -> directive
MAP = {
    "copystyle": {"covered": "native-clipboard"},
    "save": {"covered": "autosave-host"},
    "print": {"covered": "menu-file-print"},
    "copy": {"covered": "native-clipboard"},
    "cut": {"covered": "native-clipboard"},
    "paste": {"covered": "native-clipboard"},
    "select-all": {"covered": "native-ctrl-a"},
    "replace": {"covered": "find-panel"},
    "zoom-down": {"covered": "zoom-slider"},
    "zoom-up": {"covered": "zoom-slider"},
    "zoom-topage": {"covered": "zoom-slider"},
    "zoom-towidth": {"covered": "zoom-slider"},
    "status-btn-multiple-pages": {"deferred": "single-page-view"},
    "blankpage": {"deferred": "decorative-page-insert"},
    "inserthyperlink": {"real": "link"},   # AUTO by reconcile (was data-stub=insert.hyperlink)
    "addcomment": {"real": "collab:btn-comment"},
    "insertdatetime": {"real": "insert:btn-datetime"},
    "insertfield": {"deferred": "field-codes-unsupported"},
    "inserthyperlink-text": {"real": "link"},   # AUTO by reconcile (was data-stub=insert.hyperlink)
    "copy": {"covered": "native-clipboard"},
    "asc-gen987": {"covered": "zoom-slider"},
    "asc-gen989": {"covered": "zoom-slider"},
    "btn-zoom-down": {"covered": "zoom-slider"},
    "btn-zoom-topage": {"covered": "zoom-slider"},
    "btn-zoom-towidth": {"covered": "zoom-slider"},
    "btn-zoom-up": {"covered": "zoom-slider"},
    "btn-zoom-down-2": {"covered": "zoom-slider"},
    "track-changes": {"real": "collab:btn-track-changes"},
    "add-comment": {"real": "collab:btn-comment"},
    "word-count": {"covered": "statusbar-word-count"},
    "table-of-contents": {"real": "references:btn-toc"},
    "footnote": {"real": "references:btn-footnote"},
    "insert-footnote": {"real": "references:btn-footnote"},
    "insert-endnote": {"real": "references:btn-endnote"},
    "insert-image": {"real": "insert:btn-image"},
    "insert-table": {"real": "insert:btn-table"},
    "insert-shape": {"real": "insertobject"},
    "insert-chart": {"real": "insertobject"},
    "smart-art": {"deferred": "smartart-unsupported"},
    "text-art": {"real": "insertobject"},
    "drop-cap": {"real": "toggledropcap"},
    "text-from-file": {"deferred": "io-future-iteration"},
    "blank-page": {"deferred": "decorative-page-insert"},
    "content-controls": {"deferred": "content-controls-unsupported"},
    "header-footer": {"real": "insert:btn-header"},
    "edit-header-footer": {"real": "insert:btn-header"},
    "insert-header-footer": {"real": "insert:btn-header"},
    "page-number": {"real": "insert:btn-pagenumber"},
    "insert-page-number": {"real": "insert:btn-pagenumber"},
    "insert-date-time": {"real": "insert:btn-datetime"},
    "insert-field": {"deferred": "field-codes-unsupported"},
    "comment": {"real": "collab:btn-comment"},
    "mailmerge": {"deferred": "mailmerge-future-iteration"},
    "add-text": {"deferred": "text-marking-entry"},
    "update": {"real": "references:ref.update-toc"},
    "update-toc": {"real": "references:ref.update-toc"},
    "hyphenation": {"real": "togglehyphenation"},
    "line-numbering": {"real": "togglelinenumbers"},
    "watermark": {"real": "togglewatermark"},
    "page-margins": {"real": "layout:btn-page-setup"},
    "page-orient": {"real": "layout:btn-page-setup"},
    "page-orientation": {"real": "layout:btn-page-setup"},
    "page-size": {"real": "layout:btn-page-setup"},
    "page-color": {"deferred": "page-color-css-only"},
    "color-schemas": {"deferred": "theme-schemas-css-only"},
    "big-colorschemas": {"deferred": "theme-schemas-css-only"},
    "img-align": {"deferred": "float-layout-unsupported"},
    "img-wrap": {"deferred": "float-layout-unsupported"},
    "img-group": {"deferred": "canvas-grouping-unsupported"},
    "merge-shapes": {"deferred": "canvas-shapes-unsupported"},
    "menu-chart": {"real": "insertobject"},
    "chart-elements": {"real": "insertobject"},
    "big-chart-elements": {"real": "insertobject"},
    "allow-edit-ranges": {"deferred": "protection-range-granularity"},
    "multiple-pages": {"deferred": "single-page-view"},
    "day": {"covered": "system-date"},
    "nonprinting-characters": {"deferred": "no-format-marks-view"},
    "english-united-states": {"deferred": "spellcheck-language-future-iteration"},
    "language": {"deferred": "spellcheck-language-future-iteration"},
    "highlight-color": {"real": "home:highlight-color"},
    "font-color": {"real": "home:text-color"},
    "shading": {"real": "home:shading-color"},
    "borders": {"real": "openborders"},
    "paragraph": {"covered": "paragraph-dialog"},
    "change-case": {"real": "home:changecase"},
    "line-spacing": {"real": "home:sel-lh"},
    "ltr": {"covered": "directionrtl"},
    "rtl": {"covered": "directionrtl"},
    "set-markers": {"deferred": "no-format-marks-view"},
    "numbering": {"real": "home:insertorderedlist"},
    "bullets": {"real": "home:insertunorderedlist"},
    "multilevels": {"real": "multilevel"},
    "border-out": {"real": "openborders"},
    "decfont": {"real": "home:fontSizeDec"},
    "incfont": {"real": "home:fontSizeInc"},
    "insert-pagenum": {"real": "insert:btn-pagenumber"},
    "insert-hyperlink": {"real": "link"},   # AUTO by reconcile (was data-stub=insert.hyperlink)
    "big-inserthyperlink": {"real": "link"},   # AUTO by reconcile (was data-stub=insert.hyperlink)
    "hyperlink": {"real": "link"},   # AUTO by reconcile (was data-stub=insert.hyperlink)
    # ── residue triage round 1 ──
    "addcomment": {"covered": "collab:btn-comment"},
    "accept": {"covered": "collab:btn-review-changes"},
    "reject": {"covered": "collab:btn-review-changes"},
    "resolve": {"covered": "comments:panel"},
    "delete": {"covered": "comments:panel"},
    "combine": {"real": "compareversion"},
    "compare": {"real": "compareversion"},
    "display-mode": {"real": "displaymode"},
    "breaks": {"covered": "insert:btn-page-break+btn-section-break"},
    "equation": {"deferred": "equation-unsupported"},
    "textbox": {"real": "insertobject"},
    "chart": {"real": "insertobject"},
    "chart-type": {"deferred": "chart-editing-unsupported"},
    "chartelements": {"deferred": "chart-editing-unsupported"},
    "editdata": {"deferred": "chart-editing-unsupported"},
    "wrapping": {"deferred": "float-layout-unsupported"},
    "align": {"deferred": "float-layout-unsupported"},
    "bringforward": {"deferred": "float-layout-unsupported"},
    "sendbackward": {"deferred": "float-layout-unsupported"},
    "group": {"deferred": "canvas-grouping-unsupported"},
    "colors": {"deferred": "theme-schemas-css-only"},
    "linenumbers": {"real": "togglelinenumbers"},
    "margins": {"real": "layout:btn-page-setup"},
    "orientation": {"real": "layout:btn-page-setup"},
    "size": {"real": "layout:btn-page-setup"},
    "ocr": {"deferred": "external-service-future-iteration"},
    "photoeditor": {"deferred": "external-service-future-iteration"},
    "speech": {"deferred": "tts-future-iteration"},
    "speechinput": {"deferred": "stt-future-iteration"},
    "backgroundplugins": {"deferred": "background-plugins-future-iteration"},
    "grammar-spelling": {"real": "ai-grammar"},
    "translation": {"real": "aitranslate"},
    "interfacetheme": {"covered": "view:btn-view-theme"},
    "insertdatetime": {"covered": "hf:btn-hf-datetime"},
    "asc-gen673": {"real": "togglesameasprev"},
    "asc-gen668": {"deferred": "no-canvas-layer"},
    "asc-gen670": {"deferred": "no-canvas-layer"},
    "asc-gen541": {"deferred": "host-layer-permissions"},
    "asc-gen546": {"deferred": "host-layer-permissions"},
    "asc-gen4608": {"real": "ai-assistant"},
    "asc-gen4610": {"real": "ai-assistant"},
    "asc-gen4612": {"real": "ai-assistant"},
    "asc-gen4628": {"real": "ai-assistant"},
    "asc-gen4556": {"covered": "plugins:plugins.browse"},
    "asc-gen4572": {"covered": "plugins:plugins.browse"},
    "asc-gen4582": {"covered": "plugins:plugins.browse"},
    "asc-gen4584": {"covered": "plugins:plugins.browse"},
    "asc-gen4586": {"covered": "plugins:plugins.browse"},
    "asc-gen4588": {"covered": "plugins:plugins.browse"},
    "asc-gen4590": {"covered": "plugins:plugins.browse"},
    "asc-gen885": {"real": "insertcaption"},
    # F-089-style decision (2026-09-11): bibliography citation is a field, like
    # ref.index (asc-gen889) — needs the field engine -> future iteration. The
    # WO citation button stays a loud data-stub until then; OO side resolves deferred.
    "asc-gen887": {"deferred": "field-engine-future-iteration"},
    "asc-gen889": {"deferred": "field-engine-deferred"},
    "asc-gen891": {"real": "opencrossref"},
    "asc-gen893": {"covered": "references:ref.update-toc"},
    "asc-gen896": {"covered": "view:view-mode-stubs"},
    "asc-gen920": {"covered": "view:view-mode-stubs"},
    "asc-gen922": {"covered": "view:view-mode-stubs"},
    "asc-gen926": {"covered": "view:view-mode-stubs"},
    "asc-gen933": {"covered": "view:view-mode-stubs"},
    "asc-gen935": {"covered": "view:view-mode-stubs"},
    "asc-gen937": {"covered": "view:view-mode-stubs"},
    "asc-gen939": {"covered": "view:view-mode-stubs"},
    "asc-gen941": {"covered": "view:view-mode-stubs"},
    "asc-gen830": {"deferred": "chart-editing-unsupported"},
    "asc-gen842": {"deferred": "chart-editing-unsupported"},
    "asc-gen844": {"deferred": "chart-editing-unsupported"},
    "asc-gen856": {"deferred": "chart-editing-unsupported"},
    "asc-gen865": {"deferred": "chart-editing-unsupported"},
    "asc-gen509": {"covered": "collab:presence"},
    "asc-gen511": {"covered": "collab:presence"},
    "asc-gen525": {"covered": "collab:presence"},
    "asc-gen476": {"covered": "home:style-gallery"},
    "addcomment-0": {"covered": "collab:btn-comment"},
    "addcomment-1": {"covered": "collab:btn-comment"},
    "displaymode": {"real": "displaymode"},
    "multilevel-list": {"real": "multilevel"},
    "text-direction": {"covered": "home:directionRtl"},
    "style-gallery": {"covered": "home:style-gallery"},
    "footnote": {"real": "references:btn-footnote"},
    "table-ofcontents": {"real": "references:btn-toc"},
    "update-table": {"real": "updatetoc"},
    "mergeshapes": {"deferred": "canvas-shapes-unsupported"},
    "pagecolor": {"deferred": "page-color-css-only"},
    "shape": {"real": "insertobject"},
    "dropcap": {"real": "toggledropcap"},
    "textart": {"real": "insertobject"},
    "smartart": {"deferred": "smartart-unsupported"},
    "contentcontrols": {"deferred": "content-controls-unsupported"},
    "text-fromfile": {"deferred": "io-future-iteration"},
    "insertfield": {"deferred": "field-codes-unsupported"},
}

ledger = []
seen_global = set()
for slug, tab in oo["tabs"].items():
    for kind in ("buttons", "combos"):
        for c in tab.get(kind, []):
            tok = oo_token(c)
            row = {"tab": slug, "kind": kind[:-1], "id": c.get("id"), "icon": c.get("icon"),
                   "label": c.get("label"), "enabled": c.get("enabled", True), "token": tok}
            if tok in ("asc-gen987", "asc-gen989", "btn-zoom-down", "btn-zoom-topage",
                       "btn-zoom-towidth", "btn-zoom-up", "copystyle",
                       "status-btn-multiple-pages", "zoom-down", "zoom-up",
                       "zoom-topage", "zoom-towidth"):
                base = tok.replace("btn-", "") if tok.startswith("btn-zoom") else tok
                if base in seen_global:
                    ledger.append({**row, "status": "global-repeat"}); continue
                seen_global.add(base)
                row["tab"] = "_global"
            if not tok:
                row["status"] = "deferred"; row["reason"] = "no-identity-decoration"
                ledger.append(row); continue
            m = MAP.get(tok)
            if m:
                key = next(iter(m))
                val = m[key]
                if key == "real":
                    # honesty guard: claimed WO control must exist in census-wo
                    wt = val.split(":", 1)[1] if ":" in val else val
                    wt = re.sub(r"^(btn-|sel-|cmb-)", "", wt).lower()
                    hitw = WO_TOK.get(wt)
                    if not hitw:
                        row["status"] = "UNMATCHED"; row["note"] = f"MAP real target missing in WO census: {val}"
                        ledger.append(row); continue
                    row["status"] = "real"; row["wo"] = hitw[1].get("id") or hitw[1].get("cmd") or hitw[0]; row["wo_tab"] = hitw[0]
                    ledger.append(row); continue
                row["status"] = {"covered": "covered", "stub": "stub", "deferred": "deferred"}[key]
                row[key] = val
                if key == "stub" and val not in WO_STUBS:
                    row["status"] = "MISSING-STUB"  # ledger demands a stub WO does not ship yet
                ledger.append(row); continue
            hit = WO_TOK.get(tok) or WO_TOK.get(SYN.get(tok, ""))
            if hit:
                row["status"] = "real"; row["wo"] = hit[1].get("id") or hit[1].get("cmd") or hit[0]; row["wo_tab"] = hit[0]
                if hit[1].get("stub"): row["status"] = "stub"; row["ref"] = hit[1]["stub"]
                ledger.append(row); continue
            row["status"] = "UNMATCHED"; ledger.append(row)

counts = Counter(r["status"] for r in ledger)
json.dump({"ledger": ledger, "counts": dict(counts)}, open(_LEDGER, "w"), indent=1)
print("LEDGER:", json.dumps(dict(counts)))
missing = sorted(str(r.get("ref") or r.get("token")) for r in ledger if r["status"] == "MISSING-STUB")
if missing: print("MISSING STUBS IN WO:", ", ".join(missing))
un = [r for r in ledger if r["status"] == "UNMATCHED"]
by_tab = {}
for r in un: by_tab.setdefault(r["tab"], []).append(r.get("token") or r.get("icon") or r.get("id"))
for t, toks in sorted(by_tab.items()):
    print(f"\n== {t} ({len(toks)}) ==")
    print("  " + ", ".join(sorted(toks)))

