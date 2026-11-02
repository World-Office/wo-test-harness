#!/usr/bin/python3
"""test-no-parked.py — PKG-001 contract, runnable offline.

build.py already refuses to write a ledger containing a silently parked row;
this pins both halves of the contract without a live rebuild:

  1. the COMMITTED ledger.json contains no 'parked' anywhere (the acceptance
     gate's exact contract, strict form — grep -qv would pass on one clean
     line even with parked rows elsewhere);
  2. the build.py guard still TRIPS when a synthetic parked row sneaks in
     (catches the guard being silently weakened or deleted later).

Run: /usr/bin/python3 census/ledger/test-no-parked.py
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
CEN = HERE.parent


def main() -> int:
    # 1. committed artifact is clean
    blob = (HERE / "ledger.json").read_text(encoding="utf-8")
    assert "parked" not in blob, (
        "ledger.json contains 'parked' — promote the row to REGISTERED_PARKS "
        "(loud divergence) and rebuild: /usr/bin/python3 census/ledger/build.py")

    # 2. the guard trips on a synthetic silent park (temp copy, tree untouched)
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        shutil.copytree(HERE, td / "ledger")
        shutil.copytree(CEN / "census", td / "census")
        src = (td / "ledger" / "build.py").read_text(encoding="utf-8")
        anchor = 'out = HERE / "ledger.json"'
        assert anchor in src, "build.py anchor moved — update test-no-parked.py"
        src = src.replace(
            anchor,
            'ledger["_t"] = {"feature": "_t", "park_reason": "parked?"}\n' + anchor, 1)
        (td / "ledger" / "build.py").write_text(src, encoding="utf-8")
        p = subprocess.run([sys.executable, str(td / "ledger" / "build.py")],
                           capture_output=True, text=True)
        assert p.returncode != 0 and "silently parked" in p.stdout + p.stderr, (
            f"build.py guard did not trip: rc={p.returncode} "
            f"out={p.stdout[-400:]} err={p.stderr[-400:]}")

    print("test-no-parked: OK (committed ledger clean; build guard trips)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
