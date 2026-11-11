#!/usr/bin/env node
/**
 * ledger/speech-dialog-l4.test.mjs — L4 FIDELITY probe: the Speech Settings
 * dialog (campaign L4-gold FXG-G: batch parity -> census gold).
 *
 * The row dialog.speech-dialog.l4 so far stood on the FINAL-001 batch probe
 * (dialog-l4.test.mjs: field parity only, functional=null "not provable
 * offline"). This dedicated probe earns the L4 by DRIVING the dialog in the
 * running editor (compare-dialog-l4 pattern: local static serve + stubbed
 * fetch, REAL clicks) — the offline-provable speech contract is the
 * UTTERANCE one: read-aloud collects the text, the dialog configures
 * voice/speed/pitch, OK queues a SpeechSynthesisUtterance with those values.
 *
 * Census contract (honest, auditable):
 *   - OO modal EXISTENCE is measured: census/census-oo-interactions.json
 *     row "plugins/Speech -> modal" (the OO rig captured the modal mask
 *     only — controls:0 — so no field-level OO capture exists; OO reads
 *     through its SpeechWorker panel, WO through the Web Speech API).
 *   - The OO field contract is pinned here + in the batch PROBES dict
 *     (Voice / Speed / Pitch); it flips deliberately WITH this probe.
 *
 * Asserted (deep, not surface):
 *   - negative path: read aloud with nothing to read -> loud status error,
 *     dialog NOT opened
 *   - opens via real clicks: View tab + Speech menu + Read aloud
 *     (readAloud -> openSpeechDialog)
 *   - title "Speech Settings"; fields Voice (select, Default option kept
 *     when no voices), Speed (range 0.5..2 step 0.1 + live readout),
 *     Pitch (range 0.5..2 step 0.1 + live readout)
 *   - buttons Cancel + OK (primary)
 *   - moving Speed updates its readout span
 *   - OK closes the dialog and queues the utterance with the paragraph
 *     text, rate 1.5, pitch 1, lang en-US (speechSynthesis stubbed —
 *     headless has no voices/audio; the stub records the queued utterance)
 *   - Cancel closes and queues nothing
 *
 * Writes speech-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.speech-dialog.l4; level 4 only when every
 * check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-speech-dialog: OK|FAIL n/n checks".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'speech-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>l4 speech probe sentinel paragraph for read aloud.</p>';
const SPEED = '1.5';
const BOOT_MS = 2200;

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  return !!ok;
};

async function loadPlaywright() {
  const candidates = [path.join(LEDGER_DIR, '..', 'node_modules', 'playwright')];
  try {
    const { execSync } = await import('node:child_process');
    candidates.push(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
  } catch (_) { /* global npm optional */ }
  for (const c of candidates) {
    try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch (_) { /* next */ }
  }
  throw new Error('playwright not found (census/node_modules nor global)');
}

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
  srv.on('error', reject);
});

function startStaticServer(port, dir) {
  return spawn('/usr/bin/python3', ['-m', 'http.server', String(port),
    '--bind', '127.0.0.1', '--directory', dir], { stdio: ['ignore', 'ignore', 'pipe'] });
}

function stubInit(ctx) {
  localStorage.clear();
  window.__COLLAB__ = false;
  // Deterministic speech: headless Chromium ships speechSynthesis with no
  // voices and no utterance callbacks — stub it and RECORD what the editor
  // queues, so the probe can gate the utterance contract (text/rate/pitch/
  // lang) without audio hardware.
  window.__SPOKEN__ = [];
  window.SpeechSynthesisUtterance = function (text) {
    this.text = String(text == null ? '' : text);
    this.lang = '';
    this.rate = 1;
    this.pitch = 1;
    this.voice = null;
    this.onend = null;
  };
  // speechSynthesis is an own accessor on window (getter, no setter) — a
  // plain assignment silently no-ops; defineProperty replaces it.
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      onvoiceschanged: null,
      getVoices: () => [],
      cancel: () => {},
      speak: (u) => {
        window.__SPOKEN__.push({ text: u.text, rate: u.rate, pitch: u.pitch, lang: u.lang });
      },
    },
  });
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init && init.method) || 'GET';
    if (method === 'GET' && url.includes('/api/documents/') && url.includes('/html')) {
      return Promise.resolve(new Response(JSON.stringify({ html: ctx.seed, name: 'demo.docx' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
  };
  navigator.sendBeacon = () => true;
}

function pageHelpers() {
  window.__L4_SPEECH__ = function () {
    const d = document.getElementById('speech-dialog');
    const cs = d ? getComputedStyle(d) : null;
    const dlg = d || document;
    const q = (s) => dlg.querySelector(s);
    const voice = q('#speech-voice');
    const rate = q('#speech-rate');
    const pitch = q('#speech-pitch');
    const rateVal = document.getElementById('speech-rate-value');
    const pitchVal = document.getElementById('speech-pitch-value');
    return {
      open: !!d && d.classList.contains('open') && cs.display !== 'none' && cs.visibility !== 'hidden',
      title: ((q('#speech-dialog-title') || {}).textContent || '').trim(),
      voiceTag: voice ? voice.tagName.toLowerCase() : null,
      voiceDefault: voice ? [...voice.options].some((o) => o.value === '') : null,
      voiceOptions: voice ? [...voice.options].map((o) => o.value) : [],
      rate: rate ? { min: rate.min, max: rate.max, step: rate.step, value: rate.value, type: rate.type } : null,
      pitch: pitch ? { min: pitch.min, max: pitch.max, step: pitch.step, value: pitch.value, type: pitch.type } : null,
      rateReadout: rateVal ? rateVal.textContent.trim() : null,
      pitchReadout: pitchVal ? pitchVal.textContent.trim() : null,
      labels: ['speech-voice', 'speech-rate', 'speech-pitch'].map((id) => {
        const l = dlg.querySelector(`label[for="${id}"]`);
        return l ? l.textContent.trim() : null;
      }),
      cancel: ((q('#btn-speech-close') || {}).textContent || '').trim(),
      ok: ((q('#btn-speech-ok') || {}).textContent || '').trim(),
      okPrimary: !!(q('#btn-speech-ok') && q('#btn-speech-ok').classList.contains('primary')),
      spoken: window.__SPOKEN__ || [],
      status: ((document.getElementById('status') || {}).textContent || '').trim(),
      editorText: ((document.getElementById('editor') || {}).innerText || '').trim(),
    };
  };
  window.__L4_CARET_INTO_PARAGRAPH__ = function () {
    const ed = document.getElementById('editor');
    const p = ed.querySelector('p');
    const tn = p && p.firstChild;
    if (!tn || tn.nodeType !== Node.TEXT_NODE) return false;
    const r = document.createRange();
    r.setStart(tn, 0);
    r.setEnd(tn, 0);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
    return true;
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openViaReadAloud(page) {
  const active = await page.$('.ribbon-tab[data-tab="view"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="view"]');
  await sleep(150);
  // in-page clicks on the real handlers (the menu trigger + its Read aloud
  // item sit in the ribbon row; same route the batch probe took)
  await page.evaluate(() => {
    const trig = document.getElementById('btn-speech');
    if (trig) trig.click();
  });
  await sleep(200);
  await page.evaluate(() => {
    const item = document.getElementById('btn-readaloud');
    if (item) item.click();
  });
  await sleep(350);
}

async function main() {
  if (!fs.existsSync(path.join(EDITOR_DIR, 'index.html'))) {
    throw new Error(`editor dir missing index.html: ${EDITOR_DIR} (set WO_EDITOR_DIR)`);
  }
  const port = await freePort();
  const srv = startStaticServer(port, EDITOR_DIR);
  await sleep(500);
  const base = `http://127.0.0.1:${port}`;
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(stubInit, { seed: SEED_HTML });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#editor', { timeout: 20000 });
    await page.waitForTimeout(BOOT_MS);
    await page.evaluate(pageHelpers);

    // --- 1. negative path: nothing to read -> loud error, dialog closed ---
    await page.evaluate(() => { document.getElementById('editor').innerHTML = ''; });
    await openViaReadAloud(page);
    const empty = await page.evaluate(() => window.__L4_SPEECH__());
    check('read aloud with nothing to read -> loud status error, dialog NOT opened',
      !empty.open && /nothing to read/i.test(empty.status),
      `open=${empty.open} status=${JSON.stringify(empty.status)}`);

    // --- 2. opens the user way: View tab + Speech menu + Read aloud ---
    await page.evaluate((seed) => {
      const ed = document.getElementById('editor');
      ed.innerHTML = seed;
      window.__L4_CARET_INTO_PARAGRAPH__();
    }, SEED_HTML);
    await openViaReadAloud(page);
    const c = await page.evaluate(() => window.__L4_SPEECH__());
    check('open via real clicks (View tab + Speech menu + Read aloud)', c.open);

    // --- 3..4 static contract while open ---
    check('title "Speech Settings"; Voice select keeps the Default option (no voices)',
      c.title === 'Speech Settings' && c.voiceTag === 'select'
        && c.voiceDefault === true && c.voiceOptions.length === 1,
      `title=${JSON.stringify(c.title)} voiceTag=${c.voiceTag} options=${JSON.stringify(c.voiceOptions)}`);
    check('fields Voice + Speed(range 0.5..2 step .1) + Pitch(range 0.5..2 step .1) labelled',
      c.labels.join('|') === 'Voice|Speed|Pitch'
        && c.rate && c.rate.type === 'range' && c.rate.min === '0.5' && c.rate.max === '2'
        && c.rate.step === '0.1' && c.rate.value === '1'
        && c.pitch && c.pitch.type === 'range' && c.pitch.min === '0.5' && c.pitch.max === '2'
        && c.pitch.step === '0.1' && c.pitch.value === '1'
        && c.rateReadout === '1' && c.pitchReadout === '1',
      `labels=${JSON.stringify(c.labels)} rate=${JSON.stringify(c.rate)} pitch=${JSON.stringify(c.pitch)} `
        + `readouts=${c.rateReadout}/${c.pitchReadout}`);
    check('buttons Cancel + OK(primary)',
      /^cancel$/i.test(c.cancel) && /^ok$/i.test(c.ok) && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} ok=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 5. Speed drives its readout live ---
    await page.evaluate((v) => {
      const r = document.getElementById('speech-rate');
      r.value = v;
      r.dispatchEvent(new Event('input', { bubbles: true }));
    }, SPEED);
    await sleep(150);
    const rate = await page.evaluate(() => window.__L4_SPEECH__());
    check(`Speed ${SPEED} updates its readout span live`,
      rate.rate.value === SPEED && rate.rateReadout === SPEED,
      `rate=${rate.rate.value} readout=${rate.rateReadout}`);

    // --- 6. OK queues the utterance with the configured contract ---
    await page.click('#btn-speech-ok');
    await sleep(300);
    const ok = await page.evaluate(() => window.__L4_SPEECH__());
    const u = ok.spoken[0] || {};
    check('OK closes + queues the utterance: paragraph text, rate 1.5, pitch 1, lang en-US',
      !ok.open && ok.spoken.length === 1
        && /l4 speech probe sentinel/.test(u.text || '')
        && u.rate === 1.5 && u.pitch === 1 && u.lang === 'en-US',
      `closed=${!ok.open} spoken=${ok.spoken.length} text=${JSON.stringify((u.text || '').slice(0, 60))} `
        + `rate=${u.rate} pitch=${u.pitch} lang=${u.lang}`);

    // --- 7. reopen + Cancel queues nothing ---
    await page.evaluate(() => window.__L4_CARET_INTO_PARAGRAPH__());
    await openViaReadAloud(page);
    const reopen = await page.evaluate(() => window.__L4_SPEECH__());
    await page.click('#btn-speech-close');
    await sleep(300);
    const cancel = await page.evaluate(() => window.__L4_SPEECH__());
    check('reopen + Cancel closes and queues nothing (still 1 utterance)',
      reopen.open && !cancel.open && cancel.spoken.length === 1,
      `reopened=${reopen.open} closed=${!cancel.open} spoken=${cancel.spoken.length}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'speech-dialog-l4',
    feature: 'dialog.speech-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO interaction census proves the Speech modal exists '
      + '(plugins/Speech -> modal, controls:0 — the OO rig captured the modal '
      + 'mask, not fields); the OO field contract (Voice / Speed / Pitch) is '
      + 'pinned from the batch PROBES dict and flips deliberately with this '
      + 'probe',
      'OO reads through its SpeechWorker panel; WO drives the Web Speech API '
      + '(speechSynthesis) — the offline probe STUBS speechSynthesis (headless '
      + 'Chromium has no voices/audio) and gates the queued-utterance contract '
      + '(text/rate/pitch/lang); actual audio playback is out of probe scope',
      'the voice select is populated from speechSynthesis.getVoices() — the '
      + 'stub ships none, so Default is the only option here; with real '
      + 'voices the select lists them (measured wiring in openSpeechDialog)',
    ],
    contract: {
      open: 'real clicks: View tab + Speech menu (#btn-speech) + Read aloud '
        + '(data-cmd=readAloud -> readAloud() collects selection/paragraph, '
        + 'openSpeechDialog populates voices)',
      title: 'Speech Settings',
      fields: [
        { label: 'Voice', tag: 'select', type: 'text',
          note: 'options from speechSynthesis.getVoices(); Default kept when none' },
        { label: 'Speed', tag: 'input', type: 'range', min: 0.5, max: 2, step: 0.1,
          note: 'live readout span #speech-rate-value; clamped 0.5..2 on apply' },
        { label: 'Pitch', tag: 'input', type: 'range', min: 0.5, max: 2, step: 0.1,
          note: 'live readout span #speech-pitch-value; clamped 0.5..2 on apply' },
      ],
      buttons: ['Cancel', 'OK (primary)'],
      behavior: 'Read aloud collects the selection (or the caret paragraph), opens '
        + 'the dialog; OK queues a SpeechSynthesisUtterance with the collected '
        + 'text, the configured rate/pitch (clamped 0.5..2) and the editor lang '
        + '(default en-US), then closes; nothing to read -> loud status error '
        + 'and the dialog never opens; Cancel closes and queues nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-speech-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-speech-dialog: ERROR', e);
  process.exit(1);
});
