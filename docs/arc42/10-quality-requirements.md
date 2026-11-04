# 10. Quality Requirements

Quality tree — priority-ordered, with the enforced check for each leaf:

```
Q1 Completeness honesty (the ledger contract)
 ├─ Q1.1 L0 = 0 achieved 2026-11-03: 527 features scored / 18 clusters
 │       {L0:0, L1:388, L2:81, L3:38, L4:20}
 ├─ Q1.2 Deferred rows stay loud (STALE-DEFERRED = hard failure)
 └─ Q1.3 Register/graph drift gate: seed.py --check green (137
         features / 119 commands / 119 surfaces / 819 tests / 9388 edges,
         regenerated 2026-11-03)
Q2 Persistence proof
 ├─ Q2.1 roundtrip.cjs 31/31 survived, level3=31 — verbatim payloads
 ├─ Q2.2 Results committed (roundtrip-results.json) and merged into
 │       the ledger as L3 evidence
 └─ Q2.3 Converter regression surfaces as a FAIL (no sanitization)
Q3 Behavioral truth
 ├─ Q3.1 Loud-stub fx gate: 0 silent / 0 unclickable, local AND live prod
 │       (108 controls / 11 tabs as of 2026-09-26)
 └─ Q3.2 Interaction classification for every control (modal/menu/panel/none)
Q4 Visual/structural parity
 ├─ Q4.1 Chrome parity gate (ribbon geometry, translation-scroll)
 ├─ Q4.2 Geometry drift gate vs committed goldens
 └─ Q4.3 Pixel-diff gate vs OO goldens (PIL flood-line; LLM triage advisory)
Q5 Cross-engine fidelity
 ├─ Q5.1 conformance corpus + NormalizedRender scoring vs LibreOffice
 └─ Q5.2 git-dep pinning on server renderer crates (Cargo.lock regen rule)
Q6 Process
 ├─ Q6.1 CI 6 jobs green, dispatched by headSha (ADR-12)
 ├─ Q6.2 Campaign fixes land with in-repo gates (server: static JS pins,
 │       cargo converter suites) — harness re-scores afterwards
 └─ Q6.3 AI contract pyramid pinned (15 tools), STALE/EARLY exit 1
```

Not measured here: performance baselines (server/plan/performance.md),
availability, security scanning (server repo's weekly audit).
