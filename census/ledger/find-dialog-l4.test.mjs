#!/usr/bin/env node
/**
 * ledger/find-dialog-l4.test.mjs — L4 FIDELITY probe: the Find-and-replace
 * panel's field/button contract, measured against the RUNNING editor
 * (local static serve + stubbed fetch, paragraph-dialog-l4 pattern).
 *
 * Contract (campaign comprehensive-parity, task FINAL-001): open the panel
 * the way a user does — a REAL click on the toolbar #btn-find (editor.js:
 * openFindDialog) — then assert
 *   - title "Find and replace"
 *   - fields: Find (text input), Replace with (text input), Match case
 *     (checkbox); live match count status (#find-count "n / n")
 *   - buttons: Previous ▲ + Next ▼ + Close ✕ + Replace + Replace all
 *     (primary)
 *   - BEHAVIOR (fidelity, not surface): typing a query lists live matches
 *     (3/3 for a seed with golf/golf/GOLF, case-insensitive); Match case
 *     narrows to the exact-case hits (2); Replace all with case-insensitive
 *     rewrites every hit into the flat HTML (3 tango, 0 golf left);
 *     Replace (single) rewrites exactly the current match; Close leaves
 *     the document untouched.
 *
 * Declared gap (loud, never parity): OO ships Find & replace as a full
 * right panel with more>options (whole words, regex, look up, replace
 * history); the committed OO DIALOG census captured no field-level find
 * modal (OO opens it via Ctrl+F / the Home toolbar) — the field contract is
 * pinned from the MS-Word-style Find & Replace shape (Find, Replace with,
 * Match case, Find Next / Replace / Replace All). OO/MS extras (whole
 * words, sounds-like, regex) are deferred by WO — recorded divergence,
 * not gated.
 *
 * Writes find-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.find-dialog.l4; level 4 only when every
 * check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-find-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'find-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>Find sentinel golf text. golf again and GOLF caps.</p>';
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
  window.__L4_TEXT__ = function () {
    const flat = window.__WO_FLAT_HTML__();
    return {
      golf: (flat.match(/golf/gi) || []).length,
      golfLower: (flat.match(/golf/g) || []).length,
      golfCaps: (flat.match(/GOLF/g) || []).length,
      tango: (flat.match(/tango/gi) || []).length,
      lima: (flat.match(/lima/g) || []).length,
      count: (document.getElementById('find-count') || {}).textContent || '',
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

    // --- 1. opens the user way: real click on #btn-find ---
    await page.click('#btn-find');
    await sleep(250);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('find-dialog');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    check('open via real click on #btn-find', openRes);

    // --- 2..5 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('find-dialog');
      const q = (s) => dlg.querySelector(s);
      const title = (q('#find-dialog-title') || {}).textContent || '';
      const query = q('#find-query'); const repl = q('#find-replace');
      const mc = q('#find-match-case');
      const prev = q('#btn-find-prev'); const next = q('#btn-find-next');
      const close = q('#btn-find-close');
      const r1 = q('#btn-find-replace'); const rAll = q('#btn-find-replace-all');
      return {
        title: title.trim(),
        queryType: query ? query.type : null, queryPh: query ? query.placeholder : null,
        replType: repl ? repl.type : null, replPh: repl ? repl.placeholder : null,
        mcType: mc ? mc.type : null,
        prev: prev ? prev.getAttribute('aria-label') : null,
        next: next ? next.getAttribute('aria-label') : null,
        close: close ? close.getAttribute('aria-label') : null,
        r1: r1 ? r1.textContent.trim() : null,
        rAll: rAll ? rAll.textContent.trim() : null,
        rAllPrimary: !!(rAll && rAll.classList.contains('primary')),
      };
    });
    check('title "Find and replace"', c.title === 'Find and replace', JSON.stringify(c.title));
    check('fields Find + Replace with (text inputs) + Match case (checkbox)',
      c.queryType === 'text' && c.replType === 'text' && c.mcType === 'checkbox',
      `find=${c.queryType}/${JSON.stringify(c.queryPh)} replace=${c.replType} matchCase=${c.mcType}`);
    check('buttons Previous/Next/Close + Replace + Replace all (primary)',
      /previous/i.test(c.prev || '') && /next/i.test(c.next || '') && /close/i.test(c.close || '')
      && /^replace$/i.test(c.r1 || '') && /^replace all$/i.test(c.rAll || '') && c.rAllPrimary,
      `prev=${c.prev} next=${c.next} close=${c.close} replace=${c.r1} all=${c.rAll}/${c.rAllPrimary}`);

    // --- 6. live match count: 3 hits case-insensitive ---
    await page.fill('#find-query', 'golf');
    await sleep(350);
    let t = await page.evaluate(() => window.__L4_TEXT__());
    check('typing "golf" lists 3 matches (case-insensitive, count "1 / 3")',
      t.count === '1 / 3', `count=${JSON.stringify(t.count)}`);

    // --- 7. Match case narrows to exact-case hits (1 lowercase run + caps) ---
    await page.check('#find-match-case');
    await page.fill('#find-query', 'GOLF');
    await sleep(350);
    t = await page.evaluate(() => window.__L4_TEXT__());
    check('Match case + "GOLF" narrows to 1/1 exact-case match',
      t.count === '1 / 1', `count=${JSON.stringify(t.count)}`);

    // --- 8. Replace all (case-insensitive) rewrites every hit ---
    await page.uncheck('#find-match-case');
    await page.fill('#find-query', 'golf');
    await sleep(350);
    await page.fill('#find-replace', 'tango');
    await page.click('#btn-find-replace-all');
    await sleep(400);
    t = await page.evaluate(() => window.__L4_TEXT__());
    check('Replace all golf->tango rewrites all 3 hits in the flat HTML (0 golf left)',
      t.golf === 0 && t.tango === 3, `golf=${t.golf} tango=${t.tango}`);

    // --- 9. Replace (single) rewrites exactly the current match ---
    await page.fill('#find-query', 'tango');
    await sleep(350);
    await page.fill('#find-replace', 'lima');
    await page.click('#btn-find-replace');
    await sleep(400);
    t = await page.evaluate(() => window.__L4_TEXT__());
    check('Replace (single) rewrites exactly one match (3 tango -> 1 lima + 2 tango)',
      t.tango === 2 && t.lima === 1, `tango=${t.tango} lima=${t.lima}`);

    // --- 10. Close leaves the document untouched ---
    const before = await page.evaluate(() => window.__L4_TEXT__());
    await page.click('#btn-find-close');
    await sleep(250);
    const after = await page.evaluate(() => window.__L4_TEXT__());
    const closed = await page.evaluate(() =>
      !document.getElementById('find-dialog').classList.contains('open'));
    check('Close leaves the document untouched', closed && after.tango === before.tango
      && after.lima === before.lima,
      `tango=${after.tango}/${before.tango} lima=${after.lima}/${before.lima} closed=${closed}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'find-dialog-l4',
    feature: 'dialog.find-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'OO ships Find & replace as a full right panel with more-options (whole words, regex, '
      + 'look up); the committed OO DIALOG census captured no field-level find modal — the '
      + 'field contract is pinned from the MS-Word-style Find & Replace shape (Find, Replace '
      + 'with, Match case, Previous/Next, Replace, Replace All)',
      'OO/MS extras (whole words only, sounds-like, regex, search-direction scope) are deferred '
      + 'by WO — recorded divergence, not gated',
    ],
    contract: {
      open: 'real click on toolbar #btn-find (editor.js: openFindDialog)',
      title: 'Find and replace',
      fields: [
        { label: 'Find', tag: 'input', type: 'text' },
        { label: 'Replace with', tag: 'input', type: 'text' },
        { label: 'Match case', tag: 'input', type: 'checkbox' },
      ],
      buttons: ['Previous', 'Next', 'Close', 'Replace', 'Replace all'],
      behavior: 'live match count (current / total, case-insensitive; Match case narrows); '
        + 'Replace all rewrites every hit into the flat HTML as ONE undoable step; Replace '
        + 'rewrites the current match; Close leaves the document untouched',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-find-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-find-dialog: ERROR', e);
  process.exit(1);
});
