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
  await page.waitForTimeout(9000);
  await page.locator('a[href*="port-hfgate.docx"]').first().click({ timeout: 25000 });
  let wq = null;
  for (let i = 0; i < 30 && !wq; i++) {
    for (const f of page.frames()) { const m = /[?&](access_token=[^&]+&file_id=[^&]+|file_id=[^&]+&access_token=[^&]+)/.exec(f.url()); if (m) wq = m[1]; }
    if (!wq) await page.waitForTimeout(500);
  }
  const t = await ctx.newPage();
  const net = [];
  t.on('response', r => { const u = r.url(); if (u.includes('conversion') || u.includes('/wopi/files')) net.push(r.request().method() + ' ' + r.status() + ' ' + u.slice(7, 100)); });
  t.on('pageerror', e => net.push('PAGEERR ' + String(e).slice(0, 120)));
  await t.goto('http://192.168.42.42:8088/editors/document/?' + wq, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await t.waitForFunction(() => { const ed = document.querySelector('#editor'); return ed && (ed.textContent || '').trim().length > 200; }, { timeout: 30000 });
  await t.waitForTimeout(2500);

  await t.evaluate(() => localStorage.clear());
  await t.click('#editor p, #editor > *', { timeout: 10000 }).catch(async () => { await t.click('#editor'); });
  await t.evaluate(() => {
    const ed = document.querySelector('#editor');
    const p = document.createElement('p'); p.textContent = 'PORTED-WYSIWYG-SAVE-MARKER-9f2c';
    ed.appendChild(p); ed.dispatchEvent(new Event('input', { bubbles: true }));
    window.dispatchEvent(new Event('online'));
  });
  const before = net.length;
  await t.keyboard.press('Control+s');
  for (let i = 0; i < 30; i++) { if (net.slice(before).some(x => x.includes('contents') && x.startsWith('POST'))) break; await t.waitForTimeout(500); }
  await t.waitForTimeout(1500);
  console.log('NET:', JSON.stringify(net.slice(before), null, 1));
  await t.screenshot({ path: '/tmp/usrflow/wysiwyg-port2.png' });
  await browser.close();
})();
