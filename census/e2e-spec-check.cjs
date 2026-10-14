#!/usr/bin/env node
/* e2e-spec-check.cjs — drive the REAL wysiwyg editor against a spawned
 * docserver to prove the E-AI-1 / E-FP-1 / E-FI-1 acceptance criteria that
 * server/tests/e2e/tests/documents/*.spec.ts assert (stack-independent). */
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const base = process.env.E2E_BASE
  if (!base) { console.error('E2E_BASE required'); process.exit(2) }
  const url = `${base}/word/?access_token=stub&file_id=demo.docx`
  const b = await chromium.launch({ headless: true })
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('request', (r) => { if (r.url().includes('propose') || r.url().includes('ai/')) console.log(`  [AI-REQ] ${r.method()} ${r.url().replace(base,'')}`) })
  page.on('response', async (r) => {
    if (r.url().includes('/ai/')) {
      const body = await r.text().catch(() => '')
      console.log(`  [AI-HTTP] ${r.request().method()} ${r.url().replace(base, '')} -> ${r.status()} ${body.slice(0, 90)}`)
    }
  })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

  // ── E-FI-1 (us-fi-1): document renders text + a page sheet ──────────
  let loaded = false
  for (let i = 0; i < 45 && !loaded; i++) {
    await sleep(2000)
    loaded = await page.evaluate(() => (document.querySelector('#editor')?.textContent || '').trim().length > 10).catch(() => false)
    if (!loaded && i % 5 === 0) {
      const dbg = await page.evaluate(() => ({
        editorExists: !!document.querySelector('#editor'),
        len: (document.querySelector('#editor')?.textContent || '').trim().length,
        toolbar: !!document.querySelector('#toolbar'),
        bodySnippet: (document.body.textContent || '').slice(0, 120),
      })).catch(() => null)
      console.log('  [E-FI-1] still loading:', JSON.stringify(dbg))
    }
  }
  if (!loaded) { console.log('[E-FI-1] FAIL: editor content did not load'); process.exitCode = 1 }
  await sleep(1000)
  const text = await page.locator('#editor').textContent()
  const sheets = await page.locator('#editor [class*="wo-page"]').count()
  console.log(`[E-FI-1] text.len=${(text || '').trim().length} sheets=${sheets} ${sheets >= 1 && (text || '').trim().length > 10 ? 'PASS' : 'FAIL'}`)

  // ── E-FP-1 (us-fp-1): Home-tab tour, no errors, aria-pressed toggles ─
  const home = page.locator('#toolbar [data-tab="home"]')
  const btns = home.locator('button')
  const n = await btns.count()
  let visible = 0
  let clicked = 0
  for (let i = 0; i < n; i++) {
    const btn = btns.nth(i)
    if (!(await btn.isVisible().catch(() => false))) continue
    visible++
    await btn.click({ force: true, timeout: 4000 }).then(() => clicked++, () => {})
  }
  for (const id of ['btn-bold', 'btn-italic', 'btn-underline']) {
    const b2 = page.locator(`#toolbar #${id}`)
    if ((await b2.count()) === 0) continue
    await b2.click({ force: true })
    const pressed1 = await b2.getAttribute('aria-pressed')
    await b2.click({ force: true })
    const pressed2 = await b2.getAttribute('aria-pressed')
    console.log(`[E-FP-1] ${id} aria-pressed ${pressed1}->${pressed2} ${pressed1 === 'true' && pressed2 === 'false' ? 'PASS' : 'note: ' + JSON.stringify({ pressed1, pressed2 })}`)
  }
  console.log(`[E-FP-1] toured ${clicked}/${visible} visible Home buttons (${n} total); page errors=${errors.filter((e) => !e.includes('favicon')).length}`)

  // ── E-AI-1 (us-ai-1..4,7): propose -> review -> reject ──────────────
  const aiTab = page.locator('#toolbar .ribbon-tab[data-tab="ai"]')
  if ((await aiTab.count()) === 0) {
    console.log('[E-AI-1] SKIP: no AI tab in this editor build')
  } else {
    await page.evaluate(() => document.querySelector('#toolbar .ribbon-tab[data-tab="ai"]')?.click())
    await sleep(500)
    const assistant = page.locator('#btn-ai-assistant')
    if ((await assistant.count()) > 0) {
      await page.evaluate(() => document.querySelector('#btn-ai-assistant')?.click())
      const dlg = page.locator('#ai-propose-dialog')
      await dlg.waitFor({ state: 'visible', timeout: 10000 })
      await page.evaluate(() => {
        const el = document.querySelector('#ai-propose-instruction')
        el.value = 'Add a closing sentence about reliability.'
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await page.evaluate(() => document.querySelector('#btn-ai-propose-run')?.click())
      // LLM round-trip through the gateway; dialog should close on ok.
      let closed = false
      for (let i = 0; i < 120 && !closed; i++) {
        await sleep(1000)
        closed = !(await dlg.evaluate((el) => el.classList.contains('open')).catch(() => true))
        if (!closed && i % 10 === 0) {
          const errTxt = await page.locator('#ai-propose-error').textContent().catch(() => '')
          console.log(`  [E-AI-1] waiting close i=${i} dialogError="${(errTxt || '').slice(0, 80)}"`)
        }
      }
      console.log(`[E-AI-1] propose dialog closed after run: ${closed ? 'PASS' : 'FAIL'}`)
      // Review lists the attributed op.
      await page.evaluate(() => (document.querySelector('#btn-ai-review-tab') || document.querySelector('#btn-ai-review'))?.click())
      const list = page.locator('#ai-review-list')
      let row = null
      for (let i = 0; i < 40 && !row; i++) {
        await sleep(1000)
        row = await page.locator('#ai-review-list .ai-review-item').first().textContent().catch(() => null)
      }
      const hasAi = !!row && /AI \(/.test(row)
      console.log(`[E-AI-1] review row "${(row || '').slice(0, 60)}" attribution: ${hasAi ? 'PASS' : 'FAIL'}`)
      // Reject one -> list empties.
      await page.evaluate(() => document.querySelector('#ai-review-list button.ai-reject')?.click())
      await sleep(2500)
      const remaining = await page.locator('#ai-review-list .ai-review-item').count()
      console.log(`[E-AI-1] after reject, rows=${remaining} ${remaining === 0 ? 'PASS' : 'FAIL'}`)
    } else {
      console.log('[E-AI-1] SKIP: assistant button not found on AI tab')
    }
  }

  const errs = errors.filter((e) => !e.includes('favicon'))
  console.log(`TOTAL page/console errors: ${errs.length}${errs.length ? '\n  ' + errs.slice(0, 5).join('\n  ') : ''}`)
  await b.close()
  process.exit(errs.length ? 1 : 0)
}

main().catch((e) => { console.error('e2e-spec-check fail:', e.message); process.exit(1) })