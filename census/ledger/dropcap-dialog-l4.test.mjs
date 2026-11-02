#!/usr/bin/env node
/**
 * ledger/dropcap-dialog-l4.test.mjs — L4 FIDELITY probe: the Drop Cap
 * dialog's field/button contract, measured against the RUNNING editor
 * (local static serve + stubbed fetch, paragraph-dialog-l4 pattern).
 *
 * Contract (campaign comprehensive-parity, task FINAL-001): open the dialog
 * the way a user does — a REAL right-click on the caret paragraph (editor
 * #editor contextmenu handler) then a real click on the ctx-menu row
 * button[data-ctx="DropcapSettings"] (editor.js: openDropcapDialog) — then
 * assert
 *   - title "Drop Cap"
 *   - fields: Position (select none/dropped/in-margin, default dropped),
 *     Lines to drop (number 2..5, default 3), Distance from text (pt)
 *     (number 0..50, default 0)
 *   - buttons: Cancel + OK (primary)
 *   - BEHAVIOR (fidelity, not surface): dropped + lines 3 + distance 5 +
 *     OK wraps the caret paragraph's first character in a real
 *     span.dropcap carrying the parameterized CSS vars
 *     (--drop-lines: 3, --drop-distance: 5pt), visible in the flat HTML;
 *     in-margin adds the .in-margin variant; out-of-range values clamp
 *     (lines 99 -> 5, distance 99 -> 50); Position "none" removes the
 *     wrap and restores the text; Cancel mutates nothing.
 *
 * MEASURED DEFECT (2026-11, first capture): re-apply and Position-none
 * EAT the wrapped character — editor.js applyDropcap/removeDropcapOnly do
 * existing.remove() on the span WITHOUT restoring its text node, so each
 * toggle deletes one char from the document (MS Word restores the char).
 * The probe records the defect checks as FAIL; build.py pins the row
 * below L4 with this artifact as loud evidence until the editor is fixed.
 *
 * Declared gap (loud, never parity): the committed OO dialog census
 * captured NO field-level Drop cap modal (OO opens Drop cap from Insert /
 * the right panel; ledger-gap classifies the OO modal vs WO dialog shape as
 * a divergence, not a field join) — the field contract is pinned from the
 * MS-Word-style Drop Cap shape (Position None/Dropped/In margin, Lines to
 * drop, Distance from text). MS Word additionally offers a drop-cap Font
 * selector; WO defers that to the caret font — recorded divergence, not
 * gated.
 *
 * Writes dropcap-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.dropcap-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-dropcap-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'dropcap-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>Dropcap sentinel charlie text.</p><p>Second plain line.</p>';
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
  // collapsed caret at the FIRST paragraph start — the block dropcap wraps
  window.__L4_CARET__ = function () {
    const ed = document.querySelector('#editor');
    const p = ed && ed.querySelector('p');
    if (!p || !p.firstChild) return 'no-p';
    const r = document.createRange();
    r.setStart(p.firstChild, 0);
    r.setEnd(p.firstChild, 0);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    ed.focus();
    return 'ok';
  };
  // live dropcap state of the first paragraph + flat-HTML reflection
  window.__L4_DROPCAP__ = function () {
    const ed = document.querySelector('#editor');
    const p = ed && ed.querySelector('p');
    const span = p && p.querySelector(':scope > span.dropcap');
    const flat = window.__WO_FLAT_HTML__();
    return {
      has: !!span,
      text: span ? span.textContent : null,
      inMargin: !!(span && span.classList.contains('in-margin')),
      lines: span ? span.style.getPropertyValue('--drop-lines').trim() : null,
      distance: span ? span.style.getPropertyValue('--drop-distance').trim() : null,
      rest: p ? (p.textContent || '').slice(span ? span.textContent.length : 0, 60) : null,
      flatHas: flat.includes('dropcap'),
      flatLines: /--drop-lines:\s*3/.test(flat),
      flatSentinel: flat.includes('sentinel charlie'),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// open the dialog the user way: right-click the caret paragraph, click the
// ctx-menu DropcapSettings row
async function openViaCtx(page) {
  await page.evaluate(() => window.__L4_CARET__());
  await page.click('#editor p', { button: 'right' });
  await sleep(150);
  await page.click('#ctx-menu button[data-ctx="DropcapSettings"]');
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

    // --- 1. opens the user way: real right-click + ctx-menu row click ---
    await openViaCtx(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('dropcap-dialog');
      const menu = document.getElementById('ctx-menu');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && menu.hidden;
    });
    check('open via real right-click + ctx row DropcapSettings', openRes);

    // --- 2..5 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('dropcap-dialog');
      const q = (s) => dlg.querySelector(s);
      const opts = (sel) => [...sel.options].map((o) => o.value);
      const title = (q('#dropcap-dialog-title') || {}).textContent || '';
      const pos = q('#dropcap-position'); const lines = q('#dropcap-lines'); const dist = q('#dropcap-distance');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const cancel = q('#btn-dropcap-close'); const ok = q('#btn-dropcap-ok');
      return {
        title: title.trim(),
        posLabel: lab('dropcap-position'), posOpts: pos ? opts(pos) : null, posVal: pos ? pos.value : null,
        linesLabel: lab('dropcap-lines'), linesType: lines ? lines.type : null,
        linesMin: lines ? lines.min : null, linesMax: lines ? lines.max : null,
        linesVal: lines ? lines.value : null,
        distLabel: lab('dropcap-distance'), distType: dist ? dist.type : null,
        distMin: dist ? dist.min : null, distMax: dist ? dist.max : null,
        distVal: dist ? dist.value : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!(ok && ok.classList.contains('primary')),
      };
    });
    check('title "Drop Cap"', c.title === 'Drop Cap', JSON.stringify(c.title));
    check('field Position: label + select none/dropped/in-margin (default dropped)',
      c.posLabel === 'Position'
      && JSON.stringify(c.posOpts) === JSON.stringify(['none', 'dropped', 'in-margin'])
      && c.posVal === 'dropped',
      `label=${JSON.stringify(c.posLabel)} opts=${JSON.stringify(c.posOpts)} val=${c.posVal}`);
    check('field Lines to drop: label + number 2..5 (default 3)',
      c.linesLabel === 'Lines to drop' && c.linesType === 'number'
      && c.linesMin === '2' && c.linesMax === '5' && c.linesVal === '3',
      `${JSON.stringify(c.linesLabel)} ${c.linesType} ${c.linesMin}..${c.linesMax} val=${c.linesVal}`);
    check('field Distance from text (pt): label + number 0..50 (default 0)',
      c.distLabel === 'Distance from text (pt)' && c.distType === 'number'
      && c.distMin === '0' && c.distMax === '50' && c.distVal === '0',
      `${JSON.stringify(c.distLabel)} ${c.distType} ${c.distMin}..${c.distMax} val=${c.distVal}`);
    check('buttons Cancel + OK(primary)',
      /^cancel$/i.test(c.cancel || '') && /^ok$/i.test(c.ok || '') && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} ok=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 6. behavior: dropped + 3 + 5pt -> real span.dropcap + CSS vars ---
    await page.selectOption('#dropcap-position', 'dropped');
    await page.fill('#dropcap-lines', '3');
    await page.fill('#dropcap-distance', '5');
    await page.click('#btn-dropcap-ok');
    await sleep(400);
    const d1 = await page.evaluate(() => window.__L4_DROPCAP__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('dropcap-dialog').classList.contains('open'));
    check('apply dropped/3/5pt -> span.dropcap wraps first char with --drop-lines:3 --drop-distance:5pt (flat HTML)',
      closed1 && d1.has && d1.text === 'D' && !d1.inMargin && d1.lines === '3'
      && d1.distance === '5pt' && d1.rest.startsWith('ropcap')
      && d1.flatHas && d1.flatLines && d1.flatSentinel,
      `has=${d1.has} text=${JSON.stringify(d1.text)} lines=${d1.lines} dist=${d1.distance} `
      + `rest=${JSON.stringify(d1.rest)} flat=${d1.flatHas}/${d1.flatLines}/${d1.flatSentinel} closed=${closed1}`);

    // --- 7. clamp: lines 99 -> 5, distance 99 -> 50 ---
    await openViaCtx(page);
    await page.selectOption('#dropcap-position', 'dropped');
    await page.fill('#dropcap-lines', '99');
    await page.fill('#dropcap-distance', '99');
    await page.click('#btn-dropcap-ok');
    await sleep(300);
    const d2 = await page.evaluate(() => window.__L4_DROPCAP__());
    check('out-of-range clamps: lines 99 -> 5, distance 99 -> 50pt',
      d2.has && d2.lines === '5' && d2.distance === '50pt',
      `lines=${d2.lines} dist=${d2.distance}`);

    // --- 8. in-margin variant ---
    await openViaCtx(page);
    await page.selectOption('#dropcap-position', 'in-margin');
    await page.fill('#dropcap-lines', '4');
    await page.fill('#dropcap-distance', '0');
    await page.click('#btn-dropcap-ok');
    await sleep(300);
    const d3 = await page.evaluate(() => window.__L4_DROPCAP__());
    check('in-margin adds the .in-margin variant (--drop-lines:4)',
      d3.has && d3.inMargin && d3.lines === '4' && (d3.distance === '' || d3.distance === '0pt'),
      `inMargin=${d3.inMargin} lines=${d3.lines} dist=${JSON.stringify(d3.distance)}`);

    // --- 9. negative path: Position none removes the wrap ---
    await openViaCtx(page);
    await page.selectOption('#dropcap-position', 'none');
    await page.click('#btn-dropcap-ok');
    await sleep(300);
    const d4 = await page.evaluate(() => window.__L4_DROPCAP__());
    check('Position none removes the dropcap wrap (text restored)',
      !d4.has && d4.flatSentinel && (d4.rest || '').startsWith('Dropcap'),
      `has=${d4.has} rest=${JSON.stringify((d4.rest || '').slice(0, 10))}`);

    // --- 10. cancel mutates nothing ---
    await openViaCtx(page);
    await page.selectOption('#dropcap-position', 'dropped');
    await page.fill('#dropcap-lines', '2');
    await page.fill('#dropcap-distance', '10');
    await page.click('#btn-dropcap-close');
    await sleep(300);
    const d5 = await page.evaluate(() => window.__L4_DROPCAP__());
    const closed5 = await page.evaluate(() =>
      !document.getElementById('dropcap-dialog').classList.contains('open'));
    check('cancel mutates nothing', closed5 && !d5.has && (d5.rest || '').startsWith('Dropcap'),
      `has=${d5.has} closed=${closed5}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'dropcap-dialog-l4',
    feature: 'dialog.dropcap-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO dialog census captured NO field-level Drop cap modal (OO opens Drop cap '
      + 'from Insert / the right panel) — the field contract is pinned from the MS-Word-style '
      + 'Drop Cap shape (Position none/dropped/in-margin, Lines to drop, Distance from text, '
      + 'OK/Cancel)',
      'MS Word additionally offers a drop-cap Font selector; WO defers that to the caret font — '
      + 'recorded divergence, not gated',
    ],
    contract: {
      open: 'real right-click on the caret paragraph + ctx-menu row button[data-ctx="DropcapSettings"] '
        + '(editor.js: openDropcapDialog)',
      title: 'Drop Cap',
      fields: [
        { label: 'Position', tag: 'select', options: ['none', 'dropped', 'in-margin'] },
        { label: 'Lines to drop', tag: 'input', type: 'number', min: 2, max: 5, default: 3 },
        { label: 'Distance from text (pt)', tag: 'input', type: 'number', min: 0, max: 50, default: 0 },
      ],
      buttons: ['Cancel', 'OK'],
      behavior: 'OK wraps the caret paragraph first char in span.dropcap with parameterized CSS '
        + 'vars (--drop-lines, --drop-distance; .in-margin variant), clamped 2..5 / 0..50; '
        + 'Position none removes the wrap; Cancel mutates nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-dropcap-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-dropcap-dialog: ERROR', e);
  process.exit(1);
});
