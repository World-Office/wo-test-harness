#!/usr/bin/env node
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const url = process.env.E2E_BASE + '/word/?access_token=stub&file_id=demo.docx'
  const b = await chromium.launch({ headless: true })
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  for (let i = 0; i < 40; i++) { const t = await page.evaluate(() => ((document.querySelector('#editor')?.textContent) || '').trim().length).catch(() => 0); if (t > 3) break; await sleep(2000) }
  // inject a 3x2 table and place caret in cell(1,1)
  await page.evaluate(() => {
    document.querySelector('#editor').focus()
    document.execCommand('insertHTML', false,
      '<p>before</p><table class="wo-table"><tbody>' +
      '<tr><td id="c00">A</td><td>B</td></tr>' +
      '<tr><td>C</td><td>D</td></tr>' +
      '<tr><td>E</td><td>F</td></tr></tbody></table><p>after</p>')
    const c = document.getElementById('c00')
    const r = document.createRange(); r.selectNodeContents(c)
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r)
  })
  await sleep(300)
  const dim = () => page.evaluate(() => { const t = document.querySelector('#editor table'); return t ? t.querySelectorAll('tr').length + 'r x ' + t.querySelectorAll('tr')[0].querySelectorAll('td,th').length + 'c' : 'no-table' })
  console.log('initial:', await dim())
  // open table ops + click row-above
  await page.evaluate(() => { const b = document.getElementById('op-row-above'); if (b) b.click() })
  await sleep(200); console.log('after op-row-above:', await dim())
  await page.evaluate(() => { const b = document.getElementById('op-col-left'); if (b) b.click() })
  await sleep(200); console.log('after op-col-left:', await dim())
  await page.evaluate(() => { const b = document.getElementById('op-del-col'); if (b) b.click() })
  await sleep(200); console.log('after op-del-col:', await dim())
  await page.evaluate(() => { const b = document.getElementById('op-merge'); const c = document.getElementById('c00'); const r = document.createRange(); r.selectNodeContents(c); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); if (b) b.click() })
  await sleep(200); console.log('after op-merge:', await page.evaluate(() => { const t = document.querySelector('#editor table'); let ms = 0; t.querySelectorAll('td').forEach(td => { if (td.colSpan > 1 || td.rowSpan > 1) ms++ }); return `merge-cells-with-span=${ms}` }))
  // open table ops via the dialog trigger to confirm wiring (btn-table-ops)
  await page.evaluate(() => { document.getElementById('btn-table-ops')?.click() })
  await sleep(250)
  console.log('table-ops dialog opens:', await page.evaluate(() => document.getElementById('table-ops-dialog')?.classList.contains('open')))
  await b.close()
}
main().catch((e) => { console.error('fail', e.message); process.exit(1) })