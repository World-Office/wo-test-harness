#!/usr/bin/env node
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const url = process.env.E2E_BASE + '/word/?access_token=stub&file_id=demo.docx'
  const b = await chromium.launch({ headless: true })
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  for (let i = 0; i < 40; i++) { const t = await page.evaluate(() => ((document.querySelector('#editor')?.textContent) || '').trim().length).catch(() => 0); if (t > 3) break; await sleep(2000) }
  const checked = []
  const tests = [
    ['btn-header', '.page-header', 'header'],
    ['btn-footer', '.page-footer', 'footer'],
    ['btn-footnote', '.footnote-citation', 'footnote'],
    ['btn-endnote', '.endnote-citation', 'endnote'],
    ['btn-pagenumber', '.page-number', 'page-number'],
  ]
  for (const [id, sel, label] of tests) {
    const r = await page.evaluate(([btnId, selector, name]) => {
      const but = document.getElementById(btnId)
      if (!but) return `NO-BTN ${btnId}`
      but.click()
      const found = document.querySelector('#editor ' + selector)
      return found ? `OK ${name}:<${found.tagName.toLowerCase()}>` : `MISSING ${name}`
    }, [id, sel, label])
    checked.push(r)
  }
  console.log(checked.join('\n'))
  await b.close()
}
main().catch((e) => { console.error('fail', e.message); process.exit(1) })