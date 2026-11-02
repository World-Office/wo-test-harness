#!/usr/bin/env node
/**
 * ledger/table-dialog-l4.test.mjs — L4 FIDELITY probe: the insert-table
 * dialog's field/button contract, measured against the RUNNING editor
 * (local static serve + stubbed fetch, roundtrip.cjs/link-dialog-l4 pattern).
 *
 * Contract (campaign comprehensive-parity, task L4-004): open the table
 * dialog the way a user does — a REAL click on the ribbon button #btn-table
 * (id-wired, editor.js line ~4995: addEventListener("click", insertTable);
 * the census spells the bus route "openTableDialog") — then assert
 *   - title "Insert table"
 *   - fields: Rows (input#table-rows[type=number], min 1 max 20) and
 *     Columns (input#table-cols[type=number], min 1 max 10), defaults 2/3
 *   - buttons: Cancel + Insert (primary, the OK-equivalent)
 *   - BEHAVIOR (fidelity, not surface): 3x4 + Insert puts a real
 *     <table> into the document (3 <tr>, 4 cells per row, flat HTML);
 *     out-of-range values clamp to the OO-style bounds (99 -> 20 rows,
 *     0 -> 1 col); Cancel mutates nothing.
 *
 * Declared gap (loud, never parity): the committed OO reference census has
 * Insert->Table as a hover GRID picker (btn-inserttable, no numeric dialog,
 * no OK/Cancel) — the numeric rows/cols contract is pinned from the
 * MS-Word-style insert-table shape. The probe asserts WO carries exactly
 * the two numeric fields (no more), so a stray field is a parity finding,
 * not a silent pass.
 *
 * Writes table-dialog-l4.json next to this script (merged by ledger/build.py
 * into row dialog.table-dialog.l4; level 4 only when every check passed).
 * Exit code 0 iff ok. Final stdout line: "l4-table-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'table-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>L4 table sentinel alpha text.</p>';
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
  // collapsed caret at the paragraph start, inside the editor — the place
  // the table should land (insertTable saves/restores this selection).
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
  // every table in the editor (inserts land at the SAME saved caret, so the
  // newest table is not necessarily last in document order) + flat serialization
  window.__L4_TABLE__ = function () {
    const ts = [...document.querySelectorAll('#editor table')];
    return {
      n: ts.length,
      list: ts.map((t) => ({ rows: t.rows.length, cells: t.rows[0] ? t.rows[0].cells.length : 0 })),
      flatHasTable: window.__WO_FLAT_HTML__().includes('<table'),
      sentinel: window.__WO_FLAT_HTML__().includes('sentinel alpha'),
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

    // --- 1. opens the user way: REAL clicks (Insert tab, then ribbon button) ---
    const caret = await page.evaluate(() => window.__L4_CARET__());
    await page.click('.ribbon-tab[data-tab="insert"]');
    await sleep(200);
    await page.click('#btn-table');
    await sleep(300);
    // NB: .insert-pop is an anchored popover — visibility must come from
    // the .open class + computed style, not offset geometry.
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('table-dialog');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    check('open via real clicks (Insert tab + #btn-table)', openRes && caret === 'ok',
      caret !== 'ok' ? `caret: ${caret}` : '');

    // --- 2..6 static contract while open ---
    const contract = await page.evaluate(() => {
      const dlg = document.getElementById('table-dialog');
      const title = (dlg && dlg.querySelector('#table-dialog-title') || {}).textContent || '';
      const rowsLabel = (dlg && dlg.querySelector('label[for="table-rows"]') || {}).textContent || '';
      const colsLabel = (dlg && dlg.querySelector('label[for="table-cols"]') || {}).textContent || '';
      const rows = dlg && dlg.querySelector('input#table-rows');
      const cols = dlg && dlg.querySelector('input#table-cols');
      const cancel = dlg && dlg.querySelector('#btn-table-cancel');
      const insert = dlg && dlg.querySelector('#btn-table-ok');
      const labels = [...(dlg || {}).querySelectorAll?.('label') || []]
        .map((l) => (l.textContent || '').trim());
      return {
        title: title.trim(),
        rowsLabel: rowsLabel.trim(), colsLabel: colsLabel.trim(),
        rowsType: rows ? rows.type : null, rowsMin: rows ? rows.min : null, rowsMax: rows ? rows.max : null,
        rowsVal: rows ? rows.value : null,
        colsType: cols ? cols.type : null, colsMin: cols ? cols.min : null, colsMax: cols ? cols.max : null,
        colsVal: cols ? cols.value : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        insert: insert ? insert.textContent.trim() : null,
        insertPrimary: !!(insert && insert.classList.contains('primary')),
        labels,
      };
    });
    check('title "Insert table"', contract.title === 'Insert table', JSON.stringify(contract.title));
    check('field Rows: label + input[type=number] min 1 max 20',
      contract.rowsLabel === 'Rows' && contract.rowsType === 'number'
      && contract.rowsMin === '1' && contract.rowsMax === '20',
      `label=${JSON.stringify(contract.rowsLabel)} type=${JSON.stringify(contract.rowsType)} `
      + `min=${JSON.stringify(contract.rowsMin)} max=${JSON.stringify(contract.rowsMax)}`);
    check('field Columns: label + input[type=number] min 1 max 10',
      contract.colsLabel === 'Columns' && contract.colsType === 'number'
      && contract.colsMin === '1' && contract.colsMax === '10',
      `label=${JSON.stringify(contract.colsLabel)} type=${JSON.stringify(contract.colsType)} `
      + `min=${JSON.stringify(contract.colsMin)} max=${JSON.stringify(contract.colsMax)}`);
    check('defaults reset on open: rows 2, cols 3',
      contract.rowsVal === '2' && contract.colsVal === '3',
      `rows=${JSON.stringify(contract.rowsVal)} cols=${JSON.stringify(contract.colsVal)}`);
    check('buttons Cancel + Insert(primary)',
      /cancel/i.test(contract.cancel || '') && /insert/i.test(contract.insert || '') && contract.insertPrimary,
      `cancel=${JSON.stringify(contract.cancel)} insert=${JSON.stringify(contract.insert)} `
      + `primary=${contract.insertPrimary}`);
    check('declared divergence: exactly the two OO fields (OO Insert->Table is a hover grid picker; '
      + 'a stray WO field would be a parity finding, not a pass)',
      JSON.stringify(contract.labels) === JSON.stringify(['Rows', 'Columns']),
      `labels=${JSON.stringify(contract.labels)}`);

    // --- 7. behavior: 3x4 + Insert -> real table in the document ---
    await page.fill('#table-rows', '3');
    await page.fill('#table-cols', '4');
    await page.click('#btn-table-ok');
    await sleep(400);
    const t1 = await page.evaluate(() => window.__L4_TABLE__());
    check('3x4 + Insert -> <table> with 3 rows x 4 cells (flat HTML, seed text intact)',
      t1.n === 1 && t1.list[0].rows === 3 && t1.list[0].cells === 4 && t1.flatHasTable && t1.sentinel,
      `tables=${JSON.stringify(t1.list)} flatHasTable=${t1.flatHasTable} sentinel=${t1.sentinel}`);

    // --- 8. behavior: OO-style bounds clamp (clampInt 1..20 / 1..10) ---
    await page.click('#btn-table');
    await sleep(200);
    await page.fill('#table-rows', '99');
    await page.fill('#table-cols', '0');
    await page.click('#btn-table-ok');
    await sleep(400);
    const t2 = await page.evaluate(() => window.__L4_TABLE__());
    check('out-of-range clamps to bounds: 99x0 -> 20 rows x 1 col',
      t2.n === 2 && t2.list.some((t) => t.rows === 20 && t.cells === 1),
      `tables=${JSON.stringify(t2.list)}`);

    // --- 9. cancel mutates nothing ---
    await page.click('#btn-table');
    await sleep(200);
    await page.fill('#table-rows', '5');
    await page.fill('#table-cols', '5');
    await page.click('#btn-table-cancel');
    await sleep(300);
    const t3 = await page.evaluate(() => window.__L4_TABLE__());
    check('cancel mutates nothing', t3.n === 2,
      `tables=${t3.n} (expected still 2)`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'table-dialog-l4',
    feature: 'dialog.table-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'OO Insert->Table is a hover GRID picker (census btn-inserttable; the committed OO dialog '
      + 'census captured no numeric insert-table dialog and no OK/Cancel) — the numeric rows/cols '
      + 'contract is pinned from the MS-Word-style insert-table shape; WO ships a rows/cols popover '
      + 'with Insert(=OK)/Cancel as the semantic carrier (measured)',
    ],
    contract: {
      open: 'real click #btn-table (editor.js: addEventListener("click", insertTable); bus route "openTableDialog")',
      title: 'Insert table',
      fields: [
        { label: 'Rows', tag: 'input', type: 'number', min: 1, max: 20, default: 2 },
        { label: 'Columns', tag: 'input', type: 'number', min: 1, max: 10, default: 3 },
      ],
      buttons: ['Cancel', 'Insert'],
      behavior: 'rows x cols + Insert -> <table> at the saved selection (flat HTML); values clamp '
        + 'to min/max; Cancel mutates nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-table-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-table-dialog: ERROR', e);
  process.exit(1);
});
