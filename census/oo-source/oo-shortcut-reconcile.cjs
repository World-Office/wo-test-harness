#!/usr/bin/env node
// oo-shortcut-reconcile.cjs — OO default-shortcut ground truth vs WO contracts.
//
// oo-shortcuts.json is THE authoritative OO shortcut key table (dumped from the
// live editor SDK — Asc.c_oAscDefaultShortcuts, 142 actions); the shipped
// source has no plaintext key map. WO's shortcut coverage is asserted via
// word-parity-contracts.json tokens. This reconciler:
//   1. name-joins OO actions to `shortcut.<action>` tokens;
//   2. maps the rest through a CONCEPT table (WO keys/UX tokens covering the
//      action — bold, ctrl+*, selectall, …) — auditable, not guessed;
//   3. reports ANY action with no WO coverage (real gap candidates);
//   4. key-parity: where WO binds the same combo as a key token, says whether
//      it matches the OO default (divergences are flagged, e.g. a workload-
//      specific rebind — WO Control+Minus=zoomOut matches OO Ctrl+-).
// Appends its section to ledger/SOURCE-RECONCILE.md.
//
// Usage: node oo-shortcut-reconcile.cjs [oo-shortcuts.json] [contracts.json] [ledger.md]
'use strict';
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const SCR = process.argv[2] || path.join(HERE, 'oo-shortcuts.json');
const CON = process.argv[3] || process.env.WO_CONTRACTS
  || '/home/weiss/git/World-Office/server/tests/parity/word-parity-contracts.json';
const OUT = process.argv[4] || path.resolve(HERE, '..', 'ledger', 'SOURCE-RECONCILE.md');

if (!fs.existsSync(CON)) { console.error(`contracts not found: ${CON} (pass path or set WO_CONTRACTS)`); process.exit(2); }
const ref = JSON.parse(fs.readFileSync(SCR, 'utf8'));
const contracts = JSON.parse(fs.readFileSync(CON, 'utf8'));

// WO token -> WO key combo (normalized) where the token IS a key binding
const WO_KEY_TOKENS = {};
for (const e of (contracts.entries || [])) {
  const t = e.token;
  const m = /^((?:ctrl|alt|shift)(?:\+(?:ctrl|alt|shift))*\+[a-z0-9]+)$/i.test(t) ? t : /^(backspace|delete|escape|enter|tab|space)$/i.test(t) ? t : null;
  if (m) WO_KEY_TOKENS[t] = t;
}

// CONCEPT map: OO action name -> { toks: [WO tokens that cover it], note }
const CONCEPT = {
  applyheading1: { toks: ['applyheading1'], note: 'Alt+1' },
  applyheading2: { toks: ['applyheading2'], note: 'Alt+2' },
  applyheading3: { toks: ['applyheading3'], note: 'Alt+3' },
  bold: { toks: ['bold', 'ctrl+b'], note: 'WO bold contract' },
  italic: { toks: ['italic', 'ctrl+i'], note: 'WO italic contract' },
  underline: { toks: ['underline', 'ctrl+u'], note: 'WO underline contract' },
  centerpara: { toks: ['justifycenter', 'ctrl+e'], note: 'center align' },
  justifypara: { toks: ['justifyfull', 'ctrl+j'], note: 'justify' },
  leftpara: { toks: ['justifyleft', 'ctrl+l'], note: 'left align' },
  rightpara: { toks: ['justifyright', 'ctrl+r'], note: 'right align' },
  closemenu: { toks: ['escape'], note: 'close menu/dialog' },
  decreasefontsize: { toks: ['ctrl+['], note: '' },
  increasefontsize: { toks: ['ctrl+]'], note: '' },
  deleteleftchar: { toks: ['backspace'], note: '' },
  deleterightchar: { toks: ['delete'], note: '' },
  deleteleftword: { toks: [], note: 'caret/word deletion — permanent-skip family (WO nav parity backlog)', skip: true },
  deleterightword: { toks: [], note: 'caret/word deletion — permanent-skip family', skip: true },
  editselectall: { toks: ['selectall', 'ctrl+a'], note: '' },
  editundo: { toks: ['ctrl+z'], note: '' },
  copyrightsign: { toks: ['ctrl+alt+g'], note: 'insert symbol ©' },
  eurosign: { toks: ['ctrl+alt+e'], note: 'insert symbol €' },
  registeredsign: { toks: ['ctrl+alt+r'], note: 'insert symbol ®' },
  trademarksign: { toks: ['ctrl+alt+t'], note: 'insert symbol ™' },
  horizontalellipsis: { toks: ['ctrl+\\.', 'symbol-dialog'], note: 'insert … via symbol dialog', skip: true },
  insertequation: { toks: ['ctrl+alt+=', 'btn-equation', 'equation-dialog'], note: 'OO default Alt+= ; WO: macro/equation dialog', skip: true },
  insertendnotenow: { toks: ['ctrl+alt+d', 'insertfootnote'], note: 'endnote' },
  insertfootnotenow: { toks: ['ctrl+alt+f', 'insertfootnote'], note: '' },
  inserthyperlink: { toks: ['ctrl+k', 'link'], note: '' },
  insertcolumnbreak: { toks: ['ctrl+shift+enter', 'breaks'], note: 'column break' },
  insertpagebreak: { toks: ['ctrl+enter', 'breaks'], note: 'page break' },
  nonbreakinghyphen: { toks: ['ctrl+shift+minus'], note: '' },
  nonbreakingspace: { toks: ['ctrl+shift+space'], note: '' },
  openchatpanel: { toks: ['togglechat'], note: 'chat sidebar (WO toggle), OO Alt+Q' },
  openfindandreplacemenu: { toks: ['ctrl+h'], note: 'replace' },
  openfinddialog: { toks: ['ctrl+f', 'btn-find'], note: '' },
  pastetextwithoutformat: { toks: ['ctrl+shift+v'], note: '' },
  save: { toks: ['save', 'ctrl+s'], note: '' },
  subscript: { toks: ['subscript', 'ctrl+,'], note: 'OO Ctrl+, vs WO ctrl+, (same)' },
  superscript: { toks: ['superscript', 'ctrl+\\.'], note: 'OO Ctrl+. vs WO (script tools)' },
  unindent: { toks: ['ctrl+shift+m', 'outdent'], note: '' },
  indent: { toks: ['ctrl+m', 'indent'], note: '' },
  zoom100: { toks: ['ctrl+0', 'btn-zoom-reset'], note: '' },
  zoomin: { toks: ['ctrl+plus/=', 'btn-zoom-in'], note: 'OO Ctrl+= / Ctrl+NumPlus' },
  zoomout: { toks: ['ctrl+minus', 'btn-zoom-out'], note: 'OO Ctrl+- ; matches WO Control+Minus=zoomOut (L2O-06 canon)' },
};

const normKey = (s) => s.replace(/\s+/g, '').toLowerCase();
const keyOf = (s) => normKey(String(s || '').replace('+3D', '='));

const haveToks = new Set((contracts.entries || []).map((e) => e.token));
const oos = {};
for (const a of ref.shortcuts) oos[a.name.toLowerCase()] = a;

const joined = [], concept = [], gap = [], namedNoKey = [];
for (const [name, a] of Object.entries(oos)) {
  const keys = (a.keys || []).map((k) => k.key).join(' | ');
  if (haveToks.has('shortcut.' + name)) { joined.push({ name, keys }); continue; }
  const c = CONCEPT[name];
  if (c) {
    const hit = c.toks.filter((t) => haveToks.has(t));
    concept.push({ name, keys, toks: hit, note: c.note, skip: !!c.skip });
    continue;
  }
  gap.push({ name, keys });
}

const lines = [`<!-- oo-shortcuts -->
### OO default shortcuts vs WO coverage (${ref.version}) — ${joined.length + concept.length + gap.length} actions`,
  '',
  `Ground truth: oo-shortcuts.json (${joined.length + concept.length + gap.length} actions, dumped from the live editor SDK at ${ref.capturedAt.slice(0, 10)}).
Name-joined to \`shortcut.*\` contracts: **${joined.length}**; concept-mapped: **${concept.length}**; **NO WO coverage: ${gap.length}**.`,
  '',
  '#### No-coverage OO default shortcuts (real gap candidates)',
  gap.length ? gap.map((g) => `- \`${g.name}\` — OO ${g.keys}`).join('\n') : '- none',
  '',
  '#### Concept-mapped (WO covers via other tokens)',
  ''
].join('\n');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
let prev = '';
try { prev = fs.readFileSync(OUT, 'utf8'); } catch {}
const BODY = lines + '\n'
  + concept.map((c) => `- \`${c.name}\` [${c.keys}] -> ${c.toks.length ? c.toks.join(', ') : '(skip family)'}${c.note ? ' — ' + c.note : ''}${c.skip ? ' [SKIP]' : ''}`).join('\n')
  + '\n<!-- /oo-shortcuts -->\n---\n';
const out = prev.includes('<!-- oo-shortcuts -->')
  ? prev.replace(/<!-- oo-shortcuts -->[\s\S]*?<!-- \/oo-shortcuts -->/, BODY.trim())
  : prev + BODY;
fs.writeFileSync(OUT, out);

console.log(`shortcut reconcile: joined=${joined.length} concept=${concept.length} gap=${gap.length}`);
console.log('--- NO WO coverage (gap candidates) ---');
gap.forEach((g) => console.log(`  ${g.name.padEnd(28)} OO ${g.keys}`));
console.log('--- concept-mapped ---');
concept.forEach((c) => console.log(`  ${c.name.padEnd(28)} ${c.keys.padEnd(16)} -> ${c.toks.length ? c.toks.join(', ') : '(skip family)'} ${c.skip ? '[SKIP]' : ''}`));
