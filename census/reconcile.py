#!/usr/bin/env python3
"""reconcile.py — clear the parity ledger in one run.

Lives in wo-test-harness/census/ (the harness owns the census pipeline;
the OnlyOffice reference capture stays rig-side and only refreshes
census/census-oo.json via CENSUS_OUT).

One command turns "a stub button in the editor was promoted to a real
data-cmd" into "ledger cleared + register synced + graph green":

  1. capture   spawn the docserver from WO_SERVER_DIR (no docker / no rig /
               no WOPI bridge), create a store-backed doc, run census-wo.cjs
               in CENSUS_WO_URL mode, refresh census/census-wo.json
  2. diff      against census/census-wo.prev.json: every WO button that
               shipped a data-stub in the previous capture and now ships a
               data-cmd (stable id-or-label key) auto-flips every MAP row
               {"stub": <ref>} -> {"real": <cmd>} in census-diff.py; the
               previous capture is rotated so the delta is always the set
               of promotions since the last reconciled run
  3. join      census-diff.py -> census/ledger.json + LEDGER line
  4. gate      exit 0 iff stub == 0 and UNMATCHED == 0 and
               MISSING-STUB == 0; otherwise print exactly which decisions
               a human must still make
  5. register  --apply-register: flip parity absent/missing -> full on
               features.yaml rows whose divergence mentions the promoted
               data-stub ref (best effort; unknown refs are reported)
  6. seed      --seed-check: regenerate graph.json + drift gate

--check mode is the CI gate: it captures fresh into a throwaway dir, never
writes committed files, and exits 1 on any pending promotion, stub residue,
or unregistered drift — mirroring what `reconcile.py` would repair.

Semantic decisions (a genuinely new OO control, or deferring a stub like
ref.citation to the field engine) are NOT automated — the gate prints them
and exits 1 until a human edits MAP/a register row.

Usage:
  WO_SERVER_DIR=/path/to/World-Office/server /usr/bin/python3 census/reconcile.py \
      [--skip-capture] [--apply-register] [--seed-check] [--check] [--self-test]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent          # wo-test-harness/census
HARNESS = HERE.parent                            # wo-test-harness repo root
CENSUS = HERE / "census"
WO_JSON = CENSUS / "census-wo.json"
WO_PREV = CENSUS / "census-wo.prev.json"
DIFF_PY = HERE / "census-diff.py"

# MAP rows look like:     "    \"insert-shape\": {\"stub\": \"insert.shape\"},\n"
MAP_ROW = re.compile(r'^(\s*)"([^"]+)":\s*\{"stub":\s*"([^"]+)"\},?[^\n]*$')


def resolve_server() -> Path:
    env = os.environ.get("WO_SERVER_DIR")
    if env:
        p = Path(env)
        if (p / "opencloud-docserver").is_dir():
            return p
        raise SystemExit(f"WO_SERVER_DIR={env} is not a server checkout (no opencloud-docserver/)")
    cand = HARNESS.parent / "server"
    if (cand / "opencloud-docserver").is_dir():
        return cand
    raise SystemExit(
        "Cannot locate server checkout: set WO_SERVER_DIR to the World-Office/server repo root"
    )


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _wait_health(base: str, timeout: float = 30.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{base}/health", timeout=2) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError(f"docserver did not become healthy at {base}")


def spawn_docserver(server: Path, workdir: Path):
    """Start uvicorn(create_app) on a free port; return (port, proc)."""
    docserver = server / "opencloud-docserver"
    port = _free_port()
    cfg = (
        f"port={port}, host='127.0.0.1', "
        f"database={str(workdir / 'db.sqlite')!r}, content_dir={str(workdir / 'content')!r}, "
        f"jwt_secret='reconcile-secret', public_url='http://127.0.0.1:{port}'"
    )
    code = (
        "import uvicorn;"
        "from src.main import create_app;"
        "from src.config import Config;"
        f"uvicorn.run(create_app(Config({cfg})), port={port}, host='127.0.0.1', "
        "log_level='warning', access_log=False)"
    )
    proc = subprocess.Popen([sys.executable, "-c", code], cwd=docserver)
    try:
        _wait_health(f"http://127.0.0.1:{port}")
    except Exception:
        proc.kill()
        raise
    return port, proc


def capture(server: Path, out: Path, script: str = "census-wo.cjs") -> str:
    """Spawn a local docserver, run <script> (a census .cjs) against it, kill the
    server. The census JSON lands in out/ (census-wo.json for the structural
    census, interact-wo.json for the --interactions click-through)."""
    with tempfile.TemporaryDirectory(prefix="reconcile-") as td:
        port, proc = spawn_docserver(server, Path(td))
        try:
            with urllib.request.urlopen(
                urllib.request.Request(
                    f"http://127.0.0.1:{port}/api/documents/new",
                    data=b"",
                    headers={"Content-Type": "application/json"},
                    method="POST",
                ),
                timeout=10,
            ) as r:
                doc_id = json.loads(r.read())["doc_id"]
            url = f"http://127.0.0.1:{port}/editor/{doc_id}"
            out.mkdir(parents=True, exist_ok=True)
            try:
                npm_root = subprocess.run(
                    ["npm", "root", "-g"], capture_output=True, text=True, check=False,
                    timeout=15,
                ).stdout.strip()
            except (OSError, subprocess.SubprocessError):
                # no npm on PATH (Windows can't CreateProcess-search npm.cmd) —
                # census/node_modules already carries playwright
                npm_root = ""
            env = {**os.environ, "CENSUS_WO_URL": url, "CENSUS_OUT": str(out)}
            if npm_root:
                env["NODE_PATH"] = npm_root
            node = shutil.which("node") or "node"
            subprocess.run([node, script], cwd=HERE, env=env, check=True)
            return str(url)
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()


def census_buttons(census: dict) -> list[dict]:
    out = []
    for data in {**census.get("tabs", {}), **census.get("surfaces", {})}.values():
        out.extend(data.get("buttons", []))
    return out


def diff_promotions(prev: dict, curr: dict) -> list[tuple[str, str, str]]:
    """Buttons that shipped a data-stub in prev and now ship a data-cmd in
    curr (keyed by id-or-label). Returns [(key, stub_ref, cmd)]."""
    def index(census: dict) -> dict:
        out = {}
        for b in census_buttons(census):
            key = b.get("id") or b.get("label")
            if key:
                out[key] = b
        return out

    prev_idx, curr_idx = index(prev), index(curr)
    curr_stubs = {b["stub"] for b in curr_idx.values() if b.get("stub")}
    out = []
    for key, pb in prev_idx.items():
        if not pb.get("stub"):
            continue
        ref = pb["stub"]
        cb = curr_idx.get(key)
        if not cb or not cb.get("cmd") or cb.get("stub"):
            continue
        if ref in curr_stubs:
            continue  # the stub is still shipped (under another button)
        out.append((key, ref, cb["cmd"].lower()))
    return sorted(out)


def read_map_rows() -> dict[str, str]:
    """MAP key -> stub ref, for keys currently declared as stubs."""
    rows = {}
    src = DIFF_PY.read_text(encoding="utf-8")
    for m in MAP_ROW.finditer(src):
        rows[m.group(2)] = m.group(3)
    return rows


def apply_map_flips(flips: list[tuple[str, str, str]]) -> list[str]:
    """Rewrite every {"stub": <ref>} row whose ref was promoted, to
    {"real": <cmd>}. Returns human-readable AUTO flip lines."""
    changed = []
    src = DIFF_PY.read_text(encoding="utf-8")
    lines = src.split("\n")
    touched = False
    for i, ln in enumerate(lines):
        m = MAP_ROW.match(ln)
        if not m:
            continue
        ind, key, ref = m.group(1), m.group(2), m.group(3)
        for _, fl_ref, cmd in flips:
            if ref == fl_ref:
                lines[i] = f'{ind}"{key}": {{"real": "{cmd}"}},   # AUTO by reconcile (was data-stub={ref})'
                changed.append(f'AUTO {key}: data-stub={ref} -> real {cmd}')
                touched = True
    if touched:
        DIFF_PY.write_text("\n".join(lines) + "\n")
    return changed


def rotate_prev() -> None:
    if WO_JSON.exists():
        shutil.copyfile(WO_JSON, WO_PREV)


def run_join(wo: Path, ledger_out: Path) -> dict:
    subprocess.run(
        [sys.executable, "census-diff.py", "--wo", str(wo), "--ledger", str(ledger_out)],
        cwd=HERE,
        check=True,
    )
    return json.load(open(ledger_out, encoding="utf-8"))


def gate(ledger: dict) -> bool:
    counts = ledger["counts"]
    bad = {k: v for k, v in counts.items() if k in ("stub", "UNMATCHED", "MISSING-STUB", "STALE-DEFERRED") and v > 0}
    if not bad:
        return True
    for row in ledger["ledger"]:
        if row["status"] in ("stub", "UNMATCHED", "MISSING-STUB"):
            note = row.get("ref") or row.get("note") or row.get("token")
            print(f"  DECISION: [{row['status']}] {row['tab']} {note}")
        if row["status"] == "STALE-DEFERRED":
            tok = row.get("token")
            note = row.get("note") or row.get("reason")
            print(f"  PARITY UNDER-REPORT: [{row['status']}] {row['tab']} token={tok} -> {note}")
            print(f"      promote census-diff.py MAP['\"{tok}\"'] to {{\"real\": \"{((row.get('wo') or '').split(':')[-1] or '?')}\"}}")
    return False


def report_deferred(ledger: dict) -> None:
    """Print the deferred (declared-future-iteration) rows as visible parity
    debt. A green gate never fails on deferred -- that is their contract -- but
    a run that prints NOTHING about them makes the OO-gap invisible. Group by
    reason tag so the debt is auditable and track-to-zero."""
    from collections import defaultdict
    groups = defaultdict(list)
    for r in ledger["ledger"]:
        if r.get("status") == "deferred":
            reason = r.get("reason") or r.get("deferred") or "(no reason tag)"
            groups[reason].append(r.get("token") or r.get("icon") or r.get("label") or "?")
    if not groups:
        return
    print(f"\n  parity debt: {sum(len(v) for v in groups.values())} OO controls deferred (future-iteration):")
    for reason in sorted(groups):
        toks = sorted(set(str(t) for t in groups[reason]))
        print(f"    [{reason}] {len(toks)}: {', '.join(toks[:12])}")
        if len(toks) > 12:
            print(f"      +{len(toks)-12} more")


def apply_register(flips: list[tuple[str, str, str]]) -> list[str]:
    """Flip parity to full on features.yaml rows whose divergence still
    mentions the promoted data-stub ref. Best effort; unknown refs warn."""
    path = HARNESS / "harness-graph" / "features.yaml"
    text = path.read_text(encoding="utf-8")
    refs = {fl[1] for fl in flips}
    changed = []
    for ref in sorted(refs):
        needle = f"data-stub={ref}"
        occurrences = 0
        idx = text.find(needle)
        while idx != -1:
            occurrences += 1
            # the row is a 1-2 line YAML flow entry starting at "  - {id: F-###"
            row_start = text.rfind("\n  - {id: F-", 0, idx) + 1
            row_end = text.find("\n  - {id: F-", idx)
            if row_end == -1:
                row_end = len(text)
            block = text[row_start:row_end]
            m = re.search(r"id: F-(\d{3})", block)
            if not m:
                changed.append(f"(data-stub={ref}: row block has no F-id)")
                idx = text.find(needle, idx + 1)
                continue
            fid = m.group(1)
            block2 = re.sub(r"parity: (absent|missing)", "parity: full", block, count=1)
            block2 = re.sub(
                r"ref: absent",
                'ref: auto-flipped, justification: "Parity flipped mechanically by reconcile (button'
                f' promoted from data-stub={ref}); fidelity level and divergence prose still need a'
                ' human audit."',
                block2,
                count=1,
            )
            if block2 != block:
                text = text[:row_start] + block2 + text[row_end:]
                changed.append(f"features.yaml F-{fid}: parity -> full (was data-stub={ref})")
            idx = text.find(needle, idx + 1)
        if occurrences == 0:
            changed.append(f"(no features.yaml row references data-stub={ref})")
    if changed and any("features.yaml F-" in c for c in changed):
        path.write_text(text)
    return changed


def run_seed(check_only: bool = False) -> int:
    seed = HARNESS / "harness-graph" / "seed.py"
    cmds = []
    if not check_only:
        cmds.append([sys.executable, str(seed)])
    cmds.append([sys.executable, str(seed), "--check"])
    for c in cmds:
        rc = subprocess.run(c, cwd=HARNESS).returncode
        if rc != 0:
            return rc
    return 0


def self_test() -> None:
    prev = {
        "tabs": {
            "insert": {"buttons": [
                {"id": "btn-dropcap", "label": "Drop Cap", "stub": "insert.dropcap"},
                {"id": "btn-hyp", "label": "Hyphenation", "stub": "layout.hyphenation"},
                {"id": "btn-kept", "label": "Citation", "stub": "ref.citation"},
            ]},
        },
        "surfaces": {},
    }
    curr = {
        "tabs": {
            "insert": {"buttons": [
                {"id": "btn-dropcap", "label": "Drop Cap", "cmd": "toggleDropcap"},
                {"id": "btn-hyp", "label": "Hyphenation", "cmd": "toggleHyphenation"},
                {"id": "btn-kept", "label": "Citation", "stub": "ref.citation"},
            ]},
        },
        "surfaces": {},
    }
    flips = diff_promotions(prev, curr)
    assert flips == [("btn-dropcap", "insert.dropcap", "toggledropcap"),
                     ("btn-hyp", "layout.hyphenation", "togglehyphenation")], flips
    # a stub that vanished without a replacement must NOT produce a flip
    prev["tabs"]["insert"]["buttons"].append({"id": "btn-gone", "label": "Gone", "stub": "ref.index"})
    assert diff_promotions(prev, curr) == flips
    print("self-test OK: promotions delta detected, silent disappearances ignored")

    # stale-deferred: a deferred MAP row whose feature the WO census now ships as
    # a real control must classify STALE-DEFERRED (parity under-report) and the
    # gate must fail. Use a fake WO capture that ships `btn-shadow` cmd=`toggleShadow`
    # for a MAP token that is still `deferred`, plus one still-true deferral.
    # (MAP's `watermark` is deferred=true deferral; pick a genuinely deferred token
    # and a control key it would map to: `blankpage` -> WO would output btn-blankpage)
    import json as _json, pathlib as _pl, subprocess
    fake = {
        "tabs": {
            "insert": {"buttons": [
                {"id": "btn-blankpage", "cmd": "insertBlankPage"},  # MAP: blankpage deferred
                {"id": "btn-txt", "cmd": "insertSimple"},
            ]},
        },
        "surfaces": {},
    }
    td = _pl.Path(tempfile.mkdtemp())
    fake_file = td / "census-wo.json"
    fake_file.write_text(_json.dumps(fake))
    led_file = td / "l.json"
    old_cwd = Path.cwd()
    os.chdir(HERE)
    try:
        r = subprocess.run([sys.executable, "census-diff.py", "--wo", str(fake_file),
                            "--ledger", str(led_file)], capture_output=True, text=True)
    finally:
        os.chdir(old_cwd)
    assert r.returncode == 0, r.stderr
    led = _json.load(open(led_file, encoding="utf-8"))
    stale = [x for x in led["ledger"] if x["status"] == "STALE-DEFERRED"]
    assert any(x.get("token") == "blankpage" for x in stale), \
        f"expected blankpage STALE-DEFERRED, got {[x.get('token') for x in stale]}"
    assert led["counts"]["STALE-DEFERRED"] == 1, led["counts"]
    # gate must flag the under-report as a decision: STALE-DEFERRED counts as bad
    assert not gate({"counts": {"STALE-DEFERRED": 1}, "ledger": [stale[0]]}), \
        "gate should FAIL while blankpage is STALE-DEFERRED"
    assert gate({"counts": {}, "ledger": []}), "clean ledger must pass"
    print("self-test OK: stale-deferred detected and gated")


def run_interactions(server: Path, out: Path) -> int:
    """Click-through census (interact-wo.cjs) + join vs the committed OO
    reference. Returns 0 iff no missing/type/geometry interaction gaps."""
    capture(server, out, script="interact-wo.cjs")
    return subprocess.run(
        [sys.executable, "interact-diff.py", "--wo", str(out / "interact-wo.json"),
         "--out", str(out)],
        cwd=HERE,
    ).returncode


def run_fx(server: Path, out: Path) -> int:
    """Functional census (fx-wo.cjs): every ribbon control must produce an
    observable effect (doc/menu/dialog/panel/status/chrome) when clicked.
    fx-wo.cjs exits non-zero on silent/unclickable beyond the documented
    EXPECTED_SILENT precondition no-ops — the loud-stub gate."""
    capture(server, out, script="fx-wo.cjs")
    return 0  # non-zero exit inside capture raises; green run writes fx-wo.json


def run_geometry(server: Path, out: Path) -> int:
    """Geometry census (geom-wo.cjs) + gate vs the committed golden
    (geom-wo.json) with structural invariants. Returns 0 iff no drift beyond
    tolerance and no overlap/alignment/ordering violations."""
    capture(server, out, script="geom-wo.cjs")
    gold = HERE / f"geom-wo.{sys.platform}.json"
    if not gold.exists():
        gold = HERE / "geom-wo.json"
    return subprocess.run(
        [sys.executable, "geom-diff.py", "--wo", str(out / "geom-wo.json"),
         "--gold", str(gold)],
        cwd=HERE,
    ).returncode


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--skip-capture", action="store_true", help="reuse existing census-wo.json")
    ap.add_argument("--apply-register", action="store_true", help="flip features.yaml parity for flipped refs")
    ap.add_argument("--seed-check", action="store_true", help="regenerate graph.json + drift gate")
    ap.add_argument("--check", action="store_true", help="CI gate: no writes; fail on any pending promotion/residue")
    ap.add_argument("--interactions", action="store_true",
                    help="capture the click-through interaction census + gate on missing/type/geometry gaps")
    ap.add_argument("--fx", action="store_true",
                    help="capture the functional census + gate on silent/unclickable controls (loud-stub gate)")
    ap.add_argument("--geometry", action="store_true",
                    help="capture the geometry census + gate on drift/overlaps vs the committed golden")
    ap.add_argument("--self-test", action="store_true", help="run the delta-logic self-test and exit")
    args = ap.parse_args()

    if args.self_test:
        self_test()
        return 0

    server = resolve_server()

    if args.check:
        # ── CI gate: fresh capture into a throwaway dir, zero writes ──
        with tempfile.TemporaryDirectory(prefix="reconcile-check-") as td:
            tmp = Path(td)
            if args.skip_capture:
                wo = WO_JSON
            else:
                print(f"[1/4] capture (check): spawning docserver from {server} …")
                print(f"      captured via {capture(server, tmp)}")
                wo = tmp / "census-wo.json"
            prev = json.loads(WO_PREV.read_text(encoding="utf-8")) if WO_PREV.exists() else {"tabs": {}, "surfaces": {}}
            curr = json.load(open(wo, encoding="utf-8"))
            flips = diff_promotions(prev, curr)
            if flips:
                print("[2/4] diff: FAIL — unregistered promotions (run reconcile.py and commit):")
                for key, ref, cmd in flips:
                    print(f"      {key}: data-stub={ref} -> real {cmd}")
                return 1
            print("[2/4] diff: no unregistered promotions")
            ledger = run_join(wo, tmp / "ledger.json")
            print("[3/4] join: LEDGER", json.dumps(ledger["counts"]))
            ok = gate(ledger)
            report_deferred(ledger)
            print("[4/4] gate:", "PASS — ledger clear" if ok else "FAIL — decisions above remain")
            rc = 0 if ok else 1
            if args.interactions:
                print("      interactions: click-through census vs OO reference")
                if run_interactions(server, tmp) != 0:
                    rc = 1
            if args.fx:
                print("      fx: functional census (loud-stub gate)")
                try:
                    run_fx(server, tmp)
                except SystemExit:
                    rc = 1
            if args.geometry:
                print("      geometry: drift + structural invariants vs golden")
                try:
                    if run_geometry(server, tmp) != 0:
                        rc = 1
                except SystemExit:
                    rc = 1
            if args.seed_check:
                print("      seed: drift gate (graph.json vs committed)")
                if run_seed(check_only=True) != 0:
                    rc = 1
            return rc

    # ── normal: repair + gate ──
    if not args.skip_capture:
        print(f"[1/4] capture: spawning docserver from {server} …")
        print(f"      census-wo.json refreshed via {capture(server, CENSUS)}")
    else:
        print("[1/4] capture: --skip-capture, using existing census-wo.json")

    prev_exists = WO_PREV.exists()
    prev = json.loads(WO_PREV.read_text(encoding="utf-8")) if prev_exists else {"tabs": {}, "surfaces": {}}
    curr = json.load(open(WO_JSON, encoding="utf-8"))

    print("[2/4] diff: promotions since last reconciled capture")
    flips = diff_promotions(prev, curr) if prev_exists else []
    if not flips:
        print("      none (no stub->cmd promotions detected)")
    for line in apply_map_flips(flips):
        print("     ", line)
    rotate_prev()

    print("[3/4] join: census-diff -> ledger")
    ledger = run_join(WO_JSON, CENSUS / "ledger.json")
    counts = ledger["counts"]
    print("      LEDGER:", json.dumps(counts))
    report_deferred(ledger)

    if args.apply_register and flips:
        for line in apply_register(flips):
            print("     ", line)

    ok = gate(ledger)
    print("[4/4] gate:", "PASS — ledger clear" if ok else "FAIL — decisions above remain")

    interact_rc = 0
    if args.interactions:
        print("      interactions: click-through census (interact-wo.cjs)")
        interact_rc = run_interactions(server, CENSUS)

    fx_rc = 0
    if args.fx:
        print("      fx: functional census (fx-wo.cjs, loud-stub gate)")
        try:
            run_fx(server, CENSUS)
        except SystemExit:
            fx_rc = 1

    geom_rc = 0
    if args.geometry:
        print("      geometry: drift + structural invariants (geom-wo.cjs + geom-diff.py)")
        try:
            geom_rc = run_geometry(server, CENSUS)
        except SystemExit:
            geom_rc = 1

    seed_rc = 0
    if args.seed_check:
        print("      seed: regenerate graph + drift gate")
        seed_rc = run_seed(check_only=False)
        if seed_rc != 0:
            print("      seed --check FAILED (commit the regenerated graph.json)")

    return 0 if (ok and seed_rc == 0 and interact_rc == 0 and fx_rc == 0 and geom_rc == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
