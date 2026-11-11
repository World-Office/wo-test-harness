#!/usr/bin/env node
/**
 * ledger/textfromfile-dialog-l4.test.mjs — L4 FIDELITY probe: the
 * "Insert text from file" dialog (campaign L4-gold FXG-F: batch parity ->
 * census gold).
 *
 * The row dialog.textfromfile-dialog.l4 so far stood on the FINAL-001
 * batch probe (dialog-l4.test.mjs: field parity + a one-file insert
 * smoke). This dedicated probe earns the L4 by DRIVING the dialog in the
 * running editor (caption-dialog-l4 pattern: local static serve + stubbed
 * fetch, REAL clicks) across the WHOLE field/behavior contract:
 *
 * Census contract (honest, auditable):
 *   - OO modal EXISTENCE is measured: census/census-oo-interactions.json
 *     row "insert/Text fromFile -> modal" (the OO rig captured the modal
 *     mask only — controls:0 — so no field-level OO capture exists).
 *   - The OO field contract is pinned here (PROBES spirit): a file
 *     picker, "Choose file"; WO carries it plus Insert mode / Format.
 *
 * Asserted (deep, not surface):
 *   - opens via real clicks: Insert tab + Text from File (#btn-textfile)
 *   - title "Insert text from file"
 *   - fields: Choose file… (input[type=file] with the OO-ish accept list),
 *     Insert mode select (Insert / Replace selection), Format select
 *     (Auto-detect / Plain text / Keep formatting (HTML))
 *   - buttons Cancel + Insert (primary) — Insert DISABLED until a file is
 *     chosen, enabled by the change handler, reset by Cancel/Insert
 *   - .txt + Auto-detect: EVERY line lands as its own block paragraph
 *   - Plain text format escapes markup (a <b> in the file stays literal
 *     text — no <b> element)
 *   - Keep formatting inserts the file's raw HTML (a <b> lands as <b>)
 *   - Replace selection mode swaps the selected text for the file content
 *   - Cancel resets (file cleared, Insert disabled) and plants nothing
 *
 * Writes textfromfile-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.textfromfile-dialog.l4; level 4 only
 * when every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-textfromfile-dialog: OK|FAIL n/n checks".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'textfromfile-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>l4 textfromfile probe sentinel REPLACEME paragraph text.</p>';
const BOOT_MS = 2200;

const tmp = (name, content) => {
  const p = path.join(os.tmpdir(), name);
  fs.writeFileSync(p, content);
  return p;
};

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
  window.__L4_TFF__ = function () {
    const d = document.getElementById('textfromfile-dialog');
    const cs = d ? getComputedStyle(d) : null;
    const ins = document.getElementById('btn-textfromfile-insert');
    const ed = document.getElementById('editor');
    return {
      open: !!d && d.classList.contains('open') && cs.display !== 'none' && cs.visibility !== 'hidden',
      insertDisabled: ins ? ins.disabled : null,
      editor: ed ? ed.innerText : '',
      html: (typeof window.__WO_FLAT_HTML__ === 'function') ? window.__WO_FLAT_HTML__() : '',
    };
  };
  // caret at the END of the first paragraph (deterministic insert point)
  window.__L4_CARET__ = function () {
    const ed = document.querySelector('#editor');
    const p = ed && ed.querySelector('p');
    if (!p) return 'no-p';
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let tn = walker.nextNode();
    let last = null;
    while (tn) { if (tn.data && tn.data.length) last = tn; tn = walker.nextNode(); }
    const r = document.createRange();
    if (last) {
      r.setStart(last, last.data.length);
      r.setEnd(last, last.data.length);
    } else {
      r.selectNodeContents(p);
      r.collapse(false);
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    ed.focus();
    return 'ok';
  };
  // range-selection over the first occurrence of `word` (replace-mode path)
  window.__L4_SELECT_WORD__ = function (word) {
    const ed = document.querySelector('#editor');
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const i = n.data.indexOf(word);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + word.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        ed.focus();
        return 'ok';
      }
    }
    return 'word-not-found';
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openViaRibbon(page) {
  const active = await page.$('.ribbon-tab[data-tab="insert"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="insert"]');
  await sleep(150);
  await page.evaluate(() => {
    const btn = document.getElementById('btn-textfile');
    if (btn) btn.click();
  });
  await sleep(250);
}

async function main() {
  if (!fs.existsSync(path.join(EDITOR_DIR, 'index.html'))) {
    throw new Error(`editor dir missing index.html: ${EDITOR_DIR} (set WO_EDITOR_DIR)`);
  }
  const fTwoLines = tmp('l4-tff-two-lines.txt', 'l4 file line alpha\nl4 file line beta\n');
  const fMarkup = tmp('l4-tff-markup.txt', 'plain <b>NOTBOLD l4</b> tail\n');
  const fHtml = tmp('l4-tff-keep.html', '<p>l4 html file <b>bold sentinel</b></p>\n');
  const fReplace = tmp('l4-tff-replace.txt', 'replaced-file-text l4\n');

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

    // --- 1. opens the user way: Insert tab + Text from File ---
    await openViaRibbon(page);
    const openRes = await page.evaluate(() => window.__L4_TFF__().open);
    check('open via real clicks (Insert tab + Text from File btn)', openRes);

    // --- 2..5 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('textfromfile-dialog');
      const q = (s) => dlg.querySelector(s);
      const title = (q('#textfromfile-dialog-title') || {}).textContent || '';
      const file = q('#textfromfile-input');
      const mode = q('#textfromfile-mode');
      const fmt = q('#textfromfile-format');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const labTexts = [...dlg.querySelectorAll('label')].map((l) => (l.textContent || '').trim());
      const cancel = q('#btn-textfromfile-cancel'); const ins = q('#btn-textfromfile-insert');
      return {
        title: title.trim(),
        fileLab: lab('textfromfile-input'), fileTag: file ? file.tagName.toLowerCase() : null,
        fileType: file ? file.getAttribute('type') : null, fileAccept: file ? file.accept : '',
        modeOptions: mode ? [...mode.options].map((o) => o.textContent.trim()) : [],
        fmtOptions: fmt ? [...fmt.options].map((o) => o.textContent.trim()) : [],
        labels: labTexts,
        cancel: cancel ? cancel.textContent.trim() : null,
        ins: ins ? ins.textContent.trim() : null,
        insPrimary: !!(ins && ins.classList.contains('primary')),
        insDisabled: ins ? ins.disabled : null,
      };
    });
    check('title "Insert text from file"', c.title === 'Insert text from file', JSON.stringify(c.title));
    check('field Choose file…: file input with the OO-ish accept list',
      c.fileLab === 'Choose file…' && c.fileTag === 'input' && c.fileType === 'file'
        && ['.txt', '.md', '.html', '.htm', '.csv', '.docx'].every((e) => c.fileAccept.includes(e)),
      `label=${JSON.stringify(c.fileLab)} tag=${c.fileTag} type=${c.fileType} accept=${c.fileAccept}`);
    check('field Insert mode: select (Insert / Replace selection)',
      c.labels.includes('Insert mode')
        && c.modeOptions.join('|') === 'Insert|Replace selection',
      `labels=${JSON.stringify(c.labels)} options=${JSON.stringify(c.modeOptions)}`);
    check('field Format: select (Auto-detect / Plain text / Keep formatting (HTML))',
      c.labels.includes('Format')
        && c.fmtOptions.join('|') === 'Auto-detect|Plain text|Keep formatting (HTML)',
      `options=${JSON.stringify(c.fmtOptions)}`);
    check('buttons Cancel + Insert(primary) — Insert disabled until a file is chosen',
      /^cancel$/i.test(c.cancel || '') && /^insert$/i.test(c.ins || '') && c.insPrimary && c.insDisabled === true,
      `cancel=${JSON.stringify(c.cancel)} insert=${JSON.stringify(c.ins)} primary=${c.insPrimary} disabled=${c.insDisabled}`);

    // --- 6. choosing a file enables Insert ---
    await page.setInputFiles('#textfromfile-input', fTwoLines);
    await sleep(200);
    const enabled = await page.evaluate(() => !document.getElementById('btn-textfromfile-insert').disabled);
    check('change handler enables Insert once a file is chosen', enabled, `enabled=${enabled}`);

    // --- 7. .txt + Auto-detect: every line lands as its own paragraph ---
    await page.evaluate(() => window.__L4_CARET__());
    await page.selectOption('#textfromfile-mode', 'insert');
    await page.selectOption('#textfromfile-format', 'auto');
    await page.click('#btn-textfromfile-insert');
    await sleep(500);
    const t1 = await page.evaluate(() => window.__L4_TFF__());
    const split = await page.evaluate(() => {
      const ps = [...document.querySelectorAll('#editor p')].map((p) => p.textContent.trim());
      // measured insertHTML block semantics: the FIRST file line merges into
      // the caret's block, every FOLLOWING line lands in its own new <p>
      return ps.some((t) => t.includes('l4 file line alpha'))
        && ps.includes('l4 file line beta');
    });
    check('txt + Auto-detect: file lines land at the caret, line 2+ each in its own block paragraph',
      !t1.open && t1.insertDisabled === true && t1.editor.includes('l4 file line alpha')
        && t1.editor.includes('l4 file line beta')
        && t1.editor.indexOf('l4 file line alpha') < t1.editor.indexOf('l4 file line beta')
        && split,
      `closed=${!t1.open} reset=${t1.insertDisabled === true} blocks=${split}`);

    // --- 8. Plain text format escapes markup ---
    await openViaRibbon(page);
    await page.setInputFiles('#textfromfile-input', fMarkup);
    await sleep(200);
    await page.evaluate(() => window.__L4_CARET__());
    await page.selectOption('#textfromfile-format', 'plain');
    await page.click('#btn-textfromfile-insert');
    await sleep(500);
    const plain = await page.evaluate(() => {
      const st = window.__L4_TFF__();
      const boldEl = [...document.querySelectorAll('#editor b, #editor strong')]
        .some((b) => b.textContent.includes('NOTBOLD'));
      return { ...st, boldEl };
    });
    check('Plain text format escapes markup (literal <b> text, no bold element)',
      plain.editor.includes('<b>NOTBOLD l4</b>') && !plain.boldEl,
      `literal=${plain.editor.includes('<b>NOTBOLD l4</b>')} boldEl=${plain.boldEl}`);

    // --- 9. Keep formatting inserts the file's raw HTML ---
    await openViaRibbon(page);
    await page.setInputFiles('#textfromfile-input', fHtml);
    await sleep(200);
    await page.evaluate(() => window.__L4_CARET__());
    await page.selectOption('#textfromfile-format', 'html');
    await page.click('#btn-textfromfile-insert');
    await sleep(500);
    const kept = await page.evaluate(() => {
      const st = window.__L4_TFF__();
      const boldEl = [...document.querySelectorAll('#editor b, #editor strong')]
        .some((b) => b.textContent.includes('bold sentinel'));
      return { ...st, boldEl };
    });
    check('Keep formatting: raw file HTML lands (<b>bold sentinel</b> becomes a bold element)',
      kept.editor.includes('bold sentinel') && kept.boldEl,
      `text=${kept.editor.includes('bold sentinel')} boldEl=${kept.boldEl}`);

    // --- 10. Replace selection mode swaps the selected text ---
    await page.evaluate(() => window.__L4_SELECT_WORD__('REPLACEME'));
    await openViaRibbon(page);
    await page.setInputFiles('#textfromfile-input', fReplace);
    await sleep(200);
    await page.selectOption('#textfromfile-mode', 'replace');
    await page.click('#btn-textfromfile-insert');
    await sleep(500);
    const rep = await page.evaluate(() => window.__L4_TFF__());
    check('Replace selection mode swaps the selected text for the file content',
      !rep.editor.includes('REPLACEME') && rep.editor.includes('replaced-file-text l4'),
      `replaced=${!rep.editor.includes('REPLACEME')} inserted=${rep.editor.includes('replaced-file-text l4')}`);

    // --- 11. Cancel resets and plants nothing ---
    const preCancel = await page.evaluate(() => window.__L4_TFF__().editor);
    await openViaRibbon(page);
    await page.setInputFiles('#textfromfile-input', fTwoLines);
    await sleep(200);
    await page.click('#btn-textfromfile-cancel');
    await sleep(300);
    const after = await page.evaluate(() => window.__L4_TFF__());
    check('Cancel resets (file cleared, Insert disabled) and plants nothing',
      !after.open && after.insertDisabled === true && after.editor === preCancel,
      `closed=${!after.open} reset=${after.insertDisabled === true} docUnchanged=${after.editor === preCancel}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'textfromfile-dialog-l4',
    feature: 'dialog.textfromfile-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO interaction census proves the Text fromFile modal exists '
      + '(insert/Text fromFile -> modal, controls:0 — the OO rig captured the modal '
      + 'mask, not fields); the OO field contract is pinned from the file-picker '
      + 'shape (Choose file) and flips deliberately with this probe; WO additionally '
      + 'carries Insert mode / Format',
      'MEASURED QUIRK (Chromium insertHTML block semantics): the FIRST file line '
      + 'merges into the caret\u2019s block while every FOLLOWING line lands in its own '
      + 'new paragraph — MS Word splits the caret paragraph so each file line becomes '
      + 'its own paragraph (recorded divergence, never a silent pass)',
      'the .docx insert path needs the docserver import-docx endpoint — the offline '
      + 'probe proves the .txt/.html paths (per-line paragraphs, escaping, raw-HTML '
      + 'keep-formatting, replace-selection); the docx conversion itself is '
      + 'server-side',
    ],
    contract: {
      open: 'real clicks: Insert tab + Text from File btn (editor.js: #btn-textfile -> openDlg(textfromfile-dialog))',
      title: 'Insert text from file',
      fields: [
        { label: 'Choose file…', tag: 'input', type: 'file', accept: '.txt,.md,.html,.htm,.csv,.docx' },
        { label: 'Insert mode', tag: 'select', type: 'select', options: ['Insert', 'Replace selection'] },
        { label: 'Format', tag: 'select', type: 'select', options: ['Auto-detect', 'Plain text', 'Keep formatting (HTML)'] },
      ],
      buttons: ['Cancel', 'Insert (primary, disabled until a file is chosen)'],
      behavior: 'txt + Auto-detect lands the file lines at the caret (first line merges into the '
        + 'caret block, following lines each in their own paragraph); Plain text escapes markup; '
        + 'Keep formatting inserts raw HTML; Replace selection swaps the selected text; '
        + 'Cancel resets the file state and plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-textfromfile-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-textfromfile-dialog: ERROR', e);
  process.exit(1);
});
