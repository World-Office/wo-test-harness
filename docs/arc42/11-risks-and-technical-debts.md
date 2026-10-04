# 11. Risks and Technical Debts

## Parity debt (deliberate, tracked, loud)

- 83 MAP rows deferred with reason tags (react-filemenu-*, deferred XL, …) —
  printed as the parity-debt block on every run. Includes Protect/Info/
  Advanced Settings/Help backstage rows (vanilla menu doesn't ship them; the
  React menu does).
- AI gaps (F-148..F-153): 5 unimplemented contracts — provider gateway on the
  rust docserver, AI author attribution, command tool registry, host-side
  generation, in-browser LLM (deferred XL). MCP endpoint is real but
  stdio-only, no editor-command tools, integration tier env-gated.

## Known risks

| Risk | Exposure | Mitigation |
|------|----------|------------|
| **Stale-dispatch CI** (private repo; dispatch runs remote ref) | A green run proving the wrong commit | headSha verification after dispatch (ADR-12); keep local pushed before dispatch |
| **OO reference freshness** | Committed OO censuses age with OO releases | Deliberate rig refresh; pinned DS digest in the oracle job |
| **Host font dependence** | Geometry goldens differ per host | Per-platform goldens; strict drift, no slack |
| **pdfium missing on host** | wo-pdf-render untestable in host gate | Explicit exclusion (documented); wasm policy per AGENTS.md |
| **WASM host-untestability** | renderer regressions invisible to `cargo test` | Browser census + wasm.yml CI carry it |
| **Prod drift vs repo claims** | Deployed editor ≠ repo editor (happened: vanilla vs React) | fx-prod measures the deployed truth |
| **Deprecated python stack** | Dual-stack gates cost run time; python bugs distract | Sunset plan; DUAL-STACK-VERIFIED until then |
| **Single-machine goldens** | Rig-specific captures (fonts, AA) | Flood-line baselines; advisory vision triage classifies cosmetics |
| **MCP integration tier not in CI** | tools/call regressions (like the base64 bug) ship again | Enable `AI_CONTRACTS_MCP_CALL=1` + storage-service in CI once stable |

## Housekeeping debts

- OO backstage interaction capture (interact-oo click-through for the
  backstage) still pending — rig recipe validated, ports reserved.
- Portal-mode OO capture (Create New / Open Recent visible).
- Failed-cycle stashes (4 + agent's) left for manual triage.
- OpenCode key rotation + ACME renewal (ops, ~Nov 2026).
