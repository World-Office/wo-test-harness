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

## Consumers

- `server/tests/parity/surfaces/right-panel.cjs` loads this reference (via
  `WO_OO_REF` or the walk-up to `wo-test-harness/census/oo-source/`) and asserts
  every OO source right-panel section is a WO rail section or a **declared
  divergence** (`right-panel-floors.json` `_source.knownDivergences`). WO rail
  sections must be OO sections or declared extensions.
