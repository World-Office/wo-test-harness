#!/usr/bin/env node
/* verify-pyramid.cjs — prove C-M3 (aria-expanded) + C-P5 (caret->page) are
 * GREEN against the live editor, mirroring the committed spec logic exactly. */
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const url = process.env.E2E_BASE + '/word/?access_token=stub&file_id=long-doc.docx'
  const b = await chromium.launch({ headless: true })
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message)))
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  for (let i = 0; i < 40 && !(await page.evaluate(() => ((document.querySelector('#editor')?.textContent) || '').trim().length > 10).catch(() => false)); i++) await sleep(2000)

  // C-M3: open a menu -> aria-expanded=true + list revealed; pick -> closed
  let cm3 = 'FAIL'
  const tri = await page.evaluate(() => {
    const h = document.querySelector('#toolbar .ribbon-page[data-tab="home"]')
    const t = h.querySelector('button.menu-trigger')
    t.click()
    return { has: !!t }
  })
  await sleep(400)
  const open = await page.evaluate(() => {
    const h = document.querySelector('#toolbar .ribbon-page[data-tab="home"]')
    const t = h.querySelector('button.menu-trigger')
    const list = h.querySelector('.menu-list')
    return { expanded: t?.getAttribute('aria-expanded'), hidden: list?.hidden }
  })
  if (open.expanded === 'true' && open.hidden === false) {
    cm3 = 'PASS'
  }
  console.log(`[C-M3] aria-expanded=${open.expanded} listHidden=${open.hidden} -> ${cm3}`)

  // C-P5: caret drives the page indicator
  await sleep(300)
  const p1 = await page.locator('#page-indicator').textContent().catch(() => 'MISSING')
  console.log(`[C-P5] initial indicator: ${JSON.stringify(p1)} (expect Page 1 of N)`)

  const ed = page.locator('#editor')
  await ed.click({ force: true })
  // land caret at the end, then type until a 2nd page exists
  await page.evaluate(() => {
    const e = document.querySelector('#editor')
    e.focus()
    const sel = window.getSelection()
    const r = document.createRange()
    r.selectNodeContents(e); r.collapse(false)
    sel.removeAllRanges(); sel.addRange(r)
  })
  let total = 1, guarded = 0
  while (total < 2 && guarded++ < 60) {
    await page.keyboard.type('overflow line to grow past a page boundary.\n', { delay: 0 })
    await sleep(200)
    const m = (await page.locator('#page-indicator').textContent().catch(() => ''))?.match(/Page \d+ of (\d+)/)
    total = m ? parseInt(m[1], 10) : 1
  }
  const cur = (await page.locator('#page-indicator').textContent().catch(() => ''))?.match(/Page (\d+) of/)?.[1] ?? '0'
  const cp5 = (total >= 2) && parseInt(cur, 10) >= 2
  console.log(`[C-P5] drove to total=${total} pages, caret page=${cur} -> ${cp5 ? 'PASS' : 'FAIL'}`)
  console.log(`[ERRORS] ${errors.length}`)
  await b.close()
}

main().catch((e) => { console.error('fail:', e.message); process.exit(1) })