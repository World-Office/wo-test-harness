#!/usr/bin/env python3
"""react-deficit.py — OO drop-in replacement deficit report.

Joins the OO census golden (census/census/census-oo.json, 13 tabs, rendered
DOM truth) against the React ribbon spec (word-ribbon.ts, what production
ships) by normalized label, producing the per-tab missing-control list that
feeds the OO-DROPIN taskfleet campaign.

OO census quirk: quick-access controls (Copy/Paste/CopyStyle/IncFont/DecFont)
repeat in EVERY tab — dedup via GLOBAL_MIN occurrences (same as the vanilla
ledger's global-repeat rule).

Output: react-deficit.json { tabs: {tab: [missing labels]}, globals: [...],
unique_missing: N } + stdout summary. Exit 0 always (report, not gate).
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

CENSUS = Path(__file__).resolve().parent
SERVER = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    __import__("os").environ.get("WO_SERVER_DIR", "/home/weiss/git/World-Office/server"))
SPEC = SERVER / "packages/editor-common/src/ribbon/specs/word-ribbon.ts"
GLOBAL_MIN = 8  # a control censused in >=8 of 13 tabs is a global, not tab-local


def norm(label: str) -> str:
    s = re.sub(r"\(.*?\)", "", label)          # strip "(Ctrl+Insert)" hints
    s = re.sub(r"[^a-z0-9]", "", s.lower())   # space/punct-insensitive key
    return s


def main():
    oo = json.loads((CENSUS / "census" / "census-oo.json").read_text())
    spec = SPEC.read_text()

    spec_labels = {norm(m) for m in re.findall(r'label:\s*"([^"]+)"', spec)}
    spec_ids = set(re.findall(r'id:\s*"([a-z0-9-]+)"', spec))

    counts = Counter()
    per_tab = {}
    for tab, v in oo["tabs"].items():
        labels = [b.get("label", "") for b in v.get("buttons", [])]
        per_tab[tab] = labels
        for l in labels:
            counts[norm(l)] += 1

    globals_ = sorted(n for n, c in counts.items() if c >= GLOBAL_MIN)
    report = {"tabs": {}, "globals_missing": [], "total": 0}
    for tab, labels in per_tab.items():
        missing = []
        for l in labels:
            n = norm(l)
            if not n or n in spec_labels:
                continue
            if counts[n] >= GLOBAL_MIN:
                if n not in report["globals_missing"]:
                    report["globals_missing"].append(n)
                continue
            if n not in missing:
                missing.append(l)
        if missing:
            report["tabs"][tab] = missing
            report["total"] += len(missing)

    out = CENSUS / "react-deficit.json"
    out.write_text(json.dumps(report, indent=1) + "\n")
    print(f"spec labels: {len(spec_labels)} | spec ids: {len(spec_ids)}")
    print(f"globals detected: {len(globals_)} | globals missing from spec: {len(report['globals_missing'])}")
    for tab, m in report["tabs"].items():
        print(f"  {tab:14} missing {len(m):3}: {'; '.join(m[:8])}{' …' if len(m) > 8 else ''}")
    print(f"UNIQUE tab-local missing: {report['total']} -> {out}")


if __name__ == "__main__":
    main()
