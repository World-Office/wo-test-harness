# 3. System Scope and Context

## Context diagram

```
                     ┌──────────────────────┐
                     │  GitHub Actions CI   │
                     │  conformance.yml ×6  │
                     └──────────┬───────────┘
                                │ dispatch + cross-repo checkout
                                ▼
┌───────────────┐      ┌──────────────────┐        ┌──────────────────────┐
│  wo-test-     │◄────►│ World-Office/    │        │  OnlyOffice DS (rig) │
│  harness      │ git  │ server           │        │  docker, JWT off     │
│ (this repo)   │ deps │ wo-docserver     │        │  reference census    │
└──────┬────────┘      │ mcp-server       │        └──────────────────────┘
       │ spawns/       │ wo-docx-renderer │
       │ probes        └────────┬─────────┘
       │                        │ WOPI bridge
       ▼                        ▼
┌───────────────┐      ┌──────────────────────────────┐
│ LibreOffice   │      │ Production (cloud.graphwiz.ai│
│ render oracle │      │ + editor.cloud.graphwiz.ai)  │
│ (corpus)      │      │ OpenCloud + Rust docserver   │
└───────────────┘      └──────────────────────────────┘
```

## In scope

- Register (`features.yaml`, F-###), test graph, drift gates.
- Census pipeline over BOTH docserver stacks: structural DOM census
  (vanilla + React), OO rig reference capture, interaction click-through,
  functional loud-stub census (local + live prod), geometry drift, visual
  pixel gate, WOPI call-chain probes (non-word editors), AI
  spec-contract-test pyramid (HTTP + MCP stdio contracts).
- Cross-engine docx fidelity scoring (wo-conformance + wo-conformance-docx).
- Advisory LLM layers (ledger-gap classification, vision triage).

## Out of scope

- Product code, editor code, converters — measured, never modified here.
- OnlyOffice itself — reference only.
- Production infrastructure (traefik/OpenCloud) — probed, not managed.

## External interfaces

| Interface | Direction | Form |
|-----------|-----------|------|
| `WO_SERVER_DIR` checkout | in | rust crates built (wo-docserver, mcp-server, storage-service), python uv venv spawned |
| OnlyOffice DS rig | in/out | Playwright against docker DS; captures committed as reference JSON |
| Live prod | in | Playwright login + WOPI session (`fx-prod.cjs`) |
| wo-docserver HTTP | in | spawn → `/health`, `/word/?access_token=…`, `/api/conversion/convert` |
| mcp-server stdio | in | JSON-RPC 2.0 (initialize / tools/list / tools/call) |
| GitHub API | out | workflow dispatch, run verification (headSha!) |
