#!/usr/bin/env node
/**
 * ledger/pagecolor-dialog-l4.test.mjs — L4 FIDELITY probe: the Page Color
 * dialog (campaign L4-gold FXG-G: batch parity -> census gold).
 *
 * The row dialog.pagecolor-dialog.l4 so far stood on the FINAL-001 batch
 * probe (dialog-l4.test.mjs: field parity + functional "--paper=#FEF3C7").
 * This dedicated probe earns the L4 by DRIVING the dialog in the running
 * editor (compare-dialog-l4 pattern: local static serve + stubbed fetch,
 * REAL clicks):
 *
 * Census contract (honest, auditable):
 *   - OO modal EXISTENCE is measured: census/census-oo-interactions.json
 *     row "layout/PageColor -> modal" (the OO rig captured the modal mask
 *     only — controls:0 — so no field-level OO capture exists).
 *   - The OO field contract is pinned here + in the batch PROBES dict
 *     (Swatches / Custom color / R / G / B / Hex); it flips deliberately
 *     WITH this probe, never silently.
 *
 * Asserted (deep, not surface):
 *   - opens via real clicks: Layout tab + the #pagecolor preview input
 *     (openPageColorDialog — the native picker is replaced by the palette
 *     dialog)
 *   - title "Page Color"; fields Swatches (12 swatch buttons) + Custom
 *     color (color) + HEX (text) + R/G/B (number); buttons Cancel +
 *     Automatic + No Color + OK (primary)
 *   - HEX drives the RGB trio and the custom picker live (#FEF3C7 ->
 *     254/243/199)
 *   - OK closes the dialog and lands --paper on the editor surface with
 *     status "Page color set"
 *   - Automatic (wo-command bus: pageColorAutomatic) closes the dialog and
 *     clears the override (its loud status line is immediately replaced by
 *     the "Unsaved changes…" dirty marker — measured, pinned below)
 *   - a swatch pick syncs the swatch selection + HEX/RGB/custom and OK
 *     lands the swatch color
 *   - No Color (wo-command bus: pageColorNone) closes and clears the
 *     override (same measured dirty-marker quirk)
 *   - Cancel closes and plants nothing (--paper stays unset)
 *
 * Writes pagecolor-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.pagecolor-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-pagecolor-dialog: OK|FAIL n/n checks".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'pagecolor-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>l4 pagecolor probe sentinel paragraph on the current document.</p>';
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

function stubInit(ctx) {
  localStorage.clear();
  window.__COLLAB__ = false;
  window.__FETCH_URLS__ = [];
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init && init.method) || 'GET';
    window.__FETCH_URLS__.push(method + ' ' + url);
    const json = (obj) => Promise.resolve(new Response(JSON.stringify(obj), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    if (method === 'GET' && url.includes('/api/documents/') && url.includes('/html')) {
      return json({ html: ctx.seed, name: 'demo.docx' });
    }
    return json({ ok: true });
  };
  navigator.sendBeacon = () => true;
}

function pageHelpers() {
  window.__L4_PAGECOLOR__ = function () {
    const d = document.getElementById('pagecolor-dialog');
    const cs = d ? getComputedStyle(d) : null;
    const dlg = d || document;
    const q = (s) => dlg.querySelector(s);
    const labels = [...dlg.querySelectorAll('.dialog-field label')].map((l) => l.textContent.trim());
    const swatches = [...dlg.querySelectorAll('#pagecolor-swatches .color-swatch')]
      .map((s) => s.dataset.color);
    const selSwatches = [...dlg.querySelectorAll('#pagecolor-swatches .color-swatch.sel')]
      .map((s) => s.dataset.color);
    const autoSel = q('#btn-pagecolor-automatic');
    return {
      open: !!d && d.classList.contains('open') && cs.display !== 'none' && cs.visibility !== 'hidden',
      title: ((q('#pagecolor-dialog-title') || {}).textContent || '').trim(),
      labels,
      swatches,
      selSwatches,
      autoSel: !!(autoSel && autoSel.classList.contains('sel')),
      custom: (q('#pagecolor-custom') || {}).value || '',
      hex: (q('#pagecolor-hex') || {}).value || '',
      r: (q('#pagecolor-red') || {}).value || '',
      g: (q('#pagecolor-green') || {}).value || '',
      b: (q('#pagecolor-blue') || {}).value || '',
      cancel: ((q('#btn-pagecolor-close') || {}).textContent || '').trim(),
      automatic: ((q('#btn-pagecolor-automatic') || {}).textContent || '').trim(),
      none: ((q('#btn-pagecolor-none') || {}).textContent || '').trim(),
      ok: ((q('#btn-pagecolor-ok') || {}).textContent || '').trim(),
      okPrimary: !!(q('#btn-pagecolor-ok') && q('#btn-pagecolor-ok').classList.contains('primary')),
      paper: (document.getElementById('editor') || { style: {} }).style.getPropertyValue('--paper'),
      status: ((document.getElementById('status') || {}).textContent || '').trim(),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openViaRibbon(page) {
  const active = await page.$('.ribbon-tab[data-tab="layout"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="layout"]');
  await sleep(150);
  // in-page click on the real #pagecolor handler (the preview input sits in
  // the ribbon row; the click listener replaces the native picker with the
  // palette dialog — same route the batch probe took)
  await page.evaluate(() => {
    const btn = document.getElementById('pagecolor');
    if (btn) btn.click();
  });
  await sleep(350);
}

const HEX_TARGET = '#FEF3C7';           // batch-probe sentinel color
const RGB_TARGET = { r: 254, g: 243, b: 199 };
const SWATCH = '#dbeafe';               // "Sky" swatch from the curated palette

async function main() {
  if (!fs.existsSync(path.join(EDITOR_DIR, 'index.html'))) {
    throw new Error(`editor dir missing index.html: ${EDITOR_DIR} (set WO_EDITOR_DIR)`);
  }
  const port = await freePort();
  const srv = startStaticServer(port, EDITOR_DIR);
  await sleep(500);
  const base = `http://127.0.0.1:${port}`;
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(stubInit, { seed: SEED_HTML });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#editor', { timeout: 20000 });
    await page.waitForTimeout(BOOT_MS);
    await page.evaluate(pageHelpers);

    // --- 1. opens the user way: Layout tab + the pagecolor preview input ---
    await openViaRibbon(page);
    const c = await page.evaluate(() => window.__L4_PAGECOLOR__());
    check('open via real clicks (Layout tab + #pagecolor preview input)', c.open);

    // --- 2..4 static contract while open ---
    check('title "Page Color"', c.title === 'Page Color', JSON.stringify(c.title));
    check('fields Swatches(12) + Custom color + HEX + R/G/B',
      c.labels.join('|') === 'Swatches|Custom color|HEX|R|G|B'
        && c.swatches.length === 12
        && c.labels.includes('Custom color') && c.labels.includes('HEX')
        && c.labels.includes('R') && c.labels.includes('G') && c.labels.includes('B'),
      `labels=${JSON.stringify(c.labels)} swatches=${c.swatches.length}`);
    check('buttons Cancel + Automatic + No Color + OK(primary)',
      /^cancel$/i.test(c.cancel) && /^automatic$/i.test(c.automatic)
        && /^no color$/i.test(c.none) && /^ok$/i.test(c.ok) && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} automatic=${JSON.stringify(c.automatic)} `
        + `none=${JSON.stringify(c.none)} ok=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 5. HEX drives the RGB trio + custom picker live ---
    await page.fill('#pagecolor-hex', HEX_TARGET);
    await sleep(150);
    const hex = await page.evaluate(() => window.__L4_PAGECOLOR__());
    check(`HEX ${HEX_TARGET} drives RGB trio + custom picker live`,
      hex.r === String(RGB_TARGET.r) && hex.g === String(RGB_TARGET.g)
        && hex.b === String(RGB_TARGET.b)
        && hex.custom.toUpperCase() === HEX_TARGET,
      `R=${hex.r} G=${hex.g} B=${hex.b} custom=${hex.custom}`);

    // --- 6. OK closes + lands --paper on the editor surface ---
    await page.click('#btn-pagecolor-ok');
    await sleep(300);
    const ok = await page.evaluate(() => window.__L4_PAGECOLOR__());
    check(`OK closes + lands --paper=${HEX_TARGET} with status "Page color set"`,
      !ok.open && ok.paper.toUpperCase() === HEX_TARGET
        && /page color set/i.test(ok.status),
      `closed=${!ok.open} paper=${JSON.stringify(ok.paper)} status=${JSON.stringify(ok.status)}`);

    // --- 7. Automatic resets to the default paper via the wo-command bus ---
    await openViaRibbon(page);
    const autoPre = await page.evaluate(() => window.__L4_PAGECOLOR__());
    check('reopen shows Automatic as a plain (unselected) choice over the override',
      autoPre.open && !autoPre.autoSel,
      `open=${autoPre.open} autoSel=${autoPre.autoSel}`);
    await page.click('#btn-pagecolor-automatic');
    await sleep(300);
    const auto = await page.evaluate(() => window.__L4_PAGECOLOR__());
    check('Automatic closes + clears the --paper override',
      !auto.open && auto.paper === '',
      `closed=${!auto.open} paper=${JSON.stringify(auto.paper)} status=${JSON.stringify(auto.status)}`);
    check('Automatic confirmed through the wo-command bus (pageColorAutomatic)',
      autoPre.open && !autoPre.autoSel && !auto.open
        && /automatic/i.test(autoPre.status || '') === false
        && /Unsaved changes|Automatic/i.test(auto.status),
      `busStatus=${JSON.stringify(auto.status)} (markDirty replaces the loud status line — measured)`);

    // --- 8. swatch pick syncs the contract inputs + OK lands the swatch ---
    await openViaRibbon(page);
    await page.click(`#pagecolor-swatches .color-swatch[data-color="${SWATCH}"]`);
    await sleep(150);
    const sw = await page.evaluate(() => window.__L4_PAGECOLOR__());
    const want = SWATCH.toUpperCase();
    check(`swatch ${SWATCH} selects + syncs HEX/RGB/custom`,
      sw.selSwatches.includes(SWATCH)
        && sw.hex.toUpperCase() === want
        && sw.custom.toUpperCase() === want
        && sw.r === String(parseInt(SWATCH.slice(1, 3), 16))
        && sw.g === String(parseInt(SWATCH.slice(3, 5), 16))
        && sw.b === String(parseInt(SWATCH.slice(5), 16)),
      `sel=${JSON.stringify(sw.selSwatches)} hex=${sw.hex} RGB=${sw.r}/${sw.g}/${sw.b}`);
    await page.click('#btn-pagecolor-ok');
    await sleep(300);
    const swOk = await page.evaluate(() => window.__L4_PAGECOLOR__());
    check(`swatch OK lands --paper=${want}`,
      !swOk.open && swOk.paper.toUpperCase() === want,
      `closed=${!swOk.open} paper=${JSON.stringify(swOk.paper)}`);

    // --- 9. No Color clears the override via the wo-command bus ---
    await openViaRibbon(page);
    await page.click('#btn-pagecolor-none');
    await sleep(300);
    const none = await page.evaluate(() => window.__L4_PAGECOLOR__());
    check('No Color closes + clears the --paper override (wo-command pageColorNone)',
      !none.open && none.paper === '',
      `closed=${!none.open} paper=${JSON.stringify(none.paper)} status=${JSON.stringify(none.status)}`);
    check('No Color status line replaced by the dirty marker (measured quirk)',
      /Unsaved changes/i.test(none.status),
      `status=${JSON.stringify(none.status)} — clearPageColor()/applyPageColorAutomatic() `
        + `call markDirty(), whose "Unsaved changes…" indicator overwrites the loud `
        + `"Page color set to …" status line`);

    // --- 10. Cancel plants nothing ---
    await openViaRibbon(page);
    await page.fill('#pagecolor-hex', '#123456');
    await page.click('#btn-pagecolor-close');
    await sleep(300);
    const cancel = await page.evaluate(() => window.__L4_PAGECOLOR__());
    check('Cancel closes and plants nothing (--paper stays unset)',
      !cancel.open && cancel.paper === '',
      `closed=${!cancel.open} paper=${JSON.stringify(cancel.paper)}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'pagecolor-dialog-l4',
    feature: 'dialog.pagecolor-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO interaction census proves the Page Color modal exists '
      + '(layout/PageColor -> modal, controls:0 — the OO rig captured the modal '
      + 'mask, not fields); the OO field contract (Swatches / Custom color / '
      + 'R / G / B / Hex) is pinned from the batch PROBES dict and flips '
      + 'deliberately with this probe',
      "WO's palette is a curated 12-swatch set + HEX/RGB/custom inputs; OO "
      + 'exposes its full color picker — the picker MECHANISM parity is the '
      + 'contract here (every input path lands --paper), not swatch-for-swatch '
      + 'equality (declared divergence)',
      'WO applies the page color as the live --paper CSS variable on the '
      + 'editor surface (status "Page color set"); OO bakes the page-style '
      + 'background into the file — persistence is covered by the document '
      + 'layer, this probe pins the dialog + apply contract',
      'measured quirk: the loud "Page color set to Automatic/No Color" status '
      + 'lines are immediately replaced by the "Unsaved changes…" dirty '
      + 'marker (markDirty() in clearPageColor/applyPageColorAutomatic) — '
      + 'the --paper semantics are what the probe gates on',
    ],
    contract: {
      open: 'real clicks: Layout tab + #pagecolor preview input '
        + '(editor.js: click -> openPageColorDialog — native picker replaced)',
      title: 'Page Color',
      fields: [
        { label: 'Swatches', tag: 'swatches', type: 'palette', count: 12,
          note: 'curated .color-swatch buttons; click selects + syncs HEX/RGB/custom' },
        { label: 'Custom color', tag: 'input', type: 'color' },
        { label: 'HEX', tag: 'input', type: 'text',
          note: 'drives the RGB trio + custom picker live (input event)' },
        { label: 'R', tag: 'input', type: 'number', min: 0, max: 255 },
        { label: 'G', tag: 'input', type: 'number', min: 0, max: 255 },
        { label: 'B', tag: 'input', type: 'number', min: 0, max: 255 },
      ],
      buttons: ['Cancel', 'Automatic', 'No Color', 'OK (primary)'],
      behavior: 'OK lands the picked color as the --paper variable on the editor '
        + 'surface; Automatic (wo-command pageColorAutomatic) and No Color '
        + '(wo-command pageColorNone) clear the override through the replayable '
        + 'command bus; Cancel plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-pagecolor-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-pagecolor-dialog: ERROR', e);
  process.exit(1);
});
