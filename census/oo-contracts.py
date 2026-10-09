#!/usr/bin/env python3
"""oo-contracts — truth probes for the OO-core-derived contracts (F-2xx/3xx/4xx/5xx).

Spec layer   harness-graph/features.yaml (rows appended 2026-10-09, IDs stable)
OpenSpec     server change `derive-oo-core-contracts` tasks 1.1-1.5
This script  MEASURES where WO stands today against the OO C++ core contracts
             (detection matrix, PDF header, xlsx part model, pptx model, units).
             Every case prints OBSERVED truth; PASS/DIVERGE verdicts are the
             input for features.yaml parity flips — this run never edits code.

Usage: /usr/bin/python3 oo-contracts.py [base_url]
"""
from __future__ import annotations
import base64
import io
import json
import re
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

BASE = sys.argv[1] if len(sys.argv) > 1 else None
SERVER = Path("/home/weiss/git/World-Office/server")

# ── fixtures ──────────────────────────────────────────────────────────────────
CT_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
CT_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
CT_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"


def zipped(parts: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in parts.items():
            z.writestr(name, data)
    return buf.getvalue()


def fixture_docx() -> bytes:
    return zipped({
        "[Content_Types].xml": f'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="{CT_DOCX}"/></Types>',
        "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        "word/document.xml": '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello WO contracts</w:t></w:r></w:p></w:body></w:document>',
    })


def fixture_xlsx() -> bytes:
    sheet1 = ('<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
              '<sheetData>'
              '<row r="1"><c r="A1"><v>2</v></c><c r="B1"><f>A1*2</f><v>4</v></c><c r="C1" t="s"><v>0</v></c></row>'
              '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>1</v></c></row>'
              '</sheetData></worksheet>')
    sheet2 = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>'
    return zipped({
        "[Content_Types].xml": f'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="{CT_XLSX}"/></Types>',
        "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="One" sheetId="1" r:id="rId1"/><sheet name="Two" sheetId="2" r:id="rId2"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": sheet1,
        "xl/worksheets/sheet2.xml": sheet2,
        "xl/sharedStrings.xml": '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="2"><si><t>Alpha</t></si><si><t>Beta</t></si></sst>',
    })


def fixture_pptx() -> bytes:
    s = ('<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
         '<p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/><p:sp><p:txBody><a:p><a:r><a:t>SLIDETEXT-{}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>')
    return zipped({
        "[Content_Types].xml": f'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="{CT_PPTX}"/></Types>',
        "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>',
        "ppt/presentation.xml": '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>',
        "ppt/_rels/presentation.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>',
        "ppt/slides/slide1.xml": s.replace("<p:sld ", '<p:sld data-slide="1" ', 1).format(1),
        "ppt/slides/slide2.xml": s.replace("<p:sld ", '<p:sld data-slide="2" ', 1).format(2),
    })


FIXTURE_PDF = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n9\n%%EOF\n"

WORD2003_XML = ('<?xml version="1.0"?><w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">'
                '<?mso-application progid="Word.Document"?><w:body><w:p><w:r><w:t>flat2003</w:t></w:r></w:p></w:body></w:wordDocument>').encode()

# ── harness ───────────────────────────────────────────────────────────────────
def http_post(url: str, payload: dict) -> tuple[int, dict | str]:
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")


def convert(base: str, src: str, dst: str, data: bytes) -> dict:
    code, body = http_post(f"{base}/api/conversion/convert", {
        "source_format": src, "target_format": dst, "data": base64.b64encode(data).decode()})
    if code != 200:
        return {"status": f"HTTP{code}", "error": str(body)[:200]}
    return body


def unzip(data: bytes) -> dict[str, str]:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            return {n: z.read(n).decode("utf-8", errors="replace") for n in z.namelist()}
    except zipfile.BadZipFile:
        return {"<not-a-zip>": data[:120].decode("utf-8", errors="replace")}


RESULTS: list[tuple[str, str, str]] = []  # (case, verdict, detail)

def record(case: str, verdict: str, detail: str):
    RESULTS.append((case, verdict, detail))
    print(f"[{verdict:7s}] {case:28s} {detail}")


def main() -> int:
    global BASE
    if not BASE:
        sys.path.insert(0, str(Path(__file__).parent))
        import reconcile as re_
        server = re_.resolve_server()
        td = Path(tempfile.mkdtemp(prefix="oo-contracts-"))
        BASE, _procs = re_.spawn_docserver(server, td, "rust")
        print(f"# spawned docserver {BASE}")
    else:
        BASE = BASE.rstrip("/")

    docx, xlsx, pptx = fixture_docx(), fixture_xlsx(), fixture_pptx()

    # ── F-400 detection: clean labeled inputs parse ───────────────────────────
    r = convert(BASE, "docx", "txt", docx)
    record("F-400 docx->txt", "PASS" if (r.get("status") == "Success" and "Hello WO contracts" in base64.b64decode(r.get("data") or "").decode("utf-8", "replace")) else "DIVERGE", f"status={r.get('status')} err={str(r.get('error'))[:80]}")

    # ── F-400 mislabel: pptx bytes declared as docx — sniff, loud-fail, or silent-wrong? ──
    r = convert(BASE, "docx", "txt", pptx)
    txt = base64.b64decode(r.get("data") or "").decode("utf-8", "replace") if r.get("status") == "Success" else ""
    if "SLIDETEXT" in txt:
        record("F-400 mislabeled pptx-as-docx", "PASS", "content sniffed + redirected (OO parity)")
    elif r.get("status") == "Success":
        record("F-400 mislabeled pptx-as-docx", "DIVERGE", "SILENT empty Success — trusts the declared label, neither sniffs nor fails loudly (OO sniffs [Content_Types])")
    elif r.get("status") == "UnsupportedFormat" and "pptx" in (r.get("error") or ""):
        record("F-400 mislabeled pptx-as-docx", "PASS", "loud mismatch naming detected family: " + str(r.get('error'))[:90])
    else:
        record("F-400 mislabeled pptx-as-docx", "DIVERGE", f"{r.get('status')} without naming detected family; err={str(r.get('error'))[:60]}")

    # ── F-401 Word2003 XML fallback ───────────────────────────────────────────
    r = convert(BASE, "xml", "docx", WORD2003_XML)
    record("F-401 word2003-xml->docx", "DIVERGE" if r.get("status") != "Success" else "PASS",
           f"status={r.get('status')} (no 'xml' member in taxonomy; OO progid-sniffs) err={str(r.get('error'))[:60]}")

    # ── F-402 loud unsupported ────────────────────────────────────────────────
    r = convert(BASE, "docx", "xlsb", docx)
    loud = r.get("status") == "UnsupportedFormat" and "xlsb" in (r.get("error") or "")
    record("F-402 docx->xlsb loudness", "PASS" if loud else "DIVERGE",
           f"status={r.get('status')} error={str(r.get('error'))[:80]}")

    # ── F-403 PDF: direct docx->pdf + pdf roundtrip header ────────────────────
    r = convert(BASE, "docx", "pdf", docx)
    record("F-403 docx->pdf pair", "PASS" if r.get("status") == "Success" else "DIVERGE",
           f"status={r.get('status')} (OO core ships DocxRenderer; WO matrix has no docx->pdf) err={str(r.get('error'))[:60]}")
    r = convert(BASE, "pdf", "wo-pdf-document", FIXTURE_PDF)
    hdr = ""
    if r.get("status") == "Success":
        r2 = convert(BASE, "wo-pdf-document", "pdf", base64.b64decode(r["data"]))
        if r2.get("status") == "Success":
            hdr = base64.b64decode(r2["data"])[:9].decode("latin1", "replace")
    record("F-403 pdf roundtrip header", "PASS" if hdr.startswith("%PDF-1.7") else "DIVERGE",
           f"header={hdr!r} (OO: %PDF-1.7; PDF/A %PDF-1.4)")

    # ── F-200/201/204 xlsx part model ─────────────────────────────────────────
    r = convert(BASE, "xlsx", "wo-spreadsheet", xlsx)
    stage = "DIVERGE", "xlsx->wo-spreadsheet failed"
    if r.get("status") == "Success":
        r2 = convert(BASE, "wo-spreadsheet", "xlsx", base64.b64decode(r["data"]))
        if r2.get("status") == "Success":
            out = unzip(base64.b64decode(r2["data"]))
            names = {n for n in out if not n.startswith("<")}
            stage = ("PASS" if len([n for n in names if "worksheets/sheet" in n]) == 2 else "DIVERGE",
                     f"sheets={sorted(n for n in names if 'sheet' in n and n.endswith('.xml'))}")
        else:
            stage = "DIVERGE", f"wo-spreadsheet->xlsx {r2.get('status')} {str(r2.get('error'))[:60]}"
    record("F-200 xlsx roundtrip sheets", *stage)
    # detail asserts on the last output if we got one
    if RESULTS[-1][1] == "PASS":
        ss = out.get("xl/sharedStrings.xml", "")
        record("F-201 sharedStrings kept", "PASS" if "Alpha" in ss else "DIVERGE",
               f"part={'yes' if ss else 'missing'}")
        s1 = out.get("xl/worksheets/sheet1.xml", "")
        record("F-202 formula kept", "PASS" if "<f>" in s1 or "A1*2" in s1 else "DIVERGE",
               f"formula-in-output={'yes' if ('<f>' in s1 or 'A1*2' in s1) else 'no'}")
        record("F-204 empty-cell elision", "PASS" if 'r="D7"' not in s1 else "DIVERGE",
               f"D7-present={'yes' if 'r=' + chr(34) + 'D7' in s1 else 'no'}")

    # ── F-300/302 pptx model ──────────────────────────────────────────────────
    r = convert(BASE, "pptx", "wo-presentation", pptx)
    stage = "DIVERGE", f"pptx->wo-presentation {r.get('status')} {str(r.get('error'))[:60]}"
    if r.get("status") == "Success":
        r2 = convert(BASE, "wo-presentation", "pptx", base64.b64decode(r["data"]))
        if r2.get("status") == "Success":
            out = unzip(base64.b64decode(r2["data"]))
            slides = sorted(n for n in out if re.match(r"ppt/slides/slide\d+\.xml", n))
            order = ""
            pres = next((v for k, v in out.items() if k.endswith("presentation.xml")), "")
            if pres:
                order = ",".join(re.findall(r'sldId id="(\d+)"', pres))
            stage = ("PASS" if len(slides) == 2 else "DIVERGE",
                     f"slides={slides} sldIdLst={order or 'absent'}")
        else:
            stage = "DIVERGE", f"wo-presentation->pptx {r2.get('status')} {str(r2.get('error'))[:60]}"
    record("F-300/302 pptx roundtrip", *stage)

    # ── F-500 units constants (static L0 check over WO crates) ────────────────
    units = {}
    for pat in (914400, 12700, 1440, 635, 360000):
        hits = subprocess_grep(pat)
        units[pat] = hits
    cent = units[12700] and units[914400]
    record("F-500 unit constants", "PASS" if cent else "DIVERGE",
           " ; ".join(f"{k}:{v}" for k, v in units.items()))

    print("\n# summary:", sum(1 for _, v, _ in RESULTS if v == "PASS"), "PASS /",
          sum(1 for _, v, _ in RESULTS if v == "DIVERGE"), "DIVERGE")
    return 0


def subprocess_grep(number: int) -> int:
    import subprocess
    p = subprocess.run(["grep", "-rl", str(number), str(SERVER / "core/crates"),
                        "--include=*.rs"], capture_output=True, text=True)
    return len([f for f in p.stdout.splitlines() if f])


if __name__ == "__main__":
    sys.exit(main())
