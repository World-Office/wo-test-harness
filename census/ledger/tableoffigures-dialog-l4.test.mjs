#!/usr/bin/env node
/**
 * ledger/tableoffigures-dialog-l4.test.mjs — L4 FIDELITY probe: the Table
 * of Figures dialog's field/button contract, measured against the RUNNING
 * editor (local static serve + stubbed fetch, bookmark-dialog-l4 pattern).
 *
 * Contract (campaign comprehensive-parity, task FINAL-001): open the dialog
 * the way a user does — REAL clicks: the References tab, then the ribbon
 * button for Table of figures (editor.js: insertTableOfFigures) — then assert
 *   - title "TableOfFigures.Title" (localized) or "Insert table of figures"
 *   - fields: Label (select), Style (select)
 *   - buttons: Cancel + Insert (primary)
 *   - BEHAVIOR (fidelity, not surface): Label "Figure" + Style "Formal" +
 *     Insert plants div.tof[data-label="Figure"][data-style="Formal"] at
 *     the caret (visible in the flat HTML); Cancel plants nothing.
 *
 * Declared gap (loud, never parity): the committed OO dialog census carries
 * a "Table of figures" modal with fields: Show page numbers, Right align
 * page numbers, Leader, Format table of figures as links, Build table of
 * figures from, Include label and number, Styles (OO only) — WO ships Label
 * + Style only; OO fields beyond these two are deferred as recorded divergence;
 * WO's tof marker writes the document-semantic div.tof marker lazy-rendered
 * into the flat HTML by the converters (editor.js confirmTableOfFiguresDialog).
 *
 * Writes tableoffigures-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.tableoffigures-dialog.l4; level 4 only
 * when every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-tableoffigures-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'tableoffigures-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>TOF sentinel hotel text.</p>';
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
  window.__L4_CARET__ = function () {
    const ed = document.querySelector('#editor');
    const p = ed && ed.querySelector('p');
    if (!p) return 'no-p';
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const tn = walker.nextNode();
    if (!tn) return 'no-text';
    const r = document.createRange();
    r.setStart(tn, 0);
    r.setEnd(tn, 0);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    ed.focus();
    return 'ok';
  };
  window.__L4_TOF__ = function () {
    const ed = document.querySelector('#editor');
    const tof = ed && ed.querySelector('div.tof');
    const flat = window.__WO_FLAT_HTML__();
    return {
      has: !!tof,
      n: ed ? ed.querySelectorAll('div.tof').length : 0,
      label: tof ? tof.getAttribute('data-label') : null,
      style: tof ? tof.getAttribute('data-style') : null,
      flatLabel: tof && flat.includes('data-label="Figure"'),
      flatStyle: tof && flat.includes('data-style="Formal"'),
      flatClass: flat.includes('class="tof"') || flat.includes('div.tof'),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openViaRibbon(page) {
  const active = await page.$('.ribbon-tab[data-tab="references"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="references"]');
  await sleep(150);
  const btn = await page.$('[data-cmd="insertTableOfFigures"], #btn-tableoffigures');
  if (btn) await btn.click();
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

    // --- 1. opens the user way: References tab + insertTableOfFigures ---
    await openViaRibbon(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('tableoffigures-dialog');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    check('open via real clicks (References tab + insertTableOfFigures)', openRes);

    // --- 2..4 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('tableoffigures-dialog');
      const q = (s) => dlg.querySelector(s);
      const title = (q('#tableoffigures-dialog-title') || {}).textContent || '';
      const tofLabel = q('#tof-label');
      const tofStyle = q('#tof-style');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const cancel = q('#btn-tof-close, #btn-tof-cancel'); const ok = q('#btn-tof-ok, #btn-tof-insert');
      return {
        title: title.trim(),
        labelLabel: lab('tof-label'), labelTag: tofLabel ? tofLabel.tagName.toLowerCase() : null,
        styleLabel: lab('tof-style'), styleTag: tofStyle ? tofStyle.tagName.toLowerCase() : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!(ok && ok.classList.contains('primary')),
      };
    });
    check('title contains "Table of figures"', c.title.toLowerCase().includes('table of figures'), JSON.stringify(c.title));
    check('field Label: select',
      c.labelLabel === 'Label' && c.labelTag === 'select',
      `${JSON.stringify(c.labelLabel)} ${c.labelTag}`);
    check('field Style: select',
      c.styleLabel === 'Style' && c.styleTag === 'select',
      `${JSON.stringify(c.styleLabel)} ${c.styleTag}`);
    check('buttons Cancel + Insert(primary)',
      /^cancel$/i.test(c.cancel || '') && /^insert$/i.test(c.ok || '') && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} insert=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 5. behavior: caret + Label "Figure" + Style "Formal" + Insert -> div.tof ---
    await page.evaluate(() => window.__L4_CARET__());
    await page.select('#tof-label', 'Figure');
    await page.select('#tof-style', 'Formal');
    await page.click('#btn-tof-ok, #btn-tof-insert');
    await sleep(400);
    const tof1 = await page.evaluate(() => window.__L4_TOF__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('tableoffigures-dialog').classList.contains('open'));
    check('bare caret + Label "Figure" + Style "Formal" + Insert -> div.tof[data-label][data-style] (flat HTML)',
      closed1 && tof1.has && tof1.label === 'Figure' && tof1.style === 'Formal'
      && tof1.flatLabel && tof1.flatStyle && tof1.flatClass,
      `has=${tof1.has} label=${JSON.stringify(tof1.label)} style=${JSON.stringify(tof1.style)} `
      + `flat=${tof1.flatLabel}/${tof1.flatStyle}/${tof1.flatClass} closed=${closed1}`);

    // --- 6. cancel plants nothing ---
    await openViaRibbon(page);
    await page.click('#btn-tof-close, #btn-tof-cancel');
    await sleep(300);
    const tof2 = await page.evaluate(() => window.__L4_TOF__());
    const closed2 = await page.evaluate(() =>
      !document.getElementById('tableoffigures-dialog').classList.contains('open'));
    check('cancel plants nothing (single tof)', closed2 && tof2.n === 1,
      `n=${tof2.n} closed=${closed2}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'tableoffigures-dialog-l4',
    feature: 'dialog.tableoffigures-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO dialog census carries a "Table of figures" modal with fields: '
      + 'Show page numbers, Right align page numbers, Leader, Format as links, '
      + 'Build from, Include label and number, Styles — WO ships Label + Style only; '
      + 'OO fields beyond these two are deferred as recorded divergence '
      + '(census-oo-dialogs.json has the full OO contract)',
      'WO writes the document-semantic div.tof marker lazy-rendered into the flat '
      + 'HTML by the converters (editor.js confirmTableOfFiguresDialog)'
    ],
    contract: {
      open: 'real clicks: References tab + insertTableOfFigures cmd (editor.js: insertTableOfFigures)',
      title: 'TableOfFigures.Title / Insert table of figures',
      fields: [
        { label: 'Label', tag: 'select', type: 'select', options: ['Figure'] },
        { label: 'Style', tag: 'select', type: 'select', options: ['Formal', 'Simple'] },
      ],
      buttons: ['Cancel', 'Insert'],
      behavior: 'Label + Style + Insert plants div.tof[data-label][data-style] at the '
        + 'caret (DOC-semantic marker, survives serialization into flat HTML); '
        + 'Cancel plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-tableoffigures-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-tableoffigures-dialog: ERROR', e);
  process.exit(1);
});
