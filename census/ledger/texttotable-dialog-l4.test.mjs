#!/usr/bin/env node
/**
 * ledger/texttotable-dialog-l4.test.mjs — L4 FIDELITY probe: the Convert
 * Text to Table popover's field/button contract, measured against the
 * RUNNING editor (local static serve + stubbed fetch, table-dialog-l4
 * pattern — same anchored insert-pop surface).
 *
 * Contract (campaign comprehensive-parity, task FINAL-001): open the
 * popover the way a user does — REAL clicks: the Insert tab, the Table ▾
 * caret menu, the "Convert Text to Table…" menu item (editor.js:
 * openTextToTableDialog, anchored popover) — then assert
 *   - title "Convert Text to Table"
 *   - fields: Separate text at (select auto/comma/tab/semicolon/custom),
 *     Custom separator (text input), Number of columns (number 1..10)
 *   - buttons: Cancel + Insert (primary)
 *   - BEHAVIOR (fidelity, not surface): with both seed paragraphs
 *     "alpha;beta" / "gamma;delta" selected, Automatic splits on the
 *     dominant separator (semicolon, per line) and Insert replaces the
 *     selection with a REAL 2x2 <table> (rows/cells in the flat HTML);
 *     explicit Comma overrides the auto choice (2x1 table, full lines as
 *     cells); Number of columns pads every row to exactly N <td>;
 *     Cancel converts nothing.
 *
 * Declared gap (loud, never parity): the committed OO dialog census
 * captured NO convert-text-to-table modal (OO's Insert->Table exposes the
 * convert via its table menu in some versions; the WO popover is the
 * anchored-popover surface the ledger already carries) — the field
 * contract is pinned from the MS-Word-style Convert Text to Table shape
 * (Separate text at, number of columns, OK/Cancel). MS Word additionally
 * offers fixed column width / AutoFit formatting; WO defers those —
 * recorded divergence, not gated.
 *
 * Writes texttotable-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.text-to-table-dialog.l4; level 4 only
 * when every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-texttotable: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'texttotable-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>alpha;beta</p><p>gamma;delta</p>';
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
  // select BOTH seed paragraphs (selection text = "alpha;beta\ngamma;delta")
  window.__L4_SELECT__ = function () {
    const ed = document.querySelector('#editor');
    const ps = ed ? [...ed.querySelectorAll('p')] : [];
    if (ps.length < 2 || !ps[0].firstChild || !ps[1].firstChild) return 'no-p';
    const r = document.createRange();
    r.setStart(ps[0].firstChild, 0);
    r.setEnd(ps[1].firstChild, (ps[1].firstChild.data || '').length);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    ed.focus();
    return 'ok';
  };
  // table state in the live doc + flat-HTML reflection
  window.__L4_TT__ = function () {
    const ed = document.querySelector('#editor');
    const t = ed && ed.querySelector('table');
    const rows = t ? [...t.querySelectorAll('tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent)) : null;
    const flat = window.__WO_FLAT_HTML__();
    return {
      n: ed ? ed.querySelectorAll('table').length : 0,
      rows,
      flatTable: /<table>/.test(flat),
      flatCells: flat.includes('alpha') && flat.includes('delta'),
      paras: ed ? ed.querySelectorAll('p').length : -1,
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// open the popover the user way: Insert tab -> Table ▾ caret menu ->
// "Convert Text to Table…" menu item
async function openViaMenu(page) {
  const active = await page.$('.ribbon-tab[data-tab="insert"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="insert"]');
  await sleep(150);
  await page.click('.menu:has(#btn-table) .caret-btn');
  await sleep(200);
  await page.click('button[data-cmd="convertTextToTable"]');
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

    // --- 1. opens the user way: Insert tab -> Table ▾ -> Convert item ---
    await openViaMenu(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('text-to-table-dialog');
      if (!d) return false;
      const cs = getComputedStyle(d);
      return d.classList.contains('open') || cs.display !== 'none';
    });
    check('open via real clicks (Insert tab + Table ▾ + Convert Text to Table…)', openRes);

    // --- 2..5 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('text-to-table-dialog');
      const q = (s) => dlg.querySelector(s);
      const opts = (sel) => [...sel.options].map((o) => o.value);
      const title = (q('#ttt-dialog-title') || {}).textContent || '';
      const sep = q('#ttt-sep'); const custom = q('#ttt-custom'); const cols = q('#ttt-cols');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const cancel = q('#btn-ttt-cancel'); const ok = q('#btn-ttt-ok');
      return {
        title: title.trim(),
        sepLabel: lab('ttt-sep'), sepOpts: sep ? opts(sep) : null, sepVal: sep ? sep.value : null,
        customType: custom ? custom.type : null, customMax: custom ? custom.maxLength : null,
        customPh: custom ? custom.placeholder : null,
        colsLabel: lab('ttt-cols'), colsType: cols ? cols.type : null,
        colsMin: cols ? cols.min : null, colsMax: cols ? cols.max : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!(ok && ok.classList.contains('primary')),
      };
    });
    check('title "Convert Text to Table"', c.title === 'Convert Text to Table',
      JSON.stringify(c.title));
    check('field Separate text at: label + select auto/comma/tab/semicolon/custom',
      c.sepLabel === 'Separate text at' && c.sepVal === 'auto'
      && JSON.stringify(c.sepOpts)
        === JSON.stringify(['auto', 'comma', 'tab', 'semicolon', 'custom']),
      `label=${JSON.stringify(c.sepLabel)} val=${c.sepVal} opts=${JSON.stringify(c.sepOpts)}`);
    check('field Custom separator: text input (maxlength 4) + Number of columns: number 1..10',
      c.customType === 'text' && c.customMax === 4
      && c.colsLabel === 'Number of columns' && c.colsType === 'number'
      && c.colsMin === '1' && c.colsMax === '10',
      `custom=${c.customType}/${c.customMax} cols=${JSON.stringify(c.colsLabel)}/${c.colsType}/${c.colsMin}..${c.colsMax}`);
    check('buttons Cancel + Insert(primary)',
      /^cancel$/i.test(c.cancel || '') && /^insert$/i.test(c.ok || '') && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} insert=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 6. behavior: auto splits on the dominant separator -> 2x2 table ---
    // (close the popover opened for the static checks first — it anchors
    // under its own trigger and intercepts clicks; then select, then open)
    await page.click('#btn-ttt-cancel');
    await sleep(150);
    // selection BEFORE opening — openTextToTableDialog saves it and
    // confirm restores it (the real user flow: select, then open convert)
    await page.evaluate(() => window.__L4_SELECT__());
    await openViaMenu(page);
    await page.click('#btn-ttt-ok');
    await sleep(400);
    const t1 = await page.evaluate(() => window.__L4_TT__());
    const closed1 = await page.evaluate(() => {
      const d = document.getElementById('text-to-table-dialog');
      return !d.classList.contains('open');
    });
    check('Automatic on "alpha;beta / gamma;delta" -> real 2x2 <table> replacing the selection (flat HTML)',
      closed1 && t1.n === 1 && t1.rows && t1.rows.length === 2
      && JSON.stringify(t1.rows[0]) === JSON.stringify(['alpha', 'beta'])
      && JSON.stringify(t1.rows[1]) === JSON.stringify(['gamma', 'delta'])
      && t1.flatTable && t1.flatCells,
      `n=${t1.n} rows=${JSON.stringify(t1.rows)} flat=${t1.flatTable}/${t1.flatCells} closed=${closed1}`);

    // --- 7. reload: explicit Comma overrides the auto (semicolon) choice ---
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#editor', { timeout: 20000 });
    await page.waitForTimeout(BOOT_MS);
    await page.evaluate(pageHelpers);
    await page.evaluate(() => window.__L4_SELECT__());
    await openViaMenu(page);
    await page.selectOption('#ttt-sep', 'comma');
    await page.click('#btn-ttt-ok');
    await sleep(400);
    const t2 = await page.evaluate(() => window.__L4_TT__());
    check('explicit Comma overrides auto: each line becomes one full cell (2x1)',
      t2.n === 1 && t2.rows && t2.rows.length === 2
      && JSON.stringify(t2.rows[0]) === JSON.stringify(['alpha;beta'])
      && JSON.stringify(t2.rows[1]) === JSON.stringify(['gamma;delta']),
      `n=${t2.n} rows=${JSON.stringify(t2.rows)}`);

    // --- 8. reload: column count pads every row to exactly N <td> ---
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#editor', { timeout: 20000 });
    await page.waitForTimeout(BOOT_MS);
    await page.evaluate(pageHelpers);
    await page.evaluate(() => window.__L4_SELECT__());
    await openViaMenu(page);
    await page.fill('#ttt-cols', '3');
    await page.click('#btn-ttt-ok');
    await sleep(400);
    const t3 = await page.evaluate(() => window.__L4_TT__());
    const widthOk = t3.rows && t3.rows.length === 2 && t3.rows.every((r) => r.length === 3)
      && t3.rows[0][0] === 'alpha' && t3.rows[0][2] === '';
    check('Number of columns 3 pads every row to exactly 3 <td> (empty pad cells)',
      t3.n === 1 && widthOk,
      `rows=${JSON.stringify(t3.rows)}`);

    // --- 9. cancel converts nothing ---
    const before = await page.evaluate(() => window.__L4_TT__());
    await openViaMenu(page);
    await page.selectOption('#ttt-sep', 'tab');
    await page.click('#btn-ttt-cancel');
    await sleep(300);
    const after = await page.evaluate(() => window.__L4_TT__());
    const closed9 = await page.evaluate(() => {
      const d = document.getElementById('text-to-table-dialog');
      return !d.classList.contains('open');
    });
    check('cancel converts nothing', closed9 && after.n === before.n
      && JSON.stringify(after.rows) === JSON.stringify(before.rows),
      `n=${after.n}/${before.n} closed=${closed9}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'texttotable-dialog-l4',
    feature: 'dialog.text-to-table-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO dialog census captured NO convert-text-to-table modal — the field '
      + 'contract is pinned from the MS-Word-style Convert Text to Table shape (Separate text '
      + 'at, Number of columns, OK/Cancel); the popover is the anchored insert-pop surface the '
      + 'ledger already carries for table insert (table-dialog precedent)',
      'MS Word additionally offers fixed column width / AutoFit formatting; WO defers those — '
      + 'recorded divergence, not gated',
    ],
    contract: {
      open: 'real clicks: Insert tab + Table ▾ caret menu + "Convert Text to Table…" menu item '
        + '(editor.js: openTextToTableDialog, anchored insert-pop)',
      title: 'Convert Text to Table',
      fields: [
        { label: 'Separate text at', tag: 'select',
          options: ['auto', 'comma', 'tab', 'semicolon', 'custom'] },
        { label: 'Custom separator', tag: 'input', type: 'text', maxLength: 4 },
        { label: 'Number of columns', tag: 'input', type: 'number', min: 1, max: 10 },
      ],
      buttons: ['Cancel', 'Insert'],
      behavior: 'Insert replaces the selection with a real <table>: Automatic splits on the '
        + 'dominant separator (semicolon vs comma), explicit separators force their char, and '
        + 'Number of columns pads/truncates every row to exactly N <td>; Cancel converts nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-texttotable: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-texttotable: ERROR', e);
  process.exit(1);
});
