#!/usr/bin/env node
// oo-filemenu-reconcile.cjs — OO File menu source inventory vs WO backstage.
//
// oo-filemenu.json lists every OO File rail button + panel (19 + 10). WO's
// backstage surface lives in overrides-dropins/backstage.json (25
// 'backstage.*' rows) backed by openBackstage(pane) in the editor. This
// reconciler proves each OO File entry has a WO surface or a declared
// divergence, mirroring the dialog 36/36 proof. Appends a marker-replaced
// section to ledger/SOURCE-RECONCILE.md.
//
// Usage: node oo-filemenu-reconcile.cjs [oo-filemenu.json] [backstage.json] [ledger.md]
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const FM = process.argv[2] || path.join(HERE, 'oo-filemenu.json');
const BS = process.argv[3] || '/home/weiss/git/World-Office/server/tests/parity/overrides-dropins/backstage.json';
const OUT = process.argv[4] || path.resolve(HERE, '..', 'ledger', 'SOURCE-RECONCILE.md');

if (!fs.existsSync(BS)) { console.error(`backstage.json not found: ${BS}`); process.exit(2); }
const fm = JSON.parse(fs.readFileSync(FM, 'utf8'));
const bs = JSON.parse(fs.readFileSync(BS, 'utf8'));
const rows = new Set(Object.keys(bs.entries || {}));

// OO fm-btn-* -> WO backstage row (or declared divergence)
const BTN = {
  'fm-btn-create': ['backstage.pane-new'],
  'fm-btn-recent': ['backstage.pane-open'],
  'fm-btn-save': ['backstage.pane-save'],
  'fm-btn-save-copy': ['backstage.pane-save', 'DIVERGE: WO folds Save-as-Copy into save pane (no backup copy surface)'],
  'fm-btn-save-desktop': ['DIVERGE: desktop-save is a host-mode action; WO console editor keeps document on server'],
  'fm-btn-print': ['backstage.pane-print'],
  'fm-btn-print-with-preview': ['backstage.pane-print', 'DIVERGE: print preview is native browser print'],
  'fm-btn-rename': ['DIVERGE: rename is host-file-op (wo:file-rename channel), not a backstage row'],
  'fm-btn-protect': ['backstage.pane-protect'],
  'fm-btn-info': ['backstage.pane-info'],
  'fm-btn-history': ['backstage.pane-history'],
  'fm-btn-rights': ['backstage.pane-protect', 'DIVERGE: OO rights panel (sharing) folded into WO protect pane'],
  'fm-btn-settings': ['backstage.pane-settings'],
  'fm-btn-help': ['backstage.pane-help'],
  'fm-btn-suggest': ['backstage.pane-suggest'],
  'fm-btn-edit': ['DIVERGE: edit = return-to-document focus; WO overlay close button serves it'],
  'fm-btn-return': ['backstage.overlay', 'DIVERGE: return = close overlay (WO Close/Escape)'],
  'fm-btn-back': ['backstage.overlay', 'DIVERGE: same as return (WO close)'],
  'fm-btn-download': ['backstage.pane-export', 'DIVERGE: OO download = WO export pane'],
};
const PNL = {
  'panel-createnew': ['backstage.pane-new'],
  'panel-recentfiles': ['backstage.pane-open'],
  'panel-saveas': ['backstage.pane-save'],
  'panel-savecopy': ['backstage.pane-save', 'DIVERGE: folded into save pane'],
  'panel-print': ['backstage.pane-print'],
  'panel-protect': ['backstage.pane-protect'],
  'panel-info': ['backstage.pane-info'],
  'panel-rights': ['backstage.pane-protect', 'DIVERGE: rights panel folded into protect pane'],
  'panel-settings': ['backstage.pane-settings'],
  'panel-help': ['backstage.pane-help'],
};

let coveredBtns = 0, divBtns = 0, gapBtns = [];
const bRows = fm.buttons.map((b) => {
  const map = BTN[b];
  if (!map) { gapBtns.push(b); return { id: b, verdict: 'UNMAPPED' }; }
  const hit = map.find((x) => !x.startsWith('DIVERGE') && rows.has(x));
  if (hit) { coveredBtns++; return { id: b, verdict: 'covered', wo: hit }; }
  divBtns++; return { id: b, verdict: 'diverged', wo: map.find((x) => x.startsWith('DIVERGE')) || '—' };
});
let coveredP = 0, divP = 0, gapP = [];
const pRows = fm.panels.map((p) => {
  const map = PNL[p];
  if (!map) { gapP.push(p); return { id: p, verdict: 'UNMAPPED' }; }
  const hit = map.find((x) => !x.startsWith('DIVERGE') && rows.has(x));
  if (hit) { coveredP++; return { id: p, verdict: 'covered', wo: hit }; }
  divP++; return { id: p, verdict: 'diverged', wo: map.find((x) => x.startsWith('DIVERGE')) || '—' };
});

const text = [`<!-- oo-filemenu -->`,
  `## OO File menu vs WO backstage (${fm.buttons.length} buttons, ${fm.panels.length} panels)`,
  '',
  `OO File rail buttons: direct WO row hits **${coveredBtns}**, declared divergences **${divBtns}**, unmapped **${gapBtns.length}**. Panels: hits **${coveredP}**, diverged **${divP}**, unmapped **${gapP.length}**.`,
  '',
  ...(gapBtns.length ? ['Unmapped buttons:', ...gapBtns.map((g) => `- ${g}`), ''] : []),
  ...(gapP.length ? ['Unmapped panels:', ...gapP.map((g) => `- ${g}`), ''] : []),
  '',
  '| OO button | verdict | WO surface |',
  '|---|---|---|',
  ...bRows.map((r) => `| ${r.id} | ${r.verdict} | ${r.wo || '—'} |`),
  '',
  '| OO panel | verdict | WO surface |',
  '|---|---|---|',
  ...pRows.map((r) => `| ${r.id} | ${r.verdict} | ${r.wo || '—'} |`),
  '',
  '<!-- /oo-filemenu -->',
].join('\n');

const OPEN = '<!-- oo-filemenu -->', CLOSE = '<!-- /oo-filemenu -->';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
let prev = ''; try { prev = fs.readFileSync(OUT, 'utf8'); } catch {}
let body;
if (prev.includes(OPEN)) {
  const a = prev.indexOf(OPEN), b = prev.indexOf(CLOSE);
  body = prev.slice(0, a) + text + '\n' + (b >= 0 ? prev.slice(b) : '');
} else body = prev + text + '\n';
fs.writeFileSync(OUT, body);

console.log(`filemenu reconcile: ${fm.buttons.length} buttons -> covered ${coveredBtns}, diverged ${divBtns}, UNMAPPED ${gapBtns.length}; ${fm.panels.length} panels -> covered ${coveredP}, diverged ${divP}, UNMAPPED ${gapP.length}`);
if (gapBtns.length || gapP.length) console.log('UNMAPPED:', [...gapBtns, ...gapP].join(', '));
