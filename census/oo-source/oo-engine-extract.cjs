#!/usr/bin/env node
// oo-engine-extract.cjs — OO ENGINE COMMAND universe, extracted STATICALLY from
// the pinned sdkjs checkout (no rig, no browser — unlike oo-shortcut-dump.cjs
// which reads the live runtime for the *key bindings*).
//
// The parity port-graph's "engine" surface needs the command names OO's word
// engine actually ships, not the campaign-provenance feature ledger. Those
// names live in three static places in sdkjs:
//
//   1. Asc.c_oAscDocumentShortcutType.*  — every document shortcut/action type
//      (defined in word/apiDefines.js; all 147 members referenced across
//      word/**/*.js — the engine's keyboard command vocabulary).
//   2. c_oAscContextMenuTypes.*          — context-menu kind enum (defined per
//      editor: word/slide/cell apiDefines.js; union recorded here).
//   3. switch-case labels in word/Editor/Document.js — the dispatcher's case
//      strings (bare identifier commands + enum-qualified labels; numeric flag
//      values are dropped). Enum-qualified shortcut-type cases are the same
//      commands as (1) and de-duplicate into them in the flat `commands` list.
//
// Deterministic & re-runnable: no timestamps, every array order-locked (sort),
// fixed key order — a re-run over the same checkout is byte-stable, so the
// committed manifest can be staleness-checked (rebuild == committed bytes).
//
// Output: oo-engine-commands.json (sibling of this script by default).
// Usage: node oo-engine-extract.cjs [sdkjsDir|out.json] [out.json]
//   sdkjs dir: env OO_SDKJS, else argv[1] (when not a *.json path),
//              else /home/weiss/git/OO/DocumentServer/sdkjs (pinned checkout).
//   out json  : argv[1] when it ends in .json, else argv[2], else sibling file.
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Pinned OO reference (rig image web-apps build 252.232.451.526); the sdkjs
// checkout below is the engine source for that build. Fallback rev = the
// checked-out commit at extraction time — used only if `git` is unavailable.
const DEFAULT_SDKJS = '/home/weiss/git/OO/DocumentServer/sdkjs';
const PINNED_REV = '9d2138866d929be32f1d107e8b5bfae36156e097'; // merge release/v10.0.0 into master
const OO_BUILD = '252.232.451.526';

const arg1 = process.argv[2] || '';
const arg2 = process.argv[3] || '';
const SDKJS = process.env.OO_SDKJS
  || (arg1 && !arg1.endsWith('.json') ? arg1 : '')
  || DEFAULT_SDKJS;
const OUT = (arg1.endsWith('.json') ? arg1 : arg2)
  || path.join(__dirname, 'oo-engine-commands.json');

const read = (p) => {
  const full = path.join(SDKJS, p);
  if (!fs.existsSync(full)) { console.error(`oo-engine-extract: missing ${full} — is OO_SDKJS correct?`); process.exit(1); }
  return fs.readFileSync(full, 'utf8');
};

// ---- 1. Asc.c_oAscDocumentShortcutType.* (word) -----------------------------
// Parse the object literal in word/apiDefines.js (name -> numeric type id) and
// cross-check where each member is referenced as Asc.c_oAscDocumentShortcutType.X
// anywhere under word/ (the verified usage set == the definition set).
const apiDefinesWord = read('word/apiDefines.js');
const shortcutObj = apiDefinesWord.match(/var c_oAscDocumentShortcutType = \{([\s\S]*?)\n\};/);
if (!shortcutObj) { console.error('oo-engine-extract: c_oAscDocumentShortcutType object not found'); process.exit(1); }
const shortcutDefs = [...shortcutObj[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*:\s*(-?0x[0-9A-Fa-f]+|-?\d+)/gm)]
  .map((m) => ({ name: m[1], value: Number(m[2]) }));

const wordFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && e.name.endsWith('.js')) wordFiles.push(p);
  }
})(path.join(SDKJS, 'word'));
const shortcutUseRe = /Asc\.c_oAscDocumentShortcutType\.([A-Za-z0-9]+)/g;
const shortcutUses = new Map(); // name -> use count across word/**
for (const f of wordFiles) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = shortcutUseRe.exec(src))) shortcutUses.set(m[1], (shortcutUses.get(m[1]) || 0) + 1);
}

// ---- 2. c_oAscContextMenuTypes.* (word + slide + cell) ----------------------
// Defined per editor; the union is the engine's context-menu kind vocabulary.
const ctxMenuTypes = []; // {name, value, editors[]}
for (const editor of ['word', 'slide', 'cell']) {
  const src = read(`${editor}/apiDefines.js`);
  const obj = src.match(/var c_oAscContextMenuTypes = \{([\s\S]*?)\n\s*\};/);
  if (!obj) continue;
  for (const m of obj[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*:\s*(-?0x[0-9A-Fa-f]+|-?\d+)/gm)) {
    const name = m[1];
    let row = ctxMenuTypes.find((r) => r.name === name);
    if (!row) { row = { name, value: Number(m[2]), editors: [] }; ctxMenuTypes.push(row); }
    if (!row.editors.includes(editor)) row.editors.push(editor);
  }
}
ctxMenuTypes.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

// ---- 3. switch-case labels in word/Editor/Document.js -----------------------
// `case <label>:` where label is identifier-like (letters/digits/_/./-).
// Numeric flag values (-1/1/2 …) are dropped — they are not command tokens.
const documentJs = read('word/Editor/Document.js');
const caseLabels = new Set();
for (const m of documentJs.matchAll(/\bcase\s+['"]?([A-Za-z0-9_./-]+)['"]?\s*:/g)) {
  if (/^-?\d+$/.test(m[1])) continue; // numeric flags, not commands
  caseLabels.add(m[1]);
}
const classify = (label) => {
  const dot = label.lastIndexOf('.');
  if (dot === -1) return { token: label, cls: 'identifier' };
  return { token: label.slice(dot + 1), cls: label.slice(0, dot) };
};
const shortcutQualified = (name) => `Asc.c_oAscDocumentShortcutType.${name}`;
const shortcutCaseSet = new Set([...caseLabels]
  .filter((l) => l.startsWith('Asc.c_oAscDocumentShortcutType.'))
  .map((l) => l.slice('Asc.c_oAscDocumentShortcutType.'.length)));

// ---- assemble ----------------------------------------------------------------
const shortcutCommands = shortcutDefs
  .map((d) => ({
    name: d.name,
    value: d.value,
    qualified: shortcutQualified(d.name),
    usedInWord: shortcutUses.has(d.name),
  }))
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

const dispatchCommands = [...caseLabels].sort().map((label) => {
  const { token, cls } = classify(label);
  return { label, token, class: cls };
});

const ctxSorted = ctxMenuTypes.map((r) => ({
  name: r.name,
  value: r.value,
  qualified: `Asc.c_oAscContextMenuTypes.${r.name}`,
  editors: r.editors.slice().sort(),
}));

// Flat, de-duplicated command universe (what the port-graph engine surface rows
// come from): shortcut-type case labels fold into their shortcutCommands row.
const commands = [];
for (const s of shortcutCommands) {
  commands.push({
    id: `shortcut:${s.name}`, kind: 'shortcut', name: s.name, value: s.value,
    qualified: s.qualified, usedInWord: s.usedInWord, documentCase: shortcutCaseSet.has(s.name),
  });
}
for (const c of ctxSorted) {
  commands.push({
    id: `ctx:${c.name}`, kind: 'ctx-menu', name: c.name, value: c.value,
    qualified: c.qualified, editors: c.editors,
  });
}
let foldedCases = 0;
for (const d of dispatchCommands) {
  if (d.class === 'Asc.c_oAscDocumentShortcutType') { foldedCases++; continue; } // same command as the shortcut row
  commands.push({ id: `case:${d.label}`, kind: 'dispatch', token: d.token, class: d.class });
}
commands.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

let gitRev = PINNED_REV;
try { gitRev = execSync('git rev-parse HEAD', { cwd: SDKJS, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || PINNED_REV; } catch { /* keep pinned rev */ }

const manifest = {
  source: `sdkjs (pinned OO checkout, web-apps build ${OO_BUILD}) — static extraction: word/apiDefines.js (Asc.c_oAscDocumentShortcutType, c_oAscContextMenuTypes) + word/Editor/Document.js switch-case labels`,
  ooBuild: OO_BUILD,
  gitRev,
  sdkjsPath: SDKJS,
  extractor: 'census/oo-source/oo-engine-extract.cjs',
  _note: 'static extraction — command names, not UI labels; shortcut:* = engine keyboard/action command types (all referenced in word/**), ctx:* = context-menu kind enum (union over word/slide/cell), case:* = word/Editor/Document.js dispatcher case labels (numeric flags dropped; Asc.c_oAscDocumentShortcutType.* cases fold into their shortcut:* row)',
  counts: {
    shortcutCommands: shortcutCommands.length,
    ctxMenuTypes: ctxSorted.length,
    dispatchCommands: dispatchCommands.length,
    dispatchCasesFoldedIntoShortcuts: foldedCases,
    commands: commands.length,
  },
  total: commands.length,
  shortcutCommands,
  ctxMenuTypes: ctxSorted,
  dispatchCommands,
  commands,
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1) + '\n');
console.log(`oo-engine: ${commands.length} commands -> ${OUT}`);
console.log(`  shortcut types : ${shortcutCommands.length} (all used in word/: ${shortcutCommands.every((s) => s.usedInWord)})`);
console.log(`  ctx menu types : ${ctxSorted.length} (${[...new Set(ctxSorted.flatMap((c) => c.editors))].join('/')})`);
console.log(`  dispatch cases : ${dispatchCommands.length} (${foldedCases} folded into shortcut rows, ${dispatchCommands.length - foldedCases} unique)`);
console.log(`  sdkjs          : ${SDKJS} @ ${gitRev.slice(0, 12)}`);
