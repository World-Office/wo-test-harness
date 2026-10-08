const { chromium } = require('playwright')
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function main() {
  const url = process.env.E2E_BASE + '/word/?access_token=stub&file_id=demo.docx'
  const b = await chromium.launch({ headless: true }); const page = await b.newPage({ viewport: { width: 1440, height: 1100 } })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  for (let i = 0; i < 40; i++) { const t = await page.evaluate(() => ((document.querySelector('#editor')?.textContent) || '').trim().length).catch(() => 0); if (t > 3) break; await sleep(2000) }
  await page.evaluate(() => { document.querySelector('#editor').focus(); document.execCommand('insertHTML', false, '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>') })
  await page.evaluate(() => { const c = document.querySelector('#editor table td'); const r = document.createRange(); r.selectNodeContents(c); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); document.getElementById('op-merge').click() })
  await sleep(250)
  console.log('merge-span:', await page.evaluate(() => { const t = document.querySelector('#editor table'); let ms = 0; t.querySelectorAll('td').forEach(d => { if (d.colSpan > 1) ms++ }); return `${ms} cells with colspan>1` }))
  await page.evaluate(() => { const c = document.querySelector('#editor table td'); const r = document.createRange(); r.selectNodeContents(c); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); document.getElementById('op-split').click() })
  await sleep(250)
  console.log('after split (rows/cols):', await page.evaluate(() => { const t = document.querySelector('#editor table'); return t.querySelectorAll('tr').length + 'r x ' + t.querySelectorAll('tr')[0].querySelectorAll('td').length + 'c' }))
  await b.close()
}
main().catch(e => { console.error('fail', e.message); process.exit(1) })
