const { chromium } = require('playwright');
(async () => {
  const url = process.env.E2E_BASE + '/word/?access_token=stub&file_id=long-doc.docx';
  const b = await chromium.launch({ headless: true });
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 30; i++) {
    const len = await page.evaluate(() => (document.querySelector('#editor')?.textContent || '').trim().length).catch(() => 0);
    if (len > 10) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  const inv = await page.evaluate(() => {
    const home = document.querySelector('#toolbar .ribbon-page[data-tab="home"]');
    const tally = {};
    if (!home) return { error: 'no home page' };
    for (const el of home.querySelectorAll('select, button, span, div')) {
      const cls = (el.className || '').toString().split(/\s+/)[0] || el.tagName.toLowerCase();
      tally[`${el.tagName.toLowerCase()}.${cls}`] = (tally[`${el.tagName.toLowerCase()}.${cls}`] || 0) + 1;
    }
    const selects = home.querySelectorAll('select').length, menus = home.querySelectorAll('.menu-trigger').length;
    const selectIds = [...home.querySelectorAll('select')].map(s => s.id);
    const menuIds = [...home.querySelectorAll('.menu-trigger')].map(t => t.id);
    return { tally, selects, menus, selectIds, menuIds };
  });
  console.log('selects:', inv.selects, 'menu-triggers:', inv.menus);
  console.log('select ids:', inv.selectIds?.slice(0, 10));
  console.log('menu ids:', inv.menuIds?.slice(0, 10));
  console.log('tally:', JSON.stringify(inv.tally, null, 0).slice(0, 900));
  await b.close();
})().catch(e => { console.error('fail:', e.message); process.exit(1); });
