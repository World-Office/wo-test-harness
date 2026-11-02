#!/usr/bin/python3
"""
ledger/dialog-parity.py — L4 FIDELITY probe #1: dialog FIELD parity.

L1 says the dialog opens. This probe asks the fidelity question the ladder
reserves for L4: does the WO dialog carry the OO dialog's FIELD contract?
For every ledger dialog row whose WO match resolves to a censused WO dialog,
join the OO dialog census fields (reference) against the WO dialog census
fields (measured) — pairing and fields both come from the committed census
artifacts; nothing is re-derived here.

  pass (parity=true) = every OO field resolves to a WO field with a
  compatible control kind. Extra WO fields are allowed — the port contract
  is "no OO field missing" (build.py: "a WO dialog that misses fields is
  not parity even if it opens").

Matching ladder per field: declared alias -> normalized exact label ->
containment (>=4 chars). Kind families: bool must meet bool; text/number/
choice are mutually compatible (the OO census captures OO's real dropdowns
as input/text, WO renders selects).

Usage: /usr/bin/python3 ledger/dialog-parity.py   (from the census dir)
Reads : census/census-oo-dialogs.json, census/census-wo-dialogs.json,
        ledger/ledger.json (the audited OO->WO pairing)
Writes: ledger/dialog-parity.json (merged by ledger/build.py as L4)
"""
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
CEN = HERE.parent / "census"

# ---------------------------------------------------------------- normalize
def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = s.lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

# Declared OO->WO label equivalences (auditable; keep alphabetical by OO).
FIELD_ALIASES = {
    "number of columns": "columns",
}

def kind(f: dict) -> str:
    tag = (f.get("tag") or "").lower()
    typ = (f.get("type") or "").lower()
    if tag == "select" or "select" in typ or "combo" in typ:
        return "choice"
    if typ in ("checkbox", "radio"):
        return "bool"
    if typ in ("number", "spinner") or "spin" in typ:
        return "number"
    if tag in ("input", "textarea") or typ in ("text", ""):
        return "text"
    return "other"

TEXTLIKE = {"text", "number", "choice"}

def compatible(a: str, b: str) -> bool:
    if a == "other" or b == "other":
        return True  # unknown capture kind — label match carries the proof
    return a == b or (a in TEXTLIKE and b in TEXTLIKE)

def match_field(oo_f: dict, wo_fields: list, used: set):
    """Best unused WO field for one OO field: alias -> exact -> containment."""
    n = norm(oo_f.get("label", ""))
    if not n:
        return None
    want = norm(FIELD_ALIASES.get(n, n))
    cands = []
    for i, wf in enumerate(wo_fields):
        if i in used:
            continue
        wn = norm(wf.get("label", ""))
        if not wn:
            continue
        if wn == want:
            cands.insert(0, i)  # exact first
        elif len(want) >= 4 and len(wn) >= 4 and (want in wn or wn in want):
            cands.append(i)
    for i in cands:
        if compatible(kind(oo_f), kind(wo_fields[i])):
            return i
    return None

# ---------------------------------------------------------------- main
ledger = json.load(open(HERE / "ledger.json"))
oo_dlg = json.load(open(CEN / "census-oo-dialogs.json"))
wo_dlg = json.load(open(CEN / "census-wo-dialogs.json"))
wo_by_id = {d["id"]: d for d in wo_dlg.get("dialogs", [])}

# OO reference fields by dialog title (ledger oo[0].label == census title)
oo_by_title = {}
for e in oo_dlg.get("dialogs", []):
    d = e["dialog"]
    title = d.get("title") or e["trigger"].get("via") or e["trigger"].get("label")
    if title and title not in oo_by_title:
        oo_by_title[title] = d

rows = []
parity_n = 0
for row in ledger.get("features", []):
    if row.get("kind") != "dialog" or not row.get("wo"):
        continue
    wid = row["wo"].get("match", "")
    w = wo_by_id.get(wid)
    if w is None:
        continue  # WO match is not a censused dialog (command/label surface)
    oo_ref = None
    for o in row.get("oo", []):
        if o.get("surface", "").startswith("dialog:") and o.get("label") in oo_by_title:
            oo_ref = oo_by_title[o["label"]]
            break
    if oo_ref is None:
        continue
    oo_fields = [f for f in oo_ref.get("fields", []) if norm(f.get("label", ""))]
    wo_fields = w.get("fields", [])
    used, mapping, missing = set(), {}, []
    for f in oo_fields:
        i = match_field(f, wo_fields, used)
        if i is None:
            missing.append(f.get("label", "?"))
        else:
            used.add(i)
            mapping[f.get("label", "?")] = wo_fields[i].get("label", "?")
    total = len(oo_fields)
    covered = total - len(missing)
    parity = total > 0 and not missing
    if parity:
        parity_n += 1
    rows.append({
        "feature": row["feature"],
        "oo_title": oo_ref.get("title"),
        "wo_dialog": wid,
        "covered": covered, "total": total,
        "missing": missing,
        "extra_wo": [f.get("label") for i, f in enumerate(wo_fields)
                     if i not in used and f.get("label")],
        "mapping": mapping,
        "buttons": {"oo": oo_ref.get("buttons", []), "wo": w.get("buttons", [])},
        "parity": parity,
    })

rows.sort(key=lambda r: (not r["parity"], -r["total"], r["feature"]))
out = {
    "version": 1,
    "generated": datetime.now().isoformat(),
    "source": {"oo": "census/census-oo-dialogs.json",
               "wo": "census/census/census-wo-dialogs.json",
               "pairing": "ledger/ledger.json dialog rows (audited join)"},
    "summary": {"probed": len(rows), "parity": parity_n},
    "dialogs": rows,
}
(HERE / "dialog-parity.json").write_text(
    json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")

print(f"dialog-parity: {parity_n}/{len(rows)} dialogs at full field parity")
for r in rows:
    flag = "OK " if r["parity"] else "GAP"
    print(f"  {flag} {r['feature']:40} {r['covered']}/{r['total']} "
          f"oo={r['oo_title']!r} wo={r['wo_dialog']}"
          + (f" missing={r['missing']}" if r["missing"] else ""))
print("wrote", HERE / "dialog-parity.json")
