#!/usr/bin/env python3
"""Dual-stack A/B bench: Rust wo-docserver vs Python opencloud-docserver.

Every number this prints is measured on this machine, in one sequential run
(rust first, then python — same load window). Timing via time.time() around
urllib requests; medians over fixed N. No /usr/bin/time, no bc.

Metrics
  cold-boot-to-first-200  median of N_BOOT spawns (Popen -> first 200 /health)
  steady RSS              VmHWM of the server process after warmup requests
  per-endpoint p50        N_REQ sequential GETs: health / editor HTML / doc bytes
  conversion time         median of N_CONV docx->html conversions of rig/demo.docx
  footprint               release binary size (rust) vs venv size + pkg count (python)

Fidelity is NOT re-measured here: it is the committed visual-gate ink numbers
(rerun `reconcile.py --check --visual --docserver <mode>` to reproduce).

Usage: WO_SERVER_DIR=... /usr/bin/python3 census/ds-bench.py [--out md-path]
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import statistics
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent


def server_repo() -> Path:
    env = os.environ.get("WO_SERVER_DIR")
    if env:
        return Path(env).resolve()
    return (HERE.parent.parent / "server").resolve()


def free_port() -> int:
    import socket
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def get(url: str, timeout: float = 30.0, data: bytes | None = None,
        headers: dict | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(url, data=data, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def wait_200(base: str, deadline: float) -> float:
    """Poll /health until 200; return elapsed seconds (0 if already up)."""
    t0 = time.time()
    while time.time() < deadline:
        try:
            code, _ = get(f"{base}/health", timeout=2.0)
            if code == 200:
                return time.time() - t0
        except Exception:
            time.sleep(0.005)
    raise RuntimeError(f"no 200 from {base}/health")


def spawn_rust(server: Path, workdir: Path, port: int):
    docs = workdir / "docs"
    docs.mkdir(parents=True, exist_ok=True)
    if not (docs / "demo.docx").exists():
        shutil.copy(HERE / "rig" / "demo.docx", docs / "demo.docx")
    ui = workdir / "editor-ui" / "word"
    shutil.copytree(server / "apps" / "web" / "apps" / "documenteditor-wysiwyg",
                    ui, dirs_exist_ok=True)
    stub_port = free_port()
    stub = subprocess.Popen([sys.executable, str(HERE / "wopi-stub.py"),
                             str(stub_port), str(docs)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    binary = server / "target" / "release" / "wo-docserver"
    if not binary.exists():
        binary = server / "target" / "debug" / "wo-docserver"
    env = {**os.environ, "JWT_SECRET": "bench-secret", "DOCSERVER_PORT": str(port),
           "DOCSERVER_HOST": "127.0.0.1", "WOPI_TOKEN_MODE": "passthrough",
           "WOPI_HOST_URL": f"http://127.0.0.1:{stub_port}",
           "DOCSERVER_PUBLIC_URL": f"http://127.0.0.1:{port}",
           "EDITOR_UI_DIR": str(workdir / "editor-ui"),
           "RUST_LOG": "warn"}
    proc = subprocess.Popen([str(binary)], env=env, cwd=workdir,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return proc, stub


def spawn_python(server: Path, workdir: Path, port: int):
    docserver = server / "opencloud-docserver"
    cfg = (f"port={port}, host='127.0.0.1', "
           f"database={str(workdir / 'db.sqlite')!r}, content_dir={str(workdir / 'content')!r}, "
           f"jwt_secret='bench-secret', public_url='http://127.0.0.1:{port}'")
    code = ("import uvicorn;"
            "from src.main import create_app;"
            "from src.config import Config;"
            f"uvicorn.run(create_app(Config({cfg})), port={port}, host='127.0.0.1', "
            "log_level='warning', access_log=False)")
    proc = subprocess.Popen([sys.executable, "-c", code], cwd=docserver,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return proc, None


def vm_hwm_kb(pid: int) -> int:
    try:
        for line in Path(f"/proc/{pid}/status").read_text().splitlines():
            if line.startswith("VmHWM:"):
                return int(line.split()[1])
    except OSError:
        pass
    return 0


def bench_boot(spawn, server: Path, n: int) -> float:
    times = []
    for _ in range(n):
        workdir = Path(tempfile.mkdtemp(prefix="ds-bench-"))
        port = free_port()
        proc, stub = spawn(server, workdir, port)
        base = f"http://127.0.0.1:{port}"
        try:
            times.append(wait_200(base, time.time() + 60))
        finally:
            proc.kill(); proc.wait()
            if stub:
                stub.kill(); stub.wait()
            shutil.rmtree(workdir, ignore_errors=True)
            time.sleep(0.2)
    return statistics.median(times)


def bench_mode(mode: str, server: Path, doc_bytes: bytes) -> dict:
    workdir = Path(tempfile.mkdtemp(prefix=f"ds-bench-{mode}-"))
    port = free_port()
    spawn = spawn_rust if mode == "rust" else spawn_python
    proc, stub = spawn(server, workdir, port)
    base = f"http://127.0.0.1:{port}"
    out: dict = {"mode": mode}
    try:
        wait_200(base, time.time() + 60)
        # endpoints per stack (same user-visible operation)
        if mode == "rust":
            editor_url = f"{base}/word/?access_token=stub&file_id=demo.docx"
            doc_url = f"{base}/wopi/files/demo.docx/contents?access_token=stub"
            # conversion: POST /api/conversion/convert (wo-x2t, docx -> html)
            def convert() -> float:
                body = json.dumps({"source_format": "docx", "target_format": "html",
                                   "data": base64.b64encode(doc_bytes).decode()}).encode()
                t0 = time.time()
                code, _ = get(f"{base}/api/conversion/convert", data=body,
                              headers={"Content-Type": "application/json"}, timeout=60)
                if code != 200:
                    raise RuntimeError(f"convert {code}")
                return time.time() - t0
        else:
            code, body = get(f"{base}/api/documents/new", data=b"",
                             headers={"Content-Type": "application/json"})
            doc_id = json.loads(body)["doc_id"]
            get(f"{base}/api/documents/{doc_id}/contents")  # prime (may 404 empty)
            editor_url = f"{base}/editor/{doc_id}"
            doc_url = f"{base}/api/documents/{doc_id}/contents"
            def convert() -> float:  # GET html export (python-docx -> html)
                t0 = time.time()
                code, _ = get(f"{base}/api/documents/{doc_id}/html", timeout=60)
                if code != 200:
                    raise RuntimeError(f"html export {code}")
                return time.time() - t0

        # warmup (JIT/page caches/first-file parsing)
        get(editor_url); get(doc_url)
        time.sleep(0.5)
        out["rss_hwm_mb"] = round(vm_hwm_kb(proc.pid) / 1024, 1)

        eps = {}
        for name, url in (("health", f"{base}/health"), ("editor_html", editor_url),
                          ("doc_bytes", doc_url)):
            lat = []
            for _ in range(N_REQ):
                t0 = time.time()
                code, _ = get(url, timeout=30)
                if code != 200:
                    raise RuntimeError(f"{name} -> {code}")
                lat.append((time.time() - t0) * 1000)
            eps[name] = round(statistics.median(lat), 1)
        out["endpoint_p50_ms"] = eps

        conv = sorted(convert() for _ in range(N_CONV))
        out["conversion_p50_ms"] = round(statistics.median(conv) * 1000, 1)
    finally:
        proc.kill(); proc.wait()
        if stub:
            stub.kill(); stub.wait()
        shutil.rmtree(workdir, ignore_errors=True)
    return out


def footprint(server: Path) -> dict:
    rel = server / "target" / "release" / "wo-docserver"
    deb = server / "target" / "debug" / "wo-docserver"
    rust_mb = round(rel.stat().st_size / 1e6, 1) if rel.exists() else (
        round(deb.stat().st_size / 1e6, 1) if deb.exists() else None)
    venv = server / "opencloud-docserver" / ".venv"
    py_mb = pkgs = None
    if venv.exists():
        total = sum(p.stat().st_size for p in venv.rglob("*") if p.is_file())
        py_mb = round(total / 1e6, 1)
        site = next(venv.glob("lib/python*/site-packages"), None)
        if site:
            pkgs = len([p for p in site.iterdir()
                        if p.is_dir() and not p.name.endswith((".dist-info",))])
    return {"rust_binary_mb": rust_mb, "rust_binary_flavor": "release" if rel.exists() else "debug",
            "python_venv_mb": py_mb, "python_site_packages": pkgs}


N_BOOT, N_REQ, N_CONV = 5, 20, 5


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE / "ds-bench.json"))
    args = ap.parse_args()

    server = server_repo()
    if not server.exists():
        print(f"server repo not found: {server}", file=sys.stderr)
        return 2
    load = open("/proc/loadavg").read().split()[:3]
    doc_bytes = (HERE / "rig" / "demo.docx").read_bytes()

    print(f"# ds-bench  doc={len(doc_bytes)}B  loadavg={' '.join(load)}  "
          f"N_boot={N_BOOT} N_req={N_REQ} N_conv={N_CONV}")
    results = {}
    for mode in ("rust", "python"):
        t0 = time.time()
        boot = bench_boot(spawn_rust if mode == "rust" else spawn_python, server, N_BOOT)
        print(f"  {mode}: cold-boot-to-first-200 median = {boot*1000:.0f} ms "
              f"(N={N_BOOT}, bench wall {time.time()-t0:.0f}s)")
        r = bench_mode(mode, server, doc_bytes)
        r["cold_boot_p50_ms"] = round(boot * 1000)
        results[mode] = r
        print(f"    {json.dumps(r)}")
    results["footprint"] = footprint(server)
    print(f"  footprint: {json.dumps(results['footprint'])}")

    Path(args.out).write_text(json.dumps(results, indent=2) + "\n")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
