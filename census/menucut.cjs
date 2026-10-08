#!/usr/bin/env node
/* menucut.cjs — reproduce "menu gets cut after maximize". Opens each Home
 * dropdown, measures its box vs the clip ancestor + viewport, at default size
 * and after enlarging the viewport (maximize emulation), reporting any clip. */
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function openMenus(page) {
  const out = []
  const idx = await page.evaluate(() => {
    const h = document.querySelector('#toolbar .ribbon-page[data-tab="home"]')
    return h ? h.querySelectorAll('button.menu-trigger, button.styles-trigger').length : 0
  })
  for (let i = 0; i < idx; i++) {
    await page.evaluate((k) => {
      document.querySelectorAll('#toolbar .ribbon-page[data-tab="home"] button.menu-trigger, #toolbar .ribbon-page[data-tab="home"] button.styles-trigger')[k].click()
    }, i).catch(() => {})
    await sleep(120)
    const m = await page.evaluate(() => {
      const h = document.querySelector('#toolbar .ribbon-page[data-tab="home"]')
      const open = [...h.querySelectorAll('.menu-list')].find((l) => !l.hidden)
      if (!open) return null
      const r = open.getBoundingClientRect()
      // nearest scrollable/hidden-overflow ancestor (the clip box)
      let a = open.parentElement, clip = null
      while (a) {
        const cs = getComputedStyle(a)
        if (cs.overflowY === 'hidden' || cs.overflowY === 'auto' || cs.overflow === 'hidden') {
          const ar = a.getBoundingClientRect()
          const clipped = r.bottom > ar.bottom + 1 || r.right > ar.right + 1 || r.left < ar.left - 1
          if (clipped) { clip = { cls: (a.className || '').toString().slice(0, 30), tag: a.tagName, clipped }; break }
        }
        a = a.parentElement
      }
      const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight
      // paint-visible check: is a real menu item under the menu's center?
      const item = open.querySelector('button')
      const centered = item ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null
      const painted = !!(centered && open.contains(centered))
      return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom),
               vw, vh, offRight: r.right > vw, offBottom: r.bottom > vh, clip, painted }
    }).catch(() => null)
    if (m) out.push({ i, ...m })
  }
  return out
}

async function main() {
  const url = process.env.E2E_BASE + '/word/?access_token=stub&file_id=demo.docx'
  const b = await chromium.launch({ headless: true })
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  for (let i = 0; i < 40 && !(await page.evaluate(() => ((document.querySelector('#editor')?.textContent) || '').trim().length > 3).catch(() => false)); i++) await sleep(2000)
  await sleep(800)

  console.log('--- at 1440x1100 (default) ---')
  const d = await openMenus(page)
  d.forEach((m) => console.log(`menu#${m.i} box=(${m.left},${m.top})-(${m.right},${m.bottom}) vw=${m.vw} offRight=${m.offRight} offBottom=${m.offBottom} painted=${m.painted} clip=${JSON.stringify(m.clip)}`))

  console.log('--- after maximize (2560x1440) ---')
  await page.setViewportSize({ width: 2560, height: 1440 })
  await sleep(600)
  const m2 = await openMenus(page)
  m2.forEach((m) => console.log(`menu#${m.i} box=(${m.left},${m.top})-(${m.right},${m.bottom}) vw=${m.vw} offRight=${m.offRight} offBottom=${m.offBottom} painted=${m.painted} clip=${JSON.stringify(m.clip)}`))
  await b.close()
}
main().catch((e) => { console.error('fail:', e.message); process.exit(1) })