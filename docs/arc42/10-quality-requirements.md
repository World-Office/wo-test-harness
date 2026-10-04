# 10. Quality Requirements

Quality here = the gates themselves. Each gate is a scenario; each scenario
has a stimulus, an observable response, and a hard exit code.

## Gate scenarios (the quality tree)

| Scenario | Stimulus | Expected response | Gate |
|----------|----------|-------------------|------|
| Register drift | features.yaml edited, graph.json not | `seed.py --check` exit 1 | graph drift |
| Unregistered promotion | WO ships a real control while MAP says stub | reconcile promotion-diff exit 1 | ledger |
| Stale deferred | MAP row `deferred`, census shows real control | STALE-DEFERRED exit 1 | ledger |
| Trigger regression | file menu never opens (0 rows) | `menu-file == 0` ⇒ exit 1 | ledger/interactions |
| Silent stub | control clicked, nothing observable | `silent`/`unclickable` ⇒ exit 1 | fx |
| Interaction divergence | OO modal vs WO none (undeclared) | interact-diff missing/type/geometry ⇒ exit 1 | interactions |
| Geometry drift | layout shifts > 4px or overlaps | geom gate exit 1 (per-platform goldens) | geometry |
| Pixel regression | render diverges beyond flood-line baseline | pixel-diff exit 1 | visual |
| AI STALE | register says real, probe fails | exit 1 | ai-contracts |
| AI EARLY | impl landed, expectation not promoted | exit 1 | ai-contracts |
| Converter regression | docx→html conversion breaks | positive-pin exit 1 | ai-contracts |
| MCP protocol regression | initialize/tools-list/schema breaks | pinned probe exit 1 | ai-contracts |

## Non-functional requirements

- **Determinism**: real clicks, pinned browsers, per-platform goldens — a gate
  run twice on the same tree gives the same verdict (font-dependent geometry
  isolated per platform).
- **Honesty over convenience**: partial sums are never greens; runs must
  complete (rc=0 + all binaries) — the fail-fast/hang undercount lesson.
- **Speed of truth**: one command, one exit code; CI < ~11 min for 6 jobs.
- **Readability**: parity debt prints on every run; ledgers are JSON a human
  can open without running anything.
- **Reversibility**: throwaway capture dirs; gates never write committed
  artifacts; server repo untouched by harness fixes (filed, fixed there).
