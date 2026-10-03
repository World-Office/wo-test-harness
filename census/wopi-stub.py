#!/usr/bin/python3
"""wopi-stub.py — minimal WOPI host for the local Rust-docserver census.

The Rust wo-docserver proxies /wopi/files/* to WOPI_HOST_URL (OCIS). For
census runs there is no OCIS, so this stdlib stub answers the three WOPI
calls the editor's wo-bridge makes, serving .docx files straight from a
docs directory (file_id == file name):

    GET  /wopi/files/<id>          -> CheckFileInfo JSON
    GET  /wopi/files/<id>/contents -> the file bytes
    POST /wopi/files/<id>/contents -> {"error":0} save-ack

Usage: python3 wopi-stub.py <port> <docs-dir>
(Same pattern as census/rig/rig-server.py on the OnlyOffice rig side.)
"""

import json
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

DOCS = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(".")


def doc_bytes(path: str) -> bytes:
    fid = urllib.parse.unquote(path.split("?")[0].split("/")[3])
    p = DOCS / fid
    return p.read_bytes() if p.is_file() else b""


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: bytes, ctype: str = "application/json") -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if "/contents" in self.path:
            self._send(200, doc_bytes(self.path), "application/octet-stream")
        else:
            data = doc_bytes(self.path)
            name = self.path.split("?")[0].rstrip("/").split("/")[-1] or "demo.docx"
            info = {"BaseFileName": name, "Size": len(data), "Version": "1",
                    "UserId": "census", "UserFriendlyName": "Census", "Ownerid": "census",
                    "SupportsUpdate": True, "UserCanWrite": True}
            self._send(200, json.dumps(info).encode())

    def do_POST(self) -> None:
        self._send(200, b'{"error":0}')

    def log_message(self, *args) -> None:
        pass


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
