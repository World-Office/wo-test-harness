#!/usr/bin/env node
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const url = process.env.E2E_BASE + '/word/?access_token=stub&file_id=demo.docx'
  const b = await chromium.launch({ headless: true })
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  for (let i = 0; i < 40 && !(await page.evaluate(() => ((document.querySelector('#editor')?.textContent) || '').trim().length > 3).catch(() => false)); i++) await sleep(2000)
  await sleep(600)
  const rows = await page.evaluate(() => {
    const home = document.querySelector('#toolbar .ribbon-page[data-tab="home"]')
    if (!home) return ['NO HOME PAGE']
    const out = []
    for (const el of home.querySelectorAll('button, select')) {
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18)
      out.push({
        tag: el.tagName, id: el.id || '', cls: (el.className || '').toString(),
        data: el.getAttribute('data-cmd') || el.getAttribute('data-soy') || '',
        title: el.getAttribute('title') || el.getAttribute('aria-label') || '', text: t,
      })
    }
    return out
  })
  for (const r of rows) console.log([r.tag, r.cls.split(' ').filter(c=>!c.includes('--')&&c!=='menu-trigger').join('.')||'-', r.id, 'data='+(r.data||'-'), 'title='+(r.title||'').slice(0,28), (r.text?'['+r.text+']':'')].join('  '))
  await b.close()
}
main().catch((e) => { console.error('fail', e.message); process.exit(1) })