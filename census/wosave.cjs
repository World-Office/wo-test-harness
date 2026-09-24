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
  await page.locator('a[href*="worepro.docx"]').first().click({ timeout: 15000 });
  let wq = null;
  for (let i = 0; i < 24 && !wq; i++) {
    for (const f of page.frames()) { const m = /[?&](access_token=[^&]+&file_id=[^&]+|file_id=[^&]+&access_token=[^&]+)/.exec(f.url()); if (m) wq = m[1]; }
    if (!wq) await page.waitForTimeout(500);
  }
  const t = await ctx.newPage();
  await t.goto('http://192.168.42.42:8088/health', { timeout: 15000 });
  const buf = await t.evaluate(async (wq) => {
    const p = new URLSearchParams(wq);
    const r = await fetch('http://192.168.42.42:8088/wopi/files/' + p.get('file_id') + '/contents?access_token=' + p.get('access_token'));
    const ab = await (await r.blob()).arrayBuffer();
    return Array.from(new Uint8Array(ab));
  }, wq);
  fs.writeFileSync('/tmp/worepro.docx', Buffer.from(buf));
  console.log('saved', buf.length, 'bytes');
  await browser.close();
})();
