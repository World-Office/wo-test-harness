const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const url = process.env.E2E_BASE + '/word/?access_token=stub&file_id=long-doc.docx';
  const b = await chromium.launch({ headless: true });
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 40 && !(await page.evaluate(() => (document.querySelector('#editor')?.textContent || '').trim().length > 10).catch(() => false)); i++) await sleep(2000);
  await sleep(1000);
  const state = await page.evaluate(() => {
    const st = document.querySelector('.statusbar') || document.body;
    const texts = [...st.querySelectorAll('*')].map((e) => (e.textContent || '').trim()).filter((t) => t && t.length < 14);
    const sheets = document.querySelectorAll('#editor [class*="wo-page"]').length;
    const pageMarkers = [...document.querySelectorAll('#editor *')].filter((e) => /\/\s*\d+\s*$/.test((e.textContent || '').trim())).map((e) => (e.textContent || '').trim()).slice(0, 4);
    return { sheets, statusTexts: [...new Set(texts)].slice(0, 12), pageMarkers };
  });
  console.log('sheets:', state.sheets);
  console.log('statusbar texts:', JSON.stringify(state.statusTexts));
  console.log('page markers (X/Y):', JSON.stringify(state.pageMarkers));
  // identify trigger #7
  const t7 = await page.evaluate(() => {
    const home = document.querySelector('#toolbar .ribbon-page[data-tab="home"]');
    const trigs = [...home.querySelectorAll('button.menu-trigger, button.styles-trigger')];
    return trigs.length > 7 ? { idx: 7, id: trigs[7].id, text: (trigs[7].textContent || '').trim().slice(0, 30), cls: (trigs[7].className || '').toString().slice(0, 30) } : { n: trigs.length };
  });
  console.log('trigger#7:', JSON.stringify(t7));
  await b.close();
})().catch((e) => { console.error('fail:', e.message); process.exit(1); });
