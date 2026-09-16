#!/usr/bin/env python3
"""run-react-census.py — capture the REACT editor (what production ships) with
census-react.cjs.

The React editor can't be served by the vanilla docserver; it expects:
  /demo/info + /demo/document  (loadFromDemo auto-load when no WOPI params)
  /api/conversion/convert     (docx -> html on load)
So we serve a built dist (default: documenteditor-react/dist) over plain
http.server with those three stubbed, plus a `word` junction so the dist's
absolute /word/assets/ paths resolve.

Build the dist first (needs the app's node deps):
  cd <server>/apps/web/apps/documenteditor-react
  pnpm install --filter "@world-office/documenteditor..." --prefer-offline
  npx vite build
  cmd //c "mklink /J word dist"     # junction so /word/ resolves (recreate if gone)

Usage:
  python run-react-census.py                        # build dir default
  python run-react-census.py --dist <path>          # another built frontend
  python run-react-census.py --url http://.../word/ # already-running editor
"""
import argparse, base64, functools, http.server, json, os, socket, subprocess, sys, threading
from pathlib import Path

CENSUS = Path(__file__).resolve().parent
SCRIPT = CENSUS / "census-react.cjs"
DEFAULT_UI = Path(r"C:/Users/Tobias/git/World-Office/server/apps/web/apps/documenteditor-react")
_DEMO = Path(r"C:/Users/Tobias/git/World-Office/server/assets/demo.docx")
DEMO = Path(os.environ.get("WO_SERVER_DIR", "")) / "assets/demo.docx" if os.environ.get("WO_SERVER_DIR") else _DEMO
HTML_STUB = base64.b64encode(b"<p>demo document</p>").decode()


def _stub_handler(ui_dir: str, demo_bytes: bytes):
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
        def end_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            super().end_headers()
        def do_GET(self):
            if self.path == "/demo/info":
                body = json.dumps({"BaseFileName": "demo.docx", "UserCanWrite": True}).encode()
                self.send_response(200); self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
            if self.path == "/demo/document":
                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                self.send_header("Content-Length", str(len(demo_bytes))); self.end_headers(); self.wfile.write(demo_bytes); return
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
    ap.add_argument("--dist", default=str(DEFAULT_UI), help="app dir containing dist/ + word junction")
    ap.add_argument("--url", default=None, help="already-running React editor page (e.g. staged prod)")
    a = ap.parse_args()

    if a.url:
        subprocess.run(["node", str(SCRIPT)], cwd=str(CENSUS),
                       env={**os.environ, "CENSUS_REACT_URL": a.url}, check=True)
        return

    ui = Path(a.dist).resolve()
    assert (ui / "word").is_dir() or (ui / "dist").is_dir(), \
        f"no built editor found under {ui} (need dist/ + word junction; see header)"
    demo_bytes = open(DEMO, "rb").read() if DEMO.exists() else b""
    port = free_port()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port),
        functools.partial(_stub_handler(str(ui), demo_bytes), directory=str(ui)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        subprocess.run(["node", str(SCRIPT)], cwd=str(CENSUS),
            env={**os.environ, "CENSUS_REACT_URL": f"http://127.0.0.1:{port}/word/"},
            check=True, timeout=180)
    finally:
        srv.shutdown()


if __name__ == "__main__":
    main()
