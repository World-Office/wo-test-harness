#!/usr/bin/env python3
"""rig-server.py — tiny host-side server for the OO rig (Windows dev box).

The onlyoffice/documentserver container blocks/needs a callback + document URL.
This server provides both, on 127.0.0.1 (the container reaches the host via
host.docker.internal — enabled by allowPrivateIPAddress in local.json):
  GET  /rig-editor.html   the api.js loader page (opens the DS editor)
  GET  /demo.docx         the (valid) demo document the editor opens
  POST /cb                the DS save/state callback — ACK with {"error":0}
Use with: python rig-server.py   (serves on 8735)
"""
import http.server, json, os, socketserver, sys
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8735
HERE = Path(__file__).parent
# DS base URL injected into rig-editor.html (default matches the documented
# rig recipe; override when :8099 is taken, e.g. DS_URL=http://127.0.0.1:8199)
DS_URL = os.environ.get("DS_URL", "http://127.0.0.1:8099")

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _ok(self, body: bytes, ctype="text/html"):
        self.send_response(200); self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path.split("?")[0] == "/rig-editor.html":
            body = (HERE / "rig-editor.html").read_bytes().replace(b"http://127.0.0.1:8099", DS_URL.encode())
            # ?portal=1 — portal-mode editor config: flips the File-backstage
            # "Create New"/"Open Recent" items visible (standalone sessions hide
            # them). OO controller: canCreateNew ← canRequestCreateNew|createUrl|
            # templates.length; canOpenRecent ← recent !== undefined.
            # (templates list — not canRequestCreateNew — is the knob that makes
            # the Create New item actually appear; the boolean alone sets
            # appOptions.canCreateNew but the menu item stays hidden on 9.4.)
            if "portal=1" in self.path.split("?", 1)[-1]:
                body = body.replace(
                    b'lang: "en",',
                    b'lang: "en", recent: [], '
                    b'templates: [{ image: "", title: "Blank document", '
                    b'url: "http://host.docker.internal:8735/demo.docx" }],', 1)
            self._ok(body); return
        if self.path.split("?")[0] == "/demo.docx":
            # prefer the server repo's valid demo docx; fall back to a tiny valid docx
            cands = [Path("C:/Users/Tobias/git/World-Office/server/assets/demo.docx"), HERE / "demo.docx"]
            for c in cands:
                if c.exists():
                    self._ok(c.read_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); return
            self.send_response(404); self.end_headers(); return
        self.send_response(404); self.end_headers()
    def do_POST(self):
        if self.path.startswith("/cb") or self.path.startswith("/process"):
            # OO save callback: ack success so no "could not be saved" modal blocks capture
            body = b'{"error": 0}'
            self.send_response(200); self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
        self.send_response(200); self.end_headers()

if __name__ == "__main__":
    # RIG_BIND=0.0.0.0 for Linux rigs (docker host-gateway reaches the host
    # via the bridge IP, not loopback; Docker Desktop proxies loopback anyway)
    BIND = os.environ.get("RIG_BIND", "127.0.0.1")
    socketserver.ThreadingTCPServer.allow_reuse_address = True  # survive TIME_WAIT on restart
    with socketserver.ThreadingTCPServer((BIND, PORT), H) as srv:
        print(f"rig-server on {BIND}:{PORT}")
        srv.serve_forever()
