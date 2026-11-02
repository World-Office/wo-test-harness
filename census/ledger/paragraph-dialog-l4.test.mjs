#!/usr/bin/env node
/**
 * ledger/paragraph-dialog-l4.test.mjs — L4 FIDELITY probe: the paragraph
 * settings dialog's field/button contract, measured against the RUNNING
 * editor (local static serve + stubbed fetch, table-dialog-l4 pattern).
 *
 * Contract (campaign comprehensive-parity, task L4-006): open the dialog
 * the way a user does — a REAL right-click on the caret paragraph (editor
 * #editor contextmenu handler) then a real click on the ctx-menu row
 * button[data-ctx="ParagraphSettings"] (editor.js route →
 * openParagraphSettingsDialog) — then assert
 *   - title "Paragraph advanced settings" (i18n Ctx.ParagraphSettings —
 *     the same label as OO's ctx-menu row)
 *   - fields: Alignment (select left/center/right/justify), Left indent
 *     (number 0..500), Right indent (number 0..500), First line indent
 *     (number -200..200 — negatives = MS-Word hanging), Line spacing
 *     (select Single/1.5/Double), checkboxes Keep lines together /
 *     Keep with next / Page break before, plus a Tabs… button
 *   - buttons: Cancel + OK (primary)
 *   - BEHAVIOR (fidelity, not surface): center + 40/20/32 + 1.5 +
 *     keep-lines/keep-next + OK → real inline styles (text-align,
 *     margin-left/right, text-indent, line-height) + semantic classes on
 *     the caret <p>, visible in the flat HTML; REOPEN reads the live
 *     paragraph back into every field; the negative path untoggles
 *     classes (page-break before instead); Cancel mutates nothing.
 *
 * Declared gap (loud, never parity): OO's "Paragraph advanced settings"
 * modal is opened by the ctx menu row (census-oo-deep contextMenu proves
 * the item enabled) and the right panel's "Show advanced settings" — the
 * committed OO dialog census captured no field-level paragraph modal, so
 * the field contract is pinned from the MS-Word-style Indents & Spacing
 * shape. OO additionally carries Before/After paragraph spacing + "Don't
 * add interval between paragraphs of the same style" (right-panel census);
 * WO's dialog defers those (ribbon line-spacing + right-panel carry them)
 * — recorded divergence, not gated.
 *
 * Writes paragraph-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.paragraph-settings-dialog.l4; level 4
 * only when every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-paragraph-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'paragraph-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>L4 paragraph sentinel beta text.</p><p>Second plain line.</p>';
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
  // collapsed caret at the FIRST paragraph start — the block the dialog
  // formats (caretParagraph walks the selection anchor up to p/div/li/h*)
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
  // the caret paragraph's live style/class state + flat-HTML reflection
  window.__L4_PARA__ = function () {
    const ed = document.querySelector('#editor');
    const p = ed && ed.querySelector('p');
    const flat = window.__WO_FLAT_HTML__();
    return {
      align: p.style.textAlign,
      ml: p.style.marginLeft, mr: p.style.marginRight,
      ti: p.style.textIndent, lh: p.style.lineHeight,
      keepLines: p.classList.contains('keep-lines-together'),
      keepNext: p.classList.contains('keep-with-next'),
      pageBreak: p.classList.contains('page-break-before'),
      flatStyled: /text-align:\s*center/.test(flat) && flat.includes('margin-left: 40px'),
      flatKeep: flat.includes('keep-lines-together'),
      flatSentinel: flat.includes('sentinel beta'),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// open the dialog the user way: right-click the caret paragraph, click the
// ctx-menu ParagraphSettings row
async function openViaCtx(page) {
  await page.evaluate(() => window.__L4_CARET__());
  await page.click('#editor p', { button: 'right' });
  await sleep(150);
  await page.click('#ctx-menu button[data-ctx="ParagraphSettings"]');
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

    // --- 1. opens the user way: real right-click + ctx-menu row click ---
    await openViaCtx(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('paragraph-settings-dialog');
      const menu = document.getElementById('ctx-menu');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && menu.hidden;
    });
    check('open via real right-click + ctx row ParagraphSettings', openRes);

    // --- 2..9 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('paragraph-settings-dialog');
      const q = (s) => dlg.querySelector(s);
      const title = (q('#paragraph-settings-title') || {}).textContent || '';
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const opts = (sel) => [...sel.options].map((o) => o.value);
      const align = q('#ps-align'); const sp = q('#ps-spacing');
      const il = q('#ps-indent-left'); const ir = q('#ps-indent-right'); const fl = q('#ps-first-line');
      const kl = q('#ps-keep-lines'); const kn = q('#ps-keep-next'); const pb = q('#ps-page-break');
      const tabs = q('#btn-ps-tabs'); const cancel = q('#btn-ps-close'); const ok = q('#btn-ps-ok');
      return {
        title: title.trim(),
        alignLabel: lab('ps-align'), alignOpts: align ? opts(align) : null, alignVal: align ? align.value : null,
        ilLabel: lab('ps-indent-left'), ilType: il ? il.type : null, ilMin: il ? il.min : null, ilMax: il ? il.max : null,
        irLabel: lab('ps-indent-right'), irType: ir ? ir.type : null, irMin: ir ? ir.min : null, irMax: ir ? ir.max : null,
        flLabel: lab('ps-first-line'), flType: fl ? fl.type : null, flMin: fl ? fl.min : null, flMax: fl ? fl.max : null,
        spLabel: lab('ps-spacing'), spOpts: sp ? opts(sp) : null, spVal: sp ? sp.value : null,
        klType: kl ? kl.type : null, knType: kn ? kn.type : null, pbType: pb ? pb.type : null,
        klText: kl ? kl.closest('label').textContent.trim() : null,
        knText: kn ? kn.closest('label').textContent.trim() : null,
        pbText: pb ? pb.closest('label').textContent.trim() : null,
        tabs: tabs ? tabs.textContent.trim() : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!(ok && ok.classList.contains('primary')),
      };
    });
    check('title "Paragraph advanced settings" (i18n Ctx.ParagraphSettings — OO ctx-row label)',
      c.title === 'Paragraph advanced settings', JSON.stringify(c.title));
    check('field Alignment: label + select left/center/right/justify',
      c.alignLabel === 'Alignment'
      && JSON.stringify(c.alignOpts) === JSON.stringify(['left', 'center', 'right', 'justify']),
      `label=${JSON.stringify(c.alignLabel)} opts=${JSON.stringify(c.alignOpts)}`);
    check('fields Left/Right indent: labels + number 0..500',
      c.ilLabel === 'Left indent' && c.ilType === 'number' && c.ilMin === '0' && c.ilMax === '500'
      && c.irLabel === 'Right indent' && c.irType === 'number' && c.irMin === '0' && c.irMax === '500',
      `l=${c.ilLabel}/${c.ilType}/${c.ilMin}/${c.ilMax} r=${c.irLabel}/${c.irType}/${c.irMin}/${c.irMax}`);
    check('field First line indent: label + number -200..200 (negatives = hanging)',
      c.flLabel === 'First line indent' && c.flType === 'number'
      && c.flMin === '-200' && c.flMax === '200',
      `${JSON.stringify(c.flLabel)} ${c.flType} ${c.flMin}..${c.flMax}`);
    check('field Line spacing: label + select Single/1.5/Double (1, 1.5, 2)',
      c.spLabel === 'Line spacing' && JSON.stringify(c.spOpts) === JSON.stringify(['1', '1.5', '2']),
      `label=${JSON.stringify(c.spLabel)} opts=${JSON.stringify(c.spOpts)}`);
    check('checkboxes Keep lines together / Keep with next / Page break before',
      c.klType === 'checkbox' && c.knType === 'checkbox' && c.pbType === 'checkbox'
      && /keep lines together/i.test(c.klText || '') && /keep with next/i.test(c.knText || '')
      && /page break before/i.test(c.pbText || ''),
      `${JSON.stringify(c.klText)} | ${JSON.stringify(c.knText)} | ${JSON.stringify(c.pbText)}`);
    check('buttons Tabs… + Cancel + OK(primary)',
      /tabs/i.test(c.tabs || '') && /cancel/i.test(c.cancel || '')
      && /^ok$/i.test(c.ok || '') && c.okPrimary,
      `tabs=${JSON.stringify(c.tabs)} cancel=${JSON.stringify(c.cancel)} ok=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 10. behavior: center + 40/20/32 + 1.5 + keeps -> real styles ---
    await page.selectOption('#ps-align', 'center');
    await page.fill('#ps-indent-left', '40');
    await page.fill('#ps-indent-right', '20');
    await page.fill('#ps-first-line', '32');
    await page.selectOption('#ps-spacing', '1.5');
    await page.check('#ps-keep-lines');
    await page.check('#ps-keep-next');
    await page.click('#btn-ps-ok');
    await sleep(400);
    const p1 = await page.evaluate(() => window.__L4_PARA__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('paragraph-settings-dialog').classList.contains('open'));
    check('apply center/40/20/32/1.5 + keeps -> inline styles + classes on caret <p> (flat HTML)',
      closed1 && p1.align === 'center' && p1.ml === '40px' && p1.mr === '20px'
      && p1.ti === '32px' && p1.lh === '1.5' && p1.keepLines && p1.keepNext && !p1.pageBreak
      && p1.flatStyled && p1.flatKeep && p1.flatSentinel,
      `align=${p1.align} ml=${p1.ml} mr=${p1.mr} ti=${p1.ti} lh=${p1.lh} `
      + `keeps=${p1.keepLines}/${p1.keepNext} pb=${p1.pageBreak} flat=${p1.flatStyled}/${p1.flatKeep}/${p1.flatSentinel}`);

    // --- 11. read-back: reopen reflects the live paragraph ---
    await openViaCtx(page);
    const rb = await page.evaluate(() => {
      const v = (id) => (document.getElementById(id) || {}).value;
      const ck = (id) => !!(document.getElementById(id) || {}).checked;
      return { align: v('ps-align'), il: v('ps-indent-left'), ir: v('ps-indent-right'),
        fl: v('ps-first-line'), sp: v('ps-spacing'), kl: ck('ps-keep-lines'),
        kn: ck('ps-keep-next'), pb: ck('ps-page-break') };
    });
    check('reopen reads the live paragraph back (center/40/20/32/1.5, keeps on)',
      rb.align === 'center' && rb.il === '40' && rb.ir === '20' && rb.fl === '32'
      && rb.sp === '1.5' && rb.kl && rb.kn && !rb.pb,
      JSON.stringify(rb));

    // --- 12. negative path: untoggle keeps, page break before, zero out ---
    await page.selectOption('#ps-align', 'left');
    await page.fill('#ps-indent-left', '0');
    await page.fill('#ps-indent-right', '0');
    await page.fill('#ps-first-line', '0');
    await page.selectOption('#ps-spacing', '1');
    await page.uncheck('#ps-keep-lines');
    await page.uncheck('#ps-keep-next');
    await page.check('#ps-page-break');
    await page.click('#btn-ps-ok');
    await sleep(300);
    const p2 = await page.evaluate(() => window.__L4_PARA__());
    check('negative path: zero values remove styles, keeps off, page-break-before on',
      !p2.keepLines && !p2.keepNext && p2.pageBreak
      && p2.ml === '' && p2.mr === '' && p2.ti === '' && p2.lh === '',
      `keeps=${p2.keepLines}/${p2.keepNext} pb=${p2.pageBreak} ml=${JSON.stringify(p2.ml)} `
      + `mr=${JSON.stringify(p2.mr)} ti=${JSON.stringify(p2.ti)} lh=${JSON.stringify(p2.lh)}`);

    // --- 13. cancel mutates nothing ---
    await openViaCtx(page);
    await page.selectOption('#ps-align', 'justify');
    await page.fill('#ps-indent-left', '100');
    await page.check('#ps-keep-lines');
    await page.click('#btn-ps-close');
    await sleep(300);
    const p3 = await page.evaluate(() => window.__L4_PARA__());
    const closed3 = await page.evaluate(() =>
      !document.getElementById('paragraph-settings-dialog').classList.contains('open'));
    check('cancel mutates nothing', closed3 && p3.align === 'left' && p3.ml === '' && !p3.keepLines,
      `align=${p3.align} ml=${JSON.stringify(p3.ml)} keepLines=${p3.keepLines} closed=${closed3}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'paragraph-dialog-l4',
    feature: 'dialog.paragraph-settings-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'OO opens "Paragraph advanced settings" from the ctx menu row (census-oo-deep contextMenu, '
      + 'enabled) and the right panel "Show advanced settings"; the committed OO dialog census '
      + 'captured no field-level paragraph modal — the field contract is pinned from the '
      + 'MS-Word-style Indents & Spacing shape (alignment, left/right/first-line indents, line '
      + 'spacing, keeps, page break, Tabs…, OK/Cancel)',
      'OO additionally carries Before/After paragraph spacing + "Don\'t add interval between '
      + 'paragraphs of the same style" (right-panel census) — WO defers those to the ribbon '
      + 'line-spacing control and right panel; recorded divergence, not gated',
    ],
    contract: {
      open: 'real right-click on the caret paragraph + ctx-menu row button[data-ctx="ParagraphSettings"] '
        + '(editor.js: openParagraphSettingsDialog)',
      title: 'Paragraph advanced settings',
      fields: [
        { label: 'Alignment', tag: 'select', options: ['left', 'center', 'right', 'justify'] },
        { label: 'Left indent', tag: 'input', type: 'number', min: 0, max: 500 },
        { label: 'Right indent', tag: 'input', type: 'number', min: 0, max: 500 },
        { label: 'First line indent', tag: 'input', type: 'number', min: -200, max: 200 },
        { label: 'Line spacing', tag: 'select', options: ['1', '1.5', '2'] },
        { label: 'Keep lines together', tag: 'input', type: 'checkbox' },
        { label: 'Keep with next', tag: 'input', type: 'checkbox' },
        { label: 'Page break before', tag: 'input', type: 'checkbox' },
      ],
      buttons: ['Tabs…', 'Cancel', 'OK'],
      behavior: 'OK applies text-align/margins/text-indent/line-height inline styles + '
        + 'keep-lines-together/keep-with-next/page-break-before classes to the caret block '
        + '(flat HTML); reopen reads the live block back into every field; zero values remove '
        + 'styles; Cancel mutates nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-paragraph-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-paragraph-dialog: ERROR', e);
  process.exit(1);
});
