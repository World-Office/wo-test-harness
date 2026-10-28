# 12. Glossary

| Term | Meaning |
|------|---------|
| **arc42** | Architecture documentation template (12 sections; this set + the workspace-level set). |
| **backstage** | OO's full-screen backstage menu (File menu overlay) — excluded from some census joins by policy. |
| **chrome gate** | Window-chrome parity: ribbon/toolbar/statusbar geometry vs OO (chrome-*.cjs + chrome-gate.py). |
| **census (structural)** | Inventory of tabs/controls/menus/dialog fields captured via Playwright; `-deep` variants include backstage/menus/statusbar/dialogs. |
| **cluster** | Ledger grouping of feature surfaces (16 clusters: Home tab, Insert tab, statusbar, …). |
| **count-agnostic gate** | Accept criterion phrased as a relation (e.g. "all captured controls clickable"), not a magic count (ADR-17). |
| **deep-gap.py** | Deep-census diff producing the campaign implementation backlog (explicitly NOT a gate). |
| **deficit** | Count of census features with no WO counterpart ("deficit 152→3" was the old L1-ceiling metric; ledger L0 supersedes it). |
| **flatHtml** | The editor's HTML serialization of the document (the pivot format for persistence). |
| **F-### / register** | Stable feature ids in `harness-graph/features.yaml` (111 ids, F-001..F-153 with gaps preserved). |
| **fx gate** | Functional loud-stub gate: every control must visibly act or the run fails (fx-wo local, fx-prod live). |
| **ledger (v1)** | `ledger.json`: one row per OO feature surface with L0–L4 level, cluster, WO counterpart; built by `ledger/build.py`. |
| **L0–L4** | Completeness ladder: L0 missing · L1 surface · L2 acts · L3 persists · L4 fidelity. |
| **loud row** | Ledger/diff row that must be printed on every run (deferred, STALE, EARLY) — never silently dropped. |
| **MAP** | Audited OO↔WO pairing table; join scripts consume, never modify it (ADR-03). |
| **NormalizedRender** | Scoring model in wo-conformance comparing rendered docx across engines. |
| **reconcile.py** | One-run orchestrator of the full parity gate. |
| **rig** | The pinned OnlyOffice DS docker rig (`census/rig/`) producing OO ground-truth captures. |
| **roundtrip gate** | `ledger/roundtrip.cjs`: apply command in real editor → html→docx→html via conversion endpoint → reload → assert marker survival (13 gates). |
| **STALE-DEFERRED / STALE / EARLY** | Hard-fail states: a deferred MAP row whose feature landed; a contract expectation whose register row moved; an implemented-but-unregistered contract. |
| **verbatim probing** | Round-trip payloads pass through unsanitized since 2026-10-27 (ADR-16). |
| **WO_SERVER_DIR contract** | Server checkout resolution order: env → sibling `../server` → legacy → exit. |
