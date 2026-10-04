# wo-test-harness — arc42

> **System:** wo-test-harness — the World-Office cross-engine conformance harness,
> parity ledger, and feature register.
> **Format:** [arc42](https://arc42.org) — one file per section, plus this index.
> **Scope:** the harness repo (`wo-test-harness`). The product side is documented
> separately: `server/docs/arc42/` (Rust cloud+AI record) and
> `server/opencloud-docserver/docs/arc42/` (deprecated Python rewrite).
> **Status snapshot 2026-10-04:** full gate rc=0; CI all 6 jobs green; register
> 111 features; ledger 152 covered / 119 real / 83 deferred (loud).

## Document map

| # | Section | File |
|---|---------|------|
| 1 | Introduction and Goals | [01-introduction-and-goals.md](01-introduction-and-goals.md) |
| 2 | Architecture Constraints | [02-architecture-constraints.md](02-architecture-constraints.md) |
| 3 | System Scope and Context | [03-context-and-scope.md](03-context-and-scope.md) |
| 4 | Solution Strategy | [04-solution-strategy.md](04-solution-strategy.md) |
| 5 | Building Block View | [05-building-block-view.md](05-building-block-view.md) |
| 6 | Runtime View | [06-runtime-view.md](06-runtime-view.md) |
| 7 | Deployment View | [07-deployment-view.md](07-deployment-view.md) |
| 8 | Cross-cutting Concepts | [08-cross-cutting-concepts.md](08-cross-cutting-concepts.md) |
| 9 | Architecture Decisions | [09-architectural-decisions.md](09-architectural-decisions.md) |
| 10 | Quality Requirements | [10-quality-requirements.md](10-quality-requirements.md) |
| 11 | Risks and Technical Debts | [11-risks-and-technical-debts.md](11-risks-and-technical-debts.md) |
| 12 | Glossary | [12-glossary.md](12-glossary.md) |

## One-line summary

Measure everything, hand-edit nothing: the harness captures what OnlyOffice and
World-Office **actually do** (DOM census, click-through, geometry, pixels, HTTP/
MCP contracts), joins them into an auditable ledger, and turns the difference
into loud, two-directional gates — so a green build never hides the parity gap,
and a promoted feature never silently regresses.
