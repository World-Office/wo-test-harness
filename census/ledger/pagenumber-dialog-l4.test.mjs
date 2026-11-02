#!/usr/bin/env node
/**
 * ledger/pagenumber-dialog-l4.test.mjs — L4 FIDELITY probe: the Page Number
 * dialog's field/button contract, measured against the RUNNING editor
 * (local static serve + stubbed fetch, paragraph-dialog-l4 pattern).
 *
 * Contract (campaign comprehensive-parity, task FINAL-001): open the dialog
 * the way a user does — REAL clicks: the Insert tab, then the ribbon button
 * #btn-pagenumber (editor.js intercepts the click and opens
 * pagenumber-dialog) — then assert
 *   - title "Page Number"
 *   - fields: Position (select top/body/bottom), Format (select decimal /
 *     decimalZero / upperRoman / lowerRoman / upperLetter / lowerLetter),
 *     Alignment (select left/center/right)
 *   - buttons: Cancel + Insert (primary)
 *   - BEHAVIOR (fidelity, not surface): Top + lowerRoman + Right + Insert
 *     plants span.page-number[data-format="lowerRoman"] with
 *     text-align:right in the real header.page-header (visible in the flat
 *     HTML); Bottom + decimal + Left plants it in footer.page-footer; At
 *     cursor inserts an inline span.page-number at the caret; Cancel plants
 *     nothing.
 *
 * Declared gap (loud, never parity): the committed OO dialog census
 * captured NO field-level page-number modal (OO inserts via the Insert
 * header/footer flow; ledger-gap classifies OO-modal vs WO-dialog as a
 * declared divergence) — the field contract is pinned from the
 * MS-Word-style Page Numbers shape (Position top/bottom, Format, Alignment,
 * Insert/Cancel). MS Word additionally offers a "First page" checkbox; WO
 * defers that to the header/footer different-first-page marker — recorded
 * divergence, not gated.
 *
 * Writes pagenumber-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.pagenumber-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-pagenumber-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'pagenumber-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>Pagenumber sentinel echo text.</p>';
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
  // collapsed caret at the first paragraph start
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
  // page-number state: header/footer/inline spans + flat-HTML reflection.
  // NOTE: live DOM nests header/footer inside the pagination .wo-page
  // layer — query any depth; flatHtml unwraps pages into the saved shape.
  window.__L4_PN__ = function () {
    const ed = document.querySelector('#editor');
    const hdr = ed && ed.querySelector('header.page-header .page-number');
    const ftr = ed && ed.querySelector('footer.page-footer .page-number');
    const inline = ed ? [...ed.querySelectorAll('span.page-number')]
      .filter((s) => s.getAttribute('data-format')
        && !s.closest('header, footer')).length : 0;
    const flat = window.__WO_FLAT_HTML__();
    return {
      hdr: hdr ? { fmt: hdr.getAttribute('data-format'), align: hdr.style.textAlign,
        display: hdr.style.display } : null,
      ftr: ftr ? { fmt: ftr.getAttribute('data-format'), align: ftr.style.textAlign,
        display: ftr.style.display } : null,
      inline: inline,
      flatHdr: /<header[^>]*page-header[^>]*>[\s\S]*?page-number/.test(flat),
      flatSentinel: flat.includes('sentinel echo'),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// open the dialog the user way: Insert tab, then the #btn-pagenumber ribbon
// button (click-intercepted into the dialog)
async function openViaRibbon(page) {
  const active = await page.$('.ribbon-tab[data-tab="insert"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="insert"]');
  await sleep(150);
  await page.click('#btn-pagenumber');
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

    // --- 1. opens the user way: Insert tab + #btn-pagenumber ---
    await openViaRibbon(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('pagenumber-dialog');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    check('open via real clicks (Insert tab + #btn-pagenumber)', openRes);

    // --- 2..5 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('pagenumber-dialog');
      const q = (s) => dlg.querySelector(s);
      const opts = (sel) => [...sel.options].map((o) => o.value);
      const title = (q('#pagenumber-dialog-title') || {}).textContent || '';
      const pos = q('#pagenumber-position'); const fmt = q('#pagenumber-format');
      const aln = q('#pagenumber-align');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const cancel = q('#btn-pagenumber-close'); const ok = q('#btn-pagenumber-ok');
      return {
        title: title.trim(),
        posLabel: lab('pagenumber-position'), posOpts: pos ? opts(pos) : null,
        fmtLabel: lab('pagenumber-format'),
        fmtOpts: fmt ? opts(fmt) : null,
        alnLabel: lab('pagenumber-align'), alnOpts: aln ? opts(aln) : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!(ok && ok.classList.contains('primary')),
      };
    });
    check('title "Page Number"', c.title === 'Page Number', JSON.stringify(c.title));
    check('field Position: label + select top/body/bottom',
      c.posLabel === 'Position'
      && JSON.stringify(c.posOpts) === JSON.stringify(['top', 'body', 'bottom']),
      `label=${JSON.stringify(c.posLabel)} opts=${JSON.stringify(c.posOpts)}`);
    check('field Format: label + select decimal/decimalZero/upperRoman/lowerRoman/upperLetter/lowerLetter',
      c.fmtLabel === 'Format'
      && JSON.stringify(c.fmtOpts)
        === JSON.stringify(['decimal', 'decimalZero', 'upperRoman', 'lowerRoman', 'upperLetter', 'lowerLetter']),
      `label=${JSON.stringify(c.fmtLabel)} opts=${JSON.stringify(c.fmtOpts)}`);
    check('field Alignment: label + select left/center/right',
      c.alnLabel === 'Alignment'
      && JSON.stringify(c.alnOpts) === JSON.stringify(['left', 'center', 'right']),
      `label=${JSON.stringify(c.alnLabel)} opts=${JSON.stringify(c.alnOpts)}`);
    check('buttons Cancel + Insert(primary)',
      /^cancel$/i.test(c.cancel || '') && /^insert$/i.test(c.ok || '') && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} insert=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 6. behavior: Top + lowerRoman + Right -> header span ---
    await page.selectOption('#pagenumber-position', 'top');
    await page.selectOption('#pagenumber-format', 'lowerRoman');
    await page.selectOption('#pagenumber-align', 'right');
    await page.click('#btn-pagenumber-ok');
    await sleep(400);
    const p1 = await page.evaluate(() => window.__L4_PN__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('pagenumber-dialog').classList.contains('open'));
    check('Top + lowerRoman + Right -> header span.page-number[data-format=lowerRoman] text-align:right',
      closed1 && p1.hdr && p1.hdr.fmt === 'lowerRoman' && p1.hdr.align === 'right'
      && p1.hdr.display === 'block' && p1.flatHdr && p1.flatSentinel,
      `hdr=${JSON.stringify(p1.hdr)} flat=${p1.flatHdr}/${p1.flatSentinel} closed=${closed1}`);

    // --- 7. behavior: Bottom + decimal + Left -> footer span ---
    await openViaRibbon(page);
    await page.selectOption('#pagenumber-position', 'bottom');
    await page.selectOption('#pagenumber-format', 'decimal');
    await page.selectOption('#pagenumber-align', 'left');
    await page.click('#btn-pagenumber-ok');
    await sleep(300);
    const p2 = await page.evaluate(() => window.__L4_PN__());
    check('Bottom + decimal + Left -> footer span.page-number[data-format=decimal] text-align:left',
      p2.ftr && p2.ftr.fmt === 'decimal' && p2.ftr.align === 'left' && p2.ftr.display === 'block',
      `ftr=${JSON.stringify(p2.ftr)}`);

    // --- 8. behavior: At cursor inserts a formatted inline span ---
    await openViaRibbon(page);
    await page.evaluate(() => window.__L4_CARET__());
    await page.selectOption('#pagenumber-position', 'body');
    await page.selectOption('#pagenumber-format', 'upperLetter');
    await page.selectOption('#pagenumber-align', 'left');
    await page.click('#btn-pagenumber-ok');
    await sleep(300);
    const p3 = await page.evaluate(() => window.__L4_PN__());
    const p3span = await page.evaluate(() => {
      const s = [...document.querySelectorAll('#editor span.page-number')]
        .filter((x) => x.getAttribute('data-format') && !x.closest('header, footer'))
        .find((x) => x.getAttribute('data-format') === 'upperLetter');
      return s ? { fmt: s.getAttribute('data-format'), align: s.style.textAlign } : null;
    });
    check('At cursor inserts an inline span.page-number[data-format=upperLetter] text-align:left',
      p3.inline >= 1 && p3span && p3span.fmt === 'upperLetter' && p3span.align === 'left',
      `inline=${p3.inline} span=${JSON.stringify(p3span)}`);

    // --- 9. cancel plants nothing new ---
    const before = await page.evaluate(() => window.__L4_PN__());
    await openViaRibbon(page);
    await page.selectOption('#pagenumber-position', 'top');
    await page.selectOption('#pagenumber-format', 'upperRoman');
    await page.click('#btn-pagenumber-close');
    await sleep(300);
    const after = await page.evaluate(() => window.__L4_PN__());
    const closed9 = await page.evaluate(() =>
      !document.getElementById('pagenumber-dialog').classList.contains('open'));
    check('cancel plants nothing', closed9
      && JSON.stringify(after.hdr) === JSON.stringify(before.hdr)
      && JSON.stringify(after.ftr) === JSON.stringify(before.ftr)
      && after.inline === before.inline,
      `hdr=${JSON.stringify(after.hdr)}/${JSON.stringify(before.hdr)} closed=${closed9}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'pagenumber-dialog-l4',
    feature: 'dialog.pagenumber-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO dialog census captured NO field-level page-number modal (OO inserts via '
      + 'the Insert header/footer flow) — the field contract is pinned from the MS-Word-style '
      + 'Page Numbers shape (Position top/bottom, Format, Alignment, Insert/Cancel)',
      'MS Word additionally offers a "First page" checkbox; WO defers that to the header/footer '
      + 'different-first-page marker — recorded divergence, not gated',
      'declared quirk (measured): the #btn-pagenumber ribbon click carries data-cmd="insertPageNumber" '
      + 'AND the dialog-open intercept, so opening the dialog also plants a bare inline '
      + 'span.page-number at the caret (no data-format) — the OK/Insert flow above is unaffected; '
      + 'recorded, not gated',
    ],
    contract: {
      open: 'real clicks: Insert tab + ribbon #btn-pagenumber (click-intercepted into the dialog)',
      title: 'Page Number',
      fields: [
        { label: 'Position', tag: 'select', options: ['top', 'body', 'bottom'] },
        { label: 'Format', tag: 'select',
          options: ['decimal', 'decimalZero', 'upperRoman', 'lowerRoman', 'upperLetter', 'lowerLetter'] },
        { label: 'Alignment', tag: 'select', options: ['left', 'center', 'right'] },
      ],
      buttons: ['Cancel', 'Insert'],
      behavior: 'Insert plants span.page-number[data-format] with text-align in header.page-header '
        + '(top) / footer.page-footer (bottom) / inline at the caret (body); Cancel plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-pagenumber-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-pagenumber-dialog: ERROR', e);
  process.exit(1);
});
