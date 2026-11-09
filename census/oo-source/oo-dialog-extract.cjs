#!/usr/bin/env node
// oo-dialog-extract.cjs — OO dialog SOURCE inventory.
//
// OO's modal dialogs are Common.Views.AdvancedSettingsWindow subclass
// components in documenteditor/main/app/view/*Dialog.js (or *Dlg.js), each
// with an `id: 'window-*'` and a `title: this.text*` reference. The docked
// right/left settings panels show up as RightMenu/LeftMenu templates (covered
// by oo-reference.json). This manifest is the authoritative OO dialog id
// list, so WO's dialog coverage (contract tokens `*-dialog`, `dialog.*`) can
// be verified against what OO actually ships instead of a hand-written list.
//
// Output: oo-dialogs.json
// Usage: node oo-dialog-extract.cjs [view dir] [out.json]
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = process.argv[2] || '/tmp/oo-src/documenteditor/main/app/view';
const OUT = process.argv[3] || path.join(__dirname, 'oo-dialogs.json');

const dialogs = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const id = (src.match(/\bid\s*:\s*'window-[a-z0-9-]+'/) || [])[0]?.split("'")[1] || null;
  const comp = (src.match(/DE\.Views\.(\w+)\s*=\s*(?:Common\.Views\.AdvancedSettingsWindow|(?:new )?Common\.UI\.Window)\.extend/) || [])[1] || null;
  if (!id && !comp) continue;
  const titleVar = (src.match(/title\s*:\s*(this\.\w+|text\w+)/) || [])[1] || null;
  const textVars = [...new Set([...src.matchAll(/me\.(text\w+|txt\w+|text[A-Z]\w*)/g)].map((m) => 'text' + m[1].replace(/^(text|txt|text)/, '')))];
  const modal = /new Common\.UI\.ModalBox|Common\.UI\.ModalBox\.show|\.show\s*\(\s*true/.test(src);
  dialogs.push({
    file: f,
    component: comp,
    id,
    modal: modal || /this\.show/.test(src),
    title: (src.match(/textTitle\s*[:=]/) || src.match(/this\.textTitle/) ? 'textTitle' : (src.match(/\b(textTitle|textCaption|txtTitle)\b/) || [])[1]) || null,
    chars: src.length,
  });
}

const ref = {
  source: 'documenteditor/main/app/view/*Dialog.js|*Dlg.js (AdvancedSettingsWindow / Window components)',
  extractedAt: new Date().toISOString(),
  dialogs,
};
fs.writeFileSync(OUT, JSON.stringify(ref, null, 1));
console.log(`oo-dialogs: ${dialogs.length} dialog components`);
for (const d of dialogs) console.log(`  ${(d.id || '?').padEnd(34)} ${d.file.padEnd(30)}${d.component ? '[' + d.component + ']' : ''}`);
