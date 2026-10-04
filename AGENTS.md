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
- **Ledger gap triage (AI spec layer, advisory)** — `census/ledger-gap.py`. Adapted from the spec-generation phase of AI-cloning pipelines (Morph, ai-site-cloner): the census ledgers are the measured recon; this turns the parity debt into classified, prioritized copy specs. Collects gap rows from ALL measured sources (ledger.json failure statuses, interact-ledger.json missing/unmatched/divergence, MAP `{"deferred": reason}` rows parsed from census-diff.py source) — never re-derives pairings. One rubric'd LLM call (closed classes: missing-feature / divergent-behavior / intentional-divergence / census-artifact; JSON-only, temp 0) → `census/census/ledger-gap.{json,md}` (gitignored: LLM prose stays out of git; humans promote real work into MAP/register). ADVISORY only — edits no gate, no MAP, no register; loud SKIPPED without a key. First live run (gemini-2.5-flash): 28 rows → 3 missing-features (backgroundplugins, content-controls, allow-edit-ranges — all XL), 12 divergent-behaviors (OO opens modal, WO direct-toggles: header-footer, pagenumber, footnote, trackchanges, dropcap, linenumbers…), 13 census-artifacts (wo button exists but not in interact census — fix the census, not the editor). Run: `python3 ledger-gap.py [--out-dir census/census]`; offline check: `--self-test`.
- **Visual triage (vision-LLM escalation, advisory)** — `census/visual-triage.py`. Adapted from the SOTA two-stage verification pattern in AI software-cloning pipelines (ui-clone-skills Phase E, sdet.qa multimodal rubric): `pixel-diff.py` stays the ONLY gate; on FAIL, `reconcile.py --visual` fires a vision-model triage that classifies the mismatch as a real broken render (blank/garbled/collapsed/clipped/misrender, closed rubric, JSON-only, temperature 0) vs cross-engine cosmetics (AA/fonts/margins — explicitly ignored). Advisory ONLY: never changes exit codes, never approves baselines; no key → loud `SKIPPED` line, CI unchanged. Provider: any OpenAI-compatible endpoint, resolved from `VISION_API_KEY`/`VISION_API_BASE`/`VISION_MODEL` else OPENROUTER/GROQ/GOOGLE keys. Live-verified: black-box-over-text → `broken=true, high, defect located`; blur+1px → `broken=false`. Standalone: `python3 visual-triage.py --wo x.png --gold y.png [--out v.json]`; offline plumbing check: `--self-test`.
- **AI spec-contract-test pyramid (`census/ai-contracts.py`, F-148..F-153)** — the
  AI-feature gaps from the 2026 landscape research (provider gateway,
  AI-attributed tracked changes, command tool registry, MCP endpoint,
  text-to-document generation, in-browser LLM) each get three layers: SPEC =
  register rows (honest parity; the truth-table of expectations lives in the
  script's PROBES dict and flips deliberately WITH the register row,
  recapture-as-PR spirit); CONTRACT = protocol/shape pins against REAL
  processes (rust docserver HTTP probes; `services/mcp-server` stdio JSON-RPC
  — initialize/tools-list/schemas pinned GREEN today, 15 tools, backed by
  storage-service :8002; `tools/call` round-trip = integration tier behind
  `AI_CONTRACTS_MCP_CALL=1`); TEST = `reconcile.py --ai` (wired into the CI
  census-ledger job, which builds `-p mcp-server`) + the standard census/
  interact/fx surfaces once the editor ships AI controls. Teeth both ways:
  STALE (register says real, probe fails) and EARLY (impl landed but register
  + expectation not promoted) are hard failures; converter positive-pin
  (docx→html via /api/conversion/convert) failing is a hard failure. Debt
  block prints on every run — a green gate never hides the gap.
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
  # one-time rig bring-up (docker DS on :8199, host loader/docx server on :8735)
  # LINUX (plain docker engine) — three fixes vs the old Windows recipe:
  #   1. --add-host: host.docker.internal does NOT resolve on Linux docker
  #   2. DO NOT mount local.json: the DS entrypoint regenerates it via a
  #      rename(), which fails EBUSY on a bind mount → the fresh instance
  #      secret never lands in the mounted file → docservice/nginx signature
  #      mismatch → every /cache/files fetch 403s ("Download failed" modal).
  #      Instead: start UNMOUNTED, docker-exec the request-filtering-agent
  #      merge into the real local.json, then docker restart (the entrypoint
  #      merge preserves unknown keys AND the instance secrets).
  #   3. RIG_BIND=0.0.0.0 + firewall: rig-server binds loopback by default,
  #      but the container reaches the host via the bridge IP — open the
  #      port to the bridge (ufw allow from 172.17.0.0/16 to any port 8735)
  sudo docker run -d --name oo-rig -p 8199:80 --add-host=host.docker.internal:host-gateway \
    -e JWT_ENABLED=false onlyoffice/documentserver:latest
  sudo docker exec oo-rig python3 -c "
    import json; p='/etc/onlyoffice/documentserver/local.json'
    c=json.load(open(p))
    c['services']['CoAuthoring']['request-filtering-agent']={'allowPrivateIPAddress':True,'allowMetaIPAddress':True}
    json.dump(c,open(p,'w'),indent=2)" && sudo docker restart oo-rig
  RIG_BIND=0.0.0.0 DS_URL=http://127.0.0.1:8199 python census/rig/rig-server.py 8735
  node census/census-oo.cjs                 # click File, assert #file-menu-panel, enumerate
  node census/interact-oo.cjs               # backstage click-through (merges into census-oo-interactions.json)
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
  container's entrypoint regenerates local.json on start via rename(), which
  FAILS EBUSY on a bind mount (Linux) and silently desyncs the instance
  secrets — never mount it; docker-exec the merge into the real file and
  docker restart (the restart merge preserves unknown keys + secrets);
  `document.url` + the
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
  Remaining (rig follow-up): a portal-mode capture where Create New /
  Open Recent are visible. The backstage interaction capture itself landed
  2026-10-04 (`census/interact-oo.cjs`): clicks every visible backstage item,
  classifies panel/modal/none (Back=none, Save/Download-As/Protect/Info/
  Settings/Help=panel, Print/Suggest=none) and merges `tab:"backstage"`
  rows into the committed `census/census/census-oo-interactions.json`;
  `interact-diff.py` classifies the panel-vs-modal rows as DECLARED
  divergences (OO backstage sections vs WO dialogs — intentional, declared
  in `interact-divergences.json`). OO toggle gotchas: the File tab TOGGLES
  (idempotent open helper), and the hidden `#fm-btn-return` still takes
  clicks — never click Back when the panel is already closed, or every
  subsequent open silently fails.
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
- **Editor iframe refused by X-Frame-Options DENY — RESOLVED 2026-10-03.**
  Opening a doc in the OpenCloud Web UI refused to frame `editor.cloud.graphwiz.ai`
  (`X-Frame-Options: DENY` + CSP `frame-ancestors 'self'`) — every office editor
  (word/sheet/slide/vsdx) was unopenable from the shell, probes silently read
  `no-editor-iframe`, and this was NOT a port gap. Root cause (confirmed on the
  live public edge, DNS = 195.90.216.159 / contextual VPS): traefik's
  `security-headers` middleware (file provider `dynamic/routers.yml`) set
  `frameDeny: true` on all three `editor-cloud*` routers, AND the `editor-cloud`
  root router pointed `editor.cloud.graphwiz.ai/editors/*` at service `opencloud`
  (:9200 OpenCloud web SPA) instead of `docserver-wopi` (:8082) — so the WOPI
  hosting handler's `window.location.replace('/editors/spreadsheet/')` landed on
  OpenCloud's own SPA with its own blocking CSP. (The 2026-10-02 "something else
  on the public edge" attribution was WRONG — the injector WAS the editor
  router's middleware; that note was written against the old tobias-weiss VPS.)
  FIX, applied in `/root/git/docker-traefik/dynamic/routers.yml` on 195.90.216.159
  (backups `routers.yml.bak.iframe-fix-*` / `.bak.editor-route-*`): new
  `editor-security-headers` middleware (same as `security-headers` minus
  `frameDeny`, plus `contentSecurityPolicy: frame-ancestors 'self'
  https://cloud.graphwiz.ai`) wired into `editor-cloud`, `editor-cloud-http` and
  `editor-cloud-hosting`; the two root routers now target service `docserver-wopi`.
  Do NOT use `customFrameOptionsValue: SAMEORIGIN` — the framer
  (cloud.graphwiz.ai) is a DIFFERENT origin; SAMEORIGIN would still refuse it;
  CSP `frame-ancestors` is the standard. Re-verified all 4 editors inside the
  shell iframe 2026-10-03 (nonword-probe: sheet/slide/vsdx editorFrame:true,
  loads:1, 0 pageerrors; pdf native). Note: the OpenCloud web backend (:9200)
  ALWAYS sends its own CSP/XFO on its SPA responses — only relevant while an
  editor.cloud route still points at `opencloud`. The other two console errors
  (TypeError `current_version` in `src-Dj691hj2.mjs`; 404
  `/graph/v1.0/users/<id>/photo/$value`) are OpenCloud-internal, not WO.
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
    `ext="vsdx"` → `/hosting/wopi/diagram/edit` plus vssx/vstx/vsdm variants).
    **DISPATCHED END-TO-END (2026-09-28, resolved)** — the vsdx open flow is
    now LIVE and proven against prod: clicking/navigating `seed.vsdx` triggers
    `GET /app/list` (populated with `application/vnd.ms-visio.drawing` →
    WorldOffice provider) then `POST /app/open` returns HTTP 200 with
    `app_url: https://editor.cloud.graphwiz.ai/hosting/wopi/diagram/edit` +
    a minted WOPI `access_token`, and the editor iframe renders. The earlier
    "0 WOPI calls / registry excludes .vsdx" blocker had TWO root causes,
    both fixed: (1) a traefik `editor-cloud-hosting` router (Host
    `editor.cloud.graphwiz.ai` + PathPrefix `/hosting` → docserver :8082) so
    the public edge serves real WOPI discovery XML instead of the SPA HTML;
    (2) the collaboration service CRASH-LOOPED on
    `mkdir /var/lib/opencloud: permission denied` (restarts=162) so it never
    ran `RegisterAppProvider` and the reva app-registry `/app/list` stayed
    `{"mime-types":[]}` — fixed by adding `OC_BASE_DATA_PATH: /tmp/opencloud`
    to the collaboration service in `/home/weiss/opencloud-compose/docker-compose.yml`
    and recreating the container. See `census/vsdx-open-body.cjs` (probe) and
    pi-memory `mem_muip8fe9_mulo0lvd`/`mem_muip8feb_mulobajl`.
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
