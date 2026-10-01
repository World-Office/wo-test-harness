#!/usr/bin/python3
"""scope report: rebuild-readiness by surface. `--check` fails if a `live`
surface's `where` path is missing (no phantom claims)."""
import sys
from pathlib import Path
import yaml
ROOT = Path(__file__).resolve().parent.parent
s = yaml.safe_load((Path(__file__).parent / "scope.yaml").read_text(encoding="utf-8"))["surfaces"]
by = {k: [x for x in s if x["status"] == k] for k in ("live", "partial", "none")}
print(f"OnlyOffice-in-Rust harness readiness: {len(by['live'])} live / {len(by['partial'])} partial / {len(by['none'])} none of {len(s)} surfaces\n")
for k in ("none", "partial", "live"):
    for x in by[k]:
        print(f"  [{k:7}] {x['id']:14} {x['name']}\n            oracle: {x['oracle']}")
bad = [x["id"] for x in by["live"] if not (ROOT / x.get("where", "").split("/")[0]).exists()]
if "--check" in sys.argv and bad:
    print("PHANTOM live surfaces:", bad); sys.exit(1)
