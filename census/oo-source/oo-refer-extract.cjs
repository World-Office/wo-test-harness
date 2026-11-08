#!/usr/bin/env node
// oo-refer-extract.cjs — extract an authoritative ONLYOFFICE reference from the
// shipped web-apps source (the exact bundle the documentserver image serves).
//
// WHY: the parity harness compares WO's editor against a runtime CAPTURED census
// (census-oo*.json). Runtime captures miss controls that only render after
// selection/context, collapse pinned toolbars at narrow viewports, and can hold
// stale ids. This digs into the SOURCE that builds the OO UI so the reference
// cannot drift from what OO ships and exposes census blind spots.
//
// Input tree layout (as inside onlyoffice/documentserver):
//   <src>/documenteditor/main/app/view/Toolbar.js        — button wiring + hints
//   <src>/documenteditor/main/app/template/Toolbar.template  — ribbon tab/slot layout
//   <src>/documenteditor/main/app/template/RightMenu.template — right panel sections
//   <src>/documenteditor/main/app/index.html             — build version string
//
// Output: oo-reference.json (committed beside this script).
//
// Usage: node oo-refer-extract.cjs [oo-src-root] [out.json]
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || process.env.OO_SRC || '/tmp/oo-src';
const OUT = process.argv[3] || path.join(__dirname, 'oo-reference.json');
const DE = path.join(SRC, 'documenteditor', 'main');

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const view = read(path.join(DE, 'app', 'view', 'Toolbar.js'));
const tpl = read(path.join(DE, 'app', 'template', 'Toolbar.template'));
const rmTpl = read(path.join(DE, 'app', 'template', 'RightMenu.template'));
const idx = read(path.join(DE, 'index.html'));

// ribbon tabs declared by the template panels
const tabs = [...new Set([...tpl.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]))];

// --- buttons: every `id: 'id-toolbar-btn-*'` with its nearest FOLLOWING
// dataHintTitle (shortcut letter) — pairs by position, nesting-proof. ---
const idRe = /id:\s*'id-toolbar-btn-([a-z0-9-]+)'/g;
const hintRe = /dataHintTitle\s*:\s*'([^']*)'/g;
const ids = [...idRe[Symbol.matchAll] ? idRe[Symbol.matchAll](view) : []];
const hints = [...hintRe[Symbol.matchAll] ? hintRe[Symbol.matchAll](view) : []];
const buttons = ids.map((m) => {
  const at = m.index;
  const hint = hints.find((h) => h.index > at && h.index - at < 3000) || { 1: '' };
  return { id: 'id-toolbar-btn-' + m[1], hint: hint[1] };
});
// de-dupe keeping the first (earliest hint) occurrence per id
const seen = new Set();
const uniqButtons = buttons.filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));

// --- ribbon source id family (static ids + every toolbar/slot id found in view) ---
const srcIdRe = /id:\s*'(id-toolbar-[a-z0-9-]+)'/g;
const sourceIds = [...new Set([...view.matchAll(srcIdRe)].map((m) => m[1]))];

// --- template layout slots ---
const slots = [...new Set([...tpl.matchAll(/id="(slot-[a-z0-9-]+)"/g)].map((m) => m[1]))];

// --- right panel sections (authoritative: 10 in OO vs 5 in WO) ---
const rightPanel = [...new Set([...rmTpl.matchAll(/id="id-([a-z0-9-]+-settings)"/g)].map((m) => m[1]))];

// --- toolbar-registered shortcut action names ---
const shortcutActions = [...new Set([...view.matchAll(/this\.shortcutHints\.([A-Za-z0-9_]+)\s*=/g)].map((m) => m[1]))];

const version = (idx.match(/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/) || [])[0] || process.env.OO_VERSION || 'unknown';

const ref = {
  source: 'onlyoffice/documentserver web-apps/apps/documenteditor/main (source served by the OO reference image; AGPL-3.0). Extract via: docker cp <container>:/var/www/onlyoffice/documentserver/web-apps/apps/documenteditor/main /tmp/oo-src-de',
  version,
  extractedAt: new Date().toISOString(),
  ribbonTabs: tabs,
  ribbonButtons: uniqButtons,
  ribbonSlotIds: slots,
  ribbonSourceIds: sourceIds,
  ribbonShortcutActions: shortcutActions,
  rightPanel,
};
fs.writeFileSync(OUT, JSON.stringify(ref, null, 1));
console.log(`oo-reference: version=${version} tabs=${JSON.stringify(tabs)} buttons=${uniqButtons.length} slots=${slots.length} rightPanel=${rightPanel.length} shortcutActions=${shortcutActions.length}`);
