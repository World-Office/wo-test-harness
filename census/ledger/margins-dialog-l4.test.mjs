#!/usr/bin/env node
/**
 * ledger/margins-dialog-l4.test.mjs — L4 FIDELITY probe: the OO Margins
 * dialog (census-oo-dialogs.json, tab "layout", trigger
 * "menu-item:Custom margins") measured live against the RUNNING editor
 * (local static serve + stubbed fetch, watermark-dialog-l4 pattern).
 *
 * Census-driven contract (ledger/build.py LAYOUT_L4_GOLD, FXG-B): the OO
 * field contract is MINED from the committed census at probe time (never
 * re-declared here — a retitled/rewritten census dialog fails this probe)
 * and measured against WO's shared Page-setup dialog:
 *   - open the way a user does — REAL clicks: Layout tab, then EITHER the
 *     ribbon button #btn-page-setup OR the census route Layout > Margins >
 *     "Custom margins" (button[data-cmd="openPageSetup"]);
 *   - fields: Size (14 "WxH" twip presets + Custom — the superset standing
 *     for OO's "Margins" preset combo), Orientation (Portrait/Landscape
 *     radios, default Portrait), Margins (inches) Top/Bottom/Left/Right
 *     (number, default 1) — every GATED OO field (Margins, Top, Bottom,
 *     Left, Right, Orientation) resolves to its censused WO control
 *     (census-wo-dialogs.json dialog page-setup-dialog);
 *   - buttons: Cancel + Apply (primary);
 *   - BEHAVIOR (fidelity, not surface): Apply plants the document-semantic
 *     section marker #editor > div.page-setup[data-page-w][data-page-h]
 *     [data-orient][data-margin-top/bottom/left/right] (inches x 1440
 *     twips) at body start, visible in the flat HTML (converter contract:
 *     w:sectPr round-trip, editor.js writePageSetupMarker); landscape
 *     swaps the WxH pair; reopen reads the live values back; Cancel
 *     plants nothing.
 *
 * Declared gaps (loud, never gated, per the LAYOUT_L4_GOLD deferred set):
 *   - "Gutter position": WO has no gutter model — deferred by the
 *     single data-margin-* twip set (recorded divergence, not gated);
 *   - "Multiple pages": OO's mirror/multiple-pages book layout is
 *     deferred (recorded divergence, not gated).
 *
 * Writes margins-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.margins-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-margins-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'margins-dialog-l4.json');
const CENSUS_OO = path.join(LEDGER_DIR, '..', 'census', 'census-oo-dialogs.json');
const CENSUS_TITLE = 'Margins';
const CENSUS_TRIGGER = 'menu-item:Custom margins';
const MENU_ITEM_I18N = 'Layout.Margins.Custom'; // "Custom margins"
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>Margins sentinel delta text.</p>';
const BOOT_MS = 2200;

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  return !!ok;
};

// Mine the OO field contract from the committed census (single source of
// truth — build.py LAYOUT_L4_GOLD mines the same dialog at build time;
// a census retitle/rewrite fails HERE, at the cause).
function mineOoCensus() {
  const d = JSON.parse(fs.readFileSync(CENSUS_OO, 'utf8'));
  const e = (d.dialogs || []).find(
    (x) => (x.dialog || {}).title === CENSUS_TITLE && x.tab === 'layout');
  if (!e) throw new Error(
    `census-oo-dialogs.json lost its tab:"layout" dialog ${JSON.stringify(CENSUS_TITLE)} `
    + '— re-pin the LAYOUT_L4_GOLD contract');
  const fields = (e.dialog.fields || [])
    .map((f) => f.label).filter(Boolean);
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
  window.__L4_MARGINS__ = function () {
    const ed = document.querySelector('#editor');
    const m = ed && ed.querySelector(':scope > div.page-setup');
    const flat = window.__WO_FLAT_HTML__();
    return {
      has: !!m,
      w: m ? m.getAttribute('data-page-w') : null,
      h: m ? m.getAttribute('data-page-h') : null,
      orient: m ? m.getAttribute('data-orient') : null,
      mt: m ? m.getAttribute('data-margin-top') : null,
      mb: m ? m.getAttribute('data-margin-bottom') : null,
      ml: m ? m.getAttribute('data-margin-left') : null,
      mr: m ? m.getAttribute('data-margin-right') : null,
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

// open the shared page-setup dialog the user way: real click on
// #btn-page-setup (evaluate-click: bypasses Playwright's viewport
// hit-testing, which intermittently fails when the ribbon strip scrolled)
async function openViaButton(page) {
  await ensureLayoutTab(page);
  const btn = await page.$('#btn-page-setup');
  await btn.evaluate((b) => b.click());
  await sleep(250);
}

// open via the census route: Layout > Margins > "Custom margins"
// (button[data-i18n="Layout.Margins.Custom"][data-cmd="openPageSetup"])
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
    check('census mine: OO "Margins" dialog (tab layout) — 8 fields, OK/Cancel, trigger',
      oo.fields.length === 8 && JSON.stringify(oo.buttons) === JSON.stringify(['OK', 'Cancel'])
      && oo.trigger === CENSUS_TRIGGER,
      `fields=${JSON.stringify(oo.fields)} buttons=${JSON.stringify(oo.buttons)} trigger=${oo.trigger}`);

    // --- 2. opens the user way: Layout tab + #btn-page-setup ---
    await openViaButton(page);
    check('open via real #btn-page-setup click (Layout tab)',
      await page.evaluate(dialogOpen));

    // --- 3..7 static contract while open (censused WO page-setup-dialog) ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('page-setup-dialog');
      const q = (s) => dlg.querySelector(s);
      const title = ((q('#page-setup-title') || {}).textContent || '').trim();
      const size = q('#ps-size');
      const opts = [...size.options].map((o) => ({ v: o.value, t: o.textContent.trim() }));
      const radios = [...dlg.querySelectorAll('input[name="ps-orient"]')].map((r) =>
        ({ value: r.value, checked: r.checked }));
      const lab = (forId, labelSel) => {
        const l = dlg.querySelector(labelSel) || dlg.querySelector(`label[for="${forId}"]`);
        return l ? (l.textContent || '').trim().replace(/\s+/g, ' ') : '';
      };
      const num = (id) => { const i = q('#' + id); return i ? { type: i.type, val: i.value,
        min: i.min, max: i.max } : null; };
      const cancel = q('#btn-ps-cancel'); const ok = q('#btn-ps-apply');
      return {
        title,
        sizeLabel: lab('ps-size', 'label[for="ps-size"]'), sizeOpts: opts, sizeVal: size.value,
        orientRadios: radios,
        orientLabel: lab('ps-orient', '.dialog-field:has(input[name="ps-orient"]) > label:first-child'),
        marginsLabel: lab('ps-mt', '.dialog-field:has(#ps-mt) > label'),
        mt: num('ps-mt'), mb: num('ps-mb'), ml: num('ps-ml'), mr: num('ps-mr'),
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!(ok && ok.classList.contains('primary')),
      };
    });
    check('title "Page setup" (WO shared page-setup dialog)', c.title === 'Page setup',
      JSON.stringify(c.title));
    check('field Size: 13 "WxH" twip presets + Custom (superset standing for OO "Margins" preset combo)',
      c.sizeLabel === 'Size' && c.sizeOpts.length === 14
      && c.sizeOpts.every((o, i) => i < 13 ? /^\d+x\d+$/.test(o.v) : o.v === 'custom')
      && c.sizeVal === '11906x16838',
      `label=${JSON.stringify(c.sizeLabel)} n=${c.sizeOpts.length} first=${c.sizeOpts[0] && c.sizeOpts[0].v} `
      + `last=${c.sizeOpts[13] && c.sizeOpts[13].v} default=${c.sizeVal}`);
    check('field Orientation: Portrait/Landscape radios (default Portrait)',
      c.orientRadios.length === 2
      && c.orientRadios.map((r) => r.value).join(',') === 'portrait,landscape'
      && c.orientRadios[0].checked === true,
      JSON.stringify(c.orientRadios));
    check('field Margins (inches): Top/Bottom/Left/Right number inputs (default 1.0 on open)',
      c.marginsLabel.startsWith('Margins (inches)')
      && c.mt && c.mb && c.ml && c.mr
      && [c.mt, c.mb, c.ml, c.mr].every((i) => i.type === 'number' && parseFloat(i.val) === 1),
      `label=${JSON.stringify(c.marginsLabel)} T/B/L/R=${c.mt && c.mt.val}/${c.mb && c.mb.val}/`
      + `${c.ml && c.ml.val}/${c.mr && c.mr.val}`);
    check('buttons Cancel + Apply(primary)',
      /^cancel$/i.test(c.cancel || '') && /^apply$/i.test(c.ok || '') && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} apply=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 8. census route: Layout > Margins > "Custom margins" reopens it ---
    await page.click('#btn-ps-cancel');
    await sleep(200);
    await openViaCensusRoute(page);
    check('census route: Layout > Margins > "Custom margins" (data-cmd openPageSetup) reopens the dialog',
      await page.evaluate(dialogOpen));

    // --- 9. behavior: Apply plants the twip marker (inches x 1440) ---
    await page.fill('#ps-mt', '2');
    await page.fill('#ps-mb', '1.5');
    await page.fill('#ps-ml', '1');
    await page.fill('#ps-mr', '0.5');
    await page.click('#btn-ps-apply');
    await sleep(400);
    const m1 = await page.evaluate(() => window.__L4_MARGINS__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('page-setup-dialog').classList.contains('open'));
    check('Apply (2 / 1.5 / 1 / 0.5 in, portrait) -> div.page-setup[data-margin-top=2880 '
      + 'bottom=2160 left=1440 right=720] 11906x16838 at body start (flat HTML)',
      closed1 && m1.has && m1.w === '11906' && m1.h === '16838' && m1.orient === 'portrait'
      && m1.mt === '2880' && m1.mb === '2160' && m1.ml === '1440' && m1.mr === '720'
      && m1.flatHas && m1.flatSentinel,
      `closed=${closed1} has=${m1.has} ${m1.w}x${m1.h} ${m1.orient} mt/mb/ml/mr=`
      + `${m1.mt}/${m1.mb}/${m1.ml}/${m1.mr} flat=${m1.flatHas}/${m1.flatSentinel}`);

    // --- 10. reopen reads the live margins back ---
    await openViaButton(page);
    const rb = await page.evaluate(() => ({
      mt: document.getElementById('ps-mt').value,
      mb: document.getElementById('ps-mb').value,
      ml: document.getElementById('ps-ml').value,
      mr: document.getElementById('ps-mr').value,
    }));
    check('reopen reads the live margins back (2.0 / 1.5 / 1.0 / 0.5)',
      rb.mt === '2.0' && rb.mb === '1.5' && rb.ml === '1.0' && rb.mr === '0.5',
      `T/B/L/R=${rb.mt}/${rb.mb}/${rb.ml}/${rb.mr}`);

    // --- 11. landscape + Apply swaps the WxH pair ---
    await page.check('input[name="ps-orient"][value="landscape"]');
    await page.click('#btn-ps-apply');
    await sleep(400);
    const m2 = await page.evaluate(() => window.__L4_MARGINS__());
    check('Orientation landscape + Apply swaps data-page-w/h (16838 x 11906), margins kept',
      m2.w === '16838' && m2.h === '11906' && m2.orient === 'landscape'
      && m2.mt === '2880' && m2.mr === '720',
      `${m2.w}x${m2.h} ${m2.orient} mt/mr=${m2.mt}/${m2.mr}`);

    // --- 12. negative: Cancel mutates nothing ---
    await openViaButton(page);
    await page.fill('#ps-mt', '3');
    await page.click('#btn-ps-cancel');
    await sleep(300);
    const m3 = await page.evaluate(() => window.__L4_MARGINS__());
    const closed3 = await page.evaluate(() =>
      !document.getElementById('page-setup-dialog').classList.contains('open'));
    check('Cancel mutates nothing (marker keeps the landscape geometry), dialog closes',
      closed3 && m3.w === '16838' && m3.h === '11906' && m3.orient === 'landscape'
      && m3.mt === '2880',
      `closed=${closed3} ${m3.w}x${m3.h} ${m3.orient} mt=${m3.mt}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'margins-dialog-l4',
    feature: 'dialog.margins-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    oo_fields: oo.fields,
    oo_buttons: oo.buttons,
    trigger: oo.trigger,
    checks,
    declaredGaps: [
      'Gutter position: WO has no gutter model — deferred by the .page-setup marker\'s single '
      + 'data-margin-* twip set (recorded divergence, not gated)',
      'Multiple pages: OO\'s mirror/multiple-pages book layout is deferred '
      + '(recorded divergence, not gated)',
    ],
    contract: {
      open: 'real clicks: Layout tab + ribbon #btn-page-setup AND the census route '
        + 'Layout > Margins > "Custom margins" (data-cmd openPageSetup)',
      title: 'Page setup',
      wo_dialog: 'page-setup-dialog',
      fields: [
        { label: 'Size', tag: 'select', options: '13 "WxH" twip presets + Custom (default 11906x16838 = A4)' },
        { label: 'Orientation', tag: 'radio', options: ['portrait', 'landscape'] },
        { label: 'Margins (inches)', tag: 'number', fields: ['Top', 'Bottom', 'Left', 'Right'], default: 1 },
      ],
      buttons: ['Cancel', 'Apply'],
      behavior: 'Apply plants div.page-setup[data-page-w][data-page-h][data-orient]'
        + '[data-margin-top/bottom/left/right] (inches x 1440 twips) at body start (flat HTML, '
        + 'w:sectPr round-trip); landscape swaps the WxH pair; reopen reads live values back; '
        + 'Cancel plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-margins-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-margins-dialog: ERROR', e);
  process.exit(1);
});
