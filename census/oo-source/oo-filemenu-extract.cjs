#!/usr/bin/env node
// oo-filemenu-extract.cjs — OO File menu (backstage) SOURCE inventory.
//
// OO's File menu rail + panels live in documenteditor/main/app/template/
// FileMenu.template (fm-btn-* rail buttons, panel-* content boxes), with the
// panel contents built by FileMenu.js / FileMenuPanels.js. This manifest is
// the authoritative OO backstage button/panel list, so WO's backstage drop-in
// (overrides-dropins/backstage.json, 25 'backstage.*' rows) can be verified
// against what OO actually ships in its File menu.
//
// Output: oo-filemenu.json
// Usage: node oo-filemenu-extract.cjs [main/app dir] [out.json]
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = process.argv[2] || '/tmp/oo-src/documenteditor/main/app';
const OUT = process.argv[3] || path.join(__dirname, 'oo-filemenu.json');

const tpl = fs.readFileSync(path.join(DIR, 'template', 'FileMenu.template'), 'utf8');
const fmJs = fs.readFileSync(path.join(DIR, 'view', 'FileMenu.js'), 'utf8');
const panelsJs = fs.readFileSync(path.join(DIR, 'view', 'FileMenuPanels.js'), 'utf8');

const buttons = [...new Set([...tpl.matchAll(/id="(fm-btn-[a-z0-9-]+)"/g)].map((m) => m[1]))];
const panels = [...new Set([...tpl.matchAll(/id="(panel-[a-z0-9-]+)"/g)].map((m) => m[1]))];
// extra panels/buttons registered in JS (not in the template)
const jsBtn = [...new Set([...fmJs.matchAll(/'(fm-btn-[a-z0-9-]+)'/g), ...panelsJs.matchAll(/'(fm-btn-[a-z0-9-]+)'/g)].map((m) => m[1]))];
const jsPanel = [...new Set([...fmJs.matchAll(/'(panel-[a-z0-9-]+)'/g), ...panelsJs.matchAll(/'(panel-[a-z0-9-]+)'/g)].map((m) => m[1]))];
const jsCmd = [...new Set([...fmJs.matchAll(/this\.cmd([A-Z]\w*)|'cmd([A-Z]\w*)'|'btn-([a-z0-9-]+)'/g).map((m) => m[1] || m[2] || m[3])])];

const manifest = {
  source: 'documenteditor/main/app/template/FileMenu.template + view/FileMenu.js + view/FileMenuPanels.js',
  buttons,
  panels,
  extraButtonsInJs: jsBtn.filter((b) => !buttons.includes(b)),
  extraPanelsInJs: jsPanel.filter((p) => !panels.includes(p)),
  jsCommandTokens: jsCmd.slice(0, 60),
};
fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1));
console.log(`oo-filemenu: ${buttons.length} rail buttons, ${panels.length} panels`);
console.log('  buttons:', buttons.join(' '));
console.log('  panels :', panels.join(' '));
console.log('  extra in JS:', manifest.extraButtonsInJs.join(' ') || '(none)', '/', manifest.extraPanelsInJs.join(' ') || '(none)');
