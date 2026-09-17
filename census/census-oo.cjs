#!/usr/bin/env node
/**
 * census-oo.cjs — capture the OnlyOffice File backstage reference (rig-side).
 *
 * The OO reference census needs a real OnlyOffice Document Server editor. Run
 * it against the rig (docker onlyoffice/documentserver + census/rig/):
 *
 *   # one-time rig bring-up (docker DS on :8099, host server on :8735):
 *   docker run -d --name oo-rig -p 8099:80 \
 *     -e JWT_ENABLED=false -v <abs>/census/rig/local.json:/etc/onlyoffice/documentserver/local.json \
 *     onlyoffice/documentserver:latest
 *   python census/rig/rig-server.py 8735          # host: loader + demo.docx + /cb ACK
 *
 *   # capture (writes tabs["backstage"] into census/census/census-oo.json):
 *   node census-oo.cjs                            # uses the rig defaults
 *
 * Env:  OO_URL  (default http://127.0.0.1:8735/rig-editor.html)
 *       OO_OUT  (default census/census/census-oo.json)
 *
 * Contract (AGENTS.md "OO backstage reference"): after the editor is ready
 * (File tab exists), click the file trigger, wait for the panel, enumerate
 * every visible item as {id, icon, label, enabled, x, y, w, h} under
 * tabs["backstage"] — same schema as the ribbon tabs, so census-diff's
 * OO-tab-driven join enters the file menu into the parity ledger. The census
 * FAILS (exit 1) if the backstage never opens — the same trigger-regression
 * guard census-react.cjs applies to the WO side.
 */
const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")

const HERE = __dirname
const OO_URL = process.env.OO_URL || "http://127.0.0.1:8735/rig-editor.html"
const OUT = process.env.OO_OUT
  ? path.resolve(process.env.OO_OUT)
  : path.join(HERE, "census", "census-oo.json")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)))

  await page.goto(OO_URL, { waitUntil: "domcontentloaded", timeout: 40000 })

  // Wait for the editor app frame + the File ribbon trigger.
  let f = null
  for (let i = 0; i < 24; i++) {
    f = page.frames().find((x) => x.url().includes("/web-apps/"))
    if (f) {
      try {
        const ready = await f.evaluate(() => !!document.querySelector('[id="file"][data-tab="file"]'))
        if (ready) break
      } catch {}
    }
    await sleep(5000)
  }
  if (!f) throw new Error("OO editor frame never appeared")

  // Dismiss first-run tooltips that overlay the ribbon (e.g. "New multipage view").
  for (let i = 0; i < 3; i++) {
    await f
      .evaluate(() => {
        const g = [...document.querySelectorAll("button, a, .btn, .item")].find(
          (b) => /got it/i.test((b.innerText || "").trim()),
        )
        if (g) g.click()
      })
      .catch(() => {})
    await sleep(800)
  }

  // Open the File backstage — real click on the ribbon File tab.
  const fileTab = await f.locator('[id="file"][data-tab="file"]').count().catch(() => 0)
  if (!fileTab) throw new Error("OO File tab missing")
  await f.locator('[id="file"][data-tab="file"]').click({ force: true, timeout: 15000 })
  await sleep(2500)

  // Assert the backstage opened.
  const opened = await f
    .evaluate(() => {
      const p = document.querySelector("#file-menu-panel")
      return p && p.getBoundingClientRect().width > 0
    })
    .catch(() => false)
  if (!opened) {
    await browser.close()
    throw new Error(
      "OO backstage did not open on File click (trigger regression?) — check DS logs",
    )
  }

  // Enumerate every VISIBLE menu item (li.fm-btn > a.menu-item). Hidden items
  // (display:none — e.g. Create New/Open Recent in a standalone edit session)
  // are excluded: the ledger compares what the user actually sees.
  const buttons = await f.evaluate(() => {
    const items = []
    document.querySelectorAll("#file-menu-panel li.fm-btn").forEach((li) => {
      const a = li.querySelector("a.menu-item")
      if (!a) return
      const r = a.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return // hidden / not rendered
      const iconEl = a.querySelector(".menu-item-icon")
      const icon = iconEl ? (iconEl.className || "").toString() : ""
      const m = icon.match(/(?:^|\s)(btn-[^\s]+|menu__icon-\S+?|icon-[^\s]+)/)
      items.push({
        id: li.id || a.id || "",
        icon: m ? m[1] : "",
        label: (a.innerText || a.getAttribute("data-title") || "").trim(),
        enabled: !/disabled/.test(li.className),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      })
    })
    return items
  })
  if (!buttons.length) {
    await browser.close()
    throw new Error("OO backstage opened but 0 menu items enumerated")
  }

  // Merge into the committed census-oo.json (keeps the ribbon tabs intact).
  let oo = { engine: "onlyoffice", capturedAt: null, viewport: null, tabs: {} }
  if (fs.existsSync(OUT)) {
    try {
      oo = JSON.parse(fs.readFileSync(OUT, "utf-8"))
    } catch {}
  }
  oo.engine = "onlyoffice"
  oo.capturedAt = new Date().toISOString()
  oo.viewport = { w: 1600, h: 1000 }
  oo.tabs["backstage"] = { label: "File", contextual: false, buttons }
  fs.writeFileSync(OUT, JSON.stringify(oo, null, 1) + "\n", "utf-8")

  console.log(
    `census-oo: backstage open, rows=${buttons.length} :: ` +
      buttons.map((b) => b.label).join(" | "),
  )
  console.log(`wrote ${path.relative(HERE, OUT)}`)
  if (errors.length) console.log("pageerrors:", errors)
  await browser.close()
}

main().catch((e) => {
  console.error("census-oo FAILED:", e.message)
  process.exit(1)
})
