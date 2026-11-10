#!/usr/bin/env node
/**
 * ledger/watermark-dialog-l4.test.mjs — L4 FIDELITY probe: the Watermark
 * dialog's field/button contract, measured against the RUNNING editor
 * (local static serve + stubbed fetch, paragraph-dialog-l4 pattern).
 *
 * Contract (campaign comprehensive-parity, task FINAL-001): open the dialog
 * the way a user does — REAL clicks: the Layout tab, then the ribbon button
 * button[data-cmd="toggleWatermark"] (editor.js: openWatermarkDialog) —
 * then assert
 *   - title "Watermark"
 *   - fields: Watermark (select none/draft/confidential/custom, default
 *     draft), Custom text (input, row hidden until "custom" is selected,
 *     default CONFIDENTIAL), Color (select Gray #C0C0C0 / Red #CC3333 /
 *     Black #000000, default Gray)
 *   - buttons: Cancel + OK (primary)
 *   - BEHAVIOR (fidelity, not surface): DRAFT + Red + OK plants the
 *     document-semantic section marker #editor > div.watermark
 *     [data-text="DRAFT"][data-color="#CC3333"], visible in the flat HTML;
 *     "custom" reveals the text row and its value (quotes stripped) rides
 *     the marker; "none" removes the marker; Cancel plants nothing.
 *
 * Declared gap (loud, never parity): the committed OO dialog census
 * captured NO field-level Watermark modal (OO opens Watermark from Layout;
 * the OO right-panel census carries the presets) — the field contract is
 * pinned from the MS-Word-style Printed Watermark shape (no watermark /
 * preset text / custom text + color). MS Word additionally offers picture
 * watermarks, font size/rotation and diagonal layout; WO defers those —
 * recorded divergence, not gated.
 *
 * Writes watermark-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.watermark-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-watermark-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'watermark-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>Watermark sentinel delta text.</p>';
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
  window.__L4_WM__ = function () {
    const ed = document.querySelector('#editor');
    const m = ed && ed.querySelector(':scope > div.watermark');
    const flat = window.__WO_FLAT_HTML__();
    return {
      has: !!m,
      text: m ? m.getAttribute('data-text') : null,
      color: m ? m.getAttribute('data-color') : null,
      flatHas: flat.includes('watermark'),
      flatText: /data-text="DRAFT"/.test(flat),
      flatSentinel: flat.includes('sentinel delta'),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// open the dialog the user way: Layout tab, then the Watermark ribbon button
async function openViaRibbon(page) {
  const active = await page.$('.ribbon-tab[data-tab="layout"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="layout"]');
  await sleep(150);
  const btn = await page.$('button[data-cmd="toggleWatermark"]');
  // evaluate-click: bypasses Playwright's viewport hit-testing, which
  // intermittently fails when the ribbon strip scrolled (overflow-hidden)
  await btn.evaluate((b) => b.click());
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
    const page = await ctx.newPage({ viewport: { width: 1680, height: 950 } });
    await page.addInitScript(stubInit, { seed: SEED_HTML });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#editor', { timeout: 20000 });
    await page.waitForTimeout(BOOT_MS);
    await page.evaluate(pageHelpers);

    // --- 1. opens the user way: Layout tab + ribbon button ---
    await openViaRibbon(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('watermark-dialog');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    check('open via real clicks (Layout tab + toggleWatermark)', openRes);

    // --- 2..6 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('watermark-dialog');
      const q = (s) => dlg.querySelector(s);
      const opts = (sel) => [...sel.options].map((o) => ({ v: o.value, t: o.textContent.trim() }));
      const title = (q('#watermark-dialog-title') || {}).textContent || '';
      const mode = q('#wm-mode'); const row = q('#wm-custom-row'); const text = q('#wm-text');
      const color = q('#wm-color');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const cancel = q('#btn-watermark-close'); const ok = q('#btn-watermark-ok');
      return {
        title: title.trim(),
        modeLabel: lab('wm-mode'), modeOpts: mode ? opts(mode) : null, modeVal: mode ? mode.value : null,
        rowHidden: row ? row.hidden : null,
        textLabel: lab('wm-text'), textType: text ? text.type : null, textVal: text ? text.value : null,
        colorLabel: lab('wm-color'), colorOpts: color ? opts(color) : null,
        colorVal: color ? color.value : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!(ok && ok.classList.contains('primary')),
      };
    });
    check('title "Watermark"', c.title === 'Watermark', JSON.stringify(c.title));
    check('field Watermark: label + select none/draft/confidential/custom (default draft), custom row hidden',
      c.modeLabel === 'Watermark' && c.modeVal === 'draft' && c.rowHidden === true
      && JSON.stringify((c.modeOpts || []).map((o) => o.v))
        === JSON.stringify(['none', 'draft', 'confidential', 'custom']),
      `label=${JSON.stringify(c.modeLabel)} val=${c.modeVal} rowHidden=${c.rowHidden} `
      + `opts=${JSON.stringify((c.modeOpts || []).map((o) => o.v))}`);
    check('field Custom text: label + text input (default CONFIDENTIAL)',
      c.textLabel === 'Custom text' && c.textType === 'text' && c.textVal === 'CONFIDENTIAL',
      `${JSON.stringify(c.textLabel)} ${c.textType} val=${JSON.stringify(c.textVal)}`);
    check('field Color: label + select Gray/Red/Black hex values (default #C0C0C0)',
      c.colorLabel === 'Color' && c.colorVal === '#C0C0C0'
      && JSON.stringify((c.colorOpts || []).map((o) => o.v))
        === JSON.stringify(['#C0C0C0', '#CC3333', '#000000']),
      `label=${JSON.stringify(c.colorLabel)} val=${c.colorVal} `
      + `opts=${JSON.stringify((c.colorOpts || []).map((o) => o.v))}`);
    check('buttons Cancel + OK(primary)',
      /^cancel$/i.test(c.cancel || '') && /^ok$/i.test(c.ok || '') && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} ok=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 7. custom selection reveals the text row ---
    await page.selectOption('#wm-mode', 'custom');
    const revealed = await page.evaluate(() =>
      !document.getElementById('wm-custom-row').hidden);
    check('selecting "custom" reveals the Custom text row', revealed);

    // --- 8. behavior: DRAFT + Red + OK -> semantic watermark marker ---
    await page.selectOption('#wm-mode', 'draft');
    await page.selectOption('#wm-color', '#CC3333');
    await page.click('#btn-watermark-ok');
    await sleep(400);
    const w1 = await page.evaluate(() => window.__L4_WM__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('watermark-dialog').classList.contains('open'));
    check('DRAFT + Red + OK -> div.watermark data-text="DRAFT" data-color="#CC3333" (flat HTML)',
      closed1 && w1.has && w1.text === 'DRAFT' && w1.color === '#CC3333'
      && w1.flatHas && w1.flatText && w1.flatSentinel,
      `has=${w1.has} text=${JSON.stringify(w1.text)} color=${JSON.stringify(w1.color)} `
      + `flat=${w1.flatHas}/${w1.flatText}/${w1.flatSentinel} closed=${closed1}`);

    // --- 9. behavior: custom text rides the marker, quotes stripped ---
    await openViaRibbon(page);
    await page.selectOption('#wm-mode', 'custom');
    await page.fill('#wm-text', 'Internal "eyes only"');
    await page.selectOption('#wm-color', '#000000');
    await page.click('#btn-watermark-ok');
    await sleep(300);
    const w2 = await page.evaluate(() => window.__L4_WM__());
    check('custom text rides the marker with quotes stripped',
      w2.has && w2.text === 'Internal eyes only' && w2.color === '#000000',
      `text=${JSON.stringify(w2.text)} color=${JSON.stringify(w2.color)}`);

    // --- 10. negative path: "none" removes the marker ---
    await openViaRibbon(page);
    await page.selectOption('#wm-mode', 'none');
    await page.click('#btn-watermark-ok');
    await sleep(300);
    const w3 = await page.evaluate(() => window.__L4_WM__());
    check('"No watermark" removes the marker', !w3.has && w3.flatSentinel,
      `has=${w3.has}`);

    // --- 11. cancel plants nothing ---
    await openViaRibbon(page);
    await page.selectOption('#wm-mode', 'confidential');
    await page.click('#btn-watermark-close');
    await sleep(300);
    const w4 = await page.evaluate(() => window.__L4_WM__());
    const closed4 = await page.evaluate(() =>
      !document.getElementById('watermark-dialog').classList.contains('open'));
    check('cancel plants nothing', closed4 && !w4.has,
      `has=${w4.has} closed=${closed4}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'watermark-dialog-l4',
    feature: 'dialog.watermark-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO dialog census captured NO field-level Watermark modal (OO opens Watermark '
      + 'from Layout; the OO right-panel census carries the presets) — the field contract is '
      + 'pinned from the MS-Word-style Printed Watermark shape (no watermark / preset text / '
      + 'custom text + color, OK/Cancel)',
      'MS Word additionally offers picture watermarks, font size/rotation and diagonal layout; '
      + 'WO defers those — recorded divergence, not gated',
    ],
    contract: {
      open: 'real clicks: Layout tab + ribbon button[data-cmd="toggleWatermark"] '
        + '(editor.js: openWatermarkDialog)',
      title: 'Watermark',
      fields: [
        { label: 'Watermark', tag: 'select', options: ['none', 'draft', 'confidential', 'custom'] },
        { label: 'Custom text', tag: 'input', type: 'text', default: 'CONFIDENTIAL' },
        { label: 'Color', tag: 'select', options: ['#C0C0C0', '#CC3333', '#000000'] },
      ],
      buttons: ['Cancel', 'OK'],
      behavior: 'OK plants the document-semantic section marker #editor > div.watermark '
        + '[data-text][data-color] (custom reveals the text row; quotes stripped from custom '
        + 'text); "none" removes the marker; Cancel plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-watermark-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-watermark-dialog: ERROR', e);
  process.exit(1);
});
