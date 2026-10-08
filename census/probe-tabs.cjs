#!/usr/bin/env node
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const url = process.env.E2E_BASE + '/word/?access_token=stub&file_id=demo.docx'
  const b = await chromium.launch({ headless: true })
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  for (let i = 0; i < 40; i++) { const t = await page.evaluate(() => ((document.querySelector('#editor')?.textContent) || '').trim().length).catch(() => 0); if (t > 3) break; await sleep(2000) }
  const r = await page.evaluate(() => {
    const out = {}
    const toolbar = document.querySelector('#toolbar')
    out.tabs = [...toolbar.querySelectorAll('.ribbon-tab, button[data-tab]')].map(t => t.getAttribute('data-tab') || t.textContent.trim())
    out.pages = [...toolbar.querySelectorAll('.ribbon-page')].map(p => p.getAttribute('data-tab'))
    // which page is visible now
    out.visiblePages = [...toolbar.querySelectorAll('.ribbon-page')].filter(p => p.offsetParent !== null).map(p => p.getAttribute('data-tab'))
    // try switching tabs
    const tabBtns = [...toolbar.querySelectorAll('.ribbon-tab, [data-tab]')].filter(t => t.tagName === 'BUTTON')
    const switched = []
    for (const tb of tabBtns.slice(0, 12)) {
      tb.click()
      const vis = [...toolbar.querySelectorAll('.ribbon-page')].filter(p => p.offsetParent !== null).map(p => p.getAttribute('data-tab')).join(',')
      switched.push(`tab=${tb.getAttribute('data-tab')||tb.textContent.trim()} -> visible:[${vis}]`)
    }
    out.switchResults = switched
    return out
  })
  console.log('TABS:', r.tabs)
  console.log('PAGES:', r.pages)
  console.log('VISIBLE(initial):', r.visiblePages)
  console.log('SWITCH:')
  for (const s of r.switchResults) console.log('  ' + s)
  await b.close()
}
main().catch((e) => { console.error('fail', e.message); process.exit(1) })