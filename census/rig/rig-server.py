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
import http.server, json, socketserver, sys
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8735
HERE = Path(__file__).parent

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _ok(self, body: bytes, ctype="text/html"):
        self.send_response(200); self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path.split("?")[0] == "/rig-editor.html":
            body = (HERE / "rig-editor.html").read_bytes(); self._ok(body); return
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
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), H) as srv:
        print(f"rig-server on :{PORT}")
        srv.serve_forever()
