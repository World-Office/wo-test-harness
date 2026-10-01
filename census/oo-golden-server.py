#!/usr/bin/env python3
"""oo-golden-server.py — host-side server for the OO GUI pixel-gate goldens.

Serves the golden .docx files + per-doc loader pages to a local OnlyOffice DS
(host-net, JWT off, web-apps on :8094 / converter on :8000) so the OO editor
can open them. The DS reaches the host directly (host-net == same namespace),
so document URLs use http://127.0.0.1:<PORT>/... .
  GET  /loader-<stem>.html   DocsAPI loader editing <stem>.docx
  GET  /<stem>.docx          the golden document
  POST /cb                   save callback ACK ({"error":0})
Use: python oo-golden-server.py [port]
"""
import http.server, json, socketserver, sys
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8735
HERE = Path(__file__).parent
DOCS = HERE / "golden" / "docs"
api = "http://127.0.0.1:8094/web-apps/apps/api/documents/api.js"


def loader_html(stem: str) -> bytes:
    # document URL must be reachable server-side by the DS (host-net: 127.0.0.1).
    doc_url = f"http://127.0.0.1:{PORT}/{stem}.docx"
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>OO golden {stem}</title>
<script type="text/javascript" src="{api}"></script>
<style>html,body,#placeholder{{width:100%;height:100%;margin:0;padding:0}}</style></head>
<body><div id="placeholder"></div>
<script type="text/javascript">
window.docEditor = new DocsAPI.DocEditor("placeholder", {{
  width: "100%", height: "100%", documentType: "word",
  document: {{ title: "{stem}.docx", url: "{doc_url}", fileType: "docx",
               key: "golden-{stem}-001", permissions: {{ edit: true, download: true, print: true, comment: true }} }},
  editorConfig: {{ mode: "edit", lang: "en",
               callbackUrl: "http://127.0.0.1:{PORT}/cb",
               user: {{ id: "pixel", name: "PixelGate" }},
               customization: {{ autosave: false, forcesave: false, feedback: false, help: false }} }},
  events: {{ onAppReady: function () {{ console.log("OO_APP_READY"); }} }}
}});
</script></body></html>""".encode()


class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _ok(self, body: bytes, ctype: str):
        self.send_response(200); self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body))); self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/":
            stems = sorted(f.stem for f in DOCS.glob("*.docx"))
            body = "<br>".join(f'<a href="/loader-{s}.html">{s}</a>' for s in stems).encode()
            return self._ok(body, "text/html")
        if p.startswith("/loader-") and p.endswith(".html"):
            stem = p[len("/loader-"):-len(".html")]
            if (DOCS / f"{stem}.docx").exists():
                return self._ok(loader_html(stem), "text/html")
        if p.endswith(".docx"):
            stem = p[1:-len(".docx")]
            f = DOCS / f"{stem}.docx"
            if f.exists():
                return self._ok(f.read_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        self.send_response(404); self.end_headers()
    def do_POST(self):
        if self.path.split("?")[0] in ("/cb", "/process"):
            body = b'{"error": 0}'
            self.send_response(200); self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
        self.send_response(200); self.end_headers()


if __name__ == "__main__":
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), H) as srv:
        print(f"oo-golden-server on :{PORT} (docs from {DOCS})")
        srv.serve_forever()
