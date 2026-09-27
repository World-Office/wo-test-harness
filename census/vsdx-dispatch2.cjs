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
  page.on('response', r => {
    const ct = (r.headers()['content-type'] || '');
    const u = r.url();
    if (/\/api\/|ocs\/|app-provider|appprovider|collab|wopi|graph|\.well-known/i.test(u)) {
      const short = u.split('?')[0].replace(OC_URL, '');
      api.push(r.status() + ' ' + r.request().method() + ' ' + short + ' [' + ct.split(';')[0] + ']');
    }
  });
  page.on('pageerror', e => console.log('PAGEERR:', e.message.slice(0, 120)));

  await page.goto(OC_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!document.querySelector('#oc-login-password')).catch(() => false)) break; await page.waitForTimeout(500); }
  await page.evaluate(([u, p]) => {
    const s = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    s(document.querySelector('#oc-login-username'), u); s(document.querySelector('#oc-login-password'), p);
    const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'Log in'); if (b) b.click();
  }, [OC_USER, OC_PASS]);
  await page.waitForTimeout(9000);
  // go to personal files page for the target path
  await page.goto(OC_URL + '/files/spaces/personal/admin' + PATH, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(8000);
  api.length = 0;
  const link = page.locator(`a[href*="${FILE}"]`).first();
  console.log('FILE:', FILE, '| file-anchor link count:', await link.count());
  // also list on-page file names
  const names = await page.evaluate(() => [...document.querySelectorAll('*')].map(e => e.childElementCount === 0 ? (e.textContent||'').trim() : '').filter(t => t.length > 2 && (/seed/i.test(t))).slice(0, 20));
  console.log('seed-named nodes:', names);
  if (await link.count()) {
    await link.click({ timeout: 20000 });
    await sleep(16000);
  }
  console.log('finalUrl:', page.url().slice(0, 180));
  console.log('\nAPI calls after click:');
  const seen = new Set(); api.forEach(c => { if (!seen.has(c)) { console.log('  ' + c); seen.add(c); } });
  console.log('\ntotal calls:', api.length, '| distinct:', seen.size);
  await browser.close();
})();
