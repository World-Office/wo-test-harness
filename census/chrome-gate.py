#!/usr/bin/env python3
"""chrome-gate.py — one-run driver for the ribbon-chrome pixel gate.

Spawns the canonical WO docserver for the WO capture (reusing reconcile.py's
spawner), captures the OO chrome from the OO rig, and diffs with chrome-diff.py.

Requires the OO rig to be up:
  docker <onlyoffice/documentserver> on :8199 (or :8094)
  cd census/rig && RIG_BIND=0.0.0.0 DS_URL=http://127.0.0.1:8199 python rig-server.py 8735

Env: WO_SERVER_DIR (default sibling ../server), CHROME_MODE (rust|python),
     CHROME_OO_URL (default rig-editor.html), CHROME_GATE (fail %% ),
     CHROME_BANDS (default 6)."""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import reconcile as R  # noqa: E402  (reuse spawn_docserver + _kill + _py_with_pil)


def main() -> int:
    server = Path(os.environ.get("WO_SERVER_DIR") or (HERE.parent / "server")).resolve()
    mode = os.environ.get("CHROME_MODE", "rust")
    rig = os.environ.get("CHROME_OO_URL", "http://127.0.0.1:8735/rig-editor.html")
    bands = os.environ.get("CHROME_BANDS", "6")
    wo_png = HERE / "census" / "chrome-wo.png"
    oo_png = HERE / "census" / "chrome-oo.png"
    node = "node"

    with tempfile.TemporaryDirectory(prefix="chrome-gate-") as td:
        base, procs = R.spawn_docserver(server, Path(td), mode)
        try:
            wo_url = f"{base}/word/?access_token=stub&file_id=demo.docx"
            subprocess.run([node, "chrome-wo.cjs"], cwd=HERE, check=True,
                           env={**os.environ, "CENSUS_WO_URL": wo_url, "CHROME_WO_OUT": str(wo_png)})
        finally:
            R._kill(procs)

    subprocess.run([node, "chrome-oo.cjs"], cwd=HERE, check=True,
                   env={**os.environ, "CHROME_OO_URL": rig, "CHROME_OO_OUT": str(oo_png)})

    cmd = [R._py_with_pil(server), "chrome-diff.py", "--wo", str(wo_png), "--oo", str(oo_png), "--bands", bands]
    if os.environ.get("CHROME_GATE"):
        cmd += ["--gate", os.environ["CHROME_GATE"]]
    return subprocess.run(cmd, cwd=HERE).returncode


if __name__ == "__main__":
    sys.exit(main())
