#!/usr/bin/env python3
"""side-by-side-diff.py — score a side-by-side.cjs capture: OnlyOffice vs WO from the
SAME boot at the SAME width (the public compare page), all from the DOM.

Reads   <dir>/oo.json, wo.json, groups.json, styles.json   (default: newest census/side-by-side/<tag>/)
Writes  <dir>/report.md, <dir>/sheet-<tab>.png, <dir>/sheet-full.png   (ImageMagick; skipped loudly)
Prints  the findings.

What is measured (nothing is judged by eye):
  tab bar   label / order / width of every tab; tabs missing or extra; contextual tabs always shown
  layout    layout-diff.py's scorer (rows / groups / top-row placement) on OO's panel vs WO's ribbon page
  coverage  OO labels without a WO counterpart (bilingual de/en normalisation) and WO-only controls
  height    OO #toolbar vs the WO ribbon page bottom — the document starts that much lower
  styles    computed font / size / weight / colour / background of tab, tab bar, page, button
  locale    WO labels identical across two locales of the same width = not localised

Usage:
  /usr/bin/python3 census/side-by-side-diff.py [--dir census/side-by-side/<tag>] [--gate] [--min-coverage N]
  /usr/bin/python3 census/side-by-side-diff.py --self-test
Exit:   0 ok | 1 --gate failed (layout finding on any tab, or coverage < N) | 2 input problem
"""
import argparse
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("layout_diff", HERE / "layout-diff.py")
layout_diff = importlib.util.module_from_spec(spec)
spec.loader.exec_module(layout_diff)           # noqa: E402  — reuse the one scorer, never a copy
_norm, reduce_layout, score = layout_diff._norm, layout_diff.reduce_layout, layout_diff.score

# OO runs in German on the demo page; the WO ribbon is a de/en mix. Both sides go
# through this map to an English key, so "Fett (Ctrl+B)" and "Bold" compare equal.
DE_EN = {
    "fett": "bold", "kursiv": "italic", "unterstrichen": "underline", "durchgestrichen": "strikethrough",
    "hochgestellt": "superscript", "tiefgestellt": "subscript", "schriftart": "font", "schriftgrad": "fontsize",
    "schriftfarbe": "fontcolor", "texthervorhebungsfarbe": "highlightcolor", "formatierunglöschen": "clearstyle",
    "großkleinschreibungändern": "changecase", "aufzählung": "bullets", "nummerierung": "numbering",
    "listemitmehrerenebenen": "multilevellist", "einzugverkleinern": "decreaseindent", "einzugvergrößern": "increaseindent",
    "zeilenabstand": "linespacing", "textrichtung": "textdirection", "linksbündigausrichten": "alignleft",
    "zentriertausrichten": "aligncenter", "rechtsbündigausrichten": "alignright", "blocksatz": "justified",
    "ausschneiden": "cut", "kopieren": "copy", "einfügen": "paste", "rückgängig": "undo", "wiederholen": "redo",
    "suchen": "find", "ersetzen": "replace", "allesauswählen": "selectall", "seitenanpassen": "fittopage",
    "seitanpassen": "fittopage", "anbreiteanpassen": "fittowidth", "breiteanpassen": "fittowidth",
    "auf100zoomen": "zoomto100", "vergrößern": "zoomin", "verkleinern": "zoomout", "mehrereseiten": "multiplepages",
    "überschriften": "headings", "rechtschreibung": "spellchecking", "gitternetzlinien": "gridlines",
    "makroaufzeichnen": "recordmacro", "aufnahmepausieren": "pauserecording", "dunklesdokument": "darkdocument",
    "themaderbenutzeroberfläche": "interfacetheme", "oberflächenthema": "interfacetheme", "lineal": "ruler",
    "leereseite": "blankpage", "umbrüche": "breaks", "tabelle": "table", "kommentar": "comment", "link": "link",
    "textfeld": "textbox", "seitenzahl": "pagenumber", "feld": "field", "gleichung": "equation", "symbol": "symbol",
    "inhaltsverzeichnis": "tableofcontents", "fußnote": "footnote", "endnote": "endnote", "lesezeichen": "bookmark",
    "beschriftung": "caption", "querverweis": "crossreference", "abbildungsverzeichnis": "tableoffigures",
    "nachverfolgenvonänderungen": "trackchanges", "änderungennachverfolgen": "trackchanges", "annehmen": "accept",
    "ablehnen": "reject", "vorherige": "previous", "weiter": "next", "hinzufügen": "addcomment",
    "verschlüsseln": "encrypt", "dateischützen": "protectdocument", "auswählen": "select", "auswahl": "select",
    "radierer": "eraser", "zitat": "quote", "code": "code", "formatvorlagen": "styles",
    # insert / layout / references wordings that differ between the two
"formel": "equation", "kopfundfußzeile": "headerfooter", "headerfooter": "headerfooter", "textausdatei": "textfromfile", "textfromfile": "textfromfile",
"initialbuchstaben": "dropcap", "datumuhrzeit": "datetime", "datetime": "datetime", "inhaltssteuerelemente": "contentcontrols", "contentcontrols": "contentcontrols",
"texthinzufügen": "addtext", "aktualisierung": "updatetable", "updatetable": "updatetable", "aktualisieren": "update",
"orientierung": "orientation", "ausrichtung": "orientation", "trennen": "hyphenation", "hyphenation": "hyphenation", "umbruch": "wrapping", "wrapping": "wrapping",
"zeilennummern": "linenumbers", "linenumbers": "linenumbers", "eineebenenachvorne": "bringforward", "nachvorn": "bringforward",
"eineebenenachhinten": "sendbackward", "zurückstellen": "sendbackward", "gruppieren": "group", "wasserzeichen": "watermark", "farben": "colors",
"absatzhintergrundfarbe": "shading", "shading": "shading", "formatierungszeichen": "nonprintingcharacters", "nonprintingcharacters": "nonprintingcharacters",
"rahmen": "borders", "borders": "borders", "seitenzahl": "pagenumber", "pagenumber": "pagenumber", "neueformatvorlagen": "newstyle",
"hinzufügen": "addcomment", "kommentarhinzufügen": "addcomment", "addcomment": "addcomment", "lösen": "resolve", "resolve": "resolve", "entfernen": "remove", "löschen": "delete",
"zurvorherigenänderung": "previous", "zurnächstenänderung": "next", "anzeigemodus": "displaymode", "kombinieren": "combine", "serienbrief": "mailmerge",
"pluginverwaltung": "pluginmanager", "pluginmanager": "pluginmanager", "pluginsimhintergrund": "backgroundplugins", "fotoeditor": "photoeditor",
"übersetzer": "translator", "codehervorheben": "highlightcode", "rede": "speech", "spracheingabe": "speechinput", "einstellungen": "settings",
"zusammenfassen": "summarization", "summarization": "summarization", "kiassistenterstellen": "createaiassistant", "createaiassistant": "createaiassistant",
    "grammatikrechtschreibung": "grammarcheck", "grammarspelling": "grammarcheck", "akzeptieren": "accept", "alleakzeptieren": "acceptall", "alleablehnen": "rejectall",
    "ablehnen": "reject", "vergleichen": "compare", "compare": "compare", "modusgemeinsamebearbeitung": "coeditingmode", "coeditingmode": "coeditingmode",
    "kommentare": "addcomment", "löschen": "remove", "vorherige": "previous", "weiter": "next", "seiteanpassen": "fittopage", "chat": "chat", "chatbot": "chatbot",
    "einfügen": "paste", "paste": "paste", "erneutsenden": "resend",
    # the demo pins OnlyOffice to de: in en-US runs these German labels meet WO's English wording
    "incrementfontsize": "fontsizeup", "decrementfontsize": "fontsizedown", "suchen": "find", "bild": "image", "image": "image", "diagramm": "chart", "chart": "chart", "linie": "hr", "hr": "hr", "form": "shape", "shape": "shape",
    "shapes": "shapes", "formen": "shapes", "ausrichten": "align", "align": "align", "größe": "size", "size": "size", "ränder": "margins", "margins": "margins",
    "spalten": "columns", "columns": "columns", "seitenfarbe": "pagecolor", "pagecolor": "pagecolor", "formenzusammenführen": "mergeshapes", "mergeshapes": "mergeshapes",
    "design": "theme", "theme": "theme", "feld": "field", "field": "field", "datumunduhrzeit": "datetime", "seitenzahl": "pagenumber", "schließen": "close",
    "close": "close", "makros": "macros", "macros": "macros", "rechtschreibprüfung": "spellcheck", "spellcheck": "spellcheck",
    "rechtschreibung": "spellcheck", "linien": "lines", "zeichen": "symbols", "textfeld": "textbox", "textbox": "textbox", "textart": "wordart", "wordart": "wordart", "dunklesdokument": "darkdocument", "darkdocument": "darkdocument",
"sprache": "setdocumentlanguage", "dokumentsprache": "setdocumentlanguage", "seitenhintergrund": "pagebackground", "seiteneinrichten": "pagesetup",
"medien": "media", "objekte": "objects", "fußnoten": "footnotes", "index": "index", "nachverfolgung": "tracking", "änderungen": "changes",
}
EN_ALIAS = {  # WO wording that differs from OO's English
    "incrementfontsize": "fontsizeup", "schriftartvergrößern": "fontsizeup", "decrementfontsize": "fontsizedown",
    "schriftartverkleinern": "fontsizedown", "paralinespacing": "linespacing", "paragraphlinespacing": "linespacing",
    "zoomto100": "zoomto100", "spellchecking": "spellchecking", "spelling": "spellchecking",
    "multilevellist": "multilevellist", "wordcount": "wordcount", "selectall": "selectall",
}
# OO tab key → (German label, English label). Keep in step with TABS in side-by-side.cjs, which pairs by these labels.
TAB_EN = {
    "file": ("Datei", "File"), "home": ("Startseite", "Home"), "ins": ("Einfügen", "Insert"), "draw": ("Zeichnen", "Draw"),
    "layout": ("Layout", "Layout"), "links": ("Verweise", "References"), "review": ("Zusammenarbeit", "Collaboration"),
    "protect": ("Schutz", "Protection"), "view": ("Ansicht", "View"), "plugins": ("Plugins", "Plugins"), "ai": ("AI", "AI"),
    "charttab": ("Diagrammdesign", "Chart Design"),
}
WO_TAB_LABELS = {"home": ["Start", "Home"], "links": ["Referenzen", "References"], "review": ["Collaboration"]}  # WO wording besides TAB_EN


def tab_key(label: str) -> str:
    n = _norm(label)
    for key, (de, en) in TAB_EN.items():
        if n in {_norm(de), _norm(en), *(_norm(x) for x in WO_TAB_LABELS.get(key, []))}:
            return key
    return n


def canon(label: str) -> str:
    k = _norm(" ".join(label.split()))
    k = DE_EN.get(k, k)
    return EN_ALIAS.get(k, k)


def tabbar(oo, wo):
    """[(oo_label, wo_label, d_width)] by position + findings; OO labels are German (demo pins lang=de)."""
    oo_t, wo_t = oo["tabbar"], wo["tabbar"]
    rows, findings, used = [], [], set()
    for a in oo_t:  # pair by tab, not by position: a missing OO tab must not shift the whole table
        ka = tab_key(a["label"])
        b = next((t for t in wo_t if tab_key(t["label"]) == ka), None)
        rows.append((a["label"], b["label"] if b else "—", round(b["w"] - a["w"]) if b else ""))
        if b:
            used.add(id(b))
    rows += [("—", t["label"], "") for t in wo_t if id(t) not in used]
    oo_names = {_norm(t["label"]) for t in oo_t}
    wo_names = {_norm(t["label"]) for t in wo_t}
    oo_keys = [tab_key(t["label"]) for t in oo_t]
    wo_keys = [tab_key(t["label"]) for t in wo_t]
    missing = [k for k in oo_keys if k not in wo_keys]
    extra = [k for k in wo_keys if k not in oo_keys]
    name = lambda k: TAB_EN.get(k, (k, k))[1]  # noqa: E731
    if missing:
        findings.append("tabs missing in WO: " + ", ".join(name(k) for k in missing))
    if extra:
        findings.append("tabs WO always shows (OO hides until contextual): " + ", ".join(name(k) for k in extra))
    return rows, findings


AFFORDANCE = {"mehr", "more"}  # OO's overflow button is not a control


def coverage(oo_buttons, wo_buttons, oo_hidden=()):
    oo_c = {canon(b["label"]) for b in oo_buttons if _norm(b["label"])} | {canon(h) for h in oo_hidden if _norm(h)}
    wo_c = {canon(b["label"]) for b in wo_buttons if _norm(b["label"])}
    oo_c, wo_c = oo_c - AFFORDANCE, wo_c - AFFORDANCE
    missing = sorted(oo_c - wo_c)
    extra = sorted(wo_c - oo_c)
    pct = 100.0 * len(oo_c & wo_c) / len(oo_c) if oo_c else 100.0
    return pct, missing, extra


def height(groups, key):
    oo_toolbar, wo = groups["groups"][key]["oo"]["toolbar"], groups["groups"][key]["wo"]
    wo_bottom = (wo["panel"]["y"] + wo["panel"]["h"]) if wo.get("panel") else None
    return oo_toolbar["y"] + oo_toolbar["h"], wo_bottom


def styles(styles):
    out = []
    for part in ("tab", "tabInactive", "tabbar", "button"):
        a, b = styles["oo"].get(part), styles["wo"].get(part)
        if not a or not b:
            out.append((part, a, b, ["missing on one side"]))
            continue
        deltas = [f"{k}: {a[k]} → {b[k]}" for k in ("font", "size", "weight", "color", "bg", "h") if a.get(k) != b.get(k)]
        out.append((part, a, b, deltas))
    for k in ("toolbarBg", "tabbarBg", "panelBg"):
        a, b = styles["oo"].get(k), styles["wo"].get(k)
        if a is not None or b is not None:
            out.append((k, a, b, [] if a == b else [f"{a} → {b}"]))
    return out


def not_localised(dir_):
    """WO labels identical to the en-US capture of the same width are not localised."""
    if dir_.name.endswith("en-US"):
        return None, []
    other = dir_.parent / ("-".join(dir_.name.split("-")[:-2]) + "-en-US")  # <width>-<lang>-<REGION>
    if not (other / "wo.json").exists():
        return None, []
    a = json.loads((dir_ / "wo.json").read_text())
    b = json.loads((other / "wo.json").read_text())
    same = []
    for key, geo in a["geometry"].items():
        la = {x["label"] for x in geo["ribbon"]}
        lb = {x["label"] for x in b["geometry"].get(key, {}).get("ribbon", [])}
        same += sorted(la & lb)
    tabs = [t["label"] for t in a["tabbar"] if any(t["label"] == u["label"] for u in b["tabbar"])]
    return other.name, sorted(set(same) | set(tabs))


def analyse(dir_):
    oo = json.loads((dir_ / "oo.json").read_text())
    wo = json.loads((dir_ / "wo.json").read_text())
    groups = json.loads((dir_ / "groups.json").read_text())
    st = json.loads((dir_ / "styles.json").read_text()) if (dir_ / "styles.json").exists() else {"oo": {}, "wo": {}}
    if (oo["viewport"]["w"], oo["viewport"]["h"]) != (wo["viewport"]["width"], wo["viewport"]["height"]):
        raise SystemExit(f"side-by-side-diff: viewport mismatch OO {oo['viewport']} vs WO {wo['viewport']} — recapture (side-by-side.cjs forces both)")
    res = {"tag": dir_.name, "doc": oo["doc"], "locale": oo["locale"], "viewport": oo["viewport"], "tabs": {}, "gates": []}
    res["tabbar"], res["tabbar_findings"] = tabbar(oo, wo)
    for key, tab in oo["tabs"].items():
        geo = wo["geometry"].get(key)
        if not geo:
            res["tabs"][key] = {"wo_tab": None, "findings": ["no WO tab for this OO tab"]}
            continue
        oo_l, wo_l = reduce_layout(tab["buttons"]), reduce_layout(geo["ribbon"])
        ok, findings = score(oo_l, wo_l)
        pct, missing, extra = coverage(tab["buttons"], geo["ribbon"], tab.get("hiddenButtons", []))
        oo_bottom, wo_bottom = height(groups, key)
        if wo_bottom is not None and wo_bottom - oo_bottom > 6:
            findings = [f"height: WO ribbon ends at {wo_bottom}px, OO toolbar at {oo_bottom}px (+{wo_bottom - oo_bottom}px of document space)"] + findings
        res_height = (oo_bottom, wo_bottom)
        if groups["groups"][key]["oo"]["overflow"]:
            findings.append(f"OO collapses {len(tab.get('hiddenButtons', []))} control(s) behind \"Mehr\" at this width ({len(tab['buttons'])} visible); WO shows all {len(geo['ribbon'])} in {wo_l['rows']} row(s)")
        res["tabs"][key] = {"wo_tab": geo.get("label"), "ok": ok and not findings, "findings": findings, "coverage": pct,
                            "missing": missing, "extra": extra, "rows": (oo_l["rows"], wo_l["rows"]),
                            "groups": (len(groups["groups"][key]["oo"]["groups"]), len(groups["groups"][key]["wo"]["groups"])),
                            "buttons": (len(tab["buttons"]), len(geo["ribbon"])), "order": (oo_l["order"], wo_l["order"]), "height": res_height}
    res["styles"] = styles(st)
    res["locale_other"], res["not_localised"] = not_localised(dir_)
    return res


def fmt(v):
    return "—" if v is None else str(v)


def report(res, dir_):
    L = [f"# Side-by-side parity — `{res['tag']}`", "",
         f"OnlyOffice 9.4 (demo, lang de) vs WO editor, document **{res['doc']}**, both frames **{res['viewport']['w']}×{res['viewport']['h']}**, browser locale `{res['locale']}`. "
         "Measured from the DOM by `census/side-by-side.cjs`; scored by `layout-diff.py` + this script.", "",
         "## Tab bar", "", "| # | OnlyOffice tab | WO tab | Δ width (px) |", "|---|---|---|---|"]
    L += [f"| {i} | {a} | {b} | {d} |" for i, (a, b, d) in enumerate(res["tabbar"], 1)]
    L += [""] + [f"- {f}" for f in res["tabbar_findings"]] + [""]
    L += ["## Ribbon, tab by tab", "", "| OO tab | WO tab | buttons OO/WO | rows OO/WO | groups OO/WO | height OO→WO | coverage | verdict |", "|---|---|---|---|---|---|---|---|"]
    for key, t in res["tabs"].items():
        name = TAB_EN.get(key, (key, key))[1]
        if t.get("wo_tab") is None:
            L.append(f"| {name} | — | | | | | | **no WO tab** |")
            continue
        a, b = t["height"]
        h = f"{a}px" if b is None or b - a <= 6 else f"{a} → {b}px (+{b - a})"
        L.append(f"| {name} | {t['wo_tab']} | {t['buttons'][0]}/{t['buttons'][1]} | {t['rows'][0]}/{t['rows'][1]} | {t['groups'][0]}/{t['groups'][1]} | {h} | {t['coverage']:.0f}% | {'ok' if t['ok'] else '**FAIL**'} |")
    L.append("")
    for key, t in res["tabs"].items():
        if t.get("wo_tab") is None or t["ok"]:
            continue
        name = TAB_EN.get(key, (key, key))[1]
        L += [f"### {name}", ""] + [f"- {f}" for f in t["findings"]]
        if t["missing"]:
            L.append(f"- OO labels with no WO counterpart ({len(t['missing'])}): " + ", ".join(t["missing"][:40]) + (" …" if len(t["missing"]) > 40 else ""))
        if t["extra"]:
            L.append(f"- WO-only controls ({len(t['extra'])}): " + ", ".join(t["extra"][:40]) + (" …" if len(t["extra"]) > 40 else ""))
        L.append(f"- order OO: `{' '.join(sum(t['order'][0], []))[:400]}`")
        L.append(f"- order WO: `{' '.join(sum(t['order'][1], []))[:400]}`")
        L.append("")
    L += ["## Computed styles", "", "| part | property deltas OO → WO |", "|---|---|"]
    L += [f"| {part} | {'; '.join(d) or 'same'} |" for part, _a, _b, d in res["styles"]]
    if res["locale_other"]:
        L += ["", f"## Localisation (WO labels identical to the en-US capture `{res['locale_other']}`)", ""]
        L += [f"{len(res['not_localised'])} label(s) not translated in `{res['locale']}`: " + (", ".join(res["not_localised"]) if res["not_localised"] else "none") + "."]
    L += ["", "## Verdict", ""]
    fails = [TAB_EN.get(k, (k, k))[1] for k, t in res["tabs"].items() if not t.get("ok")]
    L.append(("Parity gate: **FAIL** on " + ", ".join(fails) + ".") if fails else "Parity gate: **PASS**.")
    L.append(f"Findings outside the tab ribbons: {len(res['tabbar_findings'])} (see Tab bar).")
    text = "\n".join(L) + "\n"
    (dir_ / "report.md").write_text(text)
    return text


def sheets(dir_, res):
    """OO over WO (+append when narrow, -append when wide) with a title strip each — for humans; the verdict is the report's."""
    tabs = [k for k in res["tabs"] if (dir_ / f"{k}-oo.png").exists() and (dir_ / f"{k}-wo.png").exists()] + ["full"]
    made = []
    for k in tabs:
        name = "whole frame, Home tab" if k == "full" else f"{TAB_EN.get(k, (k, k))[1]} tab"
        side = []
        for eng, title in (("oo", "OnlyOffice 9.4 — reference"), ("wo", "WO editor")):
            src = dir_ / f"{k}-{eng}.png"
            if not src.exists():
                break
            side.append(["(", str(src), "-bordercolor", "#9aa3ad", "-border", "2", "-background", "#123a7a", "-gravity", "North",
                         "-splice", "0x26", "-font", "DejaVu-Sans", "-pointsize", "15", "-fill", "white", "-annotate", "+0+4",
                         f"{title}  ·  {name}  ·  {res['tag']}  ·  {res['doc']}", ")"])
        else:
            w = subprocess.run(["magick", "identify", "-format", "%w", str(dir_ / f"{k}-oo.png")], capture_output=True, text=True).stdout
            joiner = "+append" if w.isdigit() and int(w) <= 900 else "-append"
            dst = dir_ / f"sheet-{k}.png"
            r = subprocess.run(["magick", *sum(side, []), joiner, str(dst)], capture_output=True, text=True)
            if r.returncode == 0:
                made.append(dst.name)
            else:
                print(f"side-by-side-diff: sheet {dst.name} failed: {r.stderr.strip()[:160]}", file=sys.stderr)
    return made


def self_test():
    """Offline: pairing, coverage normalisation, height finding, the scorer's own self-test."""
    layout_diff.self_test()
    assert canon("Fett (Ctrl+B)") == canon("Bold") == "bold"
    assert canon("Schriftart\nvergrößern\n(Ctrl+])") == canon("Increment font size") == "fontsizeup"
    assert canon("Datei\nschützen") == canon("Protect Document") == "protectdocument"
    pct, missing, extra = coverage([{"label": "Fett (Ctrl+B)"}, {"label": "Kursiv"}, {"label": "Unbekannt"}],
                                   [{"label": "Bold"}, {"label": "Italic"}, {"label": "Undo"}])
    assert round(pct, 1) == 66.7 and missing == ["unbekannt"] and extra == ["undo"], (pct, missing, extra)  # 2 of 3 OO labels matched
    oo = {"tabbar": [{"label": "Datei", "w": 54}, {"label": "Startseite", "w": 79}], "locale": "de-DE"}
    wo = {"tabbar": [{"label": "Start", "w": 48}, {"label": "Insert", "w": 54}, {"label": "Chart Design", "w": 103}]}
    rows, f = tabbar(oo, wo)
    assert rows[0][0] == "Datei" and any("missing in WO: File" in x for x in f), f
    assert any("always shows" in x and "Chart Design" in x for x in f) and not any("home" in x for x in f), f
    groups = {"groups": {"home": {"oo": {"toolbar": {"y": 0, "h": 116}}, "wo": {"panel": {"y": 36, "h": 84}}}}}
    assert height(groups, "home") == (116, 120)
    print("side-by-side-diff: self-test ok (normalisation / coverage / tab pairing / height / layout-diff)")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", help="capture dir (default: the newest census/side-by-side/<tag>/)")
    ap.add_argument("--gate", action="store_true", help="exit 1 on any layout finding or coverage below --min-coverage")
    ap.add_argument("--min-coverage", type=float, default=None, help="overall %% of OO labels with a WO counterpart (with --gate)")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    root = HERE / "side-by-side"
    dir_ = Path(a.dir).resolve() if a.dir else max((d for d in root.iterdir() if d.is_dir() and (d / "oo.json").exists()), key=lambda d: d.stat().st_mtime, default=None)
    if not dir_ or not (dir_ / "oo.json").exists() or not (dir_ / "wo.json").exists():
        print("side-by-side-diff: no capture — run `node census/side-by-side.cjs` first (or pass --dir)", file=sys.stderr)
        return 2
    res = analyse(dir_)
    text = report(res, dir_)
    print(text)
    made = sheets(dir_, res)
    print(f"sheets: {', '.join(made) if made else 'NONE (ImageMagick missing or failed)'}")
    if res["locale_other"]:
        print(f"not localised in {res['locale']} ({len(res['not_localised'])}): see Localisation section")
    if a.gate:
        bad = [k for k, t in res["tabs"].items() if not t.get("ok")] + (["tabbar"] if res["tabbar_findings"] else [])
        if a.min_coverage is not None:
            cov = [t["coverage"] for t in res["tabs"].values() if t.get("coverage") is not None]
            mean = sum(cov) / len(cov) if cov else 0.0
            if mean < a.min_coverage:
                bad.append(f"coverage {mean:.0f}% < {a.min_coverage:.0f}%")
        print("side-by-side-diff: GATE", "PASS" if not bad else "FAIL — " + ", ".join(bad), file=sys.stderr)
        return 0 if not bad else 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
