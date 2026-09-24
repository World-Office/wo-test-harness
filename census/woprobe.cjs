const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await ctx.newPage();
  await page.goto('https://cloud.graphwiz.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !!document.querySelector('#oc-login-password')).catch(() => false)) break; await page.waitForTimeout(500); }
  await page.evaluate(() => {
    const setVal = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    setVal(document.querySelector('#oc-login-username'), 'admin'); setVal(document.querySelector('#oc-login-password'), 'wo-od-2026');
    const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'Log in'); if (b) b.click();
  });
  await page.waitForTimeout(6000);
  await page.locator('a[href*="worepro.docx"]').first().click({ timeout: 15000 });
  let wopiQuery = null;
  for (let i = 0; i < 24 && !wopiQuery; i++) {
    for (const f of page.frames()) {
      const m = /[?&](access_token=[^&]+&file_id=[^&]+|file_id=[^&]+&access_token=[^&]+)/.exec(f.url());
      if (m) wopiQuery = m[1];
    }
    if (!wopiQuery) await page.waitForTimeout(500);
  }
  const t = await ctx.newPage();
  await t.goto('http://192.168.42.42:8088/editors/document/?' + wopiQuery, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await t.waitForTimeout(3000);
  const probe = await t.evaluate(async () => {
    const q = new URLSearchParams(location.search);
    const token = q.get('access_token'), fileId = q.get('file_id');
    const out = {};
    try {
      const r = await fetch('/wopi/files/' + fileId + '?access_token=' + token);
      out.cfiStatus = r.status; out.cfi = "ok";
    } catch (e) { out.cfiErr = String(e); }
    try {
      const r = await fetch('/wopi/files/' + fileId + '/contents?access_token=' + token);
      out.getFileStatus = r.status;
      out.getFileLen = (await r.text()).length;
    } catch (e) { out.getFileErr = String(e); }
    return out;
  });
  console.log(JSON.stringify(probe, null, 1).slice(0, 900));
  await browser.close();
})();
