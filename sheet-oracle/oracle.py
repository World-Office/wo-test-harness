#!/usr/bin/python3
"""sheet-oracle — differential spreadsheet formula conformance.

  oracle.py capture            # run cases through LibreOffice -> truth.json
  oracle.py score <engine.json> [--update-baseline]  # score an engine's results vs truth.json
  oracle.py cases              # dump cases.json for an engine to consume

Engine contract (what the Rust side implements): read cases.json
  [{"id","formula","cells":{"A1":1,...}}]  and write
  {"<id>": <number|string|bool|"#ERR">} to engine.json. Formula cell is
  always Z1; input cells live on the same sheet.

Truth is LibreOffice Calc, a proxy for OnlyOffice semantics; ids where the two
are known to differ go in divergences.json (loud, with justification).
"""
from __future__ import annotations
import csv, io, json, os, re, subprocess, sys, tempfile, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ERRS = {"#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#N/A", "#NULL!"}


def load_cases():
    import yaml
    return yaml.safe_load((HERE / "cases.yaml").read_text(encoding="utf-8"))["cases"]


def _col(ref):
    m = re.match(r"([A-Z]+)(\d+)$", ref)
    return m.group(1), int(m.group(2))


def make_xlsx(path: Path, case) -> None:
    cells = dict(case.get("cells") or {})
    rows: dict[int, list[str]] = {}
    def put(ref, xml):
        c, r = _col(ref); rows.setdefault(r, []).append((c, xml))
    for ref, v in cells.items():
        if isinstance(v, str):
            xml = f'<c r="{ref}" t="inlineStr"><is><t>{v}</t></is></c>'
        else:
            xml = f'<c r="{ref}"><v>{v}</v></c>'
        put(ref, xml)
    f = case["formula"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    put("Z1", f'<c r="Z1"><f>{f}</f></c>')
    body = "".join(
        f'<row r="{r}">' + "".join(x for _, x in sorted(cs, key=lambda t: (len(t[0]), t[0]))) + "</row>"
        for r, cs in sorted(rows.items()))
    files = {
        "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": f'<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{body}</sheetData></worksheet>',
    }
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for k, v in files.items():
            z.writestr(k, v)


def normalize(raw: str):
    if raw in ERRS or raw.startswith("Err:"):
        return "#ERR"
    if raw in ("TRUE", "FALSE"):
        return raw == "TRUE"
    try:
        return float(raw.replace(",", "")) if re.fullmatch(r"-?[\d,]*\.?\d+(E[+-]?\d+)?", raw) and "," not in raw else raw
    except ValueError:
        return raw


def capture() -> dict:
    cases = load_cases()
    out = {}
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        for c in cases:
            make_xlsx(td / f"{c['id']}.xlsx", c)
        # one soffice invocation for all cases; CSV keeps the *formatted* value,
        # so we ask for the raw-value filter options: sep ',', quote '"', utf8,
        # "save cell contents as shown"=false (token 8).
        subprocess.run(
            ["soffice", f"-env:UserInstallation=file://{td}/profile", "--headless", "--convert-to",
             "csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,false,false,false,false,-1",
             "--outdir", str(td / "out"), *map(str, sorted(td.glob("*.xlsx")))],
            check=True, capture_output=True, timeout=600,
            env={**os.environ, "LC_ALL": "en_US.UTF-8", "LANG": "en_US.UTF-8", "LANGUAGE": "en_US"})
        for c in cases:
            # -1 sheet token writes <name>-Sheet1.csv
            f = td / "out" / f"{c['id']}-Sheet1.csv"
            row = next(csv.reader(io.StringIO(f.read_text(encoding="utf-8"))))
            out[c["id"]] = normalize(row[25] if len(row) > 25 else "")
    return out


def equal(a, b, tol=1e-9):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool):
        return abs(a - b) <= tol * max(1.0, abs(a), abs(b))
    return a == b


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "capture":
        t = capture()
        (HERE / "truth.json").write_text(json.dumps(t, indent=1, sort_keys=True), encoding="utf-8")
        print(f"captured {len(t)} truths"); return 0
    if cmd == "cases":
        (HERE / "cases.json").write_text(json.dumps(load_cases(), indent=1), encoding="utf-8")
        print("wrote cases.json"); return 0
    if cmd == "score" and len(sys.argv) > 2:
        truth = json.loads((HERE / "truth.json").read_text(encoding="utf-8"))
        eng = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
        div = {}
        if (HERE / "divergences.json").exists():
            div = json.loads((HERE / "divergences.json").read_text(encoding="utf-8"))
        bad = []
        for cid, t in truth.items():
            if cid in div: continue
            if cid not in eng: bad.append((cid, t, "<missing>")); continue
            if not equal(t, eng[cid]): bad.append((cid, t, eng[cid]))
        n = len(truth) - len(div)
        passing = sorted(c for c in truth if c not in div and c in eng and equal(truth[c], eng[c]))
        # ratchet: anything in baseline.json that passed before must still pass
        bpath = HERE / "baseline.json"
        if "--update-baseline" in sys.argv:
            bpath.write_text(json.dumps(passing, indent=1), encoding="utf-8")
            print(f"baseline updated: {len(passing)} passing")
        elif bpath.exists():
            regress = [c for c in json.loads(bpath.read_text(encoding="utf-8")) if c not in passing]
            if regress:
                print("REGRESSION vs baseline:", regress); return 1
        print(f"sheet-oracle: {n - len(bad)}/{n} match ({len(div)} declared divergences)")
        for b in bad: print("  FAIL %s truth=%r engine=%r" % b)
        return 1 if bad else 0
    print(__doc__); return 2


if __name__ == "__main__":
    sys.exit(main())
