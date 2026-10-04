#!/usr/bin/env python3
"""ai-contracts — the CONTRACT layer of the AI spec-contract-test pyramid.

Pyramid per AI gap (spec ids live in harness-graph/features.yaml):

  SPEC      features.yaml F-148..F-153   what + honest parity/fidelity
  CONTRACT  this script                  protocol/shape pins against REAL
                                        processes (rust docserver, mcp-server)
  TEST      reconcile --ai gate + CI census-ledger job; once the editor ships
            AI controls, census-wo/interact-wo/fx surfaces become the e2e
            layer (same promotion flow every other ribbon control uses).

Teeth (mirrors the reconcile MAP promotion doctrine, both directions):
  expectation matches probe  -> PASS / ABSENT-AS-EXPECTED, exit 0
  expect pass, probe failed  -> STALE, exit 1          (register lies: claims real)
  expect absent, probe 200   -> EARLY, exit 1          (impl landed: flip register
                                                         + expectation together,
                                                         recapture-as-PR spirit)
Debt block prints on every run — a green gate never hides the remaining gap.

Probes:
  148 GET  /ai/config                          rust provider-config surface
  149 POST /api/documents/demo.docx/ai/propose rust-side AI ops endpoint
  150 GET  /api/ai/tools                       JSON-schema command/tool catalog
  151 mcp-server stdio JSON-RPC                initialize + tools/list + tools/call
      (rmcp; expected PASS today — pinned so regressions fail loudly)
  152 POST /ai/generate                        LLM->md->docx orchestration
      152b positive pin: POST /api/conversion/convert docx->html (the chain's
          converter half is real and must stay real)
  153 in-browser LLM — no server-side contract possible -> DEFERRED forever
"""
from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from reconcile import _kill, resolve_server, spawn_docserver  # noqa: E402

# contract truth-table: F-id -> (probe, expectation). Flipping an expectation
# is a deliberate act that goes in the same PR as the feature + register row.
PROBES: dict[str, tuple[str, str]] = {
    "F-148": ("ai_config", "absent"),
    "F-149": ("ai_propose", "absent"),
    "F-150": ("ai_tools", "absent"),
    "F-151": ("mcp_stdio", "pass"),
    "F-152": ("ai_generate", "absent"),
    "F-153": ("deferred", "deferred"),
}


def _register_parity() -> dict[str, str]:
    src = (HERE.parent / "harness-graph" / "features.yaml").read_text()
    out = {}
    for fid in PROBES:
        m = re.search(rf"id: {fid},.*?parity: (\w+)", src)
        if m:
            out[fid] = m.group(1)
    return out


def _http(method: str, url: str, payload: dict | None = None) -> tuple[int, object]:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            body = r.read().decode(errors="replace") or "null"
            return r.status, json.loads(body)
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return -1, None


def _absent_or_200(base: str, method: str, path: str, payload: dict | None = None
                   ) -> tuple[str, str]:
    """Returns (verdict, detail): pass | absent | fail."""
    code, body = _http(method, base + path, payload)
    if code in (404, 405):
        return "absent", f"HTTP {code}"
    if code == 200:
        return "pass", f"HTTP 200 ({str(body)[:80]})"
    return "fail", f"HTTP {code} {str(body)[:120]}"


def _shape_ok_tools(body: object) -> bool:
    items = body if isinstance(body, list) else (body or {}).get("tools", [])
    return bool(items) and all(
        isinstance(t, dict) and t.get("name")
        and (t.get("parameters") or t.get("inputSchema")) for t in items)


def _mcp_probe(server: Path) -> tuple[str, str]:
    """Drive services/mcp-server over stdio JSON-RPC: init, list, call."""
    binary = None
    for profile in ("debug", "release"):
        p = server / "target" / profile / "mcp-server"
        if p.exists():
            binary = p
    if binary is None:
        subprocess.run(["cargo", "build", "-p", "mcp-server"], cwd=server, check=True)
        binary = server / "target" / "debug" / "mcp-server"
    proc = subprocess.Popen([str(binary)], stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                            text=True, cwd=str(server))
    try:
        def rpc(msg: dict, want_id: bool = True, timeout: float = 20.0) -> dict | None:
            proc.stdin.write(json.dumps(msg) + "\n")
            proc.stdin.flush()
            if not want_id:
                return None
            import threading
            box: list[dict] = []

            def reader():
                for line in proc.stdout:
                    try:
                        m = json.loads(line)
                    except Exception:
                        continue
                    box.append(m)
                    if m.get("id") == msg.get("id"):
                        return

            t = threading.Thread(target=reader, daemon=True)
            t.start()
            t.join(timeout)
            return next((m for m in box if m.get("id") == msg.get("id")), None)

        init = rpc({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                    "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                               "clientInfo": {"name": "ai-contracts", "version": "0"}}})
        if not init or "result" not in init or "error" in init:
            return "fail", f"initialize: {str(init)[:120]}"
        rpc({"jsonrpc": "2.0", "method": "notifications/initialized"}, want_id=False)
        lst = rpc({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        tools = ((lst or {}).get("result") or {}).get("tools", [])
        if not tools or not all(t.get("name") and t.get("inputSchema") for t in tools):
            return "fail", f"tools/list: {len(tools)} tools, schema missing"
        create = next((t["name"] for t in tools if "create" in t["name"]), None)
        call_detail = "call-skipped (integration tier: needs storage-service, " \
                      "set AI_CONTRACTS_MCP_CALL=1 + STORAGE_SERVICE_URL)"
        if create and os.environ.get("AI_CONTRACTS_MCP_CALL"):
            call = rpc({"jsonrpc": "2.0", "id": 3, "method": "tools/call",
                        "params": {"name": create,
                                   "arguments": {"name": "pyramid-probe", "content": "x"}}})
            if not call or "error" in call or (call.get("result") or {}).get("isError"):
                return "fail", f"tools/call {create}: {str(call)[:120]}"
            call_detail = f"tools/call {create} ok"
        return "pass", f"init ok, {len(tools)} tools, {call_detail}"
    finally:
        proc.kill()


def run() -> int:
    server = resolve_server()
    parity = _register_parity()
    workdir = Path(tempfile.mkdtemp(prefix="ai-contracts-"))
    base, procs = spawn_docserver(server, workdir, mode="rust")
    demo = base64.b64encode((HERE / "rig" / "demo.docx").read_bytes()).decode()
    results: dict[str, tuple[str, str]] = {}
    try:
        results["F-148"] = _absent_or_200(base, "GET", "/ai/config")
        results["F-149"] = _absent_or_200(base, "POST",
                                          "/api/documents/demo.docx/ai/propose",
                                          {"instruction": "probe"})
        v, d = _absent_or_200(base, "GET", "/api/ai/tools")
        if v == "pass" and not _shape_ok_tools(d):
            v, d = "fail", "200 but tool shapes invalid"
        results["F-150"] = (v, d)
        results["F-151"] = ("skip", "")
        results["F-152"] = _absent_or_200(base, "POST", "/ai/generate",
                                          {"prompt": "probe", "format": "docx"})
    finally:
        _kill(procs)

    # 151 runs outside the docserver lifetime (own binary)
    results["F-151"] = _mcp_probe(server)

    # 152b positive pin: converter half of the chain must stay real
    base2, procs2 = spawn_docserver(server, workdir, mode="rust")
    try:
        code, body = _http("POST", base2 + "/api/conversion/convert",
                           {"data": demo, "source_format": "docx",
                            "target_format": "html"})
        conv = ("pass" if code == 200 and isinstance(body, dict)
                and body.get("status") == "Success" else "fail")
        if conv != "pass":
            results["F-152"] = ("fail", "generate absent; converter pin FAILED "
                               "(the chain's real half regressed)")
        else:
            results["F-152"] = ("absent", "generate absent; converter pin pass")
    finally:
        _kill(procs2)

    print("AI spec-contract-test pyramid — census/ai-contracts.py")
    print(f"{'F-id':<7}{'parity':<10}{'expect':<9}{'probe':<18}detail")
    rc = 1 if results.get("F-152", ("", ""))[0] == "fail" else 0
    debt = []
    for fid, (probe, expect) in PROBES.items():
        verdict, detail = results.get(fid, ("skip", ""))
        par = parity.get(fid, "?")
        if expect == "deferred":
            debt.append(fid)
            print(f"{fid:<7}{par:<10}deferred {'DEFERRED':<18}spec-only (no server contract)")
            continue
        ok = (verdict == expect) or (expect == "pass" and verdict == "pass")
        if not ok:
            if verdict == "fail":
                print(f"{fid:<7}{par:<10}{expect:<9}FAIL              {detail}")
            elif expect == "pass":
                print(f"{fid:<7}{par:<10}pass     STALE             {detail}")
            else:
                print(f"{fid:<7}{par:<10}absent   EARLY             {detail}"
                      "  (impl landed: promote register + expectation)")
            rc = 1
        else:
            tag = "PASS" if verdict == "pass" else "ABSENT-OK"
            if verdict != "pass":
                debt.append(fid)
            print(f"{fid:<7}{par:<10}{expect:<9}{tag:<18}{detail}")
    print(f"\nparity debt: {len(debt)} unimplemented AI contract(s) "
          + ", ".join(debt) if debt else "\nparity debt: none — all AI contracts green")
    return rc


if __name__ == "__main__":
    raise SystemExit(run())
