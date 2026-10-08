#!/usr/bin/env node
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const url = process.env.E2E_BASE + '/word/?access_token=stub&file_id=demo.docx'
  const b = await chromium.launch({ headless: true })
  const page = await b.newPage({ viewport: { width: 1440, height: 1200 } })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  for (let i = 0; i < 40 && !(await page.evaluate(() => ((document.querySelector('#editor')?.textContent) || '').trim().length > 3).catch(() => false)); i++) await sleep(2000)
  await sleep(600)
  // the tall Styles menu (idx 6) was the worst-clipped offender
  await page.evaluate(() => {
    document.querySelectorAll('#toolbar .ribbon-page[data-tab="home"] button.styles-trigger')[0]?.click()
  })
  await sleep(400)
  await page.screenshot({ path: '/tmp/menu-after-fix.png' })
  console.log('screenshot /tmp/menu-after-fix.png (styles menu over page)')
  await b.close()
}
main().catch((e) => { console.error('fail', e.message); process.exit(1) })