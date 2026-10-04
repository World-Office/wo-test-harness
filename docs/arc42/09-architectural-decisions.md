# 9. Architecture Decisions

Short-form ADRs (decision → consequence). Dates are first-recorded dates.

| ADR | Decision | Why / Consequence |
|-----|----------|-------------------|
| ADR-01 (2026-07) | **Stable `F-###` register with honest parity tags**, ids never reused; F-tags inside module docstrings. | Worklists for agents + audit trail for humans; `check-register.py` + seed drift keep it honest. |
| ADR-02 (2026-08) | **Harness lives outside the product repo** (this repo), cross-repo checkout in CI. | Product crates stay clean; register versioned independently; WO_SERVER_DIR contract born. |
| ADR-03 (2026-08) | **Audited MAP; census scripts never edit pairings** — capture more, promote via reconcile. | Pairing knowledge stays in one audited place; census fixes can't silently re-pair features. |
| ADR-04 (2026-09) | **Loud-stub functional gates** (silent/unclickable ⇒ exit 1), locally and against live prod. | "Button exists" ≠ "button works"; caught sticky-overlay regression class CI-exactly. |
| ADR-05 (2026-09) | **Interaction dimension** added: click every button, classify geometry (modal/menu/panel/none). | Structural census proved existence, not behavior; made "weird overlays" visible. |
| ADR-06 (2026-09) | **Declared divergences live loudly** (`interact-divergences.json`, register `divergence:` rows). | Intentional ≠ hidden; divergence debt is readable and reviewable. |
| ADR-07 (2026-09) | **Pixel-diff is the only visual gate**; vision-LLM triage advisory-only, prose out of git. | Deterministic gates; LLM explains, never approves. |
| ADR-08 (2026-09) | **LLM spec layer advisory-only** (ledger-gap.py): closed rubric, JSON-only, temp 0, no gate edits. | Judgment scaled without surrendering the gate. |
| ADR-09 (2026-09) | **Dual-stack reconciliation**: gates must pass on rust AND python docserver until python sunset. | Kept the rewrite honest in both directions; rust is canonical since the 2026-09-24 reversal. |
| ADR-10 (2026-10) | **STALE-DEFERRED is a hard failure**: deferred MAP rows must be promoted when the feature lands. | A green gate must never under-report parity. |
| ADR-11 (2026-10) | **AI spec-contract-test pyramid** (F-148..F-153): spec=register, contract=real-process truth-table probes, test=gates/CI; STALE and EARLY both exit 1; converter positive-pinned. | Expectations flip WITH register rows, same PR — already caught a real mcp-server base64 bug via the integration tier. |
| ADR-12 (2026-10) | **Verify CI runs by headSha after dispatch** (private repo, dispatch targets remote). | One dispatch silently ran a stale ref and "proved" nothing; now standing practice. |
