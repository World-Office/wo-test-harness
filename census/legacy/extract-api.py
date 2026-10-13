#!/usr/bin/env python3
"""legacy/extract-api.py — HTTP surface inventory, legacy python vs current rust.

Slice C of the legacy-parity divide&conquer: pulls route patterns from the
deprecated FastAPI app (opencloud-docserver/src/**/router.py + main.py) and
from the current Rust docserver (wo-docserver/src/*.rs axum .route(...) calls)
into one JSON so diff-legacy.py can report routes that existed once and
vanished.

    python3 extract-api.py --legacy SRC_DIR --rust SERVER_DIR --out FILE
"""
import argparse, json, pathlib, re

ap = argparse.ArgumentParser()
ap.add_argument("--legacy", required=True, help="opencloud-docserver/src")
ap.add_argument("--rust", required=True, help="server (git root with core/crates)")
ap.add_argument("--out", required=True)
a = ap.parse_args()

METHODS = ("get", "post", "put", "delete", "patch", "head", "options")

def norm(p):
    """FastAPI {x} -> {x}; collapse wildcard suffixes for comparability."""
    p = re.sub(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}", "{id}", p)
    p = re.sub(r":path\}", "}", p)  # fastapi converter syntax
    return "/" + p.strip("/")

def py_routes(src_dir):
    out = {}
    for f in pathlib.Path(src_dir).rglob("*.py"):
        text = f.read_text(encoding="utf-8", errors="replace")
        # @router.get("/path") | @app.post("/path")
        for m in re.finditer(r"@(?:router|app)\.(" + "|".join(METHODS) + r")\(\s*[\"']([^\"']+)[\"']", text):
            method, path = m.group(1).upper(), m.group(2)
            if path.startswith("/api") or path.startswith("/wopi") or path.startswith("/collab"):
                out.setdefault(norm(path), {"methods": set(), "file": f.name})["methods"].add(method)
    return {k: {"methods": sorted(v["methods"]), "file": v["file"]} for k, v in out.items()}

def rs_routes(server_dir):
    out = {}
    for f in pathlib.Path(server_dir, "core", "crates", "wo-docserver", "src").rglob("*.rs"):
        text = f.read_text(encoding="utf-8", errors="replace")
        # axum routes are often two-line: "/path",\n get(h).post(h2) — match
        # across newlines, capture every method word in the handler chain
        for m in re.finditer(r'\.route\(\s*"([^"]+)"\s*,\s*([\w\s:()]+?)\)', text):
            path, chain = m.group(1), m.group(2)
            methods = sorted(x.upper() for x in METHODS if re.search(r"\b" + x + r"\b", chain))
            if path.startswith("/api") or path.startswith("/wopi") or path.startswith("/collab") or path.startswith("/hosting/wopi"):
                prev = out.setdefault(norm(path), {"methods": [], "file": f.name})
                prev["methods"] = sorted(set(prev["methods"]) | set(methods))
    return out

legacy = py_routes(a.legacy)
current = rs_routes(a.rust)
json.dump({"legacy": legacy, "current": current}, open(a.out, "w"), indent=1, sort_keys=True)
only_legacy = sorted(set(legacy) - set(current))
print(f"api: legacy {len(legacy)}, current {len(current)}, legacy-only {len(only_legacy)} -> {a.out}")
