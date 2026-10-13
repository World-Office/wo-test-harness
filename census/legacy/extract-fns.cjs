#!/usr/bin/env node
// legacy/extract-fns.cjs — behavior inventory of ONE editor.js.
// Function names are the only stable behavior marker between the legacy
// python web/editor.js and the current rust-served editor.js (same UI
// skeleton, different implementation depth — e.g. pagination and
// header/footer page furniture were further along in the legacy copy).
//   node extract-fns.cjs --file editor.js --out FILE [--name label]
'use strict';
const fs = require('fs');

function arg(k, d) { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; }
const file = arg('--file'), out = arg('--out'), name = arg('--name', 'editor');
if (!file || !out) { console.error('usage: extract-fns.cjs --file editor.js --out FILE [--name label]'); process.exit(2); }

const src = fs.readFileSync(file, 'utf8');
const fns = new Set();
for (const m of src.matchAll(/(?:^|\n)\s{0,6}(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/g)) fns.add(m[1]);
for (const m of src.matchAll(/(?:^|\n)\s{0,6}const\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g)) fns.add(m[1]);

// feature keyword density — the coarse signal for where the legacy copy was
// deeper (pagination, page furniture, conversion)
const FEATURES = {
  pagination: /\bpaginat|pageBreak|page-break|\bpages\b|layoutPage|renderPage/gi,
  pageFurniture: /header[- ]?footer|pageFurniture|headerHost|footerHost|hdrFtr/gi,
  conversion: /convert|import[-_ ]?docx|export|odt/gi,
  collab: /collab|presence|cursor[A-Z]|remoteCursor/gi,
  protection: /protect|restrict/gi,
};
const keywords = {};
for (const [k, re] of Object.entries(FEATURES)) {
  const matches = src.match(new RegExp(re.source, re.flags));
  keywords[k] = matches ? matches.length : 0;
}

const inv = { name, file, fnCount: fns.size, functions: [...fns].sort(), keywords };
fs.writeFileSync(out, JSON.stringify(inv, null, 1));
console.log(`${name}: ${fns.size} functions, keywords ${JSON.stringify(keywords)} -> ${out}`);
