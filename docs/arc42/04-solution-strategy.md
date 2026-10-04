# 4. Solution Strategy

Five decisions define the architecture; everything else is implementation.

## 1. Honest register as the spec layer

Features carry `parity:` (full/partial/missing/…) + `fidelity:` (L1..L4) tags in
`features.yaml`. Tags are claims; claims are cheap. So every claim that *can*
be measured *is* measured by a lower layer, and the register is the join key
(`F-###`) across all of them.

## 2. Measured ledgers, never hand-edited

Pairing OO↔WO happens once, audited, in the **MAP** (inside census-diff.py);
census scripts capture more structure, the ledger joins via MAP, and promotion
(`stub→real`) flows only through `reconcile.py`. Nobody edits the ledger JSON.

## 3. Gates with teeth in both directions

Every gate fails on BOTH failure modes:

- **STALE** — register/expectation says real, probe fails → regression, exit 1.
- **EARLY / unregistered promotion** — implementation appears but register +
  expectation were not promoted together → exit 1 (recapture-as-PR spirit).

And every run **prints the parity debt** — a green gate never hides the gap.

## 4. Real-process contracts

Probes talk to real binaries (spawned docserver, spawned storage-service +
mcp-server over stdio JSON-RPC), not mocks. Expectations live in explicit
truth-tables (`PROBES` dict in `ai-contracts.py`) that flip **deliberately with
the register row** — same PR.

## 5. Advisory-only LLM layers

Where classification needs judgment (gap triage, pixel-mismatch triage), an
LLM call classifies into a closed rubric, writes prose OUTSIDE git
(gitignored), and changes no gate. Deterministic asserts stay the only gates.
The visual pixel gate (`pixel-diff.py`) is the single visual authority;
vision-LLM triage explains failures, never approves them.

## Pyramid layering (applied to AI gaps F-148..F-153)

| Layer | Artifact | Changes how |
|-------|----------|-------------|
| SPEC | register rows (features.yaml) | deliberate PR + seed recapture |
| CONTRACT | ai-contracts.py probes vs real processes | expectation flips WITH the register row |
| TEST | reconcile `--ai` gate + CI census-ledger job | plus the standard census/interact/fx surfaces once editor controls ship |
