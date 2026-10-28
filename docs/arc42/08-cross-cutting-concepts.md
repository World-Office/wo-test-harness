# 8. Cross-cutting Concepts

## The L0–L4 completeness ladder (the ledger's spine)

| Level | Meaning | Evidence source |
|-------|---------|-----------------|
| L0 MISSING | no WO surface for the OO feature | ledger/build.py join |
| L1 SURFACE | WO has the control/dialog (visual) | deep census |
| L2 ACTS | control mutates the document DOM | behavior probes (fx layer) |
| L3 PERSISTS | mutation survives editor→docx→reload | ledger/roundtrip.cjs |
| L4 FIDELITY | output matches OO's own output for the same op | cross-engine conformance |

The completeness contract is **L0 ≈ 0** — "deficit 3" in the old census was an
L1 ceiling artifact; the ledger exposed the real L0 backlog (44 → 1 after the
2026-10 campaigns).

## Noise control (honesty in both directions)

- `noisy()` NOISE regex + backstage exclusion list + statusbar raw-id
  suppression in `ledger/build.py`.
- Matcher aliases per cluster (`wo_match`) — OO labels ≠ WO labels are mapped
  explicitly, auditable in code.
- Deferred ledger rows stay **loud**: printed on every run, never silently
  dropped ("a green gate never hides the gap").

## Verbatim probing (post-2026-10-27)

`roundtrip.cjs` historically sanitized payloads (`&nbsp;`→space, non-ASCII →
numeric refs) to work around converter gaps. Those workarounds are RETIRED:
the converter was fixed (LEDGER2) and the probe now sends editor output
as-is. Any re-introduced converter bug must produce a FAIL.

## Count-agnostic accept gates

Campaign acceptance criteria never hard-code counts that change as the
census grows ("N controls pass"); they assert relations (all captured
controls clickable, zero pageerrors, L0-shrinking) so gates survive
reference-suite updates.

## Committed artifacts as substrate

All reference JSONs and gate results are committed: runs are reproducible,
diffs reviewable, and `artifact-check.py` enforces invariants (no re-deriving
pairings in joins; MAP is audited). OO outputs are read-only truth.

## Point-probe conventions (learned the hard way)

- Ribbon overflow must scroll by **translation**; rb-menu clicks must be
  synthetic (`page.evaluate(el.click())`).
- Dialog frames: ONE-SHOT `findDialogFrame()` lookups.
- Vector objects rasterize SVG→PNG (`data:image/png;base64`).
- Static JS gates in the server repo pin with plain substring
  `src.includes(...)` — **no regex** (JS string escapes are a trap).
