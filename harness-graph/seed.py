#!/usr/bin/env python3
"""Compile the feature register + repo inventory into the harness graph.

The graph is the traceability backbone of the OnlyOffice-parity harness:
Features ↔ Surfaces ↔ Commands ↔ Tests. Repo files are the source of truth;
graph.json is a committed projection; Neo4j (optional) is a query engine.

Usage:
  seed.py                     # regenerate graph.json (exit 1 on semantic change without update)
  seed.py --check             # CI drift gate: regenerate, diff against committed graph.json
  seed.py --report            # print coverage gaps + parity summary
  seed.py --cypher            # emit Cypher (constraints + MERGEs) for Neo4j instead of writing

Graph schema (v1):
  (:Feature {id, area, name, parity, fidelity})
  (:Surface {id, kind, source})
  (:Command {id, source})
  (:Test    {id, path, layer})
  (:Divergence {feature, justification})
  (Feature)-[:HAS_SURFACE]->(Surface)-[:TRIGGERS]->(Command)
  (Feature)-[:IMPLEMENTED_BY]->(Command)
  (Test)-[:COVERS]->(Feature)

Conventions:
  - A pytest test covers a feature by containing the marker/annotation `F-###`
    anywhere in the test file (e.g. `@pytest.mark.F-010` or a comment).
  - Commands are auto-inventoried from `data-cmd="…"` (index.html) and
    `runCommand("…")` string literals (editor.js).
  - Rust tests in core/crates/**/src/**/*.rs that contain #[test] or #[cfg(test)]
    are scanned for F-### markers and create Test nodes with layer="rust".
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import os

import yaml

HERE = Path(__file__).resolve().parent
HARNESS_ROOT = HERE.parent  # wo-test-harness repo root


def _resolve_server() -> Path:
    """Locate the World-Office server checkout.

    Priority: WO_SERVER_DIR env var, then a sibling `server/` directory next
    to this harness repo, then the legacy in-repo layout.
    """
    env = os.environ.get("WO_SERVER_DIR")
    if env:
        p = Path(env)
        if (p / "opencloud-docserver").is_dir():
            return p
        # Rust canonical server (2026-10-14+): Cargo workspace + core/crates/wo-docserver
        # For test fixtures, accept any directory with core/crates/ (even without Cargo.toml)
        if (p / "Cargo.toml").is_file() and (p / "core" / "crates" / "wo-docserver").is_dir():
            return p
        # Accept any directory with core/crates/ and at least one crate subdirectory (for test fixtures)
        if (p / "core" / "crates").is_dir():
            if any((p / "core" / "crates" / d).is_dir() for d in (p / "core" / "crates").iterdir()):
                return p
        raise SystemExit(f"WO_SERVER_DIR={env} is not a server checkout (no opencloud-docserver/ nor core/crates/)")
    cand = HARNESS_ROOT.parent / "server"
    if (cand / "opencloud-docserver").is_dir():
        return cand
    if (cand / "Cargo.toml").is_file() and (cand / "core" / "crates" / "wo-docserver").is_dir():
        return cand
    # legacy: this repo used to live at <server>/scripts/harness-graph
    if (HARNESS_ROOT.parent / "opencloud-docserver").is_dir():
        return HARNESS_ROOT.parent
    raise SystemExit(
        "Cannot locate server checkout: set WO_SERVER_DIR to the World-Office/server repo root"
    )


SERVER = _resolve_server()
_LEGACY = SERVER / "opencloud-docserver"
_RUST_UI = SERVER / "apps" / "web" / "apps" / "documenteditor-wysiwyg"
DEFAULTS = {
    "features": HERE / "features.yaml",
    # Rust canonical sources first; legacy python tree retained only if present.
    "editor_js": (_RUST_UI / "editor.js" if (_RUST_UI / "editor.js").exists()
                  else _LEGACY / "web" / "editor.js"),
    "index_html": (_RUST_UI / "index.html" if (_RUST_UI / "index.html").exists()
                   else _LEGACY / "web" / "index.html"),
    # python e2e/unit roots are gone on the canonical rust stack; build_graph
    # already skips missing roots, so coverage honestly reports what exists.
    "pytest_roots": [
        _LEGACY / "e2e",
        _LEGACY / "tests",
    ],
    "out": HERE / "graph.json",
}

F_ID = re.compile(r"\bF-\d{3}\b")
DATA_CMD = re.compile(r'data-cmd="([A-Za-z0-9_-]+)"')
RUN_CMD = re.compile(r'runCommand\(\s*"([A-Za-z0-9_-]+)"')


def _is_rust_test_file(path: Path) -> bool:
    """Return True if path is a Rust file in core/crates/**/src/**/*.rs that contains #[test] or #[cfg(test)]."""
    if not path.name.endswith('.rs'):
        return False
    # Check if it's under core/crates/**/src/**/
    try:
        rel = path.relative_to(SERVER / "core" / "crates")
        parts = rel.parts
        # Must be under some crate's src directory
        if len(parts) < 2 or parts[1] != 'src':
            return False
    except ValueError:
        return False
    
    text = path.read_text(encoding='utf-8', errors='replace')
    return bool(re.search(r'#\[[a-z_:]*test\]|#\[cfg\(test\)\]', text))


def _scan_rust_tests() -> dict[str, set[str]]:
    """Scan Rust test files and return a mapping of F-### markers to test node ids.
    
    For each Rust file under core/crates/**/src/**/*.rs that contains #[test] or #[cfg(test)],
    find all test functions (fn with #[test] attribute) and all F-### markers, and return
    a mapping from each marker to the set of test function ids that cover it.
    
    Returns:
        dict mapping feature_id (F-###) to set of test node ids
    """
    covers: dict[str, set[str]] = defaultdict(set)
    
    core_crates = SERVER / "core" / "crates"
    if not core_crates.is_dir():
        return covers
    
    # Find all *.rs files under core/crates/**/src/**/
    for crate_dir in sorted(core_crates.iterdir()):
        if not crate_dir.is_dir():
            continue
        src_dir = crate_dir / "src"
        if not src_dir.is_dir():
            continue
        
        for rs_file in src_dir.rglob('*.rs'):
            if not _is_rust_test_file(rs_file):
                continue
            
            text = rs_file.read_text(encoding="utf-8", errors="replace")
            rel = rs_file.relative_to(SERVER).as_posix()
            
            # Find all F-### markers in the file
            markers = set(F_ID.findall(text))
            
            if not markers:
                continue
            
            # Find all test functions (functions with #[test] attribute)
            # Pattern: look for #[test] attribute followed by fn definition
            lines = text.split('\n')
            test_fn_names = set()
            
            for i, line in enumerate(lines):
                if '#[test]' in line:
                    # Look ahead for fn definition (within next 5 lines)
                    for j in range(i+1, min(i+6, len(lines))):
                        # Skip attribute lines
                        if lines[j].strip().startswith('#['):
                            continue
                        fn_match = re.match(r'^\s*fn\s+([A-Za-z0-9_]+)\s*\(', lines[j])
                        if fn_match:
                            test_fn_names.add(fn_match.group(1))
                            break
            
            # If no #[test] functions found, check for #[cfg(test)] module
            # and extract all functions inside it
            if not test_fn_names:
                # Look for #[cfg(test)] mod tests blocks
                in_cfg_test_block = False
                cfg_test_depth = 0
                for i, line in enumerate(lines):
                    stripped = line.strip()
                    if stripped.startswith('#[cfg(test)]'):
                        in_cfg_test_block = True
                        cfg_test_depth = 1
                        continue
                    if in_cfg_test_block:
                        if stripped.startswith('#['):
                            cfg_test_depth += 1
                        elif stripped == '}':
                            cfg_test_depth -= 1
                            if cfg_test_depth == 0:
                                in_cfg_test_block = False
                        elif cfg_test_depth == 1:
                            # Look for fn inside #[cfg(test)] block
                            fn_match = re.match(r'^\s*fn\s+([A-Za-z0-9_]+)\s*\(', line)
                            if fn_match:
                                test_fn_names.add(fn_match.group(1))
                        continue
            
            # Create test nodes and record covers
            # Each test function covers ALL F-### markers in the file (same as pytest scanner)
            # ponytail: async-only test files (#[tokio::test] etc.) defeat fn-name parsing, so
            # fall back to ONE file-level Test node so their markers still register coverage.
            if not test_fn_names:
                test_fn_names.add('*file')
            for test_fn in sorted(test_fn_names):
                tid = f"tests/{rel}::{test_fn}"
                for fid in markers:
                    covers[fid].add(tid)
    
    return covers


def build_graph(paths: dict[str, Path]) -> dict:
    features = yaml.safe_load(paths["features"].read_text(encoding="utf-8"))["features"]

    nodes: list[dict] = []
    edges: list[dict] = []
    seen: set[tuple[str, str]] = set()

    def node(label: str, node_id: str, **props) -> None:
        key = (label, node_id)
        if key in seen:
            return
        seen.add(key)
        nodes.append({"label": label, "id": node_id, **props})

    def edge(src: str, dst: str, kind: str) -> None:
        e = {"from": f"{src}", "to": f"{dst}", "type": kind}
        if e not in edges:
            edges.append(e)

    # ── inventory: commands (editor.js) + surfaces (index.html) ──────────────
    js_text = paths["editor_js"].read_text(encoding="utf-8") if paths["editor_js"].exists() else ""
    html_text = paths["index_html"].read_text(encoding="utf-8") if paths["index_html"].exists() else ""

    js_cmds = {
        cmd: f"editor.js:runCommand('{cmd}')"
        for cmd in sorted(set(RUN_CMD.findall(js_text)) | set(DATA_CMD.findall(html_text)))
    }
    html_cmds = set(DATA_CMD.findall(html_text))
    for cmd, src in js_cmds.items():
        node("Command", cmd, source=src)
    for cmd in sorted(html_cmds):
        node("Surface", f"toolbar:{cmd}", kind="toolbar-button", source="index.html")
        edge(f"toolbar:{cmd}", cmd, "TRIGGERS")

    # ── inventory: pytest tests + F-marker coverage ──────────────────────────
    covers: dict[str, set[str]] = defaultdict(set)  # feature -> test ids
    for root in paths["pytest_roots"]:
        if not root.exists():
            continue
        for path in sorted(root.glob("test_*.py")):
            text = path.read_text(encoding="utf-8")
            rel = path.relative_to(SERVER).as_posix()
            for name in re.findall(r"^def (test_[A-Za-z0-9_]+)", text, re.M):
                tid = f"{rel}::{name}"
                node("Test", tid, path=rel, layer="e2e")
                for fid in set(F_ID.findall(text)):
                    covers[fid].add(tid)

    # ── inventory: Rust tests in core/crates/**/src/**/*.rs ──────────────
    rust_covers = _scan_rust_tests()
    # Add rust test nodes and merge covers
    rust_test_nodes = set()
    for fid, test_ids in rust_covers.items():
        for tid in test_ids:
            rust_test_nodes.add(tid)
            covers[fid].add(tid)
    
    for tid in sorted(rust_test_nodes):
        # Extract path and function name from tid
        # tid format: tests/{rel_path}::{fn_name}
        if tid.startswith("tests/"):
            rest = tid[7:]  # Remove "tests/" prefix
            path_part, fn_part = rest.rsplit("::", 1) if "::" in rest else (rest, rest)
            node("Test", tid, path=path_part, layer="rust")
        else:
            node("Test", tid, path=tid, layer="rust")

    # ── census browser probes (probe-*.cjs): F-marker header => PROBED_BY ───
    census_dir = HARNESS_ROOT / "census"
    if census_dir.is_dir():
        for path in sorted(census_dir.glob("probe-*.cjs")):
            text = path.read_text(encoding="utf-8", errors="replace")
            rel = path.relative_to(HARNESS_ROOT).as_posix()
            pid = f"census:{rel}"
            node("Probe", pid, path=rel, layer="census")
            for fid in sorted(set(F_ID.findall(text))):
                edge(pid, fid, "PROBES")

    # ── features ─────────────────────────────────────────────────────────────
    known_cmds = set(js_cmds)
    missing_impl: list[str] = []
    for f in features:
        fid = f["id"]
        node(
            "Feature",
            fid,
            area=f["area"],
            name=f["name"],
            parity=f["parity"],
            fidelity=f["fidelity"],
        )
        for surf in f.get("surfaces", []):
            node("Surface", surf, kind="declared", source="features.yaml")
            edge(fid, surf, "HAS_SURFACE")
        for cmd in f.get("commands", []):
            if cmd not in known_cmds:
                missing_impl.append(f"{fid}: command '{cmd}' not found in editor.js/index.html")
                continue
            edge(fid, cmd, "IMPLEMENTED_BY")
        for tid in sorted(covers.get(fid, ())):
            edge(tid, fid, "COVERS")
        for div in f.get("divergence", []):
            node("Divergence", f"{fid}:{div['ref']}", justification=div["justification"])

    return {
        "version": 1,
        "stats": {
            "features": sum(1 for n in nodes if n["label"] == "Feature"),
            "commands": sum(1 for n in nodes if n["label"] == "Command"),
            "surfaces": sum(1 for n in nodes if n["label"] == "Surface"),
            "tests": sum(1 for n in nodes if n["label"] == "Test"),
            "edges": len(edges),
        },
        "nodes": nodes,
        "edges": edges,
    }


def canonical(g: dict) -> str:
    """generated_at-independent form for drift checks."""
    return json.dumps(g, sort_keys=True, indent=1)


def report(g: dict) -> str:
    feats = [n for n in g["nodes"] if n["label"] == "Feature"]
    covered = {e["to"] for e in g["edges"] if e["type"] == "COVERS"}
    
    lines = []
    
    # Print COVERED lines for each feature that has at least one covering test
    for f in sorted(feats, key=lambda x: x["id"]):
        if f["id"] in covered:
            lines.append(f"COVERED {f['id']} [{f['parity']:<7}] {f['area']:<12} {f['name']}")
    
    lines.append("")
    lines.append("parity coverage by area (features with ≥1 covering test):")
    by_area: dict[str, list[dict]] = defaultdict(list)
    for f in feats:
        by_area[f["area"]].append(f)

    for area in sorted(by_area):
        fs = by_area[area]
        done = sum(1 for f in fs if f["id"] in covered)
        bar = "#" * done + "." * (len(fs) - done)
        lines.append(f"  {area:<14} {bar} {done}/{len(fs)}")

    gaps = [f for f in feats if f["id"] not in covered]
    lines.append(f"\nuncovered features ({len(gaps)}):")
    for f in gaps:
        lines.append(f"  {f['id']}  [{f['parity']:<7}] {f['area']:<12} {f['name']}")
    return "\n".join(lines)


def cypher(g: dict) -> str:
    out = ["// constraints", ""]
    for label in ("Feature", "Surface", "Command", "Test", "Divergence"):
        out.append(f"CREATE CONSTRAINT IF NOT EXISTS FOR (n:{label}) REQUIRE n.id IS UNIQUE;")
    out.append("\n// nodes")
    for n in g["nodes"]:
        props = {k: v for k, v in n.items() if k != "label"}
        body = ", ".join(
            f"{k}: {json.dumps(v)}" for k, v in props.items()
        )
        out.append(f"MERGE (n:{n['label']} {{id: {json.dumps(n['id'])}}}) SET n += {{{body}}};")
    out.append("\n// edges")
    for e in g["edges"]:
        out.append(
            f"MATCH (a {{id: {json.dumps(e['from'])}}}), (b {{id: {json.dumps(e['to'])}}}) "
            f"MERGE (a)-[:{e['type']}]->(b);"
        )
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="drift gate: compare against committed graph.json")
    ap.add_argument("--report", action="store_true", help="print coverage gaps + parity summary")
    ap.add_argument("--cypher", action="store_true", help="emit Cypher to stdout instead of writing graph.json")
    ap.add_argument("--no-write", action="store_true", help="never write/modify graph.json (pure read mode)")
    args = ap.parse_args()

    g = build_graph({
        k: Path(v) if not isinstance(v, list) else [Path(p) for p in v]
        for k, v in DEFAULTS.items()
    })
    g["generated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")

    if args.cypher:
        print(cypher(g))
        return 0

    if args.check:
        committed = json.loads(DEFAULTS["out"].read_text(encoding="utf-8")) if DEFAULTS["out"].exists() else None
        if committed is None:
            print(f"FAIL: {DEFAULTS['out']} missing — commit a fresh graph.json", file=sys.stderr)
            return 1
        stale = {k: v for k, v in g.items() if k != "generated_at"}
        old = {k: v for k, v in committed.items() if k != "generated_at"}
        if stale != old:
            print("FAIL: graph.json is stale — run `seed.py` and commit (recapture-as-PR, never silent recapture)", file=sys.stderr)
            return 1
        print(f"OK: graph.json in sync ({g['stats']})")
        return 0

    if not args.no_write:
        DEFAULTS["out"].write_text(canonical(g) + "\n", encoding="utf-8")
        print(f"wrote {DEFAULTS['out']} ({g['stats']})")
    
    if args.report:
        print(report(g))
    
    if not args.check and not args.report and not args.cypher:
        print(f"OK: graph.json in sync ({g['stats']})")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
