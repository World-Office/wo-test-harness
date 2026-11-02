#!/usr/bin/env node
/**
 * ledger/hr-settings-dialog-l4.test.mjs — L4 FIDELITY probe: the Horizontal
 * line settings dialog's field/button contract, measured against the
 * RUNNING editor (local static serve + stubbed fetch, paragraph-dialog-l4
 * pattern).
 *
 * Contract (campaign comprehensive-parity, task FINAL-001): open the dialog
 * the way a user does — REAL clicks: the Insert tab, then #btn-hr to insert
 * a default <hr>; a real right-click on that <hr> (editor contextmenu) then
 * the ctx-menu row button[data-ctx="HorizontalLineSettings"] (editor.js:
 * openHrSettings, prefilled from the clicked hr) — then assert
 *   - title "Horizontal line settings…" (i18n Ctx.HorizontalLineSettings)
 *   - fields: Width (% of page) (number 1..100, default 100), Height (px)
 *     (number 1..50, default 2), Color (input[type=color], default
 *     #000000; label renders as "Line color" via i18n RightPanel.LineColor),
 *     Alignment (select center/left/right, default center)
 *   - buttons: Insert (primary) + Close
 *   - BEHAVIOR (fidelity, not surface): the dialog opens prefilled with the
 *     clicked hr's live style; 60 / 4 / #ff0000 / left + Insert puts a REAL
 *     <hr> with style "width:60%;height:4px;background-color:#ff0000;
 *     margin-left:0;margin-right:auto" into the doc (flat HTML); out-of-
 *     range values clamp (width 200 -> 100, height 99 -> 50); Close
 *     mutates nothing.
 *
 * Declared gap (loud, never parity): OO inserts a horizontal rule directly
 * from the ctx row (HorizontalRule) with NO settings modal — the committed
 * OO dialog census captured no hr-settings dialog. The width/height/color/
 * align + Insert/Close contract is pinned from the MS-Word-style
 * horizontal-line shape (Format-shape controls; table-dialog precedent for
 * pinning from the MS shape when the OO census captured no dialog).
 *
 * Writes hr-settings-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.hr-settings-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-hr-settings-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'hr-settings-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>HR sentinel foxtrot text.</p>';
const BOOT_MS = 2200;

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  return !!ok;
};

async function loadPlaywright() {
  const candidates = [path.join(LEDGER_DIR, '..', 'node_modules', 'playwright')];
  try {
    const { execSync } = await import('node:child_process');
    candidates.push(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
  } catch (_) { /* global npm optional */ }
  for (const c of candidates) {
    try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch (_) { /* next */ }
  }
  throw new Error('playwright not found (census/node_modules nor global)');
}

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
  srv.on('error', reject);
});

function startStaticServer(port, dir) {
  return spawn('/usr/bin/python3', ['-m', 'http.server', String(port),
    '--bind', '127.0.0.1', '--directory', dir], { stdio: ['ignore', 'ignore', 'pipe'] });
}

// same fetch stub roundtrip.cjs uses: seed document via the load endpoint,
// ACK every write, collab off.
function stubInit(ctx) {
  localStorage.clear();
  window.__COLLAB__ = false;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init && init.method) || 'GET';
    if (method === 'GET' && url.includes('/api/documents/') && url.includes('/html')) {
      return Promise.resolve(new Response(JSON.stringify({ html: ctx.seed, name: 'demo.docx' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
  };
  navigator.sendBeacon = () => true;
}

// page helpers (real functions, never strings — evaluate pitfall)
function pageHelpers() {
  // all hrs in the editor (live styles) + flat-HTML reflection
  window.__L4_HRS__ = function () {
    const ed = document.querySelector('#editor');
    const hrs = ed ? [...ed.querySelectorAll('hr')].map((h) => h.getAttribute('style') || '') : [];
    const flat = window.__WO_FLAT_HTML__();
    return {
      n: hrs.length,
      hrs,
      flatN: (flat.match(/<hr/g) || []).length,
      flatStyled: /width:60%/.test(flat) && /height:4px/.test(flat)
        && /background-color:\s*#?ff0000/i.test(flat),
      flatSentinel: flat.includes('sentinel foxtrot'),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// open the settings dialog the user way: real clicks — Insert tab + #btn-hr
// (plants a default <hr>), then right-click that <hr> + the ctx row
async function openOnExistingHr(page) {
  const active = await page.$('.ribbon-tab[data-tab="insert"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="insert"]');
  await sleep(150);
  const hrCount = await page.evaluate(() => document.querySelectorAll('#editor hr').length);
  if (hrCount === 0) {
    await page.click('#btn-hr');
    await sleep(250);
  }
  await page.click('#editor hr', { button: 'right' });
  await sleep(150);
  await page.click('#ctx-menu button[data-ctx="HorizontalLineSettings"]');
  await sleep(250);
}

async function main() {
  if (!fs.existsSync(path.join(EDITOR_DIR, 'index.html'))) {
    throw new Error(`editor dir missing index.html: ${EDITOR_DIR} (set WO_EDITOR_DIR)`);
  }
  const port = await freePort();
  const srv = startStaticServer(port, EDITOR_DIR);
  await sleep(500);
  const base = `http://127.0.0.1:${port}`;
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(stubInit, { seed: SEED_HTML });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#editor', { timeout: 20000 });
    await page.waitForTimeout(BOOT_MS);
    await page.evaluate(pageHelpers);

    // --- 1. opens the user way: insert default hr, right-click it, ctx row ---
    await openOnExistingHr(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('hr-settings-dialog');
      const menu = document.getElementById('ctx-menu');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && menu.hidden;
    });
    check('open via real clicks (Insert #btn-hr + right-click hr + ctx row HorizontalLineSettings)',
      openRes);

    // --- 2..6 static contract while open (prefilled from the default hr) ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('hr-settings-dialog');
      const q = (s) => dlg.querySelector(s);
      const opts = (sel) => [...sel.options].map((o) => o.value);
      const title = (q('#hr-settings-title') || {}).textContent || '';
      const w = q('#hr-width'); const h = q('#hr-height');
      const col = q('#hr-color'); const a = q('#hr-align');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const insert = q('#btn-hr-insert'); const close = q('#btn-hr-close');
      return {
        title: title.trim(),
        wLabel: lab('hr-width'), wType: w ? w.type : null, wMin: w ? w.min : null,
        wMax: w ? w.max : null, wVal: w ? w.value : null,
        hLabel: lab('hr-height'), hType: h ? h.type : null, hMin: h ? h.min : null,
        hMax: h ? h.max : null, hVal: h ? h.value : null,
        colLabel: lab('hr-color'), colType: col ? col.type : null, colVal: col ? col.value : null,
        aLabel: lab('hr-align'), aOpts: a ? opts(a) : null, aVal: a ? a.value : null,
        insert: insert ? insert.textContent.trim() : null,
        insertPrimary: !!(insert && insert.classList.contains('primary')),
        close: close ? close.textContent.trim() : null,
      };
    });
    check('title "Horizontal line settings…" (i18n Ctx.HorizontalLineSettings)',
      /^horizontal line settings…$/i.test(c.title || ''), JSON.stringify(c.title));
    check('field Width (% of page): label + number 1..100 prefilled 100 from the clicked hr',
      c.wLabel === 'Width (% of page)' && c.wType === 'number'
      && c.wMin === '1' && c.wMax === '100' && c.wVal === '100',
      `${JSON.stringify(c.wLabel)} ${c.wType} ${c.wMin}..${c.wMax} val=${c.wVal}`);
    check('field Height (px): label + number 1..50 prefilled 2',
      c.hLabel === 'Height (px)' && c.hType === 'number'
      && c.hMin === '1' && c.hMax === '50' && c.hVal === '2',
      `${JSON.stringify(c.hLabel)} ${c.hType} ${c.hMin}..${c.hMax} val=${c.hVal}`);
    check('field Color: label + color input prefilled #000000 (i18n RightPanel.LineColor)',
      (c.colLabel === 'Line color' || c.colLabel === 'Color') && c.colType === 'color'
      && c.colVal === '#000000',
      `${JSON.stringify(c.colLabel)} ${c.colType} val=${c.colVal}`);
    check('field Alignment: label + select center/left/right (default center)',
      c.aLabel === 'Alignment' && c.aVal === 'center'
      && JSON.stringify(c.aOpts) === JSON.stringify(['center', 'left', 'right']),
      `label=${JSON.stringify(c.aLabel)} val=${c.aVal} opts=${JSON.stringify(c.aOpts)}`);
    check('buttons Insert(primary) + Close',
      /^insert$/i.test(c.insert || '') && c.insertPrimary && /^close$/i.test(c.close || ''),
      `insert=${JSON.stringify(c.insert)} primary=${c.insertPrimary} close=${JSON.stringify(c.close)}`);

    // --- 7. behavior: 60/4/#ff0000/left + Insert -> real styled <hr> ---
    await page.fill('#hr-width', '60');
    await page.fill('#hr-height', '4');
    await page.evaluate(() => {
      document.getElementById('hr-color').value = '#ff0000';
      document.getElementById('hr-color').dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.selectOption('#hr-align', 'left');
    await page.click('#btn-hr-insert');
    await sleep(400);
    const r1 = await page.evaluate(() => window.__L4_HRS__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('hr-settings-dialog').classList.contains('open'));
    const styled = r1.hrs.some((s) => s.includes('width:60%') && s.includes('height:4px')
      && /background-color:#ff0000/i.test(s) && s.includes('margin-left:0'));
    check('60/4/#ff0000/left + Insert -> <hr style="width:60%;height:4px;background-color:#ff0000;margin-left:0..."> (flat HTML)',
      closed1 && r1.n === 2 && styled && r1.flatStyled && r1.flatSentinel,
      `n=${r1.n} styled=${styled} flat=${r1.flatStyled}/${r1.flatSentinel} closed=${closed1}`);

    // --- 8. clamp: width 200 -> 100, height 99 -> 50 ---
    await openOnExistingHr(page);
    await page.fill('#hr-width', '200');
    await page.fill('#hr-height', '99');
    await page.selectOption('#hr-align', 'right');
    await page.click('#btn-hr-insert');
    await sleep(400);
    const r2 = await page.evaluate(() => window.__L4_HRS__());
    const clamped = r2.hrs.some((s) => s.includes('width:100%') && s.includes('height:50px')
      && s.includes('margin-left:auto') && s.includes('margin-right:0'));
    check('out-of-range clamps: width 200 -> 100%, height 99 -> 50px (right-aligned)',
      r2.n === 3 && clamped,
      `n=${r2.n} clamped=${clamped} hrs=${JSON.stringify(r2.hrs).slice(0, 120)}`);

    // --- 9. Close mutates nothing ---
    await openOnExistingHr(page);
    await page.fill('#hr-width', '33');
    await page.fill('#hr-height', '7');
    await page.click('#btn-hr-close');
    await sleep(300);
    const r3 = await page.evaluate(() => window.__L4_HRS__());
    const closed3 = await page.evaluate(() =>
      !document.getElementById('hr-settings-dialog').classList.contains('open'));
    check('Close mutates nothing (no new hr, existing styles intact)',
      closed3 && r3.n === 3 && !r3.hrs.some((s) => s.includes('width:33%')),
      `n=${r3.n} closed=${closed3}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'hr-settings-dialog-l4',
    feature: 'dialog.hr-settings-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'OO inserts a horizontal rule directly from the ctx row (HorizontalRule) with NO settings '
      + 'modal — the committed OO dialog census captured no hr-settings dialog; the '
      + 'width/height/color/align + Insert/Close contract is pinned from the MS-Word-style '
      + 'horizontal-line shape (table-dialog precedent)',
    ],
    contract: {
      open: 'real clicks: Insert #btn-hr (plants a default <hr>), right-click the <hr>, ctx-menu '
        + 'row button[data-ctx="HorizontalLineSettings"] (editor.js: openHrSettings)',
      title: 'Horizontal line settings…',
      fields: [
        { label: 'Width (% of page)', tag: 'input', type: 'number', min: 1, max: 100, default: 100 },
        { label: 'Height (px)', tag: 'input', type: 'number', min: 1, max: 50, default: 2 },
        { label: 'Line color', tag: 'input', type: 'color', default: '#000000' },
        { label: 'Alignment', tag: 'select', options: ['center', 'left', 'right'] },
      ],
      buttons: ['Insert', 'Close'],
      behavior: 'dialog opens prefilled from the clicked hr; Insert puts a real <hr> with '
        + 'width%/height px/background-color/margin alignment into the doc (flat HTML); values '
        + 'clamp to 1..100 / 1..50; Close mutates nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-hr-settings-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-hr-settings-dialog: ERROR', e);
  process.exit(1);
});
