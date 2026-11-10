#!/usr/bin/env node
/**
 * ledger/pagesize-dialog-l4.test.mjs — L4 FIDELITY probe: the OO "Page size"
 * dialog (census-oo-dialogs.json, tab "layout", trigger
 * "menu-item:Custom page size") measured live against the RUNNING editor
 * (local static serve + stubbed fetch, margins-dialog-l4 pattern).
 *
 * Census-driven contract (ledger/build.py LAYOUT_L4_GOLD, FXG-B2 residual):
 * the OO field contract is MINED from the committed census at probe time
 * (never re-declared here) and measured against WO's shared Page-setup
 * dialog (same #page-setup-dialog as Margins — census dialog
 * page-setup-dialog):
 *   - open the user way: Layout tab + census route Layout > Size >
 *     "Custom page size" (button[data-cmd="openPageSetup"]);
 *   - gated field "Preset" resolves to the Size select: 13 "WxH" twip
 *     presets + Custom (default 11906x16838 = A4);
 *   - BEHAVIOR: Size preset -> Apply writes data-page-w/data-page-h on the
 *     div.page-setup marker at body start (flat HTML, w:sectPr round-trip
 *     via editor.js writePageSetupMarker); landscape swaps the pair;
 *     reopen reads the live size back into the select; Cancel plants
 *     nothing.
 *
 * Declared gaps (loud, never gated, per the LAYOUT_L4_GOLD deferred set):
 *   - "Width"/"Height": free numeric custom size carried by mechanism —
 *     the Size option values are 'WxH' twips and Apply writes the pair;
 *     no separate spinners (recorded divergence, not gated).
 *
 * Writes pagesize-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.page-size-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-pagesize-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'pagesize-dialog-l4.json');
const CENSUS_OO = path.join(LEDGER_DIR, '..', 'census', 'census-oo-dialogs.json');
const CENSUS_TITLE = 'Page size';
const CENSUS_TRIGGER = 'menu-item:Custom page size';
const MENU_ITEM_I18N = 'Layout.Size.Custom'; // "Custom page size"
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>Page size sentinel delta text.</p>';
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
  window.__L4_PAGESIZE__ = function () {
    const ed = document.querySelector('#editor');
    const m = ed && ed.querySelector(':scope > div.page-setup');
    const flat = window.__WO_FLAT_HTML__();
    return {
      has: !!m,
      w: m ? m.getAttribute('data-page-w') : null,
      h: m ? m.getAttribute('data-page-h') : null,
      orient: m ? m.getAttribute('data-orient') : null,
      flatHas: flat.includes('page-setup'),
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

// census route: Layout > Size > "Custom page size"
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

// the shared dialog also opens from the ribbon button (same surface)
async function openViaButton(page) {
  await ensureLayoutTab(page);
  const btn = await page.$('#btn-page-setup');
  await btn.evaluate((b) => b.click());
  await sleep(250);
}

const dialogOpen = () => {
  const d = document.getElementById('page-setup-dialog');
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
    check('census mine: OO "Page size" dialog (tab layout) — fields incl. Preset, OK/Cancel, trigger',
      oo.fields.length > 0 && oo.fields.some((f) => /preset|size/i.test(f))
      && JSON.stringify(oo.buttons) === JSON.stringify(['OK', 'Cancel'])
      && oo.trigger === CENSUS_TRIGGER,
      `fields=${JSON.stringify(oo.fields)} buttons=${JSON.stringify(oo.buttons)} trigger=${oo.trigger}`);

    // --- 2. opens the census way: Layout > Size > "Custom page size" ---
    await openViaCensusRoute(page);
    check('census route: Layout > Size > "Custom page size" (data-cmd openPageSetup) opens the dialog',
      await page.evaluate(dialogOpen));

    // --- 3..5 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('page-setup-dialog');
      const size = dlg.querySelector('#ps-size');
      const opts = [...size.options].map((o) => o.value);
      const title = ((dlg.querySelector('#page-setup-title') || {}).textContent || '').trim();
      const ok = dlg.querySelector('#btn-ps-apply');
      const cancel = dlg.querySelector('#btn-ps-cancel');
      return {
        title, opts, defaultVal: size.value,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!ok.classList.contains('primary'),
        cancel: cancel ? cancel.textContent.trim() : null,
      };
    });
    check('gated OO field "Preset" -> Size select: 13 "WxH" twip presets + Custom, default A4 11906x16838',
      c.opts.length === 14 && c.opts.slice(0, 13).every((v) => /^\d+x\d+$/.test(v))
      && c.opts[13] === 'custom' && c.defaultVal === '11906x16838',
      `n=${c.opts.length} first=${c.opts[0]} last=${c.opts[13]} default=${c.defaultVal}`);
    check('shared page-setup dialog chrome: title "Page setup", Cancel + Apply(primary)',
      c.title === 'Page setup' && /^cancel$/i.test(c.cancel || '') && /^apply$/i.test(c.ok || '') && c.okPrimary,
      `title=${JSON.stringify(c.title)} cancel=${JSON.stringify(c.cancel)} apply=${JSON.stringify(c.ok)}`);

    // --- 6. behavior: Letter preset (12240x15840) -> Apply writes the WxH pair ---
    await page.selectOption('#ps-size', '12240x15840');
    await page.click('#btn-ps-apply');
    await sleep(400);
    const m1 = await page.evaluate(() => window.__L4_PAGESIZE__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('page-setup-dialog').classList.contains('open'));
    check('Letter preset + Apply -> div.page-setup[data-page-w=12240 data-page-h=15840] portrait',
      closed1 && m1.has && m1.w === '12240' && m1.h === '15840' && m1.orient === 'portrait'
      && m1.flatHas && m1.flatSentinel,
      `closed=${closed1} ${m1.w}x${m1.h} ${m1.orient} flat=${m1.flatHas}/${m1.flatSentinel}`);

    // --- 7. reopen reads the live size back into the select ---
    await openViaButton(page);
    const rb = await page.evaluate(() => document.getElementById('ps-size').value);
    check('reopen reads the live size back (12240x15840)',
      rb === '12240x15840', `size=${rb}`);

    // --- 8. landscape + Apply swaps the WxH pair ---
    await page.check('input[name="ps-orient"][value="landscape"]');
    await page.click('#btn-ps-apply');
    await sleep(400);
    const m2 = await page.evaluate(() => window.__L4_PAGESIZE__());
    check('Orientation landscape + Apply swaps data-page-w/h (15840 x 12240)',
      m2.w === '15840' && m2.h === '12240' && m2.orient === 'landscape',
      `${m2.w}x${m2.h} ${m2.orient}`);

    // --- 9. negative: Cancel mutates nothing ---
    await openViaButton(page);
    await page.selectOption('#ps-size', '8391x11906');
    await page.click('#btn-ps-cancel');
    await sleep(300);
    const m3 = await page.evaluate(() => window.__L4_PAGESIZE__());
    const closed3 = await page.evaluate(() =>
      !document.getElementById('page-setup-dialog').classList.contains('open'));
    check('Cancel mutates nothing (marker keeps landscape Letter geometry), dialog closes',
      closed3 && m3.w === '15840' && m3.h === '12240' && m3.orient === 'landscape',
      `closed=${closed3} ${m3.w}x${m3.h} ${m3.orient}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'pagesize-dialog-l4',
    feature: 'dialog.page-size-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    oo_fields: oo.fields,
    oo_buttons: oo.buttons,
    trigger: oo.trigger,
    checks,
    declaredGaps: [
      'Width/Height: free numeric custom size carried by mechanism — Size option values are '
      + '"WxH" twips and Apply writes data-page-w/data-page-h; no separate spinners '
      + '(recorded divergence, not gated)',
    ],
    contract: {
      open: 'real clicks: census route Layout > Size > "Custom page size" (data-cmd openPageSetup) '
        + 'AND ribbon #btn-page-setup (shared dialog)',
      title: 'Page setup',
      wo_dialog: 'page-setup-dialog',
      fields: [
        { label: 'Preset', tag: 'select', maps: 'Size', options: '13 "WxH" twip presets + Custom (default 11906x16838 = A4)' },
      ],
      buttons: ['Cancel', 'Apply'],
      behavior: 'Size preset -> Apply writes div.page-setup[data-page-w][data-page-h] at body start '
        + '(flat HTML, w:sectPr round-trip); landscape swaps the pair; reopen reads the live size '
        + 'back into the select; Cancel plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-pagesize-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-pagesize-dialog: ERROR', e);
  process.exit(1);
});
