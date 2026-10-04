# 12. Glossary

| Term | Meaning |
|------|---------|
| **Register** | `harness-graph/features.yaml` — all features with stable `F-###` ids and honest parity/fidelity tags. |
| **F-tag** | Stable feature id (F-001…F-153). Goes inside module docstrings of server code. |
| **Parity / Fidelity** | `parity:` how completely WO matches OO (full/partial/missing/deferred); `fidelity:` how faithfully (L1 pixel-exact … L4 stub). |
| **Census** | A measured enumeration of a running editor (structural DOM, interaction click-through, functional, geometry, visual). |
| **MAP** | The audited OO↔WO pairing table + reason tags, living inside `census-diff.py`. Pairings are never re-derived elsewhere. |
| **Ledger** | The joined, committed result (ledger.json, interact-ledger.json) of a census × MAP. Never hand-edited. |
| **Parity debt** | OO controls WO deliberately defers, grouped by reason — printed on every run. |
| **Loud stub** | A feature that fails visibly instead of silently doing nothing (silent/unclickable ⇒ gate failure). |
| **Promotion** | Flipping a MAP/register row stub→real after the feature ships, via reconcile — never by editing the ledger. |
| **STALE** | Register/expectation claims real but the probe fails ⇒ hard failure. |
| **EARLY** | Implementation landed but register + expectation not promoted ⇒ hard failure. |
| **STALE-DEFERRED** | A deferred MAP row whose feature the census now ships as real ⇒ hard failure (under-reports parity). |
| **Recapture-as-PR** | Committed measurement artifacts change only through explicit, reviewed regeneration. |
| **Rig** | The docker OnlyOffice DS setup (JWT off, private-IP allowed, host callback server) used for reference captures. |
| **Golden** | A committed reference artifact (docs, renders, geometry, pixel baselines) compared against by gates. |
| **Pyramid** | spec (register) → contract (real-process protocol pins) → test (gates/CI/e2e) layering for a feature gap. |
| **Truth-table** | The `PROBES` dict mapping probe→expectation; flips deliberately with its register row. |
| **DUAL-STACK-VERIFIED** | Marker that the full verify command passed on BOTH docserver stacks (rust canonical, python until sunset). |
| **WOPI** | Web Application Open Platform Interface — the protocol OpenCloud uses to hand documents to the editor. |
| **WO / OO / LO** | World-Office / OnlyOffice / LibreOffice. |
| **wo-agent loop** | The 2h server-repo agent cycle (reset --hard origin/main) — why unpushed commits are wipe-bait and heads get tagged. |
