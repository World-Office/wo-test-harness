#!/usr/bin/env node
// oo-shortcut-dump.cjs — extract the authoritative OO shortcut key table from
// the live OO editor runtime (the rig). The key map lives in the minified core
// SDK (Asc.c_oAscDefaultShortcuts / Asc.c_oAscDocumentShortcutType), not as
// plaintext in the shipped source — the runtime is the clean way to get ground
// truth. Output: oo-shortcuts.json alongside oo-reference.json.
//
// Env: OO_URL (default http://127.0.0.1:8735/rig-editor.html), OO_RIG_PORT.
// Requires: oo-rig container (documentserver on :8099), rig-server.py on :8735.
'use strict';
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/home/weiss/.npm-global/lib/node_modules/playwright')); }

const URL = process.env.OO_URL || 'http://127.0.0.1:8735/rig-editor.html';
const OUT = process.argv[2] || path.join(__dirname, 'oo-shortcuts.json');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.text().includes('RIG_APP_READY')) console.log('rig app ready'); });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => { console.error('goto:', e.message); });
  // the editor loads in a cross-origin frame; find the frame carrying Asc
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await page.waitForTimeout(500);
    for (const f of page.frames()) {
      const has = await f.evaluate(() => !!(window.Asc && window.Asc.c_oAscDefaultShortcuts)).catch(() => false);
      if (has) { target = f; break; }
    }
  }
  if (!target) { console.error('Asc.c_oAscDefaultShortcuts not reachable after 20s — is rig + DS up?'); await browser.close(); process.exit(1); }

  const data = await target.evaluate(() => {
    const Asc = window.Asc;
    const types = Asc.c_oAscDocumentShortcutType || {};           // name -> type
    const map = Asc.c_oAscDefaultShortcuts || {};                 // type -> [CAscShortcut]
    const typeToName = {};
    for (const [n, t] of Object.entries(types)) typeToName[t] = n;
    const out = [];
    for (const [t, arr] of Object.entries(map)) {
      const name = typeToName[t] || ('type:' + t);
      const keys = (arr || []).map((s) => {
        let parts = [];
        const ctrl = s.asc_IsCtrl ? s.asc_IsCtrl() : !!s.ctrlKey;
        const alt = s.asc_IsAlt ? s.asc_IsAlt() : !!s.altKey;
        const shift = s.asc_IsShift ? s.asc_IsShift() : !!s.shiftKey;
        const cmd = s.asc_IsCommand ? s.asc_IsCommand() : !!s.commandKey;
        if (cmd) parts.push('Cmd');
        if (ctrl) parts.push('Ctrl');
        if (alt) parts.push('Alt');
        if (shift) parts.push('Shift');
        const getCode = s.asc_GetKeyCode ? s.asc_GetKeyCode() : s.keyCode;
        const VK = {
          8: 'Backspace', 9: 'Tab', 13: 'Enter', 27: 'Esc', 32: 'Space',
          33: 'PgUp', 34: 'PgDn', 35: 'End', 36: 'Home', 37: 'Left', 38: 'Up',
          39: 'Right', 40: 'Down', 45: 'Insert', 46: 'Delete', 96: 'Np0',
          97: 'Np1', 98: 'Np2', 99: 'Np3', 100: 'Np4', 101: 'Np5', 102: 'Np6',
          103: 'Np7', 104: 'Np8', 105: 'Np9', 106: 'Np*', 107: 'Np+', 109: 'Np-',
          110: 'Np.', 111: 'Np/', 186: ';', 187: '=', 188: ',', 189: '-',
          190: '.', 191: '/', 192: '`', 219: '[', 220: '\\', 221: ']', 222: "'",
        };
        for (let i = 0; i <= 12; i++) VK[111 + i] = 'F' + i;
        if (typeof getCode === 'number' && getCode > 0) {
          const rendered = VK[getCode]
            || ((getCode >= 65 && getCode <= 90) ? String.fromCharCode(getCode)
              : (getCode >= 32 && getCode < 127) ? String.fromCharCode(getCode)
              : 'K' + getCode);
          parts.push(rendered);
        } else if (getCode && String(getCode)) parts.push(String(getCode));
        if (!parts.length) parts.push('(none)');
        return { key: parts.join('+'), raw: { keyCode: getCode, isLocked: !!(s.asc_IsLocked ? s.asc_IsLocked() : s.isLocked), isHidden: !!(s.asc_IsHidden ? s.asc_IsHidden() : s.isHidden) } };
      });
      out.push({ name, type: Number(t), keys });
    }
    // label lookups: txtLabel<ActionName> on the controller are runtime strings;
    // grab the raw action list too so names are complete even without labels.
    return { shortcuts: out, types };
  });

  const ref = {
    source: 'OO editor runtime (Asc.c_oAscDefaultShortcuts via rig iframe)',
    capturedAt: new Date().toISOString(),
    url: URL,
    actions: data.shortcuts.length,
    shortcuts: data.shortcuts,
  };
  fs.writeFileSync(OUT, JSON.stringify(ref, null, 1));
  console.log(`oo-shortcuts: ${data.shortcuts.length} actions dumped -> ${OUT}`);
  for (const s of data.shortcuts.slice(0, 12)) console.log(`  ${s.name.padEnd(38)} ${s.keys.join(' | ')}`);
  await browser.close();
})();
