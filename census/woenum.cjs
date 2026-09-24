const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('https://cloud.graphwiz.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !!document.querySelector('#oc-login-password')).catch(() => false)) break; await page.waitForTimeout(500); }
  await page.evaluate(() => {
    const setVal = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    setVal(document.querySelector('#oc-login-username'), 'admin'); setVal(document.querySelector('#oc-login-password'), 'wo-od-2026');
    const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'Log in'); if (b) b.click();
  });
  await page.waitForTimeout(9000);
  const state = await page.evaluate(() => ({
    url: location.pathname,
    links: [...document.querySelectorAll('a')].map(a => ((a.innerText||'').trim() + ' :: ' + (a.getAttribute('href')||'').slice(0,60))).filter(x => x.length > 6).slice(0, 20),
    docxAnchors: [...document.querySelectorAll('a')].length,
  }));
  console.log(JSON.stringify(state, null, 1));
  await page.screenshot({ path: '/tmp/usrflow/files-list.png' });
  await browser.close();
})();
