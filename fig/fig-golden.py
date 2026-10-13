#!/usr/bin/env python3
"""fig/fig-golden.py — the golden conversion oracle for the strangler fig.

Reference PDFs are captured ONCE from the OnlyOffice DocumentServer
(ConvertService.ashx, same engine that paints the OO editor canvas) and
committed as census/golden/docs/{stem}-oo.pdf. The oracle then runs
WITHOUT any OO stack: convert each golden docx through the rust wo-x2t
router (POST /api/conversion/convert) and compare against the committed
reference — page count sanity + normalized text-token similarity (Jaccard).

Modes:
  default          compare wo-x2t output vs committed -oo.pdf references
  --capture        (re)capture missing references from the OO DS first
  --ds URL         OO DS converter endpoint   (default :8000)
  --base URL       running wo-docserver       (default :18113, boot via run-fig)
Output: fig/census/fig-golden.json  — consumed by fig-check.cjs (oracle 'golden').
"""
import argparse, base64, json, re, subprocess, sys, time, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
GOLDEN = HERE.parent / "census" / "golden" / "docs"
OUT = HERE / "census"
STEMS = ["visual-gate", "image-gate", "hf-gate"]
SIM_THRESHOLD = 0.5  # token Jaccard floor (different engines, same content)

def http_json(url, payload=None, timeout=90):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data,
                                 headers={"Content-Type": "application/json"},
                                 method="POST" if data else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def capture_oo_pdf(ds, serve_port, stem, dest):
    """Convert stem.docx -> pdf via OO DS; write dest. Needs oo-golden-server."""
    proc = subprocess.Popen(
        [sys.executable, str(HERE.parent / "census" / "oo-golden-server.py"), str(serve_port)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1.0)
        payload = {"url": f"http://127.0.0.1:{serve_port}/{stem}.docx",
                   "outputtype": "pdf", "filetype": "docx",
                   "title": f"{stem}.docx", "key": f"fig-golden-{stem}-{int(time.time())}"}
        resp = None
        for _ in range(12):
            try:
                resp = http_json(f"{ds}/ConvertService.ashx", payload, timeout=120).decode()
                if "FileUrl" in resp:
                    break
            except Exception:
                resp = None
            time.sleep(10)
        if not resp or "FileUrl" not in resp:
            print(f"  golden: OO DS failed for {stem}: {(resp or '')[:120]}")
            return False
        url = resp[resp.index("<FileUrl>") + 9:resp.index("</FileUrl>")].replace("&amp;", "&")
        dest.write_bytes(http_json(url, timeout=60))
        print(f"  golden: captured {dest.name}")
        return True
    finally:
        proc.terminate()
        try: proc.wait(timeout=5)
        except subprocess.TimeoutExpired: proc.kill()

def pdf_pages(path):
    out = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True).stdout
    m = re.search(r"Pages:\s+(\d+)", out)
    return int(m.group(1)) if m else 0

def pdf_tokens(path):
    out = subprocess.run(["pdftotext", "-q", str(path), "-"], capture_output=True, text=True).stdout
    return set(re.findall(r"[a-z0-9]{2,}", out.lower()))

def docx_tokens(path):
    """Engine-independent reference text: text runs straight from the OOXML."""
    import zipfile
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf-8", "replace")
    text = " ".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", xml))
    return set(re.findall(r"[a-z0-9]{2,}", text.lower()))

def jaccard(a, b):
    if not a or not b: return 0.0
    return len(a & b) / len(a | b)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--capture", action="store_true")
    ap.add_argument("--ds", default="http://127.0.0.1:8000")
    ap.add_argument("--serve-port", type=int, default=8736)
    ap.add_argument("--base", default="http://127.0.0.1:18113")
    ap.add_argument("--out", default=str(OUT / "fig-golden.json"))
    a = ap.parse_args()

    results = {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"), "base": a.base, "stems": {}}
    failures = 0
    for stem in STEMS:
        docx = GOLDEN / f"{stem}.docx"
        ref = GOLDEN / f"{stem}-oo.pdf"
        if not docx.exists():
            print(f"  golden: missing {docx.name} — skip"); failures += 1; continue
        if not ref.exists() or a.capture:
            if not capture_oo_pdf(a.ds, a.serve_port, stem, ref):
                print(f"  golden: no OO pdf ref for {stem} — falling back to docx-text reference")
        # wo-x2t: docx -> pdf via the facade
        b64 = base64.b64encode(docx.read_bytes()).decode()
        resp = json.loads(http_json(f"{a.base}/api/conversion/convert",
                                    {"data": b64, "source_format": "docx", "target_format": "pdf"}))
        if resp.get("status") != "Success" or not resp.get("data"):
            print(f"  golden: wo-x2t failed for {stem}: {resp.get('error', resp.get('status'))[:80]}")
            results["stems"][stem] = {"ok": False, "error": resp.get("error") or resp.get("status")}
            failures += 1; continue
        wo = GOLDEN.parent.parent / "wo-conversion.pdf"  # scratch under census/golden
        wo.write_bytes(base64.b64decode(resp["data"]))
        oo_pages = pdf_pages(ref) if ref.exists() else None
        wo_pages = pdf_pages(wo)
        ref_tokens = pdf_tokens(ref) if ref.exists() else docx_tokens(docx)
        sim = jaccard(ref_tokens, pdf_tokens(wo))
        ok = wo_pages > 0 and sim >= SIM_THRESHOLD
        results["stems"][stem] = {"ok": ok, "ooPages": oo_pages, "woPages": wo_pages,
                                  "reference": "oo-pdf" if ref.exists() else "docx-text",
                                  "textSimilarity": round(sim, 3), "woPdfBytes": wo.stat().st_size}
        print(f"  golden: {stem}: pages {oo_pages}->{wo_pages}, similarity {sim:.3f} -> {'PASS' if ok else 'FAIL'}")
        if not ok: failures += 1

    results["ok"] = failures == 0
    Path(a.out).write_text(json.dumps(results, indent=1))
    print(f"fig-golden: {'PASS' if results['ok'] else 'FAIL'} ({len(results['stems'])} stems) -> {a.out}")
    return 0 if results["ok"] else 1

if __name__ == "__main__":
    sys.exit(main())
