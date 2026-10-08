#!/usr/bin/env node
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const CMDS = ['ocrRun','aiSummarize','aiTranslate','aiRewrite','toggleNavigation','browsePlugins','managePlugins','photoEditor','toggleInk','inkMode','toggleDropcap','openBorders','insertCaption','insertCitation','insertObject','link','insertFootnote','insertEndnote']
async function main() {
  const url = process.env.E2E_BASE + '/word/?access_token=stub&file_id=demo.docx'
  const b = await chromium.launch({ headless: true })
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  for (let i = 0; i < 40; i++) { const t = await page.evaluate(() => ((document.querySelector('#editor')?.textContent) || '').trim().length).catch(() => 0); if (t > 3) break; await sleep(2000) }
  await page.evaluate(() => { const e = document.querySelector('#editor'); e.focus(); const r = document.createRange(); r.selectNodeContents(e); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); })
  for (const c of CMDS) {
    const res = await page.evaluate((cmd) => {
      // locate a real button carrying this data-cmd (across all ribbon pages)
      const btn = document.querySelector(`button[data-cmd="${cmd}"]`) || [...document.querySelectorAll('button[data-cmd]')].find(b => b.dataset.cmd === cmd)
      if (!btn) return 'NOBTN'
      // reveal its tab so the effect is measurable and the click is real
      const page = btn.closest('.ribbon-page')
      if (page) { const tb = document.querySelector(`#toolbar button[data-tab="${page.dataset.tab}"]`); if (tb) tb.click() }
      // open its menu if it lives inside one
      const menu = btn.closest('.menu-list')
      const trig = btn.closest('.rb-menu')?.querySelector('.menu-trigger')
      if (trig) trig.click()
      const snap = { ed: (document.querySelector('#editor')?.innerHTML || '').length, st: document.querySelector('#status')?.textContent || '', di: [...document.querySelectorAll('.dialog-overlay')].filter(d => d.classList.contains('open')).length, lb: document.querySelector('#navigation-panel, #bookmarks-panel')?.classList.contains('open') ? 'nav' : '', diag: btn.closest('.dialog-overlay')?.id || '' }
      btn.click()
      return snap
    }, c)
    await sleep(700)
    if (res === 'NOBTN') { console.log(`${c.padEnd(18)} NO-BUTTON`); continue }
    const now = await page.evaluate((r) => { const ed = (document.querySelector('#editor')?.innerHTML || '').length; const st = ((document.querySelector('#status')?.textContent)||'').trim(); const di = [...document.querySelectorAll('.dialog-overlay')].filter(d => d.classList.contains('open')).length; return { ed, st, di } }, res)
    const ef = ((now.ed !== res.ed) ? 'content' : '') + ((now.di !== res.di) ? '+dialog' : '')
    console.log(`${c.padEnd(18)} ${ef || 'NONE'}  status="${now.st.slice(0,34)}"`)
  }
  await b.close()
}
main().catch((e) => { console.error('fail', e.message); process.exit(1) })