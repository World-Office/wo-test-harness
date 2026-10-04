# 1. Introduction and Goals

## What the system is

wo-test-harness is the verification side of the World-Office project: a
cross-engine conformance harness, an OnlyOffice↔World-Office parity ledger, and
a stable feature register (`F-###`), living outside the production repo
(`World-Office/server`) so product crates never carry test scaffolding and the
register is versioned independently.

## Top goals

| # | Goal | Motivation |
|---|------|------------|
| G1 | **Ground-truth parity** — prove with measurements, not claims, how close World-Office (editors + docserver) is to OnlyOffice per feature. | Parity is the product's selling point; regression here is invisible to unit tests. |
| G2 | **Honest gates, two-directional** — a gate must fail when a promised feature breaks (STALE) *and* when an unregistered feature appears (EARLY / unregistered promotion). | Silent stubs and silent regressions both erode trust; "loud failure over silent stub" is the house doctrine. |
| G3 | **One-run orchestration** — `reconcile.py --check …` runs every dimension in one command with a single exit code, both locally and in CI. | The gate must be as cheap to run as it is hard to fool. |
| G4 | **Deliberate recapture** — committed artifacts (graph.json, ledgers, goldens) change only via explicit recapture, reviewed as PRs. | Measured artifacts are the audit trail; silent regeneration destroys it. |
| G5 | **Format fidelity scoring** — corpus-driven cross-engine comparison (WO renderer vs LibreOffice/OnlyOffice) with normalized render scoring. | Editor parity is skin; document fidelity is substance. |

## Non-goals

- Product code lives in `World-Office/server`; this repo never patches it
  (findings get filed, server fixes land in the server repo).
- LLM-assisted triage (ledger-gap, visual-triage) is **advisory only** — it may
  classify and propose, never gate, never edit the register or MAP.

## Stakeholders

- **World-Office engineers** — consume gates before/after server changes.
- **CI** (GitHub Actions, 6 jobs) — the authoritative green.
- **AI coding agents** (wo-agent loop, taskfleet workers) — the register's
  honest tags are their worklist; the gates are their acceptance criteria.
- **Auditors/humans** — parity debt must be readable without running anything.
