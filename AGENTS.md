# wo-test-harness — AGENTS

Workspace container for the World-Office test-harness tooling extracted from
the server repo (`World-Office/server`). See `README.md` for the unit map.

## Structure

```
wo-test-harness/
├── conformance/            # wo-conformance crate: corpus, scoring, adapters, cross-engine compare
├── conformance-docx/       # wo-conformance-docx crate: DocxConformanceAdapter + wo-render-ir bin
├── harness-graph/          # feature register → test graph tooling (F-### ids live here)
├── tf-test-harness/        # unified shell test orchestrator + generation/coverage tooling
└── .github/workflows/      # conformance.yml (self-contained CI)
```

## Key contracts

- **`WO_SERVER_DIR`** — path-resolution contract for moved Python/shell
  scripts. Chain: env → `HARNESS_ROOT/../server` sibling → legacy in-repo
  layout → `SystemExit`. Always pass it explicitly when testing against a
  server checkout.
- **Register (`F-###`)** — 82 stable ids in `harness-graph/features.yaml`.
  F-tags go INSIDE module docstrings; ids are stable; honest tagging; loud
  failure over silent stub.
- **Graph drift** — `seed.py --check` must stay green; graph.json is
  recaptured deliberately (recapture-as-PR, never silent).
- **`wo-render-ir`** — built from `conformance-docx` (`cargo build -p
  wo-conformance-docx --bin wo-render-ir`), git-depends on the server repo
  (`wo-docx-renderer` + `wo-ooxml`, branch `main`).
- **Parity census** — the OnlyOffice↔World-Office census pipeline now lives
  **here** in `census/` (scripts + `census/` data): `census-wo.cjs` (WO DOM
  census, local-server `CENSUS_WO_URL` mode — no docker), `census-diff.py`
  (OO↔WO join + MAP → `ledger.json`), `reconcile.py` (one-run ledger-clear:
  spawn local docserver → recapture → auto-flip MAP `stub→real` for
  promoted buttons → gate). The OnlyOffice reference capture
  (`census-oo.cjs`) stays rig-side (needs docker OO); it refreshes
  `census/census-oo.json` here via `CENSUS_OUT`. One-run:
  `WO_SERVER_DIR=/path/to/server /usr/bin/python3 census/reconcile.py
  --seed-check`; CI gate: `census/reconcile.py --check --seed-check`
  (conformance.yml `census-ledger` job). Register parity rows sync via
  `--apply-register`. Every run prints the `parity debt` block — the
  OO controls WO deliberately defers (grouped by reason tag) so the
  green gate never hides the remaining gap.
  `STALE-DEFERRED` is a hard gate failure: a MAP row declaring
  `{"deferred": ...}` whose feature the WO census now ships as a real
  control under-reports parity (e.g. ocr/photoeditor were deferred while
  the register said parity: full and the inter census proved real modals).
  When a feature lands, promote its MAP row to `{"real": ...}`; the gate
  tells you which rows to promote and to what key.
- **Interaction dimension** — the structural census proves buttons EXIST
  but never clicks one, so "weird overlays / missing dialogs" were invisible
  to it. `interact-wo.cjs` (WO click-through: click every ribbon button,
  classify modal/menu/panel/none + geometry), `interact-oo.cjs` (rig-side,
  same schema vs live OO → committed `census/census/census-oo-interactions.json`,
  334 rows, refreshed deliberately), `interact-diff.py` (joins via the
  audited structural ledger's `wo` mapping — never re-derives the pairing —
  and classifies ok/missing/type/geometry/organic/divergence). Declared
  intentional divergences live loudly in `interact-divergences.json`.
  Gate: `reconcile.py --check --interactions` (wired into conformance.yml).
- **File-menu surface (`menu-file`)** — the file menu is NOT a ribbon tab;
  it is `#btn-file` (`.menu-trigger`) toggling `#file-menu`. The editor wires
  the toggle on **CLICK** — a dispatched `MouseEvent('mousedown')` never
  opens it, so the census silently reported `menu-file: 0 rows` since
  inception and the whole surface (New / Open… / Export / Print / History… /
  AI changes…) was invisible to parity. Both census scripts now use a real
  `page.click('#btn-file')` and query `#file-menu` (NOT `#menu-file`).
  `census-diff.py` carries `counts["menu-file"]` into the ledger and
  `reconcile.py`'s gate FAILS on `menu-file == 0` — the trigger regression
  is now a gate failure, not a silent zero. Known remaining gap: the OO
  reference census has no file-menu capture either (OO's full-screen
  backstage: Back / Create New / Save / Download As…), so file-menu parity
  vs OO is not yet JOINED — the rig-side `census-oo.cjs`/`interact-oo.cjs`
  need the same click-`#btn-file`-equivalent open + enumerate for OO's File
  menu before the join can compare it.
  Playwright pitfall: page-side logic must be REAL functions passed to
  `page.evaluate`, never strings-as-expressions (evaluates to a function
  value → clicks nothing). Command-wired buttons dispatch via the bus;
  id-wired buttons (most of Insert: btn-table, btn-image, ...) need a REAL
  click. Preserve the button id (a surface id clobbers it); a surface
  identical to the previous row is a sticky leftover, not a fresh open.
  CI-exact fresh-clone proof: the gate FAILED against the pre-fix server
  commit (table/image full-screen modals) and PASSED after the
  anchored-popover fix landed — it catches the overlay-regression class.
- **Docx fidelity** — `DocxConformanceAdapter` projects `wo-docx-renderer`
  layout into `NormalizedRender` for scoring against captured truth.

## Workflow

```sh
# Register drift gate
WO_SERVER_DIR=/path/to/World-Office/server /usr/bin/python3 harness-graph/seed.py --check

# Unified self-test
WO_SERVER_DIR=/path/to/World-Office/server bash tf-test-harness/test-harness.sh --self-test

# Full CI gate (ledger + interactions + fx functional + geometry)
WO_SERVER_DIR=/path/to/World-Office/server /usr/bin/python3 census/reconcile.py \
  --check --seed-check --interactions --fx --geometry

# Cross-engine fidelity (conformance-docx included in workspace)
cd .
cargo test -p wo-conformance
cargo build -p wo-conformance-docx --bin wo-render-ir

# Server CI (in World-Office/server) does a cross-repo checkout of this repo
# into the job and runs seed.py --check / check-register.py / test-harness.sh
```

## Windows host

`/usr/bin/python3` is just `python`. The docserver deps (python-docx, uvicorn)
come from the server's uv project, and `reconcile.py` spawns `sys.executable`, so
the gate must run inside `opencloud-docserver`'s venv (once: `uv sync --frozen`):

```powershell
cd <server>/opencloud-docserver
cd <harness>/census; npm install --no-save playwright@1.61.1   # gitignored
$env:WO_SERVER_DIR = 'C:/path/to/server'
& uv run --frozen python <harness>/census/reconcile.py --check --seed-check --interactions --fx --geometry
```

Run the gate via PowerShell, not Git Bash: MSYS2 mangles `;`-separated env vars
when spawning native python (PATH becomes just `C`). No npm/PYTHONUTF8 setup
needed — `npm root -g` is best-effort (census/node_modules carries playwright)
and all file I/O is explicit UTF-8. Browser builds come from the system Playwright
cache (chromium-1228 = pin 1.61.1).

Geometry note: `geom-wo.json` is the Linux-rig golden; hosts whose fonts differ
(text metrics) commit their own `geom-wo.<sys.platform>.json` via a deliberate
recapture — the gate picks it automatically and keeps drift strict (no slack).

## Conventions

## Conventions

- `/usr/bin/python3` — the default `python3` shim on this machine is broken;
  always use `/usr/bin/python3` explicitly.
- `py_compile` moved scripts before committing.
- `cargo test` cannot cover WASM crates; conformance-docx is pure native.
- `Cargo.lock` reflects `wo-docx-renderer`/`wo-ooxml` resolved from the
  server repo's `main` branch — regenerate after server-side dep changes.

## License

AGPL-3.0-or-later.
