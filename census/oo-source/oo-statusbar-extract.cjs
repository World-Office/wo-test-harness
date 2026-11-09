#!/usr/bin/env node
// oo-statusbar-extract.cjs — OO status bar SOURCE inventory.
//
// OO's status bar is built from template/StatusBar.template (id-stable
// controls) into view/Statusbar.js. This manifest is the authoritative OO
// statusbar control list, so WO's statusbar contracts (sb-*/btn-zoom*/
// btn-multipage tokens + tests/statusbar.test.mjs) can be checked against
// what OO actually ships instead of a hand-written list.
//
// Output: oo-statusbar.json
// Usage: node oo-statusbar-extract.cjs [main/app dir] [out.json]
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = process.argv[2] || '/tmp/oo-src/documenteditor/main/app';
const OUT = process.argv[3] || path.join(__dirname, 'oo-statusbar.json');

const tpl = fs.readFileSync(path.join(DIR, 'template', 'StatusBar.template'), 'utf8');
const sbJs = fs.readFileSync(path.join(DIR, 'view', 'Statusbar.js'), 'utf8');

const ids = [...new Set([...tpl.matchAll(/id="([a-z0-9-]+)"/g)].map((m) => m[1]))];
// zoom + info buttons wired in Statusbar.js
const jsIds = [...new Set([...sbJs.matchAll(/'((?:btn|status|label|slot)-[a-z0-9-]+)'/g)].map((m) => m[1]))];

const manifest = {
  source: 'documenteditor/main/app/template/StatusBar.template + view/Statusbar.js',
  templateIds: ids,
  jsWiredIds: jsIds,
};
fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1));
console.log(`oo-statusbar: ${ids.length} template ids, ${jsIds.length} js-wired`);
console.log('  templateIds:', ids.join(' '));
console.log('  jsWired   :', jsIds.join(' '));
