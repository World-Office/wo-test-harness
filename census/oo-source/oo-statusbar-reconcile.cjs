#!/usr/bin/env node
// oo-statusbar-reconcile.cjs — OO status bar source inventory vs WO tokens.
//
// oo-statusbar.json lists OO's status bar controls (template ids + js wires).
// WO's statusbar surface is spelled in word-parity-contracts.json as sb-*/
// btn-zoom*/btn-multipage tokens and statusbar.test.mjs. This reconciles
// every OO control to a WO token or a declared divergence, mirroring the
// dialog 36/36 proof. Appends a marker-replaced section to
// ledger/SOURCE-RECONCILE.md.
//
// Usage: node oo-statusbar-reconcile.cjs [oo-statusbar.json] [contracts.json] [ledger.md]
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const SB = process.argv[2] || path.join(HERE, 'oo-statusbar.json');
const CON = process.argv[3] || process.env.WO_CONTRACTS
  || '/home/weiss/git/World-Office/server/tests/parity/word-parity-contracts.json';
const OUT = process.argv[4] || path.resolve(HERE, '..', 'ledger', 'SOURCE-RECONCILE.md');

if (!fs.existsSync(CON)) { console.error(`contracts not found: ${CON}`); process.exit(2); }
const sb = JSON.parse(fs.readFileSync(SB, 'utf8'));
const contracts = JSON.parse(fs.readFileSync(CON, 'utf8'));
const toks = new Set((contracts.entries || []).map((e) => e.token));

// OO statusbar id -> WO token(s); 'DIVERGE:' prefix = declared divergence.
const MAP = {
  'label-pages': ['DIVERGE: WO sb-page-count id in statusbar DOM, not contract-tokenized', 'sb-page-count'],
  'status-goto-box': ['DIVERGE: Go-to-page input; WO covers via Find (btn-find) + page navigation'],
  'status-goto-page': ['DIVERGE: Go-to-page input; WO covers via Find (btn-find) + page navigation'],
  'label-action': ['DIVERGE: OO transient action/status text; WO shows status in overlay toasts'],
  'slot-status-btn-info': ['backstage-info', 'DIVERGE: info slide-in = WO backstage pane-info'],
  'btn-cnt-lang': ['sb-lang'],
  'btn-doc-lang': ['sb-lang', 'DIVERGE: OO splits content-vs-doc language; WO single sb-lang opens language dialog'],
  'btn-doc-spell': ['sb-doc-spell'],
  'btn-doc-review': ['sb-track-changes'],
  'status-btn-select-tool': ['DIVERGE: native selection indicator; no WO control (browser native)'],
  'status-btn-hand-tool': ['DIVERGE: hand/pan tool; WO pans with scroll + selection cursor'],
  'status-btn-multiple-pages': ['btn-multipage'],
  'btn-zoom-topage': ['btn-zoom-fit', 'btn-zoom-reset'],
  'btn-zoom-towidth': ['btn-zoom-fit'],
  'btn-zoom-down': ['btn-zoom-out'],
  'btn-zoom-up': ['btn-zoom-in'],
  'label-zoom': ['DIVERGE: WO sb-zoom-label id in statusbar DOM, not contract-tokenized', 'sb-zoom-label'],
  'status-zoom': ['DIVERGE: WO sb-zoom-slider id in statusbar DOM, not contract-tokenized', 'sb-zoom-slider'],
};

let covered = 0, diverged = 0, gap = [];
const rows = sb.templateIds.map((id) => {
  const map = MAP[id];
  if (!map) { gap.push(id); return { id, verdict: 'UNMAPPED' }; }
  const hit = map.find((x) => !x.startsWith('DIVERGE') && toks.has(x));
  if (hit) { covered++; return { id, verdict: 'covered', wo: hit }; }
  diverged++; return { id, verdict: 'diverged', wo: (map.find((x) => x.startsWith('DIVERGE')) || 'WO control id exists but not contract-tokenized').slice(8, 999) };
});

const text = [`<!-- oo-statusbar -->`,
  `## OO status bar vs WO tokens (${sb.templateIds.length} OO controls)`,
  '',
  `Direct WO token hits **${covered}**; declared divergences **${diverged}**; unmapped **${gap.length}**.`,
  '',
  ...(gap.length ? ['Unmapped:', ...gap.map((g) => `- ${g}`), ''] : []),
  '',
  '| OO control | verdict | WO surface |',
  '|---|---|---|',
  ...rows.map((r) => `| ${r.id} | ${r.verdict} | ${r.wo || '—'} |`),
  '',
  '<!-- /oo-statusbar -->',
].join('\n');

const OPEN = '<!-- oo-statusbar -->', CLOSE = '<!-- /oo-statusbar -->';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
let prev = ''; try { prev = fs.readFileSync(OUT, 'utf8'); } catch {}
let body;
if (prev.includes(OPEN)) {
  const a = prev.indexOf(OPEN), b = prev.indexOf(CLOSE);
  body = prev.slice(0, a) + text + '\n' + (b >= 0 ? prev.slice(b) : '');
} else body = prev + text + '\n';
fs.writeFileSync(OUT, body);

console.log(`statusbar reconcile: ${sb.templateIds.length} OO controls -> covered ${covered}, diverged ${diverged}, UNMAPPED ${gap.length}`);
if (gap.length) console.log('UNMAPPED:', gap.join(', '));
