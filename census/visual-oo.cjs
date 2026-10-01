#!/usr/bin/env node
/* visual-oo.cjs — capture the OnlyOffice editor GUI's render of a docx.
 *
 * NOTE: the committed pixel-gate goldens (golden/docs/*-oo.png) are generated
 * by capture-oo-goldens.py from the DS converter (clean full-page OO renders,
 * deterministic for the gate). This script is the alternate literal
 * GUI-screenshot path — it opens the doc in the live DS editor and screenshots
 * the rendered viewport. Useful for verifying the OO GUI paints a doc; its
 * output (viewport UI incl. grey backdrop + ribbon, zoom-dependent) is NOT the
 * committed golden format. Requires the DS nginx patched to :8094 and the
 * secure-link guard disabled on /cache/files (see the DS rig notes in AGENTS.md).
 * Env:
 *   VISUAL_OO_URL - loader page, e.g. http://127.0.0.1:8735/loader-visual-gate.html
 *   VISUAL_OUT    - png path to write */
const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const url = process.env.VISUAL_OO_URL
  const out = process.env.VISUAL_OUT
  if (!url || !out) {
    console.error("visual-oo.cjs: VISUAL_OO_URL and VISUAL_OUT required")
    process.exit(2)
  }
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 150)))

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 })

  // Wait for the editor app frame (docx editor lands in a /web-apps/ frame).
  let f = null
  for (let i = 0; i < 30; i++) {
    f = page.frames().find((x) => x.url().includes("/web-apps/"))
    if (f) {
      try {
        // the document page canvas appears when the flow is rendered
        const ok = await f.evaluate(() => {
          const c = document.querySelector("#viewport canvas")
          return !!c && c.width > 0 && c.height > 0
        })
        if (ok) break
      } catch {}
    }
    await sleep(5000)
  }
  if (!f) throw new Error("OO editor frame never appeared: " + errors.join("; "))

  // Dismiss any first-run tooltip overlays so they don't cover page ink.
  for (let i = 0; i < 3; i++) {
    await f.evaluate(() => {
      const g = [...document.querySelectorAll("button, a, .btn, .item")].find(
        (b) => /got it|dismiss|skip/i.test((b.innerText || "").trim()),
      )
      if (g) g.click()
    }).catch(() => {})
    await sleep(800)
  }

  // Wait for text to actually be painted on the page canvas (ink present).
  const ready = await f.evaluate(() => {
    const canvas = document.querySelector("#viewport canvas")
    if (!canvas) return false
    const ctx2d = canvas.getContext("2d")
    if (!ctx2d) return true // canvas 2d not exposable → assume painted
    const data = ctx2d.getImageData(0, 0, canvas.width, canvas.height).data
    let ink = 0
    for (let i = 3; i < data.length; i += 40) if (data[i] > 0) ink++
    return ink > 50
  }).catch(() => false)
  if (!ready) throw new Error("OO page never painted ink: " + errors.join("; "))
  await sleep(2000) // settle fonts/AA

  // Screenshot the first document page. OO pages are divs inside #viewport;
  // the actual page content is a child (canvas + overlays). Prefer the
  // .pageView .thumb or a page element; fall back to #viewport.
  const shot = await f.evaluate(() => {
    const cands = [
      "#viewport .pageView:not(.hidden)", ".pageView[data-page-is-active]",
      "#viewport .thumb", ".pageView",
    ]
    for (const sel of cands) {
      const el = document.querySelector(sel)
      if (el && el.getBoundingClientRect().width > 0) return sel
    }
    return "#viewport"
  })
  const el = await f.$(shot)
  const png = await el.screenshot({ path: out })
  await browser.close()
  console.log(`visual-oo: captured ${out} (${fs.statSync(out).size} bytes, sel=${shot})`)
  process.exit(0)
}

main().catch((e) => {
  console.error("visual-oo FAILED:", e.message)
  process.exit(1)
})
