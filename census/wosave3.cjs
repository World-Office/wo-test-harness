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
  t.on('response', r => { const u = r.url(); if (u.includes('conversion') || u.includes('/wopi/files')) net.push(r.request().method() + ' ' + r.status() + ' ' + u.slice(0, 90)); });
  const cons = []; t.on('console', m => { if (['error', 'warning'].includes(m.type())) cons.push(m.type() + ': ' + m.text().slice(0, 150)); });
  t.on('pageerror', e => cons.push('PAGEERR: ' + String(e).slice(0, 150)));
  await t.goto('http://192.168.42.42:8088/editors/document/?' + wq, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await t.waitForFunction(() => { const ed = document.querySelector('#editor'); return ed && (ed.textContent || '').trim().length > 200; }, { timeout: 30000 });
  await t.waitForTimeout(2500);
  const before = net.length;

  // marker + explicit save via Ctrl+S on a focused body
  await t.evaluate(() => {
    const ed = document.querySelector('#editor');
    const p = document.createElement('p'); p.textContent = 'PORTED-WYSIWYG-SAVE-MARKER-9f2c';
    ed.appendChild(p); ed.dispatchEvent(new Event('input', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true, cancelable: true }));
  });
  await t.waitForTimeout(8000);
  console.log('NET after save:', JSON.stringify(net.slice(before), null, 1));
  console.log('CONSOLE:', cons.length ? cons.slice(0, 5) : 'quiet');
  const status = await t.evaluate(() => { const s = document.querySelector('.status-message, #status-message, [class*="status"]'); return s ? (s.textContent || '').slice(0, 80) : null; });
  console.log('status text:', status);
  await browser.close();
})();
