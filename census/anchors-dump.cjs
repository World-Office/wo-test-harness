const { chromium } = require('playwright');
const OC_URL = process.env.OC_URL || 'https://cloud.graphwiz.ai';
const OC_USER = process.env.OC_USER || 'admin';
const OC_PASS = process.env.OC_PASS || 'wo-od-2026';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1100 } })).newPage();
  await page.goto(OC_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!document.querySelector('#oc-login-password')).catch(() => false)) break; await page.waitForTimeout(500); }
  await page.fill('#oc-login-username', OC_USER);
  await page.fill('#oc-login-password', OC_PASS);
  await page.click('button:has-text("Log in")');
  await page.waitForTimeout(9000);
  await page.goto(OC_URL + '/files/spaces/personal/admin/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(8000);
  // find element whose text is exactly 'seed.vsdx'
  const info = await page.evaluate(() => {
    const byText = [...document.querySelectorAll('button, [role="button"], [class*="oc-resource" i]')].find(e => (e.textContent||'').trim() === 'seed.vsdx');
    if (!byText) return { found: false };
    const chain = [];
    let node = byText;
    for (let i = 0; i < 9 && node; i++) {
      const cls = (node.className||'').toString();
      chain.push({ tag: node.tagName, cls: cls.slice(0,80), testid: (node.getAttribute && node.getAttribute('data-testid'))||'', href: (node.getAttribute && node.getAttribute('href')||'').slice(0,80) });
      node = node.parentElement;
    }
    const row = byText.closest('div, li, tr') || byText;
    return { found: true, outerHTML: row.outerHTML.slice(0, 1800), chain };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
