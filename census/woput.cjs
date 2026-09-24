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
  await t.goto('http://192.168.42.42:8088/editors/document/?' + wq, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await t.waitForTimeout(1500);
  const out = await t.evaluate(async (wq) => {
    const p = new URLSearchParams(wq);
    const fileId = p.get('file_id'), token = p.get('access_token');
    // fresh small docx (the one we just proved works)
    const conv = await fetch('/api/conversion/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: btoa('<html><body><p>PUTPROBE-7c1a</p></body></html>'), source_format: 'html', target_format: 'docx' }) });
    const cj = await conv.json();
    if (!cj.data) return { stage: 'convert', cj };
    const bytes = Uint8Array.from(atob(cj.data), c => c.charCodeAt(0));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort('timeout 15s'), 15000);
    try {
      const r = await fetch('/wopi/files/' + fileId + '/contents?access_token=' + token, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-WOPI-Override': 'PUT' }, body: bytes, signal: ctrl.signal });
      const body = await r.text().catch(() => '');
      clearTimeout(timer);
      return { stage: 'put', status: r.status, body: body.slice(0, 200) };
    } catch (e) { clearTimeout(timer); return { stage: 'put-throw', err: String(e) }; }
  }, wq);
  console.log('PUTPROBE:', JSON.stringify(out, null, 1));
  await browser.close();
})();
