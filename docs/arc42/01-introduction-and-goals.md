# 1. Introduction and Goals

## What is the harness?

Everything test/verification-side that lives outside the production repo:
the feature register, cross-engine docx conformance scoring, the OnlyOffice
parity census, the feature ledger, and the persistence round-trip gates.
It is the **measurement instrument** for the World-Office parity program —
product code (server repo) is judged by gates defined here.

## Goals

| # | Goal | Motivation |
|---|------|-----------|
| G1 | **One machine-checkable completeness contract** | Parity is a count, not a feeling. The ledger scores every OO feature surface at L0 missing → L4 fidelity. "Done" is L0≈0, not "looks done". |
| G2 | **Persistence proven, not assumed** | A feature only counts when its document mutation survives editor → docx → reload (round-trip gates, 13/13). |
| G3 | **Cross-engine truth** | Rendered docx output is scored against LibreOffice (and OO goldens) — not eyeballed. |
| G4 | **Campaign-drivable** | agentflow/taskfleet workers consume gap reports as task lists; every fix lands with a gate that fails loudly on regression. |
| G5 | **Honest noise control** | Deferred/loud rows, noise filters, matcher aliases — a green gate must never hide a real gap, and noise must never fake a gap. |

## Non-goals

- Load/performance testing (baseline metrics live in `server/plan/performance.md`).
- Editor unit tests (those live in the server repo, e.g. static JS gates).
- Being CI-only: everything runs locally first (prod-probing scripts included).
