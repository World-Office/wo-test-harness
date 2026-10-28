# 2. Architecture Constraints

| Constraint | Detail |
|-----------|--------|
| Python interpreter | Host `python3` on PATH is broken (missing venv) — **`/usr/bin/python3` is the only sanctioned interpreter**; census scripts pin shebangs accordingly. |
| Node | `/usr/bin/node` only; census `node_modules/` holds Playwright locally. |
| Proxy env | Node `fetch` honors proxy env → `NO_PROXY=127.0.0.1,localhost` required for local docserver probes. |
| Ground truth immutability | OO census JSONs (`census/census-oo*.json`) are **read-only reference** — the harness adapts WO to OO, never the reverse. |
| Server coupling | `conformance-docx` git-depends on the server repo's `wo-docx-renderer`/`wo-ooxml` (branch main) — `Cargo.lock` must be regenerated after server-side dep changes. |
| Path resolution | `WO_SERVER_DIR` env → sibling `../server` → legacy layout → hard `SystemExit`. Server-side e2e reads `WO_HARNESS_GRAPH`/`WO_CONFORMANCE_CORPUS` the same way. |
| Windows host | Gate runs via PowerShell inside the (now-removed) Python venv path; browser builds come from the system Playwright cache (chromium-1228 = pin 1.61.1). |
| CI | GitHub Actions `conformance.yml` (private repo), 6 jobs, workflow_dispatch + cross-repo checkout. |
| Zombie processes | Long census runs can leak listeners — `ss -tlnp` + kill is a documented operational step; probe ports are picked dynamically. |
| Editorial discipline | Census runs use `/usr/bin/python3`; agent campaign policy "NO CHANGE IS NOT SUCCESS"; round-trip probes must stay **verbatim** (no sanitization) since 2026-10-27. |
