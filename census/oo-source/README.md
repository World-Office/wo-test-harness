# OO source reference (source-dug OO truth)

The parity harness's OnlyOffice reference was previously **runtime-captured only**
(`census-oo*.json` — walks of the live OO UI on the rig). Runtime captures miss
controls that only render after selection/context or collapse at narrow
viewports, and they can hold stale ids. This directory digs into the **source**
the OO image ships, so the reference cannot drift from what OO actually builds.

## Provenance

- Image: `onlyoffice/documentserver:latest` running as the `oo-rig` container.
- web-apps bundle build version: **252.232.451.526**
  (`apps/documenteditor/main/index.html`, exact OO build served by the rig).
- Extracted tree: `.../web-apps/apps/documenteditor/main` (app/ view+template+controller,
  locale) and `documenteditor/main/index.html` version marker.
- License: AGPL-3.0-only (Ascensio); used as read-only reference for parity.

## Files

| File | What |
|------|------|
| `oo-refer-extract.cjs` | Extractor: ribbon tabs + toolbar buttons (with F1 shortcut-hint letters) + template slots + right-panel sections + toolbar shortcut-action names → `oo-reference.json` |
| `oo-reference.json` | Committed output (pinned version 252.232.451.526) |
| `oo-reconcile.cjs` | Source ↔ census audit: census blind spots (OO toolbar controls the runtime walk never captured), stale/ghost captures, right-panel section delta; appends to `../ledger/SOURCE-RECONCILE.md` |
| `oo-shortcut-dump.cjs` | Runtime dump of the authoritative OO shortcut key table (142 actions) from the live editor SDK (`Asc.c_oAscDefaultShortcuts`) → `oo-shortcuts.json` |
| `oo-shortcuts.json` | Committed ground truth: every OO default shortcut (action → keys), captured from the running editor at version 252.232.451.526 |
| `oo-shortcut-reconcile.cjs` | OO shortcut table vs WO parity contracts: 142/142 OO default shortcuts covered (98 `shortcut.*` name-joined, 44 concept-mapped, **0 gap candidates**); idempotent ledger section (marker-replaced); run on contract changes |

## Re-extract (when the OO image is upgraded)

```sh
# from the running rig container
docker cp oo-rig:/var/www/onlyoffice/documentserver/web-apps/apps/documenteditor/main \
  /tmp/oo-src-de
OO_VERSION=<build> node oo-refer-extract.cjs /tmp/oo-src-de oo-reference.json
node oo-reconcile.cjs ../census/census-oo.json oo-reference.json ../ledger/SOURCE-RECONCILE.md
```

On version change, review `oo-reference.json` diffs and re-run `oo-reconcile.cjs`
— new ribbon/right-panel controls surface there before they can silently
outpace WO's coverage.

## Shortcuts

The OO shortcut key map is NOT plaintext in the shipped source — it lives in the
minified core SDK (`Asc.c_oAscDefaultShortcuts`). Extract it from the running
editor instead:

```sh
node oo-shortcut-dump.cjs oo-shortcuts.json   # needs rig + DS up (OO_URL env)
node oo-shortcut-reconcile.cjs oo-shortcuts.json   # vs word-parity-contracts.json
```

`oo-shortcut-reconcile.cjs` re-runs are idempotent (its ledger section is
marker-replaced). Re-run after any WO shortcut contract change so a newly
promoted shortcut can never leave a silent OO-default gap.

## Consumers

- `server/tests/parity/surfaces/right-panel.cjs` loads this reference (via
  `WO_OO_REF` or the walk-up to `wo-test-harness/census/oo-source/`) and asserts
  every OO source right-panel section is a WO rail section or a **declared
  divergence** (`right-panel-floors.json` `_source.knownDivergences`). WO rail
  sections must be OO sections or declared extensions.
