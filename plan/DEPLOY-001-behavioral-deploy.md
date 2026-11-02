# DEPLOY-001 — behavioral fixes live on cloud.graphwiz.ai (2026-11-02 21:07 CET)

Server `main` @ `0dfa571d6` is LIVE on BOTH docserver containers
(prod :8082 opencloud-compose, staging :8086 ocstaging) via the
bind-mounted bundle `~/editor-ui-ebae8fc3/word/` — all 5 files
(editor.js i18n.js index.html style.css wo-bridge.js) md5-identical
to committed HEAD on both ports.

Deployed this run (all UI-only → bundle sync, no image rebuild):
- BHV-002 `0dfa571d6` Shift+Enter gray-background fix (sheet-bottom split)
- BHV-001 `e82cdbbe2` behavioral gate test (Shift+Enter keeps text on sheet)
- RIB-001 `269d8cb1f` ribbon tabs folder-tab visual
- RIB-003 `163b6c74e` contextual tabs auto-show/hide (MutationObserver)
- RIB-002 `db1652028` ribbon tab keyboard navigation (WAI-ARIA tabs)
- plus VIS-001 `a3a37131f` ruler z-index + link-dialog `661546015` that
  postdated the 19:55 image build.

Synced from COMMITTED HEAD via `git show HEAD:`, never the dirty working
tree — other agents had in-flight uncommitted editor.js edits during the
deploy window. Bundle backup: `~/editor-ui-backups-20261102-deploy001/`.

Gate (verbatim): OK. Fix verified in served editor.js.
ponytail: embedded image editor-ui stays one vintage behind (76b37a431) —
rebuild `worldoffice/documentserver:latest` only before any container
recreate; bundle is canonical for UI-only changes (established recipe).
