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
- **React editor (what production ships) — `census-react.cjs`.** The Rust
  wo-docserver serves the REACT `documenteditor-react` at
  `/editors/word/` (and sheet/slide/pdf/diagram), NOT the vanilla
  `web/editor.js` the Python docserver serves. These are two different
  editors with different file menus: vanilla = 6-item dropdown
  (btn-new/btn-open/btn-export/btn-print/btn-history/btn-ai-review); React
  = full-screen FileMenu (Back, Download as…, Save Copy as…, Save as…,
  Print, Rename…, Share…, Create New, Protect Document…). The vanilla census
  CANNOT see the React editor — a React surface once silently shipped
  broken (Viewport read `documentStore.isFileMenuOpen` without a mobx
  `observer`, so the FileMenu panel never re-rendered — clicking File did
  nothing). `census-react.cjs` clicks the FileTab (`[data-tab="file"]`),
  ASSERT the `.de-file-menu-panel` opens (the regression test) and
  enumerates its buttons into `census-react.json`. Run it with
  `run-react-census.py` (serves a built dist + /demo/* + /api/conversion
  stubs the editor auto-loads; needs `pnpm install --filter
  "@world-office/documenteditor..."` + `npx vite build` + a `word`→`dist`
  junction — header of census-react.cjs has the recipe). Verified: fixed
  bundle opens the panel (22 rows); the pre-fix bundle FAILS the census
  (panel stays none). Note the committed `census-react.json` is captured
  from the locally-built bundle at b2c1c282 (post-fix); it is a WO-side
  golden — parity against OO backstage still needs the rig-side OO capture.
- **OO backstage reference — IMPLEMENTED, rig-side (`census-oo.cjs`, `census/rig/`).**
  OO's File menu is a full-screen backstage (Back / Save / Download As / Print
  / Protect / Info / Advanced Settings / Help / Suggest a Feature). The public
  OO endpoints (open.onlyoffice.com, documentserver /example/) expose no
  login-free editor — capture runs against docker OO on the rig:

  ```sh
  # one-time rig bring-up (docker DS on :8099, host loader/docx server on :8735)
  docker run -d --name oo-rig -p 8099:80 -e JWT_ENABLED=false \
    -v <ABS>/census/rig/local.json:/etc/onlyoffice/documentserver/local.json \
    onlyoffice/documentserver:latest
  python census/rig/rig-server.py 8735      # host side: rig-editor.html + demo.docx + /cb ACK
  node census/census-oo.cjs                 # click File, assert #file-menu-panel, enumerate
  ```

  Confirmed exact selectors on the rig (version 9.4): File trigger =
  `a#file[data-tab="file"]` in the ribbon (NOT `.menuFile`/`#id-menu-file` —
  those don't exist in this version); panel = `#file-menu-panel`; items =
  `li.fm-btn > a.menu-item` (ids `fm-btn-return/-save/-download/-print/...`
  are stable; the inner `a.menu-item` ids are generated `asc-genNNNN` — use
  the `li` id, and the tokenizer strips `fm-btn-`). Hidden items
  (display:none — Create New / Open Recent in a standalone edit session) are
  excluded: the ledger compares what the user sees. Census FAILS (exit 1) if
  the backstage never opens — same trigger-regression guard as
  `census-react.cjs`.

  Rig gotchas (all solved, keep them in the rig): JWT must be off
  (`JWT_ENABLED=false`) or the DS injects `checkJwt` failures; the DS
  **blocks private-IP document URLs by default** — fix is `local.json` under
  `services.CoAuthoring.request-filtering-agent.allowPrivateIPAddress: true`
  (NOT `server.*` — the config schema uses `request-filtering-agent`); the
  container's entrypoint regenerates local.json on start (mount the file via
  `-v`, and re-verify after container restarts); `document.url` + the
  save-callback must both be reachable by the DS server-side — point them at
  `http://host.docker.internal:8735/...` (host.docker.internal resolves from
  the container, enabled by allowPrivateIPAddress) and have rig-server ACK
  the `/cb` POST with `{"error":0}` or a `could not be saved` modal blocks
  all subsequent clicks; `autosave:false` avoids spurious saves; dismiss the
  first-run "Got it" tooltip before clicking File.

  The join: a `backstage` tab enters the ledger automatically (census-diff is
  OO-tab-driven); MAP is wired — OO `download-as` → WO `menu-file` Export
  (real), Back/Save/Print covered, Protect/Info/Advanced Settings/Help/
  Suggest deferred with `react-filemenu-*` reasons (vanilla menu-file doesn't
  ship them; the React menu does). Ledger gate counts moved covered 90→93,
  real 94→95, deferred 78→83 with all 9 backstage rows resolved.
  Remaining (rig follow-up): `interact-oo.cjs` click-through for the
  backstage, and a portal-mode capture where Create New / Open Recent are
  visible.
  Playwright pitfall: page-side logic must be REAL functions passed to
  `page.evaluate`, never strings-as-expressions (evaluates to a function
  value → clicks nothing). Command-wired buttons dispatch via the bus;
  id-wired buttons (most of Insert: btn-table, btn-image, ...) need a REAL
  click. Preserve the button id (a surface id clobbers it); a surface
  identical to the previous row is a sticky leftover, not a fresh open.
  CI-exact fresh-clone proof: the gate FAILED against the pre-fix server
  commit (table/image full-screen modals) and PASSED after the
  anchored-popover fix landed — it catches the overlay-regression class.
- **Live production editor — functional (loud-stub) census, `fx-prod.cjs`**
  (the "future Rust harness" the DEPRECATED note deferred — now delivered).
  `reconcile.py`/`fx-wo.cjs` boot the deprecated Python docserver; `fx-prod.cjs`
  instead mint a WOPI session against the live collaboration shell: log in to
  `OC_URL` (default `https://cloud.graphwiz.ai`), open a `.docx`, drive the
  real `#editor` frame it lands in, then click EVERY visible ribbon control
  across every tab and classify whether it produces an observable effect
  (doc mutation / menu / dialog / panel / status / chrome-inline-style).
  A control with none is `silent`/`unclickable` (exit 1) — the loud-stub gate
  against the actual deployed editor. Run: `CENSUS_OUT=... node
  census/fx-prod.cjs` (uses Playwright headless, no Docker, talks to prod).
  VERIFIED 2026-09-26 against the live deploy: **108 controls across 11 tabs,
  0 silent, 0 unclickable, 0 "Not available" stub-strings** — every ribbon
  button in the serving editor does something real (ink modes, TOC update,
  track-changes/display-mode, themecolors CSS-vars, etc.). The snapshot's
  `chrome` signal includes the editor's inline `style` (CSS custom properties)
  so color-scheme controls aren't mis-flagged silent. NOTE: this censuses the
  editor actually DEPLOYED at `/editors/document/` → `editor_ui_dir/word/`,
  which as of this date is the **vanilla** `documenteditor-wysiwyg`
  (grep-confirmed: `/app/editor-ui/word/index.html` has `ribbon-row-2`, no
  `de-file-menu-panel`) — so the "prod ships the React editor" claim above is
  stale for word/docx until the React build replaces the vanilla one in the
  image. `fx-prod.cjs` measures whatever is really serving docx today.
- **Non-word editors — port status (2026-xx, T-002/T-003/T-007).** Verified via
  `census/nonword-probe.cjs` (iframe-aware: enters the editor subframe from
  `editor.cloud.graphwiz.ai`, reads the inner `#root`/canvas/toolbar) and
  `census/nonword-wopi.cjs` (captures the WOPI call chain); full ledger in
  `census/nonword-findings.json`. Against prod (cloud.graphwiz.ai +
  editor.cloud.graphwiz.ai) through the Rust docserver bridge:
  - **sheet (seed.xlsx)** and **slide (seed.pptx)** — PORTED+VERIFIED. WOPI:
    `POST /hosting/wopi/{sheet|slide}/edit` → `GET /editors/spreadsheet|presentation/`
    [access_token] → `CheckFileInfo` → `GetFile(contents)` →
    `POST /api/conversion/convert`. The React Univer editors mount into the
    subframe's `#root` (sheet: 3 canvases + `File Home Insert Layout Formula…`
    toolbar; slide: `…Design Transitions Animation…` toolbar) with 0 pageerrors.
  - **pdf (seed.pdf)** — NOT a port gap: OpenCloud routes `.pdf` to its native
    `/pdf-viewer/` (correct; no OOXML edit loop).
  - **diagram (seed.vsdx)** — Rust port COMPLETE (wo-visio converter,
    `/editors/diagram/` route, and deployed WOPI discovery advertises
    `ext="vsdx"` → `/hosting/wopi/diagram/edit` plus vssx/vstx/vsdm variants),
    but **NOT dispatched end-to-end**: clicking stays on the files page with 0
    WOPI calls because OpenCloud's static file-type→app registry excludes
    `.vsdx`. A prod collaboration-service restart did NOT change this, proving
    it is NOT a discovery-cache issue. Fix would be an OpenCloud-side app-map/
    companion-app config change (`.vsdx` in the editable-type registry) —
    outside the Rust docserver; `contentconnector.go` only does WOPI
    GetFile/PutFile transport and does not govern editability.
- **Docx fidelity** — `DocxConformanceAdapter` projects `wo-docx-renderer`
  layout into `NormalizedRender` for scoring against captured truth.

## Workflow

```sh
# Register drift gate
WO_SERVER_DIR=/path/to/World-Office/server /usr/bin/python3 harness-graph/seed.py --check

# Unified self-test
WO_SERVER_DIR=/path/to/World-Office/server bash tf-test-harness/test-harness.sh --self-test

# Full CI gate (ledger + interactions + fx functional + geometry + visual pixel gate)
WO_SERVER_DIR=/path/to/World-Office/server /usr/bin/python3 census/reconcile.py \
  --check --seed-check --interactions --fx --geometry --visual

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
& uv run --frozen python <harness>/census/reconcile.py --check --seed-check --interactions --fx --geometry --visual
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

### React ribbon congruence (taskfleet + manual)
The React editor's ribbon mirrors OO's tab order minus surfaces WO doesn't ship:
`File Home Insert Layout References Collaboration Protection View Forms Plugins AI`
(the `review` tab was retitled `collaboration`; OO has no Review tab). All tab
controls route to REAL actions via `wo-command` → `lib/word-commands.ts`
(changes/accept-reject/track-changes = RTE ops; Comments/Chat/AI Assistant/
Manage Plugins open the corresponding right/left panels — `DocumentStore.toggleRightPanel`
now reveals the right rail when a panel is requested, since the web shell kept
it permanently hidden). Columns that are surface-only or unbuilt must stay out:
WO still has NO Draw tab — image blocks parse (wo-ooxml `<w:drawing>`) and
insert via `image_apply_insert`, but the wasm renderer draws only a placeholder
(no pixels), and true vector shapes would be new Rust renderer work that cannot
be built/verified locally (no wasm32 toolchain); do not add a fake Draw surface.
Plugin EXECUTION is now real: `lib/plugin-runtime.ts` wires the editor-common
PluginLoader at startup (loads enabled builtins, unloads on disable, reconcile
on `plugin-config-changed`); a bundled word-count plugin registers a button in
PluginsPanel's "Apps" section and shows a toast with real counts. Builtin
plugin ids MUST match the PluginsPanel manage-list ids (word-count, not
wordcount) or toggles won't unload them.
