#!/usr/bin/env python3
"""run-react-census-sheet.py — sheet variant of run-react-census.py: serve a
built spreadsheeteditor-react dist with stubbed demo/conversion endpoints and
drive census/census-react-sheet.cjs against it.

Same three stubs the sheet editor may touch on a bare load (/demo/info,
/demo/document, /api/conversion/convert); a `sheet -> dist` symlink inside the
app dir makes the dist's absolute /sheet/assets/ paths resolve (vite base is
"/sheet/"). Linux-first: symlink instead of the Windows junction.

Usage:
  python3 census/run-react-census-sheet.py --dist <app-dir-with-dist>
      builds nothing — serve + census, exit code = census exit code
  python3 census/run-react-census-sheet.py --url http://.../sheet/
      run the census against an already-running editor (staging/prod)
"""
import argparse, base64, functools, http.server, json, os, socket, subprocess, sys, threading
from pathlib import Path

CENSUS = Path(__file__).resolve().parent
SCRIPT = CENSUS / "census-react-sheet.cjs"
_DEMO = Path.home() / "git/World-Office/server/assets/demo.docx"
DEMO = Path(os.environ.get("WO_SERVER_DIR", "")) / "assets/demo.docx" if os.environ.get("WO_SERVER_DIR") else _DEMO
HTML_STUB = base64.b64encode(b"<p>demo document</p>").decode()
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _stub_handler(ui_dir: str, demo_bytes: bytes):
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()
        def do_GET(self):
            if self.path == "/demo/info":
                body = json.dumps({"name": "demo.docx", "size": len(demo_bytes)}).encode()
                self.send_response(200); self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
            if self.path == "/demo/document":
                self.send_response(200); self.send_header("Content-Type", XLSX_MIME)
                self.send_header("Content-Length", str(len(demo_bytes))); self.end_headers()
                self.wfile.write(demo_bytes); return
            super().do_GET()
        def do_POST(self):
            if self.path == "/api/conversion/convert":
                body = json.dumps({"status": "ok", "data": HTML_STUB, "format": "html", "duration_ms": 1}).encode()
                self.send_response(200); self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
            self.send_response(404); self.end_headers()
    return H


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dist", default=None, help="app dir containing dist/ (+ sheet symlink to dist)")
    ap.add_argument("--url", default=None, help="already-running sheet editor page (e.g. staging)")
    a = ap.parse_args()

    if a.url:
        subprocess.run(["node", str(SCRIPT)], cwd=str(CENSUS),
                       env={**os.environ, "CENSUS_REACT_URL": a.url}, check=True)
        return

    ui = Path(a.dist).resolve()
    link = ui / "sheet"
    if not link.exists() and (ui / "dist").is_dir():
        link.symlink_to("dist")
    assert (ui / "sheet").is_dir(), f"no built sheet editor under {ui} (need dist/ + sheet symlink)"
    demo_bytes = open(DEMO, "rb").read() if DEMO.exists() else b""
    port = free_port()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port),
        functools.partial(_stub_handler(str(ui), demo_bytes), directory=str(ui)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        subprocess.run(["node", str(SCRIPT)], cwd=str(CENSUS),
            env={**os.environ, "CENSUS_REACT_URL": f"http://127.0.0.1:{port}/sheet/"},
            check=True, timeout=300)
    finally:
        srv.shutdown()


if __name__ == "__main__":
    main()
