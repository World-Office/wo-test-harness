#!/usr/bin/env node
/**
 * ledger/toc-dialog-l4.test.mjs — L4 FIDELITY probe: the Insert Table of
 * Contents dialog's field/button contract, measured against the RUNNING
 * editor (local static serve + stubbed fetch, bookmark-dialog-l4 pattern).
 *
 * Contract (campaign comprehensive-parity, task FINAL-001): open the dialog
 * the way a user does — REAL clicks: the References tab, then the ribbon
 * button #btn-toc (editor.js: toc) — then assert
 *   - title "Insert table of contents"
 *   - fields: Title (text input)
 *   - buttons: Cancel + Insert (primary)
 *   - BEHAVIOR (fidelity, not surface): Title "My TOC" + Insert plants
 *     div.toc[data-title="My TOC"] at the caret (visible in the flat HTML);
 *     Cancel plants nothing.
 *
 * Declared gap (loud, never parity): the committed OO dialog census carries
 * a "Table of contents" modal with fields: Show page numbers, Right align
 * page numbers, Leader, Format table of contents as links, Build table of
 * contents from, Levels, Styles (OO only) — WO ships the Title field only;
 * OO fields deferred as recorded divergence; WO's toc marker writes the
 * document-semantic div.toc marker lazy-rendered into the flat HTML by
 * the converters ( editor.js confirmTocDialog ).
 *
 * Writes toc-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.toc-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-toc-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'toc-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>TOC sentinel hotel text.</p>';
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
  window.__L4_TOC__ = function () {
    const ed = document.querySelector('#editor');
    const toc = ed && ed.querySelector('div.toc');
    const flat = window.__WO_FLAT_HTML__();
    return {
      has: !!toc,
      title: toc ? toc.getAttribute('data-title') : null,
      flatTitle: toc && flat.includes('data-title="My TOC"'),
      flatClass: flat.includes('class="toc"') || flat.includes('div.toc'),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openViaRibbon(page) {
  const active = await page.$('.ribbon-tab[data-tab="references"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="references"]');
  await sleep(150);
  await page.click('#btn-toc');
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

    // --- 1. opens the user way: References tab + #btn-toc ---
    await openViaRibbon(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('toc-dialog');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    check('open via real clicks (References tab + #btn-toc)', openRes);

    // --- 2..4 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('toc-dialog');
      const q = (s) => dlg.querySelector(s);
      const title = (q('#toc-dialog-title') || {}).textContent || '';
      const tocTitle = q('#toc-title');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const cancel = q('#btn-toc-close, #btn-toc-cancel'); const ok = q('#btn-toc-ok, #btn-toc-insert');
      return {
        title: title.trim(),
        titleLabel: lab('toc-title'), titleType: tocTitle ? tocTitle.type : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!(ok && ok.classList.contains('primary')),
      };
    });
    check('title "Insert table of contents"', c.title === 'Insert table of contents', JSON.stringify(c.title));
    check('field Title: text input',
      c.titleLabel === 'Title' && c.titleType === 'text',
      `${JSON.stringify(c.titleLabel)} ${c.titleType}`);
    check('buttons Cancel + Insert(primary)',
      /^cancel$/i.test(c.cancel || '') && /^insert$/i.test(c.ok || '') && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} insert=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 5. behavior: caret + Title "My TOC" + Insert -> div.toc[data-title] ---
    await page.evaluate(() => window.__L4_CARET__());
    await page.fill('#toc-title', 'My TOC');
    await page.click('#btn-toc-ok, #btn-toc-insert');
    await sleep(400);
    const t1 = await page.evaluate(() => window.__L4_TOC__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('toc-dialog').classList.contains('open'));
    check('bare caret + "My TOC" + Insert -> div.toc[data-title="My TOC"] (flat HTML)',
      closed1 && t1.has && t1.title === 'My TOC' && t1.flatTitle && t1.flatClass,
      `has=${t1.has} title=${JSON.stringify(t1.title)} flat=${t1.flatTitle}/${t1.flatClass} closed=${closed1}`);

    // --- 6. cancel plants nothing ---
    await openViaRibbon(page);
    await page.click('#btn-toc-close, #btn-toc-cancel');
    await sleep(300);
    const t2 = await page.evaluate(() => window.__L4_TOC__());
    const closed2 = await page.evaluate(() =>
      !document.getElementById('toc-dialog').classList.contains('open'));
    check('cancel plants nothing (single toc)', closed2 && t2.has && t2.title === 'My TOC',
      `has=${t2.has} title=${JSON.stringify(t2.title)} closed=${closed2}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'toc-dialog-l4',
    feature: 'dialog.toc-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO dialog census carries a "Table of contents" modal with fields: '
      + 'Show page numbers, Right align page numbers, Leader, Format table of contents as links, '
      + 'Build table of contents from, Levels, Styles — WO ships the Title field only; OO fields beyond '
      + 'Title are deferred as recorded divergence (census-oo-dialogs.json has the full OO contract)',
      'WO writes the document-semantic div.toc marker lazy-rendered into the flat '
      + 'HTML by the converters (editor.js confirmTocDialog)'
    ],
    contract: {
      open: 'real clicks: References tab + ribbon #btn-toc (editor.js: toc)',
      title: 'Insert table of contents',
      fields: [
        { label: 'Title', tag: 'input', type: 'text' },
      ],
      buttons: ['Cancel', 'Insert'],
      behavior: 'Title + Insert plants div.toc[data-title] at the caret (DOC-semantic '
        + 'marker, survives serialization into flat HTML); Cancel plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-toc-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-toc-dialog: ERROR', e);
  process.exit(1);
});
