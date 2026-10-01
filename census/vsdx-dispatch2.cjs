#!/usr/bin/env node
// vsdx-dispatch2.cjs — robust dispatch probe: navigate to personal files page,
// wait for file tiles to render, click target file, capture ALL api calls.
const { chromium } = require('playwright');
const OC_URL = process.env.OC_URL || 'https://cloud.graphwiz.ai';
const OC_USER = process.env.OC_USER || 'admin';
const OC_PASS = process.env.OC_PASS || 'wo-od-2026';
const FILE = process.env.PROBE_FILE || 'seed.vsdx';
const PATH = process.env.PATH_IN || '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await ctx.newPage();
  const api = [];
  const popups = [];
  const hook = async (t, u) => {
    const ct = (await t.headers())['content-type'] || '';
    if (/app\/list|app-provider|appprovider/i.test(u)) {
      try { const body = await t.text(); console.log('APP_LIST_BODY [' + t.status() + '] ' + (u.split('?')[0].replace(OC_URL,'') + ': ' + body.slice(0, 2000))); } catch (e) {}
    }
    if (/\/api\/|ocs\/|app-provider|appprovider|collab|wopi|graph|\.well-known|app\/open|hosting\//i.test(u)) {
      const short = u.split('?')[0].replace(OC_URL, '').replace('https://editor.cloud.graphwiz.ai', '<editor>');
      api.push(t.status() + ' ' + t.request().method() + ' ' + short + ' [' + ct.split(';')[0] + ']');
    }
  };
  page.on('response', r => hook(r, r.url()));
  page.on('popup', async p => { try { popups.push(p.url().slice(0, 120)); p.on('response', r => hook(r, r.url())); } catch (e) {} });
  page.on('pageerror', e => console.log('PAGEERR:', e.message.slice(0, 120)));

  await page.goto(OC_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!document.querySelector('#oc-login-password')).catch(() => false)) break; await page.waitForTimeout(500); }
  await page.fill('#oc-login-username', OC_USER);
  await page.fill('#oc-login-password', OC_PASS);
  await page.click('button:has-text("Log in")');
  await page.waitForTimeout(9000);
  // go to personal files page for the target path
  await page.goto(OC_URL + '/files/spaces/personal/admin' + PATH, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(8000);
  api.length = 0;
  // Per memory (ocs 5.x + external-app): the editor-open mechanism is SPA
  // navigation to /external-worldoffice/.../<file>, NOT the tile click (which
  // only does preview -> 'no preview available' modal for non-previewable types).
  // Decisive e2e: navigate directly to the external-app editor route and capture
  // whether the WOPI editor dispatches to editor.cloud.graphwiz.ai.
  const EXT_BASE = process.env.EXT_BASE || '/external-worldoffice/personal/admin';
  const extUrl = OC_URL + EXT_BASE + PATH + FILE;
  console.log('NAVIGATE (external-app editor route):', extUrl);
  try {
    await page.goto(extUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(20000);
    console.log('finalUrl:', page.url().slice(0, 200));
    // body heuristic: did a WOPI editor / docserver iframe or canvas render?
    const bodyText = await page.evaluate(() => (document.body ? (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200) : '')).catch(() => '');
    const hasIframe = await page.evaluate(() => !!document.querySelector('iframe')).catch(() => false);
    console.log('hasIframe:', hasIframe, '| body-text:', JSON.stringify(bodyText));
  } catch (e) {
    console.log('NAV error:', e.message.slice(0, 160));
  }
  console.log('popups:', JSON.stringify(popups));
  console.log('\nAPI calls after external-route navigation:');
  const seen = new Set(); api.forEach(c => { if (!seen.has(c)) { console.log('  ' + c); seen.add(c); } });
  console.log('\ntotal calls:', api.length, '| distinct:', seen.size);
  await browser.close();
})();
