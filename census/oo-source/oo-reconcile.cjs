#!/usr/bin/env node
// oo-reconcile.cjs — source-driven census audit.
//
// Compares the SOURCE-derived OO reference (oo-reference.json, from
// oo-refer-extract.cjs) against the RUNTIME-captured census (census-oo.json).
// Purpose: find census blind spots — controls the runtime walk never captured
// (pinned toolbars, contextual items, collapsed viewports) — and stale/corrupt
// captures (dynamic ids, parse artifacts). The parity contracts are built from
// the census; a blind spot means a WO control appears 'uncovered' without a
// real OO counterpart, or an OO control exists but WO coverage was never asked
// about it.
//
// Emits:
//   (a) census misses — stable OO toolbar ids with NO census capture
//   (b) census ghosts — captured ids that do not exist in the source (normalized)
//   (c) right-panel section delta (OO source 10 sections vs WO 5)
// Writes census/ledger/SOURCE-RECONCILE.md (append-style, dated section).
//
// Usage: node oo-reconcile.cjs [census-oo.json] [oo-reference.json] [out.md]
'use strict';
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const CENSUS = process.argv[2] || path.resolve(HERE, '..', 'census', 'census-oo.json');
const REF = process.argv[3] || path.join(HERE, 'oo-reference.json');
const OUT = process.argv[4] || path.resolve(HERE, '..', 'ledger', 'SOURCE-RECONCILE.md');

const census = JSON.parse(fs.readFileSync(CENSUS, 'utf8'));
const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));

// --- normalize a captured id into a stable family token ---
function stable(id) {
  if (!id) return null;
  if (/^asc-gen\d+$/.test(id)) return null;              // runtime id generator
  if (/^id-[\w-]+-\d+$/.test(id)) return null;           // split-right / dynamic suffixes
  if (/toolbar__icon/.test(id)) return null;             // parse artifact
  if (/^(fm-btn-|btn-zoom|status-btn|tlbtn-|slot-)/.test(id)) return null; // other surfaces
  return id;
}

// census captures per stable id (+ the tab it was seen in)
const captured = new Map();
for (const [tab, info] of Object.entries(census.tabs || {})) {
  if (!info || !Array.isArray(info.buttons)) continue;
  for (const b of info.buttons) {
    const s = stable(b.id);
    if (!s) continue;
    if (!captured.has(s)) captured.set(s, []);
    captured.get(s).push(tab);
  }
}

const srcIds = new Set(ref.ribbonSourceIds);
const srcSlots = new Set(ref.ribbonSlotIds);
const srcBtns = new Set(ref.ribbonButtons.map((b) => b.id));

// (a) census misses: stable OO source toolbar ids with no captured counterpart.
// CONTRACT_COVERED: runtime walk never saw the OO control (title-bar/QAT or
// overflow), but the FEATURE is contracted in the parity manifest — verified
// 2026-11-12 against word-parity-contracts.json. Not census debt.
const CONTRACT_COVERED = {
  'id-toolbar-btn-borders': 'shading/borders-dialog contracts',
  'id-toolbar-btn-case': 'change-case contracts',
  'id-toolbar-btn-colorschemas': 'themecolors, page.colors, dialog.pagecolor-dialog.l4',
  'id-toolbar-btn-direction': 'direction contracts',
  'id-toolbar-btn-fontcolor': 'text-color contract',
  'id-toolbar-btn-hidenchars': 'btn-home-formatmarks contract',
  'id-toolbar-btn-highlight': 'highlight-color contract',
  'id-toolbar-btn-linespace': 'line-spacing contract',
  'id-toolbar-btn-markers': 'marker contracts',
  'id-toolbar-btn-multilevels': 'multilevel contracts',
  'id-toolbar-btn-numbering': 'numbering contracts',
  'id-toolbar-btn-paracolor': 'shading contract',
  'id-toolbar-btn-print': 'print dialog contracts',
  'id-toolbar-btn-redo': 'redo (QAT contract)',
  'id-toolbar-btn-save': 'save (QAT contract)',
  'id-toolbar-btn-text-from-file': 'btn-textfile contracts',
  'id-toolbar-btn-undo': 'undo (QAT contract)',
};
const missOrder = [...srcBtns].sort();
const misses = missOrder.filter((id) => !captured.has(id) && !CONTRACT_COVERED[id]);
// (b) census ghosts: captured ids not present in source at all
const ghosts = [...captured.keys()].filter((id) => !srcIds.has(id) && !srcBtns.has(id) && !srcSlots.has(id)).sort();

// icon-keyed captures, for annotating misses (runtime often captures dropdown/menu
// buttons with id null + an icon class name)
const iconCaptures = new Set();
for (const [tab, info] of Object.entries(census.tabs || {})) {
  if (!info || !Array.isArray(info.buttons)) continue;
  for (const b of info.buttons) if (!b.id && b.icon) iconCaptures.add(b.icon);
}
const iconMatches = (id) => {
  const slug = id.replace(/^id-toolbar-btn-/, '').replace(/-/g, '');
  return [...iconCaptures].filter((ic) => ic.replace(/-/g, '').includes(slug) || slug.includes(ic.replace(/-/g, '')));
};

// (c) right-panel: WO sections vs OO source sections (dash-insensitive).
// SECTION_COVERED: OO routes these via right panel; WO covers the feature
// through contracts/dialogs instead (verified 2026-11-12).
//   signature  -> FX-U4 btn-signature-settings / openSignSettings dialogs
//   form       -> forms-design-mode + forms contracts
//   textart    -> inserttextart, dialoginput.textart
//   shape      -> insertobject, ctx.convert-to-shape
// send-for-signing / filling-status need OO's hosted e-signature backend —
// documented N/A (see census/ledger/SOURCE-ANALYSIS.md), not census debt.
const SECTION_COVERED = {
  shape: 'insertobject, ctx.convert-to-shape',
  textart: 'inserttextart, dialoginput.textart',
  signature: 'FX-U4 openSignatureSettings/openSignSettings dialogs',
  form: 'forms-design-mode + forms contracts',
  'send-for-signing': 'hosted e-signature service — documented N/A',
  'filling-status': 'hosted e-signature service — documented N/A',
};
const WO_SECTIONS = ['paragraph', 'table', 'image', 'chart', 'mailmerge'];
const ooSections = ref.rightPanel.map((s) => s.replace(/-settings$/, '').replace(/-/g, ''));
const missingSections = ref.rightPanel.map((s) => s.replace(/-settings$/, '')).filter((s) => !WO_SECTIONS.includes(s.replace(/-/g, '')) && !SECTION_COVERED[s]);

const now = new Date().toISOString();
const md = `
## Source reconciliation — ${now.slice(0, 10)}

OO source: **${ref.version}** (web-apps bundle inside the reference image, extracted by
oo-refer-extract.cjs). Reference fields: ${ref.ribbonButtons.length} toolbar buttons,
${ref.ribbonSourceIds.length} static toolbar-source ids, ${ref.ribbonSlotIds.length} template
slots, ${ref.rightPanel.length} right-panel sections, ${ref.ribbonShortcutActions.length}
toolbar shortcut actions.

### (a) Census blind spots — OO toolbar controls the runtime walk never captured (${misses.length})

These are real OO ribbon controls for which NO census row exists, so the parity
contract set never asks WO about them. Each becomes a candidate contract row or a
deliberately-recorded known gap. ("icon-only" = the census captured it under a
dropdown/menu component with a null id + icon class, i.e. partially captured.)
${misses.length ? misses.map((id) => { const im = iconMatches(id); return `- \`${id}\`${im.length ? ` — icon-only capture: ${im.join(', ')}` : ''}`; }).join('\n') : '- none'}
### (b) Stale/corrupt census captures (${ghosts.length})

Captured ids with no source counterpart (after normalizing runtime/dynamic ids).
Likely renamed or mis-parsed at capture time.
${ghosts.length ? ghosts.map((id) => `- \`${id}\` (seen: ${captured.get(id).join(', ')}${captured.has(id) ? '' : ''})`).join('\n') : '- none'}

### (c) Right-panel section delta — OO ${ref.rightPanel.length} vs WO 5

WO right panel (#right-panel rail): ${WO_SECTIONS.join(', ')}.
OO source sections WO has NO right-panel counterpart:
${missingSections.length ? missingSections.map((s) => `- \`${s}\``).join('\n') : '- none'}
(WO may route these to dedicated dialogs — verify each is otherwise contracted.)

---
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.appendFileSync(OUT, md);
console.log(`reconcile: ${misses.length} census misses, ${ghosts.length} ghosts, ${missingSections.length} right-panel section gaps`);
console.log('--- misses ---'); misses.forEach((m) => console.log('  ' + m));
console.log('--- ghosts ---'); ghosts.forEach((g) => console.log('  ' + g));
console.log('--- right-panel gaps ---'); missingSections.forEach((s) => console.log('  ' + s));
