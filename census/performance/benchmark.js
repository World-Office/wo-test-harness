#!/usr/bin/env node
/**
 * Performance Benchmark Suite — WO word editor on staging :8086.
 *
 * First measured baseline (INFRA-BENCH-BASELINE). PERF-002 follow-up work
 * is judged against the numbers this script writes to baseline-wo.json.
 *
 * Run FROM the census/ directory (repo convention for Playwright scripts;
 * playwright resolves from census/node_modules):
 *
 *   NO_PROXY=127.0.0.1,localhost,192.168.42.42 /usr/bin/node performance/benchmark.js
 *
 * Scenarios (medians over N samples, wall-clock ms incl. Playwright round-trip):
 *   1. cold_load               — page.goto → #editor + #toolbar visible (+ content seeded)
 *   2. typing_latency          — time typing 100 sequential keyboard events into a paragraph
 *   3. select_all_bold_large_doc — 50-paragraph document (typed in, untimed), then Ctrl+A + Ctrl+B
 *                                 until bold markup observable
 *   4. table_insert            — #btn-table → dialog → #btn-table-ok → <table> in #editor
 *   5. banded_toggle           — rp-table-banded label click → table gains .table-banded
 *                                 (the checkbox lives in the right panel, hidden by default;
 *                                  a dispatched label click drives the exact same
 *                                  label→checkbox→handler path as a user click — verified
 *                                  the real-click path is blocked by panel visibility internals)
 *
 * Env knobs: BENCH_URL (default staging :8086/word/), BENCH_ITERS (default 7,
 * min 5), BENCH_BIG_ITERS (default 5). goto uses waitUntil:'domcontentloaded'
 * + fixed settle — 'networkidle' never settles on this app.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.BENCH_URL || 'http://192.168.42.42:8086/word/';
const ITERS = Math.max(5, parseInt(process.env.BENCH_ITERS || '7', 10));
const BIG_ITERS = Math.max(5, parseInt(process.env.BENCH_BIG_ITERS || '5', 10));
const SETTLE_MS = 2500;
const OUTPUT = path.join(__dirname, 'baseline-wo.json');

const TYPE_TEXT = 'the quick brown fox jumps over the lazy dog '.repeat(3).slice(0, 100);
const PARAGRAPHS = Array.from({ length: 50 }, (_, i) =>
  `Paragraph ${i + 1}: the quick brown fox jumps over the lazy dog.`);
const BIG_DOC_TEXT = PARAGRAPHS.join('\n');

function median(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function now() {
  return Number(process.hrtime.bigint() / 1000000n);
}

async function openEditor(browser) {
  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // fixed settle: networkidle never fires on this app (websocket/long-poll)
  await page.waitForTimeout(SETTLE_MS);
  await page.waitForSelector('#toolbar', { timeout: 30000 });
  await page.waitForSelector('#editor', { state: 'visible', timeout: 30000 });
  return page;
}

async function resetDoc(page) {
  await page.click('#editor');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  // the staging document persists across page loads — a leftover bolded
  // empty paragraph would make Ctrl+B toggle bold OFF in scenario 3
  const boldOn = await page.evaluate(() => {
    try { return document.queryCommandState('bold'); } catch { return false; }
  });
  if (boldOn) await page.keyboard.press('Control+b');
}

async function insertTable(page) {
  await page.click('button[data-tab="insert"]');
  await page.waitForTimeout(200);
  await page.click('#btn-table');
  await page.waitForSelector('#table-dialog', { state: 'visible', timeout: 5000 });
  await page.click('#btn-table-ok');
  await page.waitForSelector('#editor table', { timeout: 5000 });
  await page.waitForTimeout(200);
}

async function measureColdLoad(browser, iterations) {
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const page = await browser.newPage();
    try {
      const t0 = now();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#toolbar', { timeout: 30000 });
      await page.waitForSelector('#editor', { state: 'visible', timeout: 30000 });
      // editor usable = document model seeded (async after toolbar)
      await page.waitForFunction(
        () => !!document.querySelector('#editor') &&
              (document.querySelector('#editor').querySelector('p, div, table') !== null ||
               document.querySelector('#editor').isContentEditable),
        null, { timeout: 15000 }
      ).catch(() => { /* empty new doc: isContentEditable fallback above */ });
      samples.push(now() - t0);
    } finally {
      await page.close();
    }
  }
  return samples;
}

async function measureTyping(page, iterations) {
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    await resetDoc(page);
    await page.click('#editor');
    const t0 = now();
    await page.keyboard.type(TYPE_TEXT);
    samples.push(now() - t0);
  }
  return samples;
}

async function measureSelectAllBold(page, iterations) {
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    await resetDoc(page);
    await page.click('#editor');
    // setup (untimed): build the 50-paragraph document
    await page.keyboard.type(BIG_DOC_TEXT);
    await page.waitForTimeout(500);
    const t0 = now();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+b');
    await page.waitForFunction(
      () => !!document.querySelector('#editor b, #editor strong'),
      null, { timeout: 10000 }
    );
    samples.push(now() - t0);
  }
  return samples;
}

async function measureTableInsert(page, iterations) {
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    await resetDoc(page);
    await page.click('button[data-tab="insert"]');
    await page.waitForTimeout(200);
    const t0 = now();
    await page.click('#btn-table');
    await page.waitForSelector('#table-dialog', { state: 'visible', timeout: 5000 });
    await page.click('#btn-table-ok');
    await page.waitForSelector('#editor table', { timeout: 5000 });
    samples.push(now() - t0);
  }
  return samples;
}

async function measureBandedToggle(page, iterations) {
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    await resetDoc(page);
    await insertTable(page);
    // settle (untimed): caret placement into the freshly inserted table and
    // cleanup of the previous iteration's banded table are asynchronous —
    // measuring before they complete systematically forces one 2s retry
    await page.waitForTimeout(800);
    // fresh table each iteration starts un-banded (verified in probe; note the
    // global rp-table-banded checkbox may still read checked from the previous
    // iteration — the table class is the real signal)
    await page.waitForFunction(
      () => {
        const t = document.querySelector('#editor table');
        return !!t && !t.classList.contains('table-banded');
      },
      null, { timeout: 5000 }
    );
    // untimed priming: the rp-table-banded checkbox is global and still reads
    // checked from the previous iteration's banded table; force it back to the
    // fresh table's un-banded state so the measured toggle is a clean false→true
    await page.click('#editor table td');
    if (await page.evaluate(() => document.getElementById('rp-table-banded').checked)) {
      await page.evaluate(() =>
        document.querySelector('label[for="rp-table-banded"]').click());
      await page.waitForFunction(
        () => !document.getElementById('rp-table-banded').checked,
        null, { timeout: 3000 }
      ).catch(() => {});
      await page.waitForTimeout(200);
    }
    const t0 = now();
    // the checkbox lives in the right panel, hidden by default; a dispatched
    // label click drives the exact same label→checkbox→handler path as a user
    // click. Races handled below: (a) the editor's change handler drops the
    // toggle when no table-selection context exists yet — so click into the
    // first cell, mirroring what a user does anyway; (b) the checkbox is
    // global and can read stale-checked from the previous iteration — the
    // untimed priming above normalizes it; (c) verify each click actually
    // flipped the checkbox and retry with a fresh query if it didn't.
    let applied = false;
    for (let attempt = 0; attempt < 5 && !applied; attempt++) {
      if (attempt > 0) await page.waitForTimeout(300);
      await page.click('#editor table td');
      const flipped = await page.evaluate(() => {
        const cb = document.getElementById('rp-table-banded');
        const label = document.querySelector('label[for="rp-table-banded"]');
        if (!label) return false;
        label.click();
        return cb.checked === true;
      });
      if (!flipped) continue;
      applied = await page.waitForFunction(
        () => document.querySelector('#editor table')?.classList.contains('table-banded'),
        null, { timeout: 3000 }
      ).then(() => true).catch(() => false);
    }
    if (!applied) throw new Error('banded toggle never applied after 5 attempts');
    samples.push(now() - t0);
  }
  return samples;
}

async function main() {
  console.log(`benchmark: ${BASE_URL} — ${ITERS} iters/scenario (${BIG_ITERS} large-doc)`);
  const browser = await chromium.launch();
  try {
    const env = async (page) => ({
      url: BASE_URL,
      date: new Date().toISOString(),
      userAgent: await page.evaluate(() => navigator.userAgent),
    });

    // warm working page for the interactive scenarios; cold_load makes its own pages
    const page = await openEditor(browser);
    await resetDoc(page); // staging doc persists across loads — clear inherited state

    const scenarios = {};

    console.log('scenario 1/5: cold editor load');
    let s = await measureColdLoad(browser, ITERS);
    scenarios.cold_load = { unit: 'ms', samples: s, median_ms: median(s), n: s.length, env: await env(page) };

    console.log('scenario 2/5: typing latency (100 keystrokes)');
    s = await measureTyping(page, ITERS);
    scenarios.typing_latency = {
      unit: 'ms', samples: s, median_ms: median(s), n: s.length,
      note: 'total wall-clock to type 100 sequential keyboard.type events into one paragraph; per-char ~= median_ms/100',
      env: await env(page),
    };

    console.log('scenario 3/5: select-all + bold on 50-paragraph document');
    s = await measureSelectAllBold(page, BIG_ITERS);
    scenarios.select_all_bold_large_doc = {
      unit: 'ms', samples: s, median_ms: median(s), n: s.length,
      note: 'Ctrl+A + Ctrl+B until bold markup observable in a 50-paragraph document (typed in untimed)',
      env: await env(page),
    };

    console.log('scenario 4/5: table insertion (dialog flow)');
    s = await measureTableInsert(page, ITERS);
    scenarios.table_insert = {
      unit: 'ms', samples: s, median_ms: median(s), n: s.length,
      note: '#btn-table click → rows/cols dialog → #btn-table-ok → <table> present in #editor',
      env: await env(page),
    };

    console.log('scenario 5/5: banded-rows toggle');
    s = await measureBandedToggle(page, ITERS);
    scenarios.banded_toggle = {
      unit: 'ms', samples: s, median_ms: median(s), n: s.length,
      note: 'rp-table-banded label click → table gains .table-banded (dispatched label click: same label→checkbox→handler path as a user click; right-panel visibility internals block synthetic pointer events)',
      env: await env(page),
    };

    await resetDoc(page);
    await page.close();

    const out = { _meta: { generator: 'census/performance/benchmark.js', iterations: ITERS, big_doc_iterations: BIG_ITERS }, ...scenarios };
    fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2) + '\n');
    console.log(`wrote ${OUTPUT}`);
    for (const [k, v] of Object.entries(scenarios)) {
      console.log(`  ${k}: median ${v.median_ms.toFixed(1)} ms  samples=[${v.samples.map(x => x.toFixed(0)).join(', ')}]`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('BENCH-FAIL:', e.message); process.exit(1); });
