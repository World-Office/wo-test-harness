#!/usr/bin/python3
"""legacy/diff-legacy.py — join the legacy-codebase inventories into one verdict.

Slice D of the divide&conquer: consumes the outputs of extract-ui.cjs (x2),
extract-api.py, extract-fns.cjs (x2) and produces
  census/census/legacy-parity.json  (machine verdict)
  plan/LEGACY_PARITY.md             (human report, written to --report)

Axes:
  1. UI markers      — ids/cmds/i18n/dialogs: did the 1:1 UI port lose anything?
  2. API surface     — legacy routes missing in rust, with wildcard-coverage
                       heuristic (/hosting/wopi/{*path} covers /wopi/files/{id}/*)
  3. Behavior        — function inventory: legacy-only = regression risk,
                       current-only = forward work; keyword density comparison
  4. Contract mining — legacy tests/e2e docstrings: ready-made behavior specs
                       waiting to be lifted into parity contracts

    python3 diff-legacy.py [--dir census/legacy/census] [--report plan/LEGACY_PARITY.md]
"""
import argparse, json, pathlib, re

ap = argparse.ArgumentParser()
ap.add_argument("--dir", default=str(pathlib.Path(__file__).parent / "census"))
ap.add_argument("--report", default="../../../../plan/LEGACY_PARITY.md")
ap.add_argument("--legacy-e2e", nargs="*", default=[],
                help="legacy test roots (e2e/ tests/) — docstrings become the mining backlog")
a = ap.parse_args()
D = pathlib.Path(a.dir)
load = lambda name: json.loads((D / name).read_text())

leg_ui, cur_ui = load("legacy-ui.json"), load("current-ui.json")
api = load("legacy-api.json")
leg_fn, cur_fn = load("legacy-fns.json"), load("current-fns.json")

out = {"generated": __import__("datetime").datetime.now().isoformat(timespec="seconds")}

# ── axis 1: UI markers ────────────────────────────────────────────────────
def ids(inv): return {c["id"] for c in inv["controls"]}
def cmds(inv): return {c["cmd"] for c in inv["controls"] if c["cmd"]}
def i18n(inv): return set(inv["i18nKeys"])
def dlg(inv): return {d["id"] for d in inv["dialogs"]}

ui = {}
for axis, getter in (("control-ids", ids), ("data-cmds", cmds), ("i18n-keys", i18n), ("dialog-ids", dlg)):
    L, C = getter(leg_ui), getter(cur_ui)
    ui[axis] = {"legacy": len(L), "current": len(C),
                "lost": sorted(L - C), "added": sorted(C - L)}
out["ui"] = ui

# ── axis 2: API with wildcard coverage ───────────────────────────────────
wildcards = [p for p in api["current"] if "{*" in p]  # axum {*path} catch-alls

def covered_by_wildcard(route):
    # /wopi/files/{id}/lock is served by the axum catch-all
    # /hosting/wopi/{*path} (hosting_wopi_handler strips the hosting/ prefix) —
    # so any legacy /wopi/* route counts as covered when that wildcard exists
    if route.startswith("/wopi/") and any("/hosting/wopi/" in w for w in wildcards):
        return True
    wseg = {w.split("/")[1] for w in wildcards}
    return route.split("/")[1] in wseg

legacy_only = sorted(set(api["legacy"]) - set(api["current"]))
api_lost = [r for r in legacy_only if not covered_by_wildcard(r)]
api_wildcard = [r for r in legacy_only if covered_by_wildcard(r)]
current_only = sorted(set(api["current"]) - set(api["legacy"]))
out["api"] = {"legacy": len(api["legacy"]), "current": len(api["current"]),
              "lost": api_lost, "covered_by_wildcard": api_wildcard, "added": current_only}

# ── axis 3: behavior ─────────────────────────────────────────────────────
ls, cs = set(leg_fn["functions"]), set(cur_fn["functions"])
out["behavior"] = {
    "legacy_fns": len(ls), "current_fns": len(cs),
    "legacy_only": sorted(ls - cs),
    "current_only": sorted(cs - ls),
    "keywords": {"legacy": leg_fn["keywords"], "current": cur_fn["keywords"]},
}

# ── axis 4: legacy e2e corpus as contract-mining backlog ─────────────────
e2e = []
seen_files = set()
for root in map(pathlib.Path, a.legacy_e2e):
    for f in sorted(root.rglob("test_*.py")):
        key = f.name  # same test filename in e2e/ and tests/ counts once
        if key in seen_files or ".venv" in f.parts:
            continue
        seen_files.add(key)
        text = f.read_text(encoding="utf-8", errors="replace")
        m = re.search(r'"""(.+?)"""', text, re.S) or re.search(r"'''(.+?)'''", text, re.S)
        title = (m.group(1).strip().splitlines()[0] if m else "").strip()
        ntests = len(re.findall(r"^\s*def test_", text, re.M))
        e2e.append({"file": str(f.relative_to(root)), "title": title, "tests": ntests})
out["legacy_e2e"] = {"files": len(e2e), "test_fns": sum(t["tests"] for t in e2e), "items": e2e}

dest = D / "legacy-parity.json"
dest.write_text(json.dumps(out, indent=1))
print(f"verdict -> {dest}")

# ── markdown report ──────────────────────────────────────────────────────
R = []
R.append("# Legacy-Codebase-Parität (opencloud-docserver → rust docserver)")
R.append("")
R.append(f"Generiert {out['generated']} aus dem wo-test-harness (`census/legacy/`). "
         "Vier Achsen: UI-Marker, API-Fläche, Behavior, Contract-Mining.")
R.append("")
R.append("## Kernaussage")
total_lost = sum(len(v["lost"]) for v in ui.values())
if total_lost == 0 and not api_lost and not out["behavior"]["legacy_only"]:
    R.append("")
    R.append("**Kein Regressionssignal.** Der Rust-Port ist auf allen drei Achsen "
             "Superset oder identisch zur legacy python codebase. Der Restwert der "
             "legacy codebase liegt NICHT in verlorenen Features, sondern in ihrem "
             f"Verhaltens-Korpus: {out['legacy_e2e']['files']} e2e-Testdateien "
             f"({out['legacy_e2e']['test_fns']} Testfunktionen) sind fertige "
             "Verhaltens-Spezifikationen, aus denen Parity-Contracts gehoben werden können.")
R.append("")
R.append("## 1. UI-Marker (web/ vs documenteditor-wysiwyg/)")
R.append("")
R.append("| Achse | legacy | current | verloren | neu |")
R.append("|---|---|---|---|---|")
for axis, v in ui.items():
    R.append(f"| {axis} | {v['legacy']} | {v['current']} | {len(v['lost'])} | {len(v['added'])} |")
for axis, v in ui.items():
    if v["lost"]:
        R.append(f"- **LOST {axis}:** {', '.join(v['lost'])}")
R.append("")
R.append("## 2. API-Fläche (FastAPI vs axum)")
R.append("")
R.append(f"legacy {len(api['legacy'])} Routen, current {len(api['current'])}, "
         f"legacy-only {len(legacy_only)} ({len(api_wildcard)} davon durch "
         "Wildcard-Handler abgedeckt).")
for r in api_wildcard:
    R.append(f"- `{r}` → abgedeckt durch `/hosting/wopi/{{*path}}` (hosting_wopi_handler)")
for r in api_lost:
    R.append(f"- **LOST** `{r}` ({api['legacy'][r]['methods']} — {api['legacy'][r]['file']})")
R.append("")
R.append("## 3. Behavior (editor.js Funktionsinventar)")
R.append("")
b = out["behavior"]
R.append(f"legacy {b['legacy_fns']} Funktionen, current {b['current_fns']}. "
         f"legacy-only: **{len(b['legacy_only'])}**, current-only: {len(b['current_only'])} (Weiterentwicklung).")
if b["legacy_only"]:
    R.append("")
    R.append("Regression riskieren:")
    for f in b["legacy_only"]:
        R.append(f"- `{f}()`")
R.append("")
R.append("| Keyword | legacy | current |")
R.append("|---|---|---|")
for k in b["keywords"]["legacy"]:
    R.append(f"| {k} | {b['keywords']['legacy'][k]} | {b['keywords']['current'].get(k, 0)} |")
R.append("")
R.append("## 4. Contract-Mining: legacy e2e als Spec-Quelle")
R.append("")
R.append(f"Legacy-Korpus: {out['legacy_e2e']['files']} Dateien, {out['legacy_e2e']['test_fns']} Testfunktionen. "
         "Hebungspfad: je Test ein Verhaltens-Contract (assertion.kind dom-mutation/op-emitted/"
         "dialog-visible) in word-parity-overrides.json — die UI-Marker existieren alle "
         "bereits in der aktuellen UI (Achse 1).")
R.append("")
if out["legacy_e2e"].get("items"):
    R.append("| Datei | Tests | Thema |")
    R.append("|---|---|---|")
    for t in out["legacy_e2e"]["items"]:
        R.append(f"| {t['file']} | {t['tests']} | {t['title'][:90]} |")
R.append("")

report_path = pathlib.Path(a.report)
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text("\n".join(R) + "\n")
print(f"report -> {report_path}")
