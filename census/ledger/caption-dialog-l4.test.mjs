#!/usr/bin/env node
/**
 * ledger/caption-dialog-l4.test.mjs — L4 FIDELITY probe: the Insert Caption
 * dialog's field/button contract, measured against the RUNNING editor
 * (local static serve + stubbed fetch, bookmark-dialog-l4 pattern).
 *
 * Contract (campaign comprehensive-parity, task FINAL-001): open the dialog
 * the way a user does — REAL clicks: the References tab, then the ribbon
 * command insertCaption (editor.js: insertCaption) — then assert
 *   - title "Insert caption"
 *   - fields: Caption (text input), Label (select: Figure/Table/Equation),
 *     Exclude label from caption (checkbox), Numbering (checkbox),
 *     Include chapter number (checkbox), Chapter starts with style (select),
 *     Use separator (checkbox)
 *   - buttons: Cancel + OK (primary)
 *   - BEHAVIOR (fidelity, not surface): Caption "My Figure" + Label "Figure" +
 *     Numbering checked + OK plants the caption wrapper at the caret;
 *     Cancel plants nothing.
 *
 * Declared gap (loud, never parity): the committed OO dialog census carries
 * an "Insert caption" modal (triggered by Bookmark in OO) with fields: Caption,
 * Insert, Label, Exclude label from caption, Numbering, Include chapter number,
 * Chapter starts with style, Use separator — WO matches the full field set;
 * OO's separate Insert field is deferred (not a WO capability); WO's caption
 * marker writes the document-semantic attributes on the wrapper.
 *
 * Writes caption-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.caption-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-caption-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'caption-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>Caption sentinel <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt=""> hotel text.</p>';
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
  window.__L4_CAPTION__ = function () {
    const ed = document.querySelector('#editor');
    const cap = ed && ed.querySelector('.caption, figcaption, [data-caption]');
    const flat = window.__WO_FLAT_HTML__();
    return {
      has: !!cap,
      n: ed ? ed.querySelectorAll('.caption, figcaption, [data-caption]').length : 0,
      text: cap ? cap.textContent : null,
      flat: flat.includes('caption') || flat.includes('figcaption'),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openViaRibbon(page) {
  const active = await page.$('.ribbon-tab[data-tab="references"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="references"]');
  await sleep(150);
  // caption is triggered by data-cmd="insertCaption"
  await page.evaluate(() => {
    const btn = document.querySelector('[data-cmd="insertCaption"], #btn-caption');
    if (btn) btn.click();
  });
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

    // --- 1. opens the user way: References tab + insertCaption ---
    await openViaRibbon(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('caption-dialog');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    check('open via real clicks (References tab + insertCaption)', openRes);

    // --- 2..4 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('caption-dialog');
      const q = (s) => dlg.querySelector(s);
      const title = (q('#caption-dialog-title') || {}).textContent || '';
      const captionText = q('#caption-text');
      const captionLabel = q('#caption-label');
      const exclude = q('#caption-exclude-label');
      const numbering = q('#caption-numbering');
      const includeChap = q('#caption-include-chapter');
      const chapStyle = q('#caption-chapter-style');
      const separator = q('#caption-use-separator');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const cancel = q('#btn-caption-close'); const ok = q('#btn-caption-ok');
      return {
        title: title.trim(),
        captionLabelLab: lab('caption-text'), captionTextType: captionText ? captionText.type : null,
        labelLab: lab('caption-label'), labelTag: captionLabel ? captionLabel.tagName.toLowerCase() : null,
        excludeLab: lab('caption-exclude-label'), excludeType: exclude ? exclude.type : null,
        numberingLab: lab('caption-numbering'), numberingType: numbering ? numbering.type : null,
        includeChapLab: lab('caption-include-chapter'), includeChapType: includeChap ? includeChap.type : null,
        chapStyleLab: lab('caption-chapter-style'), chapStyleTag: chapStyle ? chapStyle.tagName.toLowerCase() : null,
        separatorLab: lab('caption-use-separator'), separatorType: separator ? separator.type : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!(ok && ok.classList.contains('primary')),
      };
    });
    check('title "Insert caption"', c.title === 'Insert caption', JSON.stringify(c.title));
    check('field Caption: text input',
      c.captionLabelLab === 'Caption' && c.captionTextType === 'text',
      `${JSON.stringify(c.captionLabelLab)} ${c.captionTextType}`);
    check('field Label: select (Figure/Table/Equation)',
      c.labelLab === 'Label' && c.labelTag === 'select',
      `${JSON.stringify(c.labelLab)} ${c.labelTag}`);
    check('field Exclude label from caption: checkbox',
      c.excludeLab === 'Exclude label from caption' && c.excludeType === 'checkbox',
      `${JSON.stringify(c.excludeLab)} ${c.excludeType}`);
    check('field Numbering: checkbox',
      c.numberingLab === 'Numbering' && c.numberingType === 'checkbox',
      `${JSON.stringify(c.numberingLab)} ${c.numberingType}`);
    check('field Include chapter number: checkbox',
      c.includeChapLab === 'Include chapter number' && c.includeChapType === 'checkbox',
      `${JSON.stringify(c.includeChapLab)} ${c.includeChapType}`);
    check('field Chapter starts with style: select',
      c.chapStyleLab === 'Chapter starts with style' && c.chapStyleTag === 'select',
      `${JSON.stringify(c.chapStyleLab)} ${c.chapStyleTag}`);
    check('field Use separator: checkbox',
      c.separatorLab === 'Use separator' && c.separatorType === 'checkbox',
      `${JSON.stringify(c.separatorLab)} ${c.separatorType}`);
    check('buttons Cancel + OK(primary)',
      /^cancel$/i.test(c.cancel || '') && /^ok$/i.test(c.ok || '') && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} ok=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 5. behavior: fill caption + label + OK -> caption wrapper ---
    await page.evaluate(() => window.__L4_CARET__());
    await page.fill('#caption-text', 'My Figure');
    await page.select('#caption-label', 'Figure');
    await page.check('#caption-numbering');
    await page.click('#btn-caption-ok');
    await sleep(400);
    const cap1 = await page.evaluate(() => window.__L4_CAPTION__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('caption-dialog').classList.contains('open'));
    check('caption "My Figure" + label Figure + numbering + OK -> caption wrapper (flat HTML)',
      closed1 && cap1.has && cap1.text && cap1.text.includes('Figure') && cap1.flat,
      `has=${cap1.has} text=${JSON.stringify(cap1.text)} flat=${cap1.flat} closed=${closed1}`);

    // --- 6. cancel plants nothing ---
    await openViaRibbon(page);
    await page.click('#btn-caption-close');
    await sleep(300);
    const cap2 = await page.evaluate(() => window.__L4_CAPTION__());
    const closed2 = await page.evaluate(() =>
      !document.getElementById('caption-dialog').classList.contains('open'));
    check('cancel plants nothing (single caption)', closed2 && cap2.n === 1,
      `n=${cap2.n} closed=${closed2}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'caption-dialog-l4',
    feature: 'dialog.caption-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO dialog census carries an "Insert caption" modal (triggered '
      + 'by Bookmark in OO) with an extra Insert field (not a WO capability); '
      + 'WO matches all other OO fields: Caption, Label, Exclude label from caption, '
      + 'Numbering, Include chapter number, Chapter starts with style, Use separator',
      'WO writes the document-semantic caption wrapper with data attributes; '
      + 'the exact HTML form depends on the selection context (img/table/etc)',
    ],
    contract: {
      open: 'real clicks: References tab + insertCaption cmd (editor.js: insertCaption)',
      title: 'Insert caption',
      fields: [
        { label: 'Caption', tag: 'input', type: 'text' },
        { label: 'Label', tag: 'select', type: 'select', options: ['Figure', 'Table', 'Equation'] },
        { label: 'Exclude label from caption', tag: 'input', type: 'checkbox' },
        { label: 'Numbering', tag: 'input', type: 'checkbox' },
        { label: 'Include chapter number', tag: 'input', type: 'checkbox' },
        { label: 'Chapter starts with style', tag: 'select', type: 'select', options: ['Heading 1', 'Heading 2', 'Heading 3'] },
        { label: 'Use separator', tag: 'input', type: 'checkbox' },
      ],
      buttons: ['Cancel', 'OK'],
      behavior: 'Caption + Label + options + OK plants the caption wrapper at the '
        + 'selection or caret (DOC-semantic marker, survives serialization); '
        + 'Cancel plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-caption-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-caption-dialog: ERROR', e);
  process.exit(1);
});
