#!/usr/bin/env node
/* coverage-pagination.cjs — (A) sub-menu coverage: open every Home select +
 * menu trigger, pick items; (B) live-typing pagination: does typing past the
 * first sheet re-paginate? */
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const url = process.env.E2E_BASE + '/word/?access_token=stub&file_id=long-doc.docx'
  const b = await chromium.launch({ headless: true })
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(String(m.text())) })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  for (let i = 0; i < 40 && !(await page.evaluate(() => (document.querySelector('#editor')?.textContent || '').trim().length > 10).catch(() => false)); i++) await sleep(2000)
  await sleep(1500)

  // ── (A) SUB-MENU COVERAGE ────────────────────────────────────────────
  const inventory = await page.evaluate(() => {
    const home = document.querySelector('#toolbar .ribbon-page[data-tab="home"]')
    return {
      selects: [...home.querySelectorAll('select')].map((s) => ({ id: s.id, opts: s.options.length })),
      menus: [...home.querySelectorAll('button.menu-trigger, button.styles-trigger')].length,
    }
  })
  console.log(`[SUBMENU] selects=${inventory.selects.length} menu-triggers=${inventory.menus}`)

  // selects: open and pick one option each
  for (const sel of inventory.selects) {
    const r = await page.evaluate((id) => {
      const el = document.getElementById(id)
      if (!el) return 'missing'
      const before = el.value
      const target = [...el.options].find((o) => o.value && o.value !== el.value)
      if (!target) return 'no-option'
      el.value = target.value
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return { id, before, after: el.value }
    }, sel.id).catch((e) => 'err:' + e.message)
    await sleep(400)
    console.log(`[SUBMENU] select#${sel.id} (${sel.opts} opts) -> ${JSON.stringify(r)}`)
  }

  // menu triggers: open, expect a sub-list, click one item, expect it closes
  let menusOpened = 0
  const triggerInfo = await page.evaluate(() => {
    const home = document.querySelector('#toolbar .ribbon-page[data-tab="home"]')
    return [...home.querySelectorAll('button.menu-trigger, button.styles-trigger')].map((t, i) => ({ i, cls: (t.className || '').toString().slice(0, 30) }))
  })
  for (const t of triggerInfo) {
    const r = await page.evaluate((i) => {
      const trig = document.querySelectorAll('#toolbar .ribbon-page[data-tab="home"] button.menu-trigger, #toolbar .ribbon-page[data-tab="home"] button.styles-trigger')[i]
      trig.click()
      return true
    }, t.i).catch(() => false)
    await sleep(400)
    const sub = await page.evaluate(() => {
      const home = document.querySelector('#toolbar .ribbon-page[data-tab="home"]')
      const open = [...home.querySelectorAll('.menu-list')].filter((l) => !l.hidden)
      return open.length ? { n: open.length, items: open[0].querySelectorAll('li').length, text: (open[0].textContent || '').trim().slice(0, 40) } : null
    }).catch(() => null)
    if (sub) {
      menusOpened++
      console.log(`[SUBMENU] trigger#${t.i} open: list with ${sub.items} items ("${sub.text}")`)
      // click the first item and expect the list closes
      await page.evaluate(() => {
        const home = document.querySelector('#toolbar .ribbon-page[data-tab="home"]')
        const open = [...home.querySelectorAll('.menu-list')].find((l) => !l.hidden)
        const item = open.querySelector('li button, li')
        if (item) item.click()
      }).catch(() => {})
      await sleep(400)
      const stillOpen = await page.evaluate(() => {
        const home = document.querySelector('#toolbar .ribbon-page[data-tab="home"]')
        return [...home.querySelectorAll('.menu-list')].filter((l) => !l.hidden).length
      }).catch(() => -1)
      console.log(`[SUBMENU]   after item click, open lists=${stillOpen}`)
    } else {
      console.log(`[SUBMENU] trigger#${t.i} did NOT open a sub-list -> possible broken sub-menu`)
    }
  }
  console.log(`[SUBMENU] menus that opened+covered: ${menusOpened}/${triggerInfo.length}`)

  // ── (B) LIVE TYPING PAGINATION ───────────────────────────────────────
  const before = await page.evaluate(() => document.querySelectorAll('#editor [class*="wo-page"]').length)
  const ed = page.locator('#editor').first()
  await ed.click({ force: true })
  for (let i = 0; i < 25; i++) await page.keyboard.type('Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n', { delay: 1 })
  await sleep(3000)
  const after = await page.evaluate(() => {
    const ed = document.querySelector('#editor')
    const sheets = [...ed.querySelectorAll('[class*="wo-page"]')]
    const last = sheets[sheets.length - 1]
    return { sheets: sheets.length, lastH: last ? Math.round(last.getBoundingClientRect().height) : 0, editorScrollH: ed.scrollHeight }
  })
  console.log(`[PAGINATION-LIVE] sheets before typing=${before} after=${after.sheets} (typed 25 lines)`)
  console.log(`[PAGINATION-LIVE] ${after.sheets > before ? 'PASS: re-paginated' : 'FAIL: typing past the page bottom does NOT create new pages'}`)

  console.log(`[ERRORS] ${errors.length}`)
  await b.close()
}

main().catch((e) => { console.error('fail:', e.message); process.exit(1) })