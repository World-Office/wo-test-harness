// react-e2e/e2e-lib.cjs — shared boot + assertion helpers for the react E2E suite.
// Every probe: exit 0 = PASS, non-zero = FAIL, console lines `PASS: …`/`FAIL: …`.
const { chromium } = require('/home/weiss/.npm-global/lib/node_modules/playwright/index.mjs');

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:8932/word/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;

function ok(name, cond, extra = '') {
  if (cond) { passed++; console.log(`PASS: ${name}`); }
  else { failed++; console.log(`FAIL: ${name}${extra ? ' — ' + extra : ''}`); }
}

async function boot(opts = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: opts.downloads !== false,
  });
  const p = await ctx.newPage();
  const pageErrors = [];
  p.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(opts.bootMs ?? 9000);
  return { b, ctx, p, pageErrors };
}

/// Type into the canvas at a document position, then return.
async function typeAt(p, text, pos = { x: 396, y: 200 }) {
  const c = await p.$('canvas');
  await c.click({ position: pos });
  await sleep(400);
  await p.keyboard.type(text, { delay: 25 });
  await sleep(600);
}

/// File → Download as… → DOCX → save to `to`; DOM-click recipe (File panel
/// buttons are display:none until hovered in some builds — playwright's
/// visibility-gated click stalls; DOM click works).
async function exportDocx(p, to) {
  await p.evaluate(() => [...document.querySelectorAll('[role=tab]')]
    .find((e) => /file/i.test(e.textContent || ''))?.click());
  await sleep(1000);
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('.de-file-menu-panel button, .de-file-menu-panel [role=menuitem]')]
      .find((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().toLowerCase().startsWith('download'));
    btn?.click();
  });
  await sleep(1200);
  const dlPromise = p.waitForEvent('download', { timeout: 25000 });
  await p.evaluate(() => [...document.querySelectorAll('.de-file-menu-format-btn')]
    .find((b) => b.textContent.trim() === 'DOCX')?.click());
  const dl = await dlPromise;
  await dl.saveAs(to);
  return dl.suggestedFilename();
}

/// Read word/document.xml out of a docx file (returns string).
async function docxXml(path) {
  const { execSync } = require('node:child_process');
  const dir = '/tmp/e2e-docx-' + Date.now();
  execSync(`rm -rf ${dir} && mkdir -p ${dir} && cd ${dir} && unzip -o -q ${path} word/document.xml`);
  return require('node:fs/promises').readFile(dir + '/word/document.xml', 'utf8');
}

function finish(label) {
  console.log(`\n${label}: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

module.exports = { chromium, sleep, ok, boot, typeAt, exportDocx, docxXml, finish, BASE };
