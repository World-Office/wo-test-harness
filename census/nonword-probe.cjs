#!/usr/bin/env node
// nonword-probe.cjs — FUNCTIONAL probe of the non-word editor types
// (sheet/slide/pdf/diagram) through the LIVE Rust docserver WOPI bridge.
//
// The ported word editor is verified green (fx-prod.cjs, 108 controls). The four
// non-word types are deployed as the React @world-office/documenteditor build
// (Univer/React Vite, mounts in #root) — whether they actually load a document,
// hold a WOPI token and reach a save path through the Rust bridge is UNKNOWN.
// This probe measures that, per type, with network evidence.
//
// For each file: log in, click the file, then follow the full editor flow and
// record:
//   finalUrl   — where the shell landed us (editor host vs viewer vs nowhere)
//   editorFrame — did a subframe from the editor host (editor.cloud.graphwiz.ai)
//                or an editor iframe actually mount?
//   vdomRoot   — script_ignore
//   wopiToken  — network saw WOPI-ish calls (CheckFileInfo / access_token= /
//                /wopi/ / PutFile)
//   loads      — a canvas/root editor DOM or an editor iframe is present
//   savePath   — PutFile / file-save affordance observed
//   pageerrors — runtime exceptions seen
// Writes the ledger to $CENSUS_OUT/nonword-probe.json and prints a table.
const fs = require('fs');
const path = require('path');
const OUT = process.env.CENSUS_OUT || path.join(__dirname, 'census');
const OC_URL = process.env.OC_URL || 'https://cloud.graphwiz.ai';
const OC_USER = process.env.OC_USER || 'admin';
const OC_PASS = process.env.OC_PASS || 'wo-od-2026';
const EDITOR_HOST = 'editor.cloud.graphwiz.ai';
const FILES = [
  ['sheet', 'seed.xlsx'],
  ['slide', 'seed.pptx'],
  ['pdf', 'seed.pdf'],
  ['diagram', 'seed.vsdx'],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function login(page) {
  await page.goto(OC_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => !!document.querySelector('#oc-login-password')).catch(() => false)) break;
    await page.waitForTimeout(500);
  }
  await page.evaluate(([u, p]) => {
    const setVal = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    setVal(document.querySelector('#oc-login-username'), u);
    setVal(document.querySelector('#oc-login-password'), p);
    const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'Log in');
    if (b) b.click();
  }, [OC_USER, OC_PASS]);
  await page.waitForTimeout(6500);
}

async function probeOne(browser, type, file) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await ctx.newPage();
  const wopi = new Set();
  const pageerrors = [];
  page.on('pageerror', e => pageerrors.push(e.message.slice(0, 140)));
  page.on('request', r => {
    const u = r.url();
    if (/CheckFileInfo|access_token=|\/wopi\/|\/api\/documents\/|PutFile/.test(u)) wopi.add(u.split('?')[0]);
  });
  page.on('response', r => {
    if (/PutFile|PutRelativeFile/.test(r.url())) wopi.add(r.url().split('?')[0]);
  });

  let row = { type, file, finalUrl: '', editorFrame: false, loads: false, wopiToken: false, savePath: false, domNote: '', pageerrors: 0, wopiCalls: 0 };
  try {
    await login(page);
    const link = page.locator(`a[href*="${file}"]`).first();
    if (await link.count()) await link.click({ timeout: 20000 });
    await page.waitForTimeout(12000);

    row.finalUrl = page.url().replace(OC_URL, '');
    // any subframe from the editor host or an editor iframe?
    let frames = [];
    try { frames = page.frames().map(f => f.url().replace(/^https?:\/\//, '').split('/')[0]); } catch (e) {}
    const hasEditorFrame = frames.some(u => u === EDITOR_HOST);

    let d = await page.evaluate(() => {
      const bodyText = (document.body.innerText || '');
      const editorFrame = [...document.querySelectorAll('iframe')].map(f => (f.src || '')).find(s => /editor\.cloud\.graphwiz\.ai/.test(s));
      return {
        bodyText: bodyText.slice(0, 100).replace(/\s+/g, ' '),
        errText: /error|not found|401|403|500|unavailable/i.test(bodyText) ? 'ERR' : '',
        hasRoot: !!document.querySelector('#root'),
        rootChildren: document.querySelector('#root')?.childElementCount || 0,
        editorIframe: editorFrame || '',
        canvasEls: document.querySelectorAll('canvas').length,
      };
    }).catch(() => ({}));

    row.editorFrame = hasEditorFrame || !!d.editorIframe;
    // enter the editor iframe (if any) and inspect its inner state
    let inner = null;
    try {
      const edFrame = page.frames().find(f => /editor\.cloud\.graphwiz\.ai/.test(f.url()));
      if (edFrame) {
        await edFrame.waitForTimeout(4000);
        inner = await edFrame.evaluate(() => {
          const bt = (document.body.innerText || '');
          return {
            mount: !!document.querySelector('#root') && (document.querySelector('#root').childElementCount || 0),
            canvas: document.querySelectorAll('canvas').length,
            toolbar: !!document.querySelector('[class*="toolbar"],[class*="ribbon"],nav,header'),
            saveWord: /save|savefile|download|export/i.test(bt) ? 'save-ui' : '',
            err: /error|unavailable|404|failed/i.test(bt) ? 'ERR' : '',
            text: bt.slice(0, 70).replace(/\s+/g, ' '),
          };
        }).catch(() => ({ err: 'IFRAME-EV-ERR' }));
      } else {
        inner = { mount: 0, canvas: 0, toolbar: false, saveWord: 'no-editor-iframe' };
      }
    } catch (e) { inner = { err: 'IFRAME-ERR:' + String(e.message).slice(0, 60) }; }

    row.loads = !d.errText && (row.editorFrame && inner && (inner.mount || inner.canvas));
    row.wopiToken = wopi.size > 0;
    row.savePath = row.wopiToken && (/PutFile|PutRelativeFile/i.test(Array.from(wopi).join(' ')) || (inner && inner.saveWord));
    row.domNote = `${d.errText || ''} frames[${hasEditorFrame}] inner{mount#${inner?.mount} canvas#${inner?.canvas} ${inner?.saveWord || ''} ${inner?.err || ''} "${inner?.text || ''}"}`;
  } catch (e) {
    row.domNote = 'PROBE-ERR: ' + String(e.message).slice(0, 100);
  }
  row.wopiCalls = wopi.size;
  row.pageerrors = pageerrors.length;
  await ctx.close();
  return row;
}

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const rows = [];
  for (const [type, file] of FILES) {
    console.log(`\n=== probing ${type} via ${file} ===`);
    const row = await probeOne(browser, type, file);
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'nonword-probe.json'), JSON.stringify(rows, null, 2) + '\n');
  console.log(`\nwrote ${path.join(OUT, 'nonword-probe.json')}`);
})();
