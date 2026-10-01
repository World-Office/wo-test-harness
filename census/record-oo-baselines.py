#!/usr/bin/env python3
"""Record the honest WO-vs-OO pixel baselines into baselines.json.

Runs the real run_visual path (scratch docserver -> visual-wo.cjs WO capture ->
pixel-diff.py vs the committed OO golden) and records each doc's diff_px /
mean / wo_ink / gold_ink as the baseline, keyed by the OO golden filename.

Usage: /usr/bin/python3 census/record-oo-baselines.py WO_SERVER_DIR
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import reconcile  # noqa: E402

server = Path(sys.argv[1])
HERE = reconcile.HERE
GOLD = HERE / "golden" / "docs"


def main() -> int:
    rc = 0
    rec = {}
    with tempfile.TemporaryDirectory(prefix="reconcile-visual-") as td:
        pd = Path(td)
        content = pd / "content"; content.mkdir(parents=True)
        reconcile._register_goldens(server, pd / "db.sqlite", content)
        port, proc = reconcile.spawn_docserver(server, pd)
        try:
            for stem, gold_name in sorted(reconcile.VISUAL_GOLDEN.items()):
                docx = (HERE / "golden" / "docs") / f"{stem}.docx"
                gold = (HERE / "golden" / "docs") / gold_name
                if not docx.exists() or not gold.exists():
                    print(f"  rec: missing {stem} source/golden"); rc = 1; continue
                png = pd / f"{stem}-wo.png"
                subprocess.run(["node", "visual-wo.cjs"], cwd=HERE, check=True,
                               env={**reconcile.os.environ,
                                    "VISUAL_BASE": f"http://127.0.0.1:{port}",
                                    "VISUAL_DOC": docx.name,
                                    "VISUAL_OUT": str(png)})
                r = subprocess.run([reconcile._py_with_pil(server), "pixel-diff.py",
                                    "--wo", str(png), "--gold", str(gold)], cwd=HERE,
                                   capture_output=True, text=True)
                print(r.stdout.strip() or r.stderr.strip())
                # pull numbers from the printed line
                for token in r.stdout.split():
                    if token.startswith(("mean_diff=", "diff_px=", "ink")):
                        rec.setdefault(gold_name, {})
                    if token.startswith("mean_diff="):
                        rec[gold_name]["mean"] = float(token.split("=")[1].rstrip("/255"))
                    if token.startswith("diff_px="):
                        rec[gold_name]["diff_px"] = float(token.split("=")[1].rstrip("%"))
                    if token.startswith("ink"):
                        pass  # handled below with regex
                import re
                m = re.search(r"ink wo=([\d.]+)% gold=([\d.]+)%", r.stdout)
                if m:
                    rec[gold_name]["wo_ink"] = float(m.group(1))
                    rec[gold_name]["gold_ink"] = float(m.group(2))
                if r.returncode != 0:
                    rc = 1
        finally:
            proc.terminate()
            try: proc.wait(timeout=5)
            except subprocess.TimeoutExpired: proc.kill()

    out = GOLD / "baselines.json"
    data = json.loads(out.read_text()) if out.exists() else {}
    data.update(rec)
    out.write_text(json.dumps(data, indent=2) + "\n")
    print("WROTE", out, "->", json.dumps(rec, indent=2))
    return rc


if __name__ == "__main__":
    sys.exit(main())
