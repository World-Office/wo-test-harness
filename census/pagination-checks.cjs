#!/usr/bin/env node
/* pagination-check.cjs — reproduce the pagination + sub-menu defects against
 * the real wysiwyg editor. */
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const base = process.env.E2E_BASE
  const url = `${base}/word/?access_token=stub&file_id=${encodeURIComponent(process.env.E2E_DOC || 'demo.docx')}`
  const b = await chromium.launch({ headless: true })
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(String(m.text())) })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  let loaded = false
  for (let i = 0; i < 45 && !loaded; i++) {
    await sleep(2000)
    loaded = await page.evaluate(() => (document.querySelector('#editor')?.textContent || '').trim().length > 10).catch(() => false)
  }
  await sleep(1500)

  // ── PAGINATION ──────────────────────────────────────────────────────
  const pg = await page.evaluate(() => {
    const ed = document.querySelector('#editor')
    const sheets = [...ed.querySelectorAll('[class*="wo-page"]')]
    const text = (ed.textContent || '').trim()
    // any paragraph count estimate + last sheet bottom vs content
    const first = sheets[0]?.getBoundingClientRect()
    const last = sheets[sheets.length - 1]?.getBoundingClientRect()
    return {
      sheets: sheets.length,
      textLen: text.length,
      pages: ed.querySelectorAll('.wo-page, [class*="page"]').length,
      firstH: first ? Math.round(first.height) : 0,
      lastTop: last ? Math.round(last.top) : 0,
    }
  })
  console.log(`[PAGINATION] sheets=${pg.sheets} textLen=${pg.textLen} docPageCount=${pg.pages} firstSheetH=${pg.firstH}`)
  if (pg.sheets > 1) console.log('[PAGINATION] PASS: document paginates into multiple sheets')
  else console.log('[PAGINATION] FAIL: single sheet for a >1-page document')

  // ── SUB-MENUS ───────────────────────────────────────────────────────
  const menus = await page.evaluate(() => {
    const home = document.querySelector('#toolbar [data-tab="home"]')
    if (!home) return []
    const out = []
    for (const t of home.querySelectorAll('.menu-trigger, .toolbar-select, [aria-haspopup="true"]')) {
      out.push({ id: t.id, cls: (t.className || '').toString().slice(0, 40), tag: t.tagName })
    }
    return out
  })
  console.log(`[SUBMENU] triggers on Home: ${menus.length}`)
  let opened = 0
  for (const m of menus) {
    const openedRes = await page.evaluate(({ id, cls }) => {
      const el = document.getElementById(id) || [...document.querySelectorAll('.menu-trigger')].find((e) => (e.className || '').includes(cls.split(' ')[0]))
      if (!el) return null
      el.click()
      return true
    }, m).catch(() => null)
    await sleep(400)
    if (openedRes) opened++
  }
  const sublists = await page.evaluate(() => {
    const home = document.querySelector('#toolbar [data-tab="home"]')
    return [...home.querySelectorAll('.menu-list')].filter((l) => !l.hidden).length
  })
  console.log(`[SUBMENU] triggers clicked=${opened} visible sub-lists=${sublists}`)

  console.log(`[ERRORS] page/console errors: ${errors.length}`)
  await b.close()
}

main().catch((e) => { console.error('check fail:', e.message); process.exit(1) })