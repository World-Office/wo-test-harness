#!/usr/bin/env node
/**
 * ledger/crossref-dialog-l4.test.mjs — L4 FIDELITY probe: the Insert
 * Cross-reference dialog's field/button contract, measured against the RUNNING
 * editor (local static serve + stubbed fetch, bookmark-dialog-l4 pattern).
 *
 * Contract (campaign comprehensive-parity, task FINAL-001): open the dialog
 * the way a user does — REAL clicks: the References tab, then the ribbon
 * button for Cross-reference (editor.js: openCrossref) — then assert
 *   - title "Insert cross-reference"
 *   - fields: Target bookmark (select), Display text (text input)
 *   - buttons: Cancel + Insert (primary)
 *   - BEHAVIOR (fidelity, not surface): requires a pre-existing bookmark
 *     (inserted via bookmark-dialog); with a bookmark named "mark1" in the
 *     document: select "mark1" + custom display text + Insert plants
 *     span.crossref[data-target="mark1"][data-display-text="custom"] at the
 *     caret (visible in the flat HTML); Cancel plants nothing.
 *
 * Declared gap (loud, never parity): the committed OO dialog census carries
 * a "Cross-reference" modal with fields: Reference type, Insert reference to,
 * Insert as link, Include above/below, Separate numbers with (OO only) -
 * WO ships Target bookmark + Display text; OO fields deferred as recorded
 * divergence; WO's crossref marker writes the document-semantic span with
 * data-target and data-display-text attrs (editor.js confirmCrossrefDialog).
 *
 * Writes crossref-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.crossref-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-crossref-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'crossref-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>Crossref sentinel <span class="bookmark" data-name="mark1">hotel</span> text.</p>';
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
  window.__L4_CROSSREF__ = function () {
    const ed = document.querySelector('#editor');
    const cr = ed && ed.querySelector('span.crossref');
    const flat = window.__WO_FLAT_HTML__();
    return {
      has: !!cr,
      n: ed ? ed.querySelectorAll('span.crossref').length : 0,
      target: cr ? cr.getAttribute('data-target') : null,
      display: cr ? cr.getAttribute('data-display-text') : null,
      flatTarget: flat.includes('data-target="mark1"'),
      flatClass: flat.includes('crossref'),
      flatDisplay: flat.includes('custom-ref'),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openViaRibbon(page) {
  const active = await page.$('.ribbon-tab[data-tab="references"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="references"]');
  await sleep(150);
  const btn = await page.$('button[data-cmd="openCrossref"], #btn-crossref');
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

    // --- 1. opens the user way: References tab + openCrossref ---
    await openViaRibbon(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('crossref-dialog');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    check('open via real clicks (References tab + openCrossref)', openRes);

    // --- 2..4 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('crossref-dialog');
      const q = (s) => dlg.querySelector(s);
      const title = (q('#crossref-dialog-title') || {}).textContent || '';
      const target = q('#crossref-target');
      const display = q('#crossref-display-text');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const cancel = q('#btn-crossref-close, #btn-crossref-cancel'); const ok = q('#btn-crossref-ok, #btn-crossref-insert');
      return {
        title: title.trim(),
        targetLabel: lab('crossref-target'), targetTag: target ? target.tagName.toLowerCase() : null,
        displayLabel: lab('crossref-display-text'), displayType: display ? display.type : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!(ok && ok.classList.contains('primary')),
      };
    });
    check('title "Insert cross-reference"', c.title === 'Insert cross-reference', JSON.stringify(c.title));
    check('field Target bookmark: select',
      c.targetLabel === 'Target bookmark' && c.targetTag === 'select',
      `${JSON.stringify(c.targetLabel)} ${c.targetTag}`);
    check('field Display text: text input',
      c.displayLabel === 'Display text' && c.displayType === 'text',
      `${JSON.stringify(c.displayLabel)} ${c.displayType}`);
    check('buttons Cancel + Insert(primary)',
      /^cancel$/i.test(c.cancel || '') && /^insert$/i.test(c.ok || '') && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} insert=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 5. behavior: select mark1 + custom display text + Insert -> span.crossref ---
    await openViaRibbon(page);
    await page.select('#crossref-target', 'mark1');
    await page.fill('#crossref-display-text', 'custom-ref');
    await page.evaluate(() => window.__L4_CARET__());
    await page.click('#btn-crossref-ok, #btn-crossref-insert');
    await sleep(400);
    const cr1 = await page.evaluate(() => window.__L4_CROSSREF__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('crossref-dialog').classList.contains('open'));
    check('select mark1 + "custom-ref" + Insert -> span.crossref[data-target][data-display-text] (flat HTML)',
      closed1 && cr1.has && cr1.target === 'mark1' && cr1.display === 'custom-ref'
      && cr1.flatTarget && cr1.flatClass && cr1.flatDisplay && cr1.n >= 1,
      `has=${cr1.has} target=${JSON.stringify(cr1.target)} display=${JSON.stringify(cr1.display)} `
      + `flat=${cr1.flatTarget}/${cr1.flatClass}/${cr1.flatDisplay} n=${cr1.n} closed=${closed1}`);

    // --- 6. cancel plants nothing ---
    await openViaRibbon(page);
    await page.click('#btn-crossref-close, #btn-crossref-cancel');
    await sleep(300);
    const cr2 = await page.evaluate(() => window.__L4_CROSSREF__());
    const closed2 = await page.evaluate(() =>
      !document.getElementById('crossref-dialog').classList.contains('open'));
    check('cancel plants nothing (single crossref)', closed2 && cr2.n === 1,
      `n=${cr2.n} closed=${closed2}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'crossref-dialog-l4',
    feature: 'dialog.crossref-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO dialog census carries a "Cross-reference" modal with fields: '
      + 'Reference type, Insert reference to, Insert as link, Include above/below, '
      + 'Separate numbers with — WO ships Target bookmark + Display text only; OO '
      + 'fields beyond these two are deferred as recorded divergence (census-oo-dialogs.json '
      + 'has the full OO contract)',
      'WO writes the document-semantic span.crossref marker with data-target and '
      + 'data-display-text attrs lazy-rendered into the flat HTML by the converters '
      + '(editor.js confirmCrossrefDialog)'
    ],
    contract: {
      open: 'real clicks: References tab + ribbon openCrossref (editor.js: openCrossref)',
      title: 'Insert cross-reference',
      fields: [
        { label: 'Target bookmark', tag: 'select', type: 'select' },
        { label: 'Display text', tag: 'input', type: 'text' },
      ],
      buttons: ['Cancel', 'Insert'],
      behavior: 'requires a pre-existing bookmark; Target bookmark + Display text + Insert '
        + 'plants span.crossref[data-target][data-display-text] at the caret (DOC-semantic '
        + 'marker, survives serialization into flat HTML); Cancel plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-crossref-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-crossref-dialog: ERROR', e);
  process.exit(1);
});
