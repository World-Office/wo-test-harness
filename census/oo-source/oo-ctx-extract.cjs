#!/usr/bin/env node
// oo-ctx-extract.cjs — OO context-menu SOURCE manifest.
//
// The census (census-ctx.cjs) records OO right-click menus with provenance
// "5 scenario menus, 302 MenuItems" — numbers that came from an older OO
// bundle and were never re-verified against source once the reference image
// moved. This extractor re-derives the ground truth straight from
// DocumentHolderExt.js (the file that builds OO's context menus), so the
// census provenance is verifiable, and OO version upgrades can't silently
// shift the menu inventory under the contracts.
//
// Output: oo-ctx-manifest.json (menus, per-menu item/separator counts, totals)
//   + prints a verification line to paste into census-ctx.cjs provenance.
//
// Usage: node oo-ctx-extract.cjs [documenteditor/main/app/view/DocumentHolderExt.js] [out.json]
'use strict';
const fs = require('fs');
const path = require('path');
const SRC = process.argv[2] || '/tmp/oo-src/documenteditor/main/app/view/DocumentHolderExt.js';
const OUT = process.argv[3] || path.join(__dirname, 'oo-ctx-manifest.json');

const src = fs.readFileSync(SRC, 'utf8');

// brace-matched spans for a function/menu block starting at an open brace.
// Quote- and comment-aware so string literals ('...{...}') can't unbalance.
function blockAt(text, openIdx) {
  let depth = 0, i = openIdx;
  while (i < text.length) {
    const c = text[i];
    if (c === `'` || c === `"` || c === '`') { // string literal
      let q = c; i++;
      while (i < text.length && !(text[i] === q && text[i - 1] !== '\\')) i++;
      i++; continue;
    }
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; i++; continue; }
    if (c === '/' && text[i + 1] === '*') { const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 2; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return { start: openIdx, end: i + 1 }; }
    i++;
  }
  return null;
}

// scenario menus: `this.<x>Menu = new Common.UI.Menu({ ... })`; items are
// pre-built refs inside the menu's `items: [ ... ]` array.
function countArrayElems(text, fromIdx) {
  // find `[` after fromIdx, balance-brace/quote aware, count top-level commas+1
  let i = text.indexOf('[', fromIdx);
  if (i < 0) return { ok: false, count: 0 };
  let depth = 0, quote = null, elems = 1, hasAny = false;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote && text[i - 1] !== '\\') quote = null; continue; }
    if (c === `"` || c === `'`) { quote = c; continue; }
    if (c === '[' || c === '{') { depth++; hasAny = true; continue; }
    if (c === ']' || c === '}') { depth--; hasAny = true; if (depth === 0 && c === ']') return { ok: true, count: elems }; continue; }
    if (c === ',' && depth === 1) elems++;
  }
  return { ok: false, count: 0 };
}

const menus = {};
const menuRe = /this\.(\w+Menu)\s*=\s*new Common\.UI\.Menu\(\{/g;
let m;
while ((m = menuRe.exec(src))) {
  const openBrace = src.indexOf('{', m.index);
  const blk = blockAt(src, openBrace);
  const body = blk ? src.slice(blk.start, blk.end) : src.slice(m.index, m.index + 4000);
  const itemsAt = src.indexOf('items:', blk ? blk.start : m.start);
  const arr = countArrayElems(blk ? src.slice(blk.start, blk.end) : '', itemsAt >= 0 ? itemsAt - blk.start : 0);
  const itemRefs = arr.ok ? arr.count : 0;
  menus[m[1]] = { items: itemRefs === 0 && !arr.ok ? '?(n/a)' : itemRefs, chars: body.length };
}

// totals across the whole file
const allConstructors = (src.match(/new Common\.UI\.MenuItem/g) || []).length;
const allCaptions = (src.match(/caption\s*:\s*['"]/g) || []).length;
const allSeps = (src.match(/caption\s*:\s*'--'/g) || []).length;

const manifest = {
  sourceFile: 'documenteditor/main/app/view/DocumentHolderExt.js',
  menus,
  totals: { menuItemConstructors: allConstructors, captionEntries: allCaptions, separators: allSeps },
};
fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1));
console.log(`oo-ctx-manifest: ${Object.keys(menus).length} scenario menus, ${allConstructors} MenuItem constructors, ${allCaptions} caption entries (${allSeps} separators)`);
for (const [n, v] of Object.entries(menus)) console.log(`  ${n.padEnd(18)} items=${v.items} (${v.chars}b)`);
