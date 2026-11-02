#!/usr/bin/env node
/**
 * ledger/linenumbers-dialog-l4.test.mjs — L4 FIDELITY probe: the Line
 * Numbers dialog's field/button contract, measured against the RUNNING
 * editor (local static serve + stubbed fetch, paragraph-dialog-l4 pattern).
 *
 * Contract (campaign comprehensive-parity, task FINAL-001): open the dialog
 * the way a user does — REAL clicks: the Layout tab, then the ribbon button
 * button[data-cmd="toggleLineNumbers"] (editor.js: openLineNumbersDialog)
 * — then assert
 *   - title "Line Numbers"
 *   - fields: Apply to (select none / continuous / restart-each-page
 *     (default) / restart-each-section)
 *   - buttons: Cancel + OK (primary)
 *   - BEHAVIOR (fidelity, not surface): Restart each page + OK plants the
 *     document-semantic section marker #editor > div.line-numbers
 *     [data-restart="newPage"], visible in the flat HTML; Continuous maps
 *     to data-restart="continuous", Restart each section to "newSection";
 *     "No line numbers" removes the marker; Cancel plants nothing.
 *
 * Declared gap (loud, never parity): the committed OO dialog census
 * captured NO field-level Line-numbers modal (OO opens Line numbering from
 * Layout->Page setup; ledger-gap classifies OO-modal vs WO-dialog as a
 * declared divergence) — the field contract is pinned from the
 * MS-Word-style Line Numbers shape (Add line numbering, Start at, From
 * text, Count by, Numbering restart). MS Word's numeric knobs (Start at /
 * Count by / From text) are deferred by WO's restart-mode carrier —
 * recorded divergence, not gated.
 *
 * Writes linenumbers-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.linenumbers-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-linenumbers-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'linenumbers-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>Linenumbers sentinel india text.</p>';
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
  window.__L4_LN__ = function () {
    const ed = document.querySelector('#editor');
    const m = ed && ed.querySelector(':scope > div.line-numbers, div.line-numbers');
    const flat = window.__WO_FLAT_HTML__();
    return {
      has: !!m,
      restart: m ? m.getAttribute('data-restart') : null,
      flatHas: /line-numbers/.test(flat),
      flatNewPage: /data-restart="newPage"/.test(flat),
      flatSentinel: flat.includes('sentinel india'),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// open the dialog the user way: Layout tab + the Line numbers ribbon button
async function openViaRibbon(page) {
  const active = await page.$('.ribbon-tab[data-tab="layout"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="layout"]');
  await sleep(150);
  await page.click('button[data-cmd="toggleLineNumbers"]');
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

    // --- 1. opens the user way: Layout tab + ribbon button ---
    await openViaRibbon(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('linenumbers-dialog');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    check('open via real clicks (Layout tab + toggleLineNumbers)', openRes);

    // --- 2..4 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('linenumbers-dialog');
      const q = (s) => dlg.querySelector(s);
      const opts = (sel) => [...sel.options].map((o) => o.value);
      const title = (q('#linenumbers-dialog-title') || {}).textContent || '';
      const mode = q('#ln-mode');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const cancel = q('#btn-linenumbers-close'); const ok = q('#btn-linenumbers-ok');
      return {
        title: title.trim(),
        modeLabel: lab('ln-mode'), modeOpts: mode ? opts(mode) : null,
        modeVal: mode ? mode.value : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!(ok && ok.classList.contains('primary')),
      };
    });
    check('title "Line Numbers"', c.title === 'Line Numbers', JSON.stringify(c.title));
    check('field Apply to: label + select none/continuous/restart-each-page/restart-each-section (default restart-each-page)',
      c.modeLabel === 'Apply to' && c.modeVal === 'restart-each-page'
      && JSON.stringify(c.modeOpts)
        === JSON.stringify(['none', 'continuous', 'restart-each-page', 'restart-each-section']),
      `label=${JSON.stringify(c.modeLabel)} val=${c.modeVal} opts=${JSON.stringify(c.modeOpts)}`);
    check('buttons Cancel + OK(primary)',
      /^cancel$/i.test(c.cancel || '') && /^ok$/i.test(c.ok || '') && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} ok=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 5. behavior: restart-each-page -> data-restart="newPage" ---
    await page.selectOption('#ln-mode', 'restart-each-page');
    await page.click('#btn-linenumbers-ok');
    await sleep(400);
    const l1 = await page.evaluate(() => window.__L4_LN__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('linenumbers-dialog').classList.contains('open'));
    check('Restart each page + OK -> div.line-numbers[data-restart="newPage"] (flat HTML)',
      closed1 && l1.has && l1.restart === 'newPage' && l1.flatHas && l1.flatNewPage
      && l1.flatSentinel,
      `has=${l1.has} restart=${JSON.stringify(l1.restart)} `
      + `flat=${l1.flatHas}/${l1.flatNewPage}/${l1.flatSentinel} closed=${closed1}`);

    // --- 6. continuous -> data-restart="continuous" ---
    await openViaRibbon(page);
    await page.selectOption('#ln-mode', 'continuous');
    await page.click('#btn-linenumbers-ok');
    await sleep(300);
    const l2 = await page.evaluate(() => window.__L4_LN__());
    check('Continuous maps to data-restart="continuous"',
      l2.has && l2.restart === 'continuous', `restart=${JSON.stringify(l2.restart)}`);

    // --- 7. restart-each-section -> data-restart="newSection" ---
    await openViaRibbon(page);
    await page.selectOption('#ln-mode', 'restart-each-section');
    await page.click('#btn-linenumbers-ok');
    await sleep(300);
    const l3 = await page.evaluate(() => window.__L4_LN__());
    check('Restart each section maps to data-restart="newSection"',
      l3.has && l3.restart === 'newSection', `restart=${JSON.stringify(l3.restart)}`);

    // --- 8. negative path: "No line numbers" removes the marker ---
    await openViaRibbon(page);
    await page.selectOption('#ln-mode', 'none');
    await page.click('#btn-linenumbers-ok');
    await sleep(300);
    const l4 = await page.evaluate(() => window.__L4_LN__());
    check('"No line numbers" removes the marker', !l4.has && l4.flatSentinel,
      `has=${l4.has}`);

    // --- 9. cancel plants nothing ---
    await openViaRibbon(page);
    await page.selectOption('#ln-mode', 'continuous');
    await page.click('#btn-linenumbers-close');
    await sleep(300);
    const l5 = await page.evaluate(() => window.__L4_LN__());
    const closed5 = await page.evaluate(() =>
      !document.getElementById('linenumbers-dialog').classList.contains('open'));
    check('cancel plants nothing', closed5 && !l5.has, `has=${l5.has} closed=${closed5}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'linenumbers-dialog-l4',
    feature: 'dialog.linenumbers-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO dialog census captured NO field-level Line-numbers modal (OO opens '
      + 'Line numbering from Layout->Page setup) — the field contract is pinned from the '
      + 'MS-Word-style Line Numbers shape (Apply-to/restart mode, OK/Cancel)',
      'MS Word\'s numeric knobs (Start at, Count by, From text) are deferred by WO\'s '
      + 'restart-mode carrier — recorded divergence, not gated',
    ],
    contract: {
      open: 'real clicks: Layout tab + ribbon button[data-cmd="toggleLineNumbers"]',
      title: 'Line Numbers',
      fields: [
        { label: 'Apply to', tag: 'select',
          options: ['none', 'continuous', 'restart-each-page', 'restart-each-section'] },
      ],
      buttons: ['Cancel', 'OK'],
      behavior: 'OK plants the document-semantic section marker div.line-numbers[data-restart] '
        + '(restart-each-page -> newPage, continuous -> continuous, restart-each-section -> '
        + 'newSection); "No line numbers" removes the marker; Cancel plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-linenumbers-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-linenumbers-dialog: ERROR', e);
  process.exit(1);
});
