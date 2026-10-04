#!/usr/bin/env node
/**
 * interact-oo.cjs — INTERACTION census of the OnlyOffice File backstage (rig-side).
 *
 * The committed OO reference interactions (census/census-oo-interactions.json,
 * ribbon tabs) prove what OO's ribbon controls open. The File backstage was
 * missing: this script clicks every visible backstage item after opening the
 * File menu, classifies what appears, and MERGES `tab:"backstage"` rows into
 * the committed reference (ribbon rows are left untouched — deliberate,
 * minimal recapture).
 *
 * Classification mirrors interact-wo.cjs's vocabulary:
 *   panel — the backstage (#file-menu-panel) is showing a section
 *   modal  — an .asc-window modal appeared over the editor
 *   none  — the backstage closed (Back) and nothing else opened
 * Fails (exit 1) if the backstage never opens — same trigger-regression
 * guard as census-oo.cjs.
 *
 * Rig (see AGENTS.md): docker DS + census/rig/rig-server.py on :8735
 * (DS_URL env substitutes the DS base URL if :8099 is taken).
 *
 * Env:  OO_URL  (default http://127.0.0.1:8735/rig-editor.html)
 *       OO_OUT  (default census/census/census-oo-interactions.json)
 */
const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")

const HERE = __dirname
const OO_URL = process.env.OO_URL || "http://127.0.0.1:8735/rig-editor.html"
const OUT = process.env.OO_OUT
  ? path.resolve(process.env.OO_OUT)
  : path.join(HERE, "census", "census-oo-interactions.json")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// page-side: classify what is currently showing in the OO editor frame
const classify = () => {
  const vis = (el) => {
    if (!el) return false
    const s = getComputedStyle(el)
    if (s.display === "none" || s.visibility === "hidden") return false
    const r = el.getBoundingClientRect()
    return r.width > 4 && r.height > 4
  }
  const modal = [...document.querySelectorAll(".asc-window, [class*='modal']")].find(vis)
  if (modal) return "modal"
  if (vis(document.querySelector("#file-menu-panel"))) return "panel"
  const menu = [...document.querySelectorAll("[role=menu], .dropdown-menu")].find(vis)
  if (menu) return "menu"
  return "none"
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await page.goto(OO_URL, { waitUntil: "domcontentloaded", timeout: 40000 })

  // editor app frame + File ribbon trigger
  let f = null
  for (let i = 0; i < 24; i++) {
    f = page.frames().find((x) => x.url().includes("/web-apps/"))
    if (f) {
      try {
        if (await f.evaluate(() => !!document.querySelector('[id="file"][data-tab="file"]'))) break
      } catch {}
    }
    await sleep(5000)
  }
  if (!f) throw new Error("OO editor frame never appeared")

  // dismiss first-run tooltips ("Got it")
  for (let i = 0; i < 3; i++) {
    await f.evaluate(() => {
      const g = [...document.querySelectorAll("button, a, .btn, .item")].find(
        (b) => /got it/i.test((b.innerText || "").trim()))
      if (g) g.click()
    }).catch(() => {})
    await sleep(800)
  }

  const backstageOpen = async () =>
    f.evaluate(() => {
      const p = document.querySelector("#file-menu-panel")
      return !!(p && p.getBoundingClientRect().width > 0)
    }).catch(() => false)
  const openBackstage = async () => {
    if (await backstageOpen()) return true // idempotent — File TOGGLES
    await f.locator('[id="file"][data-tab="file"]').click({ force: true, timeout: 15000 })
    await sleep(1800)
    return backstageOpen()
  }
  const closeBackstage = async () => {
    if (!(await backstageOpen())) return // hidden fm-btn still takes clicks — never click when closed
    await f.evaluate(() => {
      const back = document.querySelector("#fm-btn-return a, li#fm-btn-return a")
      if (back) back.click()
    }).catch(() => {})
    await sleep(700)
    if (await backstageOpen()) {
      await page.keyboard.press("Escape").catch(() => {})
      await sleep(500)
    }
  }

  if (!(await openBackstage())) throw new Error("OO backstage did not open (trigger regression?)")

  // enumerate the SAME ids the structural census uses (li.fm-btn, stable)
  const items = await f.evaluate(() => {
    const out = []
    document.querySelectorAll("#file-menu-panel li.fm-btn").forEach((li) => {
      const a = li.querySelector("a.menu-item")
      if (!a) return
      const r = a.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return // hidden (Create New etc. standalone)
      out.push({ id: li.id || "", label: (a.innerText || "").trim() })
    })
    return out
  })
  if (!items.length) { await browser.close(); throw new Error("backstage open but 0 items") }
  await closeBackstage() // the File tab TOGGLES — close so each loop iteration opens fresh

  const rows = []
  for (const it of items) {
    let opens = "none"
    try {
      if (!(await openBackstage())) throw new Error("backstage did not reopen")
      await f.evaluate((id) => {
        const a = document.querySelector(`li#${id} a.menu-item`)
        if (a) a.click()
      }, it.id)
      await sleep(1400)
      opens = await f.evaluate(classify)
    } catch (e) {
      opens = "error:" + String(e.message).slice(0, 50)
    }
    rows.push({ tab: "backstage", id: it.id, label: it.label, opens })
    console.log(`  ${it.id.padEnd(18)} ${String(it.label).padEnd(24)} -> ${opens}`)
    await closeBackstage()
    await sleep(300)
  }

  // MERGE into the committed reference (ribbon rows untouched)
  let ref = { engine: "onlyoffice", capturedAt: null, viewport: "1440x900", interactions: [] }
  if (fs.existsSync(OUT)) {
    try { ref = JSON.parse(fs.readFileSync(OUT, "utf-8")) } catch {}
  }
  const kept = ref.interactions.filter((r) => r.tab !== "backstage")
  ref.interactions = [...kept, ...rows]
  ref.backstageCapturedAt = new Date().toISOString()
  fs.writeFileSync(OUT, JSON.stringify(ref, null, 1) + "\n", "utf-8")
  console.log(`interact-oo: backstage rows=${rows.length} (kept ${kept.length} ribbon rows) -> ${path.relative(HERE, OUT)}`)
  await browser.close()
}

main().catch((e) => { console.error("interact-oo FAILED:", e.message); process.exit(1) })
