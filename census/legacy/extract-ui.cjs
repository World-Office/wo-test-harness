#!/usr/bin/env node
// legacy/extract-ui.cjs — UI feature inventory for ONE editor web root.
// Emits a normalized JSON: controls (id/cmd/i18n/label/context), dialogs,
// i18n catalog keys. Run once against the LEGACY python web/ and once
// against the CURRENT documenteditor-wysiwyg/ — diff-legacy.py joins them.
//   node extract-ui.cjs --root DIR --out FILE [--name label]
'use strict';
const fs = require('fs');
const path = require('path');

function arg(k, d) { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; }
const root = arg('--root');
const out = arg('--out');
const name = arg('--name', path.basename(root));
if (!root || !out) { console.error('usage: extract-ui.cjs --root DIR --out FILE [--name label]'); process.exit(2); }

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// ── controls: every button/select/input with an id, in its surface context ──
function surfaceOf(before) {
  // surface = nearest data-tab/page marker or structural class BEFORE the tag
  const tabs = [...before.matchAll(/data-tab="([a-z-]+)"/g)];
  if (tabs.length) return tabs[tabs.length - 1][1];
  if (/ribbon/.test(before.slice(-800))) return 'ribbon';
  if (/file-menu/.test(before.slice(-2000))) return 'menu-file';
  if (/titlebar/.test(before.slice(-800))) return 'titlebar';
  if (/statusbar|status-bar/.test(before.slice(-800))) return 'statusbar';
  if (/<dialog|dialog-overlay/.test(before.slice(-400))) return 'dialog';
  return 'other';
}

const controls = [];
for (const m of html.matchAll(/<(button|select|input)\b[^>]*>/g)) {
  const tag = m[0];
  const id = (tag.match(/\bid="([^"]+)"/) || [])[1];
  if (!id) continue;
  const cmd = (tag.match(/data-cmd="([^"]+)"/) || [])[1] || null;
  const i18n = (tag.match(/data-i18n="([^"]+)"/) || [])[1] ||
               (tag.match(/data-i18n-aria-label="([^"]+)"/) || [])[1] || null;
  const label = (tag.match(/aria-label="([^"]+)"/) || [])[1] ||
                (tag.match(/\btitle="([^"]+)"/) || [])[1] || null;
  controls.push({ id, tag: m[1], cmd, i18n, label: label && label.replace(/\s*\(Ctrl[^)]*\)/, ''), surface: surfaceOf(html.slice(0, m.index)) });
}

// ── dialogs: .dialog-overlay roots (id + title key) ──
const dialogs = [];
for (const m of html.matchAll(/<(?:div|dialog)\b[^>]*class="dialog-overlay"[^>]*>/g)) {
  const id = (m[0].match(/\bid="([^"]+)"/) || [])[1];
  const titleKey = (html.slice(m.index, m.index + 600).match(/data-i18n="([^"]+)"/) || [])[1] || null;
  if (id) dialogs.push({ id, titleKey });
}

// ── i18n catalog keys (en block, the canonical one) ──
let i18nKeys = [];
const i18nPath = path.join(root, 'i18n.js');
if (fs.existsSync(i18nPath)) {
  const src = fs.readFileSync(i18nPath, 'utf8');
  i18nKeys = [...new Set([...src.matchAll(/"([A-Za-z0-9]+\.[A-Za-z0-9_-]+)":/g)].map(m => m[1]))];
}

const inv = { name, root, controls, dialogs, i18nKeys };
fs.writeFileSync(out, JSON.stringify(inv, null, 1));
console.log(`${name}: ${controls.length} controls, ${dialogs.length} dialogs, ${i18nKeys.length} i18n keys -> ${out}`);
