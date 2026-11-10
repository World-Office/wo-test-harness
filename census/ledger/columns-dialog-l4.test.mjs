#!/usr/bin/env node
/**
 * ledger/columns-dialog-l4.test.mjs — L4 FIDELITY probe: the OO "Columns"
 * dialog (census-oo-dialogs.json, tab "layout", trigger
 * "menu-item:Custom columns") measured live against the RUNNING editor
 * (local static serve + stubbed fetch, margins-dialog-l4 pattern).
 *
 * Census-driven contract (ledger/build.py LAYOUT_L4_GOLD, FXG-B2 residual):
 * the OO field contract is MINED from the committed census at probe time
 * (never re-declared here) and measured against WO's #columns-dialog:
 *   - open the user way: Layout tab + census route Layout > Columns >
 *     "Custom columns" (button[data-cmd="openColumnsDialog"]);
 *   - gated OO field "Number of columns" resolves to #columns-count
 *     (number 1..6, default 2); WO extra: Gap (px) 0..200 default 36;
 *   - buttons: Cancel + Insert (primary);
 *   - BEHAVIOR: Insert wraps the caret position in
 *     <section data-columns="N" data-column-gap="G"> (editor.js
 *     confirmColumnsDialog; count clamps 1..6 — converter contract:
 *     DOCX w:cols / ODF multi-column section); the preset route Layout >
 *     Columns > Two (data-cmd applyColumns) plants the same marker with
 *     data-columns=2; out-of-range counts clamp; Cancel plants nothing.
 *
 * Declared gaps (loud, never gated, per the LAYOUT_L4_GOLD deferred set):
 *   - per-column width spinners: collapse into WO's equal-width section
 *     mechanism (one data-column-gap knob — recorded divergence);
 *   - "Equal column width": satisfied by mechanism (no checkbox exists);
 *   - "Column divider": no divider attribute on the section marker.
 *
 * Writes columns-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.columns-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-columns-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'columns-dialog-l4.json');
const CENSUS_OO = path.join(LEDGER_DIR, '..', 'census', 'census-oo-dialogs.json');
const CENSUS_TITLE = 'Columns';
const CENSUS_TRIGGER = 'menu-item:Custom columns';
const MENU_ITEM_I18N = 'Layout.Columns.Custom'; // "Custom columns"
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>Columns sentinel delta text.</p>';
const BOOT_MS = 2200;

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  return !!ok;
};

function mineOoCensus() {
  const d = JSON.parse(fs.readFileSync(CENSUS_OO, 'utf8'));
  const e = (d.dialogs || []).find(
    (x) => (x.dialog || {}).title === CENSUS_TITLE && x.tab === 'layout');
  if (!e) throw new Error(
    `census-oo-dialogs.json lost its tab:"layout" dialog ${JSON.stringify(CENSUS_TITLE)} `
    + '— re-pin the LAYOUT_L4_GOLD contract');
  const fields = (e.dialog.fields || []).map((f) => f.label).filter(Boolean);
  const buttons = e.dialog.buttons || [];
  const trigger = (e.trigger || {}).via || CENSUS_TRIGGER;
  return { fields, buttons, trigger };
}

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

function pageHelpers() {
  window.__L4_COLUMNS__ = function () {
    const ed = document.querySelector('#editor');
    const sec = ed && [...ed.querySelectorAll('section[data-columns]')].pop();
    const flat = window.__WO_FLAT_HTML__();
    return {
      has: !!sec,
      cols: sec ? sec.getAttribute('data-columns') : null,
      gap: sec ? sec.getAttribute('data-column-gap') : null,
      layout: sec ? sec.getAttribute('data-columns-layout') : null,
      flatHas: flat.includes('data-columns'),
      flatSentinel: flat.includes('sentinel delta'),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureLayoutTab(page) {
  const active = await page.$('.ribbon-tab[data-tab="layout"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="layout"]');
  await sleep(150);
}

// census route: Layout > Columns > "Custom columns"
async function openViaCensusRoute(page) {
  await ensureLayoutTab(page);
  const holders = await page.$$('.ribbon-page[data-tab="layout"] .rb-menu');
  let holder = null;
  for (const h of holders) {
    if (await h.$(`button[data-i18n="${MENU_ITEM_I18N}"]`)) { holder = h; break; }
  }
  if (!holder) throw new Error(`Layout ribbon lost the ${MENU_ITEM_I18N} menu item`);
  await (await holder.$('.menu-trigger')).evaluate((b) => b.click());
  await sleep(150);
  await (await holder.$(`button[data-i18n="${MENU_ITEM_I18N}"]`)).evaluate((b) => b.click());
  await sleep(250);
}

// preset route: Layout > Columns > Two (data-cmd applyColumns, data-value two)
async function applyColumnsPreset(page, value) {
  await ensureLayoutTab(page);
  const holders = await page.$$('.ribbon-page[data-tab="layout"] .rb-menu');
  let holder = null;
  for (const h of holders) {
    if (await h.$(`button[data-cmd="applyColumns"][data-value="${value}"]`)) { holder = h; break; }
  }
  if (!holder) throw new Error(`Layout ribbon lost the applyColumns:${value} preset`);
  await (await holder.$('.menu-trigger')).evaluate((b) => b.click());
  await sleep(150);
  await (await holder.$(`button[data-cmd="applyColumns"][data-value="${value}"]`)).evaluate((b) => b.click());
  await sleep(300);
}

const dialogOpen = () => {
  const d = document.getElementById('columns-dialog');
  if (!d || !d.classList.contains('open')) return false;
  const cs = getComputedStyle(d);
  return cs.display !== 'none' && cs.visibility !== 'hidden';
};

async function main() {
  if (!fs.existsSync(path.join(EDITOR_DIR, 'index.html'))) {
    throw new Error(`editor dir missing index.html: ${EDITOR_DIR} (set WO_EDITOR_DIR)`);
  }
  const oo = mineOoCensus();
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

    // --- 1. mined census contract (never re-declared) ---
    check('census mine: OO "Columns" dialog (tab layout) — fields incl. "Number of columns", OK/Cancel, trigger',
      oo.fields.length > 0 && oo.fields.some((f) => /number of columns/i.test(f))
      && JSON.stringify(oo.buttons) === JSON.stringify(['OK', 'Cancel'])
      && oo.trigger === CENSUS_TRIGGER,
      `fields=${JSON.stringify(oo.fields)} buttons=${JSON.stringify(oo.buttons)} trigger=${oo.trigger}`);

    // --- 2. opens the census way: Layout > Columns > "Custom columns" ---
    await openViaCensusRoute(page);
    check('census route: Layout > Columns > "Custom columns" (data-cmd openColumnsDialog) opens the dialog',
      await page.evaluate(dialogOpen));

    // --- 3..5 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('columns-dialog');
      const q = (s) => dlg.querySelector(s);
      const lab = (id) => { const l = dlg.querySelector(`label[for="${id}"]`); return l ? (l.textContent || '').trim() : ''; };
      const num = (id) => { const i = q('#' + id); return i ? { type: i.type, val: i.value, min: i.min, max: i.max } : null; };
      const title = ((q('#columns-dialog-title') || {}).textContent || '').trim();
      const cancel = q('#btn-columns-cancel'); const ok = q('#btn-columns-ok');
      return {
        title,
        countLabel: lab('columns-count'), count: num('columns-count'),
        gapLabel: lab('columns-gap'), gap: num('columns-gap'),
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!ok.classList.contains('primary'),
      };
    });
    check('gated OO field "Number of columns" -> #columns-count number 1..6, default 2',
      /columns/i.test(c.countLabel) && c.count && c.count.type === 'number'
      && c.count.min === '1' && c.count.max === '6' && c.count.val === '2',
      `label=${JSON.stringify(c.countLabel)} ${JSON.stringify(c.count)}`);
    check('WO extra: Gap (px) number 0..200, default 36',
      /gap/i.test(c.gapLabel) && c.gap && c.gap.type === 'number'
      && c.gap.min === '0' && c.gap.max === '200' && c.gap.val === '36',
      `label=${JSON.stringify(c.gapLabel)} ${JSON.stringify(c.gap)}`);
    check('chrome: title "Insert columns", Cancel + Insert(primary)',
      c.title === 'Insert columns' && /^cancel$/i.test(c.cancel || '')
      && /^insert$/i.test(c.ok || '') && c.okPrimary,
      `title=${JSON.stringify(c.title)} cancel=${JSON.stringify(c.cancel)} insert=${JSON.stringify(c.ok)}`);

    // --- 6. behavior: 3 cols / gap 42 -> Insert wraps caret in the section marker ---
    await page.fill('#columns-count', '3');
    await page.fill('#columns-gap', '42');
    await page.click('#btn-columns-ok');
    await sleep(400);
    const m1 = await page.evaluate(() => window.__L4_COLUMNS__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('columns-dialog').classList.contains('open'));
    check('Insert (3 / 42px) -> section[data-columns=3 data-column-gap=42] in the flat HTML',
      closed1 && m1.has && m1.cols === '3' && m1.gap === '42' && m1.flatHas && m1.flatSentinel,
      `closed=${closed1} has=${m1.has} cols=${m1.cols} gap=${m1.gap} flat=${m1.flatHas}/${m1.flatSentinel}`);

    // --- 7. clamp: count 99 -> 6; gap 9999 -> 200 ---
    await openViaCensusRoute(page);
    await page.fill('#columns-count', '99');
    await page.fill('#columns-gap', '9999');
    await page.click('#btn-columns-ok');
    await sleep(400);
    const m2 = await page.evaluate(() => window.__L4_COLUMNS__());
    check('out-of-range clamps: 99 -> data-columns=6, 9999 -> gap=200',
      m2.cols === '6' && m2.gap === '200', `cols=${m2.cols} gap=${m2.gap}`);

    // --- 8. preset route: Layout > Columns > Two plants data-columns=2 ---
    await applyColumnsPreset(page, 'two');
    const m3 = await page.evaluate(() => window.__L4_COLUMNS__());
    check('preset route: Layout > Columns > Two (data-cmd applyColumns) plants data-columns=2',
      m3.cols === '2', `cols=${m3.cols} layout=${JSON.stringify(m3.layout)}`);

    // --- 9. negative: Cancel plants nothing ---
    await openViaCensusRoute(page);
    await page.fill('#columns-count', '5');
    await page.click('#btn-columns-cancel');
    await sleep(300);
    const m4 = await page.evaluate(() => window.__L4_COLUMNS__());
    const closed4 = await page.evaluate(() =>
      !document.getElementById('columns-dialog').classList.contains('open'));
    check('Cancel mutates nothing (marker keeps the Two preset), dialog closes',
      closed4 && m4.cols === '2', `closed=${closed4} cols=${m4.cols}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'columns-dialog-l4',
    feature: 'dialog.columns-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    oo_fields: oo.fields,
    oo_buttons: oo.buttons,
    trigger: oo.trigger,
    checks,
    declaredGaps: [
      'Per-column width spinners (1/2): collapse into the equal-width section mechanism '
      + '(one data-column-gap knob — recorded divergence, not gated)',
      'Equal column width: satisfied by mechanism — WO columns are equal-width by construction '
      + '(no checkbox exists — recorded divergence, not gated)',
      'Column divider: rule between columns deferred — the section marker has no divider '
      + 'attribute (recorded divergence, not gated)',
    ],
    contract: {
      open: 'real clicks: census route Layout > Columns > "Custom columns" (data-cmd openColumnsDialog)',
      title: 'Insert columns',
      wo_dialog: 'columns-dialog',
      fields: [
        { label: 'Number of columns', tag: 'number', maps: 'Columns', range: '1..6', default: 2 },
        { label: 'Gap (px)', tag: 'number', wo_extra: true, range: '0..200', default: 36 },
      ],
      buttons: ['Cancel', 'Insert'],
      behavior: 'Insert wraps the caret position in section[data-columns][data-column-gap] '
        + '(count clamps 1..6, gap clamps 0..200); the Layout > Columns presets (One/Two/Three/'
        + 'Left/Right) plant the same marker (asymmetric layouts add data-columns-layout); '
        + 'Cancel plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-columns-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-columns-dialog: ERROR', e);
  process.exit(1);
});
