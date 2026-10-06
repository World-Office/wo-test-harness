#!/usr/bin/env python3
"""struct-probe.py — dump WO and OO toolbar child-row structure (chrome-height
investigation). Spawns the canonical docserver for WO; OO from the rig.
Env: WO_SERVER_DIR, CHROME_OO_URL."""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import reconcile as R  # noqa: E402


def main() -> int:
    server = Path(os.environ.get("WO_SERVER_DIR") or (HERE.parent / "server")).resolve()
    with tempfile.TemporaryDirectory(prefix="struct-probe-") as td:
        base, procs = R.spawn_docserver(server, Path(td), "rust")
        try:
            subprocess.run(
                ["node", "chrome-struct.cjs"], cwd=HERE, check=True,
                env={**os.environ,
                     "STRUCT_URL": f"{base}/word/?access_token=stub&file_id=demo.docx",
                     "STRUCT_OO": "0"},
            )
        finally:
            R._kill(procs)
    subprocess.run(
        ["node", "chrome-struct.cjs"], cwd=HERE, check=True,
        env={**os.environ,
             "STRUCT_URL": os.environ.get("CHROME_OO_URL", "http://127.0.0.1:8735/rig-editor.html"),
             "STRUCT_OO": "1"},
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())