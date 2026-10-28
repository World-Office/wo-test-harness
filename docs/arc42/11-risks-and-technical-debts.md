# 11. Risks and Technical Debts

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Stale containers lie** | A weeks-old docserver image produced false "true gaps" and burned campaign time | Rule (ADR-18): verify against a freshly built local binary/image; `cargo build -p wo-docserver` + `:18087` probe loop documented in R3 |
| **OO ground-truth drift** | OO rig upgrades change labels/geometry; matcher aliases rot | OO census JSONs are pinned per rig version; aliases live in code, reviewed in diffs |
| **Sanitization creep** | Re-adding "harmless" probe workarounds would mask converter regressions | `sanitizeForConvert` must stay identity (ADR-16); ROUNDTRIP-GAPS.md documents the retirement |
| **Count-pinned gates** | Magic-number accept criteria break on every census refresh | ADR-17: count-agnostic relations only |
| **Host env quirks** | `python3` on PATH broken, proxy env hijacks localhost fetch, zombie probe ports | `/usr/bin/python3`, `NO_PROXY=…`, `ss -tlnp` + kill — all documented in §2 |
| **Bus factor** | Campaign-specific knowledge lives in few heads | This arc42 set + ledger/gap reports + AGENTS.md |

## Debts (deliberate)

- **insert-spreadsheet** — the last real L0 gate cluster; open as its own task.
- **L2 behavior-probe coverage** is thinner than L1/L3 layers; fx covers 108
  controls, ledger L2 comes from probe layer where available.
- **L4 fidelity scoring** only where the conformance crate reaches (docx
  rendering); most ledger rows top out at L3.
- **Converter ceilings accepted (documented in server docs)**: list `start`
  value not emitted; `ilvl` flattened; hand-authored numbering numIds ≠1/2
  degrade in Word — the harness documents rather than gates these.
- **React-editor censuses** are regression-pinned snapshots; deep/dialog
  census exists only for word (OO + WO vanilla), not for sheet/slide/pdf/visio.
- **Point-probe zoo** (30+ `.cjs` scripts): some are one-shot campaign
  leftovers; candidates for consolidation into the reconcile flow.
