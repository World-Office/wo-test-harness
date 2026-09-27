#!/usr/bin/env node
// nonword-wopi.cjs — capture the FULL WOPI call flow for one editor type
// (default sheet/seed.xlsx) to confirm CheckFileInfo + save-path wiring.
const { chromium } = require('playwright');
const OC_URL = process.env.OC_URL || 'https://cloud.graphwiz.ai';
const OC_USER = process.env.OC_USER || 'admin';
const OC_PASS = process.env.OC_PASS || 'wo-od-2026';
const FILE = process.env.PROBE_FILE || 'seed.xlsx';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await ctx.newPage();
  const calls = [];
  page.on('request', r => {
    const u = r.url();
    if (/wopi|checkfileinfo|access_token|api\/documents|convert|fileinfo/i.test(u)) {
      calls.push(r.method() + ' ' + u.split('?')[0] + (u.includes('access_token') ? ' [tok]' : '') + (u.includes('?') ? ' ...' + u.split('?')[1].slice(0, 40) : ''));
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
  await page.waitForTimeout(6500);
  const link = page.locator(`a[href*="${FILE}"]`).first();
  if (await link.count()) await link.click({ timeout: 20000 });
  await page.waitForTimeout(12000);

  console.log('finalUrl:', page.url().slice(0, 120));
  console.log('\nWOPI/WORLDOFFICE calls observed:');
  calls.forEach(c => console.log('  ' + c));
  console.log('\ntotal WOPI-ish calls:', calls.length);
  const ed = page.frames().find(f => /editor\.cloud\.graphwiz\.ai/.test(f.url()));
  if (ed) {
    const inner = await ed.evaluate(() => { const bt = document.body.innerText || ''; return { save: /save/i.test(bt), saving: /saving/i.test(bt) }; }).catch(() => null);
    console.log('editor iframe save-word present:', JSON.stringify(inner));
  }
  await browser.close();
})();
