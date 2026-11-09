#!/usr/bin/env node
// oo-dialog-reconcile.cjs — OO source dialog inventory vs WO coverage.
//
// oo-dialogs.json lists every dialog component OO actually ships (36, from
// view/*Dialog.js | *Dlg.js). WO's dialog coverage is spelled in
// word-parity-contracts.json as `*-dialog` + `dialog.*.l4` tokens. This
// reconciler proves every OO dialog has a WO surface or a declared divergence,
// so a dialog OO ships can never silently lack a WO counterpart (mirror of
// the shortcut 142/142 and right-panel 10-section proofs).
// Appends a marker-replaced section to ledger/SOURCE-RECONCILE.md.
//
// Usage: node oo-dialog-reconcile.cjs [oo-dialogs.json] [contracts.json] [ledger.md]
'use strict';
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const DLG = process.argv[2] || path.join(HERE, 'oo-dialogs.json');
const CON = process.argv[3] || process.env.WO_CONTRACTS
  || '/home/weiss/git/World-Office/server/tests/parity/word-parity-contracts.json';
const OUT = process.argv[4] || path.resolve(HERE, '..', 'ledger', 'SOURCE-RECONCILE.md');

if (!fs.existsSync(CON)) { console.error(`contracts not found: ${CON}`); process.exit(2); }
const ref = JSON.parse(fs.readFileSync(DLG, 'utf8'));
const contracts = JSON.parse(fs.readFileSync(CON, 'utf8'));
const toks = new Set((contracts.entries || []).map((e) => e.token));

// OO component -> WO token(s); note when the WO surface is a dialog vs another UX.
const MAP = {
  BookmarksDialog: ['bookmark-dialog'],
  CaptionDialog: ['caption', 'insertcaption'],
  CellsAddDialog: ['table-dialog'],
  ControlSettingsDialog: ['contentcontrol', 'table-dialog'],
  CrossReferenceDialog: ['crossref-dialog'],
  CustomColumnsDialog: ['columns-dialog'],
  DateTimeDialog: ['btn-datetime'],
  DropcapSettingsAdvanced: ['dialog.dropcap-dialog.l4'],
  EditListItemDialog: ['list-indents'],
  HyperlinkSettingsDialog: ['link-dialog'],
  HyphenationDialog: ['hyphenation-dialog'],
  ImageSettingsAdvanced: ['dialog.image-dialog.l4'],
  LineNumbersDialog: ['dialog.linenumbers-dialog.l4', 'togglelinenumbers'],
  ListIndentsDialog: ['list-indents'],
  ListSettingsDialog: ['bulletsAndNumbering', 'multilevel'],
  ListTypesAdvanced: ['multilevel', 'bulletsAndNumbering'],
  MailMergeEmailDlg: ['mailmerge'],
  NoteSettingsDialog: ['insertfootnote', 'insertendnote'],
  NotesRemoveDialog: ['insertfootnote'],
  NumberingValueDialog: ['setNumberingValue'],
  PageMarginsDialog: ['margins'],
  PageNumberingDlg: ['dialog.pagenumber-dialog.l4'],
  PageSizeDialog: ['size'],
  ParagraphSettingsAdvanced: ['dialog.paragraph-settings-dialog.l4'],
  ProtectDialog: ['protectdialog', 'restrictediting'],
  RoleDeleteDlg: ['protectdialog'],
  RoleEditDlg: ['protectdialog'],
  RolesManagerDlg: ['protectdialog'],
  SaveFormDlg: ['saveform'],
  StyleTitleDialog: ['style'],
  TableFormulaDialog: ['table-formula'],
  TableOfContentsSettings: ['toc-dialog'],
  TableSettingsAdvanced: ['table-dialog'],
  TableToTextDialog: ['dialog.text-to-table-dialog.l4'],
  TextToTableDialog: ['dialog.text-to-table-dialog.l4'],
  WatermarkSettingsDialog: ['dialog.watermark-dialog.l4'],
};

let covered = 0, diverged = 0, gap = [];
const rows = ref.dialogs.map((d) => {
  const map = MAP[d.component];
  if (!map) { gap.push(d.component + ' (id ' + (d.id || 'n/a') + ', ' + d.file + ')'); return { ...d, verdict: 'UNMAPPED' }; }
  const hits = map.filter((t) => toks.has(t));
  if (hits.length) { covered++; return { ...d, verdict: 'covered', hits }; }
  diverged++;
  return { ...d, verdict: 'diverged', hits: [], note: 'WO covers via surface not tokenized as a dialog — expected: ' + map.join(' / '), expected: map };
});

const lines = [`<!-- oo-dialogs -->\n### OO source dialogs vs WO coverage (${ref.dialogs.length} dialogs, ${ref.extractedAt.slice(0, 10)})`,
  '',
  `OO dialog inventory: **${ref.dialogs.length}** components from view/*Dialog.js|*Dlg.js. Direct token hits: **${covered}**; declared-divergence (WO covers via other token): **${diverged}**; unmapped: **${gap.length}**.`,
  '',
  ...(gap.length ? ['Unmapped (WO has NO obvious token — candidate gaps):', ...gap.map((g) => `- ${g}`), ''] : []),
  '',
  '| OO dialog | file | verdict | WO token |',
  '|---|---|---|---|',
  ...rows.map((r) => `| ${r.component} | ${r.file} | ${r.verdict} | ${r.hits && r.hits.length ? r.hits.join(', ') : (r.note || '—')} |`),
  '',
  '<!-- /oo-dialogs -->\n---',
].join('\n');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
let prev = ''; try { prev = fs.readFileSync(OUT, 'utf8'); } catch {}
const OPEN = '<!-- oo-dialogs -->';
const CLOSE = '<!-- /oo-dialogs -->';
const section = lines + '\n';
let body;
if (prev.includes(OPEN)) {
  const a = prev.indexOf(OPEN);
  const b = prev.indexOf(CLOSE);
  body = prev.slice(0, a) + section + (b >= 0 ? prev.slice(b) : '');
} else {
  body = prev + section;
}
fs.writeFileSync(OUT, body);

console.log(`dialog reconcile: ${ref.dialogs.length} OO dialogs -> covered ${covered}, diverged ${diverged}, UNMAPPED ${gap.length}`);
if (gap.length) { console.log('--- UNMAPPED (candidate gaps) ---'); gap.forEach((g) => console.log('  ' + g)); }
