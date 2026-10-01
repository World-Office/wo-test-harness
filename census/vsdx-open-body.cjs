#!/usr/bin/env node
// vsdx-open-body.cjs — capture the /app/open request + response body for seed.vsdx
const { chromium } = require('playwright');
const OC_URL = process.env.OC_URL || 'https://cloud.graphwiz.ai';
const OC_USER = process.env.OC_USER || 'admin';
const OC_PASS = process.env.OC_PASS || 'wo-od-2026';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await ctx.newPage();
  page.on('request', async r => {
    if (/app\/open/.test(r.url())) {
      console.log('APP_OPEN_REQUEST [' + r.method() + '] ' + r.url().split('?')[0]);
      const pd = r.postData();
      if (pd) console.log('APP_OPEN_REQBODY: ' + pd.slice(0, 800));
    }
  });
  page.on('response', async r => {
    if (/app\/open/.test(r.url())) {
      console.log('APP_OPEN_RESPONSE [' + r.status() + '] ct=' + ((await r.headers())['content-type']||''));
      try { console.log('APP_OPEN_RESPBODY: ' + (await r.text()).slice(0, 800)); } catch (e) { console.log('(no body)'); }
    }
    if (/hosting\/wopi|app_source|editor\.cloud/g.test(r.url())) {
      console.log('EDITOR_CALL [' + r.status() + '] ' + r.url().slice(0, 200));
    }
  });
  await page.goto(OC_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!document.querySelector('#oc-login-password')).catch(() => false)) break; await page.waitForTimeout(500); }
  await page.fill('#oc-login-username', OC_USER);
  await page.fill('#oc-login-password', OC_PASS);
  await page.click('button:has-text("Log in")');
  await page.waitForTimeout(9000);
  const extUrl = OC_URL + '/external-worldoffice/personal/admin/seed.vsdx';
  console.log('NAV:', extUrl);
  try {
    await page.goto(extUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(15000);
    console.log('finalUrl:', page.url().slice(0, 200));
    const hasIframe = await page.evaluate(() => !!document.querySelector('iframe')).catch(() => false);
    console.log('hasIframe:', hasIframe);
    if (hasIframe) {
      const src = await page.evaluate(() => { const f=[...document.querySelectorAll('iframe')].map(x=>x.src); return f.join('\n'); }).catch(()=> '');
      console.log('IFRAME_SRCS:\n' + src.slice(0, 1000));
    }
  } catch (e) { console.log('NAV error:', e.message.slice(0, 160)); }
  await browser.close();
})();
