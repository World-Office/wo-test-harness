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
| ADR-13 (2026-10) | **Deep census + dialog FIELD census** (oo-deep / oo-dialogs / wo-deep): inventory beyond tabs/buttons into menus, backstage, statusbar, dialog fields. | The old census ceiling was L1 ("deficit 3" was visual-only); deep census exposed the real L0 backlog. |
| ADR-14 (2026-10) | **Feature ledger v1 (L0–L4 ladder)**: one row per OO surface, merged deep inventories + roundtrip evidence; `LEDGER-REPORT.md` per-cluster counts. | Completeness became a number, not a narrative; drove the 44→1 L0 burn-down. |
| ADR-15 (2026-10) | **Round-trip probes through the REAL endpoint** (html→docx→html via `/api/conversion/convert`), then reload a fresh editor. | L2 "acts in DOM" proved too weak; persistence is the parity currency. |
| ADR-16 (2026-10-27) | **Verbatim payloads / workarounds retired**: after the LEDGER2 converter fixes, `sanitizeForConvert` is identity. | Sanitization masked converter gaps; now a regression fails loudly. |
| ADR-17 (2026-10) | **Count-agnostic accept gates** for campaigns (relations, not magic numbers). | Gates survive reference-suite updates; agent tasks stay mergeable across census refreshes. |
| ADR-18 (2026-10) | **Never trust a stale container**: verify converter behavior against a freshly built local binary/image before believing a gap. | A weeks-old staging image produced false "true gaps"; local fresh-build probing is now the rule. |
