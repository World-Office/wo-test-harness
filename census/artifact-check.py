#!/usr/bin/python3
"""artifact-check.py — deterministic interact-ledger assertions.

The ledger-gap AI layer is ADVISORY; this script is the deterministic twin:
it asserts measured facts about census/census/interact-ledger.json and exits
non-zero with the offending rows listed loudly.

  A. census-artifacts: NO rows with status=='unmatched' whose note says the
     WO button was never captured by the interaction census
     ("wo=btn-X not in interact census"). These are harness blindness, not
     editor gaps — fix interact-wo.cjs capture, never the MAP.
  B. OO-parity modals: the divergent-behavior tokens (OO opens a modal where
     WO direct-toggles) must be status=='ok' once WO ships the modal.

--self-test: offline fixtures only (no ledger, no browser, no LLM).
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_LEDGER = HERE / "census" / "interact-ledger.json"
ARTIFACT_NOTE = "not in interact census"
MODAL_TOKENS = ("header-footer", "pagenumber", "footnote", "trackchanges")


def load_rows(path):
    """Return the row list from an interact-ledger JSON (dict or list)."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    return data.get("rows") or data.get("ledger") or []


def artifact_failures(rows):
    """Rows whose button the interaction census never captured."""
    hits = [
        r for r in rows
        if r.get("status") == "unmatched" and ARTIFACT_NOTE in (r.get("note") or "")
    ]
    return hits


def modal_failures(rows):
    """Modal tokens not yet at OO parity (status != ok)."""
    bad = []
    for token in MODAL_TOKENS:
        for r in rows:
            if r.get("token") == token and r.get("status") != "ok":
                bad.append(f"{token}: status={r.get('status')} note={r.get('note') or ''}")
    return bad


def check(rows):
    """Return (artifact_rows, modal_failures) for the given ledger rows."""
    return artifact_failures(rows), modal_failures(rows)


def self_test():
    """Offline fixtures: both failure modes fire, clean ledger passes."""
    artifact = [{"token": "smartart", "status": "unmatched",
                 "note": "wo=btn-smartart not in interact census"}]
    divergence = [{"token": "footnote", "status": "divergence", "note": ""}]
    clean = [{"token": t, "status": "ok", "note": ""} for t in MODAL_TOKENS]
    assert len(artifact_failures(artifact)) == 1, "artifact fixture must fire"
    assert len(modal_failures(divergence)) == 1, "divergence fixture must fire"
    assert artifact_failures(clean) == [] and modal_failures(clean) == [], \
        "clean fixture must pass"
    print("artifact-check self-test: OK")


def main(argv):
    if "--self-test" in argv:
        self_test()
        return 0
    path = DEFAULT_LEDGER
    if "--ledger" in argv:
        path = Path(argv[argv.index("--ledger") + 1])
    arts, mods = check(load_rows(path))
    for r in arts:
        print(f"ARTIFACT  [{r.get('tab')}] {r.get('token')}: {r.get('note')}")
    for m in mods:
        print(f"MODAL     {m}")
    if arts or mods:
        print(f"artifact-check: FAIL ({len(arts)} artifacts, {len(mods)} modal gaps)")
        return 1
    print(f"artifact-check: OK ({path})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
