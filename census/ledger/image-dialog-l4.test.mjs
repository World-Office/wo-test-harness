#!/usr/bin/env node
/**
 * ledger/image-dialog-l4.test.mjs — L4 FIDELITY probe: the insert-image
 * dialog's field/button contract, measured against the RUNNING editor
 * (local static serve + stubbed fetch, table-dialog-l4 pattern).
 *
 * Contract (task L4-003): open the image dialog the way a user does — a
 * REAL click on the ribbon button #btn-image (click-wired, editor.js:
 * getElementById("btn-image").addEventListener("click", insertImage)) —
 * then assert
 *   - title "Insert image"
 *   - fields: Image file (input#image-file[type=file], accepts png),
 *     Width + Height (input[type=number] min 1, hidden until a file is
 *     picked) and the size hint "leave empty for original size"
 *   - buttons: Cancel + Insert (primary, disabled until a valid file)
 *   - BEHAVIOR (fidelity, not surface): a real PNG via setInputFiles
 *     shows the preview, reveals the size fields and arms Insert;
 *     an invalid type is rejected with an error (Insert stays disabled);
 *     width 123 + Insert puts a real <img width="123"> into the flat
 *     HTML at the saved caret; empty size inserts at natural size (no
 *     width/height attrs — the hint's promise); Cancel mutates nothing.
 *
 * Declared gap (loud, never parity): the committed OO reference census has
 * Insert→Image as a menu into the native OS file picker (interact census:
 * insert/Image opens "menu"; header-footer/Image opens a 0-control modal
 * mask) — the OO dialog census captured NO field-level insert-image
 * dialog. The file + width/height + Insert/Cancel contract is pinned from
 * the MS-Word-style insert-image shape (table-dialog precedent).
 *
 * Writes image-dialog-l4.json next to this script (merged by ledger/build.py
 * into row dialog.image-dialog.l4; level 4 only when every check passed).
 * Exit code 0 iff ok. Final stdout line: "l4-image-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'image-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>L4 image sentinel alpha text.</p>';
const BOOT_MS = 2200;

// 1x1 red PNG — real bytes, real mime, decodes to natural size 1x1 (below
// the page-fit clamp so width=123 survives unclamped).
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_FILE = { name: 'probe.png', mimeType: 'image/png', buffer: Buffer.from(PNG_B64, 'base64') };
const TXT_FILE = { name: 'probe.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') };

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

const startStaticServer = (port, dir) => spawn('/usr/bin/python3',
  ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dir],
  { stdio: ['ignore', 'ignore', 'ignore'] });

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
  // collapsed caret at the paragraph start, inside the editor — the place
  // the image should land (insertImage saves/restores this selection, and
  // a TEXT caret keeps plainImageSelection() null so Insert inserts rather
  // than replaces).
  window.__L4_CARET__ = function () {
    const ed = document.querySelector('#editor');
    const p = ed && ed.querySelector('p');
    if (!p) return 'no-p';
    // first TEXT node of the paragraph — after an earlier insert p.firstChild
    // is an <img>, and a selection ON that img routes confirmImageDialog
    // into the contextual Replace-image path (plainImageSelection) instead
    // of insert-at-caret. A text-node caret is the plain insert case.
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    if (!node) return 'no-text';
    const r = document.createRange();
    r.setStart(node, 0);
    r.setEnd(node, 0);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    ed.focus();
    return 'ok';
  };
  // every <img> the editor inserted + flat serialization state
  window.__L4_IMGS__ = function () {
    const imgs = [...document.querySelectorAll('#editor img')];
    const flat = window.__WO_FLAT_HTML__();
    return {
      n: imgs.length,
      list: imgs.map((i) => ({ w: i.getAttribute('width'), h: i.getAttribute('height'), alt: i.alt })),
      flatHasImg: flat.includes('<img'),
      sentinel: flat.includes('sentinel alpha'),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// popover helpers: #image-dialog is an anchored .insert-pop — the .open
// class + computed style carry visibility, never offset geometry.
async function openImageDialog(page) {
  if (await page.$('#image-dialog.open')) return;
  const active = await page.$('.ribbon-tab[data-tab="insert"][aria-selected="true"]');
  if (!active) {
    await page.click('.ribbon-tab[data-tab="insert"]');
    await sleep(200);
  }
  await page.click('#btn-image');
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

    // --- 1. opens the user way: REAL clicks (Insert tab, then ribbon button) ---
    const caret = await page.evaluate(() => window.__L4_CARET__());
    await openImageDialog(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('image-dialog');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    check('open via real clicks (Insert tab + #btn-image)', openRes && caret === 'ok',
      caret !== 'ok' ? `caret: ${caret}` : '');

    // --- 2. static contract while open ---
    const contract = await page.evaluate(() => {
      const dlg = document.getElementById('image-dialog');
      const title = (dlg.querySelector('#image-dialog-title') || {}).textContent || '';
      const fileLabel = (dlg.querySelector('label[for="image-file"]') || {}).textContent || '';
      const wLabel = (dlg.querySelector('label[for="image-width"]') || {}).textContent || '';
      const hLabel = (dlg.querySelector('label[for="image-height"]') || {}).textContent || '';
      const file = dlg.querySelector('#image-file');
      const w = dlg.querySelector('#image-width');
      const h = dlg.querySelector('#image-height');
      const cancel = dlg.querySelector('#btn-image-cancel');
      const insert = dlg.querySelector('#btn-image-ok');
      return {
        title: title.trim(),
        fileLabel: fileLabel.trim(), wLabel: wLabel.trim(), hLabel: hLabel.trim(),
        fileType: file ? file.type : null,
        acceptPng: !!(file && (file.accept || '').includes('image/png')),
        sizeFieldsHidden: !!(dlg.querySelector('#image-size-fields') || {}).hidden,
        previewHidden: !!(dlg.querySelector('#image-preview-wrap') || {}).hidden,
        wType: w ? w.type : null, wMin: w ? w.min : null,
        hType: h ? h.type : null, hMin: h ? h.min : null,
        hint: ((dlg.querySelector('.image-size-hint') || {}).textContent || '').trim(),
        cancel: cancel ? cancel.textContent.trim() : null,
        insert: insert ? insert.textContent.trim() : null,
        insertPrimary: !!(insert && insert.classList.contains('primary')),
        insertDisabled: !!(insert && insert.disabled),
      };
    });
    check('title "Insert image"', contract.title === 'Insert image', JSON.stringify(contract.title));
    check('field Image file: label + input[type=file] accepting png',
      contract.fileLabel === 'Image file' && contract.fileType === 'file' && contract.acceptPng,
      `label=${JSON.stringify(contract.fileLabel)} type=${JSON.stringify(contract.fileType)} acceptPng=${contract.acceptPng}`);
    check('fields Width/Height: labels + input[type=number] min 1, hidden until a file is picked',
      contract.wLabel === 'Width' && contract.hLabel === 'Height'
      && contract.wType === 'number' && contract.hType === 'number'
      && contract.wMin === '1' && contract.hMin === '1'
      && contract.sizeFieldsHidden && contract.previewHidden,
      `w=${JSON.stringify(contract.wLabel)}/${JSON.stringify(contract.wType)}/${JSON.stringify(contract.wMin)} `
      + `h=${JSON.stringify(contract.hLabel)}/${JSON.stringify(contract.hType)}/${JSON.stringify(contract.hMin)} `
      + `sizeFieldsHidden=${contract.sizeFieldsHidden} previewHidden=${contract.previewHidden}`);
    check('size hint "leave empty for original size"',
      /leave empty for original size/i.test(contract.hint), JSON.stringify(contract.hint));
    check('buttons Cancel + Insert(primary, disabled until file)',
      /cancel/i.test(contract.cancel || '') && /insert/i.test(contract.insert || '')
      && contract.insertPrimary && contract.insertDisabled,
      `cancel=${JSON.stringify(contract.cancel)} insert=${JSON.stringify(contract.insert)} `
      + `primary=${contract.insertPrimary} disabled=${contract.insertDisabled}`);

    // --- 3. file field applies: real file -> preview + size fields + armed Insert ---
    await page.setInputFiles('#image-file', PNG_FILE);
    await sleep(400); // FileReader is async
    const applied = await page.evaluate(() => {
      const wrap = document.getElementById('image-preview-wrap');
      const prev = document.getElementById('image-preview');
      const sizes = document.getElementById('image-size-fields');
      const ok = document.getElementById('btn-image-ok');
      return {
        previewVisible: !!wrap && !wrap.hidden,
        previewDataUrl: !!prev && String(prev.src || '').startsWith('data:image/png'),
        sizesVisible: !!sizes && !sizes.hidden,
        okEnabled: !!ok && !ok.disabled,
        err: (document.getElementById('image-error') || {}).textContent || '',
      };
    });
    check('file field applies: PNG -> preview shown (data:image/png), size fields revealed, Insert armed, no error',
      applied.previewVisible && applied.previewDataUrl && applied.sizesVisible && applied.okEnabled && !applied.err,
      JSON.stringify(applied));

    // --- 4. invalid type rejected: text/plain -> error, Insert stays disabled ---
    await page.setInputFiles('#image-file', TXT_FILE);
    await sleep(300);
    const rejected = await page.evaluate(() => ({
      err: (document.getElementById('image-error') || {}).textContent || '',
      okDisabled: !!(document.getElementById('btn-image-ok') || {}).disabled,
      previewHidden: !!(document.getElementById('image-preview-wrap') || {}).hidden,
    }));
    check('invalid type rejected with error (Insert stays disabled, preview hidden)',
      !!rejected.err && rejected.okDisabled && rejected.previewHidden, JSON.stringify(rejected));

    // --- 5. behavior: width 123 + Insert -> real <img width="123"> at the caret ---
    await page.evaluate(() => window.__L4_CARET__());
    await page.setInputFiles('#image-file', PNG_FILE);
    await sleep(400);
    await page.fill('#image-width', '123');
    await page.click('#btn-image-ok');
    await sleep(400);
    const t1 = await page.evaluate(() => window.__L4_IMGS__());
    const closed1 = !(await page.$('#image-dialog.open'));
    check('width applies + Insert -> <img width="123"> in flat HTML, seed text intact, dialog closed',
      t1.n === 1 && t1.list[0].w === '123' && t1.flatHasImg && t1.sentinel && closed1,
      `imgs=${JSON.stringify(t1.list)} flatHasImg=${t1.flatHasImg} sentinel=${t1.sentinel} closed=${closed1}`);

    // --- 6. behavior: empty size = original size (the hint's promise) ---
    await page.evaluate(() => window.__L4_CARET__());
    await openImageDialog(page);
    await page.setInputFiles('#image-file', { ...PNG_FILE, name: 'probe2.png' });
    await sleep(400);
    await page.click('#btn-image-ok');
    await sleep(400);
    const t2 = await page.evaluate(() => window.__L4_IMGS__());
    check('empty size inserts at natural size (no width/height attrs)',
      t2.n === 2 && t2.list[1].w === null && t2.list[1].h === null,
      `imgs=${JSON.stringify(t2.list)}`);

    // --- 7. cancel mutates nothing ---
    await openImageDialog(page);
    await page.setInputFiles('#image-file', { ...PNG_FILE, name: 'probe3.png' });
    await sleep(400);
    await page.fill('#image-width', '77');
    await page.click('#btn-image-cancel');
    await sleep(300);
    const t3 = await page.evaluate(() => window.__L4_IMGS__());
    const closed3 = !(await page.$('#image-dialog.open'));
    check('cancel mutates nothing', t3.n === 2 && closed3,
      `imgs=${t3.n} (expected still 2) closed=${closed3}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'image-dialog-l4',
    feature: 'dialog.image-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'OO Insert→Image opens a menu into the native OS file picker (interact census: insert/Image '
      + 'opens "menu", header-footer/Image opens a 0-control modal mask; the committed OO dialog '
      + 'census captured NO field-level insert-image dialog) — the file + width/height + Insert/Cancel '
      + 'contract is pinned from the MS-Word-style insert-image shape; WO ships an anchored popover '
      + 'with preview + size fields as the semantic carrier (table-dialog precedent, measured)',
    ],
    contract: {
      open: 'real click #btn-image (editor.js: getElementById("btn-image").addEventListener("click", insertImage))',
      title: 'Insert image',
      fields: [
        { label: 'Image file', tag: 'input', type: 'file', accept: 'image/png,image/jpeg,image/gif,image/bmp,image/webp,image/svg+xml' },
        { label: 'Width', tag: 'input', type: 'number', min: 1, note: 'hidden until a file is picked; empty = original size' },
        { label: 'Height', tag: 'input', type: 'number', min: 1, note: 'hidden until a file is picked; empty = original size' },
      ],
      buttons: ['Cancel', 'Insert'],
      behavior: 'real file -> data: preview + armed Insert; invalid type rejected with error; '
        + 'width 123 + Insert -> <img width="123"> at the saved caret; empty size -> natural size '
        + '(no width/height attrs); Cancel mutates nothing; a selection ON an <img> routes the same '
        + 'dialog into the contextual Replace-image path (measured during probe bring-up; the '
        + 'ctx.replace-image ledger row), text-caret inserts are the plain case',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-image-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-image-dialog: ERROR', e);
  process.exit(1);
});
