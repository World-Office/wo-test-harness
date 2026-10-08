#!/usr/bin/env node
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function test(page, cmd, expect) {
  await page.goto(process.env.E2E_BASE + '/word/?access_token=stub&file_id=demo.docx', { waitUntil: 'domcontentloaded', timeout: 60000 })
  for (let i = 0; i < 40; i++) { const t = await page.evaluate(() => ((document.querySelector('#editor')?.textContent) || '').trim().length).catch(() => 0); if (t > 3) break; await sleep(2000) }
  await page.evaluate(() => { const e = document.querySelector('#editor'); e.focus(); const r = document.createRange(); r.selectNodeContents(e); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r) })
  // switch to the tab holding this command
  await page.evaluate((cmd) => {
    const btn = [...document.querySelectorAll('button[data-cmd]')].find(b => b.dataset.cmd === cmd)
    if (!btn) return 'NOBTN'
    const tab = btn.closest('.ribbon-page')?.dataset.tab
    const tb = document.querySelector(`#toolbar button[data-tab="${tab}"]`)
    if (tb) tb.click()
    btn.click()
  }, cmd)
  await sleep(900)
  const res = await page.evaluate(() => {
    const open = [...document.querySelectorAll('.dialog-overlay')].filter(d => d.classList.contains('open')).map(d => d.id)
    return { openDialogs: open, aiProposeOpen: document.getElementById('ai-propose-dialog')?.classList.contains('open') }
  })
  console.log(`${cmd.padEnd(16)} openDialogs=[${res.openDialogs}]  aiProposeOpen=${res.aiProposeOpen}`)
  await page.goto('about:blank')
}
async function main() {
  const b = await chromium.launch({ headless: true })
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } })
  await test(page, 'aiSummarize', true)
  await test(page, 'aiTranslate', true)
  await test(page, 'aiRewrite', true)
  await b.close()
}
main().catch((e) => { console.error('fail', e.message); process.exit(1) })