#!/usr/bin/env python3
"""capture-oo-goldens.py — generate OnlyOffice reference goldens for the pixel
gate, replacing the LibreOffice PDF goldens.

Uses the local OnlyOffice DS converter (ConvertService.ashx on :8000) — the
same rendering engine that paints the OO editor's page canvas — to render each
committed golden .docx to a full-page PNG. Output goes to census/golden/docs/
alongside the existing goldens, named by {stem}-oo.png.

Prereqs (dev rig, host-net DS, JWT off + allowPrivateIPAddress in local.json):
  DS container oo-harness-ds up, converter healthy on :8000; the goldens are
  served to the DS by oo-golden-server.py (needs the docx URL reachable by the
  DS — host-net means 127.0.0.1 works directly).

Usage:
  /usr/bin/python3 census/capture-oo-goldens.py \
      [--ds http://127.0.0.1:8000] [--serve http://127.0.0.1:8735] \
      [--out census/golden/docs]
"""
import argparse
import json
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
GOLDEN = (HERE / "golden" / "docs")
STEMS = ["visual-gate", "image-gate", "hf-gate"]


def _start_server(port: int) -> subprocess.Popen:
    """Serve the golden docx + loader pages to the DS from a scratch dir."""
    proc = subprocess.Popen(
        [sys.executable, str(HERE / "oo-golden-server.py"), str(port)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(1.0)
    return proc


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ds", default="http://127.0.0.1:8000")
    ap.add_argument("--port", type=int, default=8735)
    ap.add_argument("--out", type=Path, default=GOLDEN)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)

    proc = _start_server(a.port)
    try:
        serve = f"http://127.0.0.1:{a.port}"
        for stem in STEMS:
            docx = GOLDEN / f"{stem}.docx"
            if not docx.exists():
                print(f"  capture-oo: missing {docx.name} — skipping"); continue
            url = f"{serve}/{stem}.docx"
            payload = {
                "url": url, "outputtype": "png", "filetype": "docx",
                "title": f"{stem}.docx", "key": f"pixel-oo-{stem}",
            }
            # POST may 404 until the converter is ready (2-3 min boot); retry.
            resp = None
            for attempt in range(12):
                try:
                    req = urllib.request.Request(
                        a.ds + "/ConvertService.ashx",
                        data=json.dumps(payload).encode(),
                        headers={"Content-Type": "application/json"},
                        method="POST",
                    )
                    with urllib.request.urlopen(req, timeout=120) as r:
                        resp = r.read().decode()
                    if "FileUrl" in resp:
                        break
                except Exception as e:
                    resp = None
                time.sleep(10)
            if not resp or "FileUrl" not in resp:
                print(f"  capture-oo: converter failed for {stem}: {resp}")
                return 1
            file_url = resp[resp.index("<FileUrl>") + 9:resp.index("</FileUrl>")]
            file_url = file_url.replace("&amp;", "&")
            # swap the DS-internal host for the browser-visible one
            out_png = a.out / f"{stem}-oo.png"
            with urllib.request.urlopen(file_url, timeout=60) as r:
                out_png.write_bytes(r.read())
            print(f"  capture-oo: {out_png.name} <- {file_url.split('?')[0]}")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
    return 0


if __name__ == "__main__":
    sys.exit(main())
