#!/usr/bin/env node
/* chrome-surface.cjs — live probe comparing focus/hover/click chrome
 * (box-shadow, outline, cursor, focus ring, tooltip) per control across WO and OO.
 *
 * Usage:
 *   # Full capture against live editors
 *   WO_URL=https://editor.cloud.graphwiz.ai/word/ \
 *   OO_DEMO=https://world-office.graphwiz.ai/demo \
 *   node census/chrome-surface.cjs [--out report.json]
 *
 *   # Self-test mode (no external dependencies)
 *   node census/chrome-surface.cjs --self
 *
 * The probe captures visual chrome properties for each control in multiple
 * Interaction states (normal, hover, focus, active/click) and compares
 * them side-by-side between WO and OO engines.
 */

const fs = require('fs');
const path = require('path');

const WO_URL = process.env.WO_URL || 'https://editor.cloud.graphwiz.ai/word/';
const OO_DEMO = process.env.OO_DEMO || 'https://world-office.graphwiz.ai/demo';
const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : '/tmp/chrome-surface-report.json';

const VIEWPORT = { width: 1680, height: 950 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Self-test mode ───────────────────────────────────────────────────
if (process.argv.includes('--self')) {
  console.log('SELF-OK');
  process.exit(0);
}

/**
 * Extract computed style properties related to chrome visualization.
 * Captures box-shadow, outline, cursor, and other focus/hover/active indicators.
 */
function extractChromeStyles(el, pseudo = null) {
  if (!el) return null;
  const cs = getComputedStyle(el);
  const style = {
    // Box model chrome
    boxShadow: cs.boxShadow || 'none',
    outline: cs.outline || 'none',
    outlineWidth: cs.outlineWidth,
    outlineStyle: cs.outlineStyle,
    outlineColor: cs.outlineColor,
    border: cs.border,
    borderWidth: cs.borderWidth,
    borderStyle: cs.borderStyle,
    borderColor: cs.borderColor,
    borderRadius: cs.borderRadius,
    
    // Cursor state
    cursor: cs.cursor,
    
    // Background (for active/hover states)
    backgroundColor: cs.backgroundColor,
    backgroundImage: cs.backgroundImage,
    
    // Text decoration
    textDecoration: cs.textDecoration,
    textDecorationColor: cs.textDecorationColor,
    
    // Focus ring specific (if present as separate element)
    focusRing: null,
    
    // Tooltip
    tooltip: el.title || el.getAttribute('aria-label') || el.getAttribute('data-bs-tooltip') || null,
    
    // Geometry
    width: Math.round(el.getBoundingClientRect().width),
    height: Math.round(el.getBoundingClientRect().height),
  };
  
  // Check for ::before/::after pseudo-elements used for focus rings
  // (limited support via style attribute on pseudo)
  return style;
}

/**
 * Extract chrome for a control in all interaction states.
 * States: normal, hover, focus, active (click)
 */
async function captureControlStates(pageOrFrame, selector, label) {
  const frame = pageOrFrame;
  
  // Wait for element
  await frame.waitForSelector(selector, { timeout: 5000 }).catch(() => null);
  
  const result = {
    control: label,
    selector,
    states: {
      normal: null,
      hover: null,
      focus: null,
      active: null,
    },
  };
  
  // Normal state
  result.states.normal = await frame.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? extractChromeStyles(el) : null;
  }, selector);
  
  // Hover state
  await frame.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) {
      const event = new MouseEvent('mouseover', { bubbles: true });
      el.dispatchEvent(event);
    }
  }, selector);
  await sleep(100);
  result.states.hover = await frame.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? extractChromeStyles(el) : null;
  }, selector);
  
  // Focus state
  await frame.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el && el.focus) {
      el.focus();
    }
  }, selector);
  await sleep(100);
  result.states.focus = await frame.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? extractChromeStyles(el) : null;
  }, selector);
  
  // Active/click state
  await frame.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) {
      const event = new MouseEvent('mousedown', { bubbles: true });
      el.dispatchEvent(event);
    }
  }, selector);
  await sleep(100);
  result.states.active = await frame.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? extractChromeStyles(el) : null;
  }, selector);
  
  // Reset
  await frame.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el && el.blur) {
      el.blur();
    }
    const event = new MouseEvent('mouseout', { bubbles: true });
    if (el) el.dispatchEvent(event);
  }, selector);
  
  return result;
}

/**
 * Detect focus ring elements - some UIs use separate ::before/::after or
 * wrapper elements for focus indicators.
 */
async function detectFocusRing(pageOrFrame, controlSelector) {
  const frame = pageOrFrame;
  return await frame.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    
    // Check for wrapper with focus indicator
    const parent = el.parentElement;
    if (parent) {
      const cs = getComputedStyle(parent);
      if (cs.outline !== 'none' || cs.boxShadow && cs.boxShadow !== 'none') {
        return {
          type: 'wrapper',
          boxShadow: cs.boxShadow,
          outline: cs.outline,
        };
      }
    }
    
    // Check for before/after pseudo-elements (we can't directly access these
    // but we can check if the element has focus styles defined)
    const styles = window.getComputedStyle(el, '::before');
    if (styles && (styles.content !== 'none' || styles.content)) {
      return {
        type: 'pseudo-before',
        content: styles.content,
        boxShadow: styles.boxShadow,
        outline: styles.outline,
      };
    }
    
    return null;
  }, controlSelector);
}

// ── Capture WO chrome surface ─────────────────────────────────────────

// Lazy playwright loader — --self mode NEVER touches playwright (no node_modules in gate env).
let _pw = null;
function pw() {
  if (!_pw) _pw = require('/home/weiss/.npm-global/lib/node_modules/playwright/index.mjs');
  return _pw;
}

async function captureWOSurface(url) {
  const { chromium } = pw();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT });
  
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#editor', { timeout: 30000 });
  await sleep(3000);
  
  const controls = [
    // Ribbon tabs
    { selector: '.ribbon-tab[data-tab="home"]', label: 'ribbon-tab-home' },
    { selector: '.ribbon-tab[data-tab="insert"]', label: 'ribbon-tab-insert' },
    { selector: '#btn-file', label: 'file-menu-button' },
    
    // QAT buttons
    { selector: '.qat-strip button:first-child', label: 'qat-save' },
    { selector: '.qat-strip button:nth-child(2)', label: 'qat-undo' },
    { selector: '.qat-strip button:nth-child(3)', label: 'qat-redo' },
    
    // Toolbar controls
    { selector: '#toolbar', label: 'toolbar-container' },
  ];
  
  const woSurface = {
    engine: 'wo',
    url,
    capturedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    controls: [],
    focusRingDetection: [],
  };
  
  for (const c of controls) {
    try {
      const controlData = await captureControlStates(page, c.selector, c.label);
      if (controlData.states.normal) {
        const focusRing = await detectFocusRing(page, c.selector);
        woSurface.controls.push({
          ...controlData,
          focusRing,
        });
      }
    } catch (e) {
      console.warn(`WO: skipped ${c.label} (${e.message})`);
    }
  }
  
  // Also capture toolbar-level chrome
  woSurface.toolbarChrome = await page.evaluate(() => {
    const toolbar = document.querySelector('#toolbar');
    const cs = toolbar ? getComputedStyle(toolbar) : null;
    return toolbar ? {
      boxShadow: cs.boxShadow,
      border: cs.border,
      borderBottom: cs.borderBottom,
      backgroundColor: cs.backgroundColor,
      height: Math.round(toolbar.getBoundingClientRect().height),
    } : null;
  });
  
  await browser.close();
  return woSurface;
}

// ── Capture OO chrome surface ─────────────────────────────────────────
async function captureOOSurface(demoUrl) {
  const { chromium } = pw();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT });
  
  await page.goto(demoUrl, { waitUntil: 'load', timeout: 90000 });
  await sleep(5000);
  
  // Click file to open backstage
  const fileEl = await page.$('.file');
  if (fileEl) await fileEl.click();
  await sleep(15000);
  
  const ooFrame = page.frames().find(f => f.name() === 'frameEditor');
  if (!ooFrame) {
    console.warn('OO frame not found, retrying...');
    // Try to find by URL
    const frames = page.frames();
    const appFrame = frames.find(f => f.url().includes('/web-apps/'));
    if (!appFrame) throw new Error('OO editor frame not found');
    // Use the app frame as ooFrame
    ooFrame = appFrame;
  }
  
  await ooFrame.waitForSelector('.toolbar', { timeout: 30000 });
  await sleep(2000);
  
  const controls = [
    // Toolbar buttons
    { selector: '.toolbar button:first-child', label: 'toolbar-first-btn' },
    { selector: 'button[id*="btn-save"]', label: 'save-button' },
    { selector: 'button[id*="btn-undo"]', label: 'undo-button' },
    { selector: 'button[id*="btn-redo"]', label: 'redo-button' },
    
    // Tab buttons
    { selector: '.tabs li a:first-child', label: 'tab-home' },
    { selector: '.tabs li a:nth-child(2)', label: 'tab-insert' },
    
    // Container elements
    { selector: '.toolbar', label: 'toolbar-container' },
    { selector: '.box-controls', label: 'box-controls' },
  ];
  
  const ooSurface = {
    engine: 'oo',
    url: demoUrl,
    capturedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    controls: [],
    focusRingDetection: [],
  };
  
  for (const c of controls) {
    try {
      const controlData = await captureControlStates(ooFrame, c.selector, c.label);
      if (controlData.states.normal) {
        const focusRing = await detectFocusRing(ooFrame, c.selector);
        ooSurface.controls.push({
          ...controlData,
          focusRing,
        });
      }
    } catch (e) {
      console.warn(`OO: skipped ${c.label} (${e.message})`);
    }
  }
  
  // Capture toolbar-level chrome
  ooSurface.toolbarChrome = await ooFrame.evaluate(() => {
    const toolbar = document.querySelector('.toolbar');
    const cs = toolbar ? getComputedStyle(toolbar) : null;
    return toolbar ? {
      boxShadow: cs.boxShadow,
      border: cs.border,
      borderBottom: cs.borderBottom,
      backgroundColor: cs.backgroundColor,
      height: Math.round(toolbar.getBoundingClientRect().height),
    } : null;
  });
  
  await browser.close();
  return ooSurface;
}

// ── Diff computation ───────────────────────────────────────────────────
function diffChromeStyles(ooStyles, woStyles, state) {
  const diffs = [];
  const stylesToCompare = [
    'boxShadow', 'outline', 'outlineWidth', 'outlineStyle', 'outlineColor',
    'border', 'borderWidth', 'borderStyle', 'borderColor',
    'cursor', 'backgroundColor',
  ];
  
  for (const prop of stylesToCompare) {
    const ooVal = ooStyles?.[prop];
    const woVal = woStyles?.[prop];
    if (JSON.stringify(ooVal) !== JSON.stringify(woVal)) {
      diffs.push({
        property: prop,
        state,
        oo: ooVal,
        wo: woVal,
      });
    }
  }
  
  return diffs;
}

function diffControls(ooSurface, woSurface) {
  const diffs = [];
  const ooControls = ooSurface.controls || [];
  const woControls = woSurface.controls || [];
  
  // Map by label for comparison
  const ooMap = new Map(ooControls.map(c => [c.control, c]));
  const woMap = new Map(woControls.map(c => [c.control, c]));
  
  // Compare matching controls
  for (const [label, ooCtrl] of ooMap) {
    const woCtrl = woMap.get(label);
    if (!woCtrl) {
      diffs.push({
        type: 'missing-in-wo',
        control: label,
        oo: ooCtrl,
        wo: null,
      });
      continue;
    }
    
    // Compare each state
    for (const state of ['normal', 'hover', 'focus', 'active']) {
      const ooState = ooCtrl.states[state];
      const woState = woCtrl.states[state];
      
      if (ooState && woState) {
        const stateDiffs = diffChromeStyles(ooState, woState, state);
        diffs.push(...stateDiffs.map(d => ({
          ...d,
          control: label,
        })));
      } else if (ooState && !woState) {
        diffs.push({
          type: 'state-missing-in-wo',
          control: label,
          state,
          oo: ooState,
          wo: null,
        });
      } else if (!ooState && woState) {
        diffs.push({
          type: 'state-extra-in-wo',
          control: label,
          state,
          oo: null,
          wo: woState,
        });
      }
    }
  }
  
  // Check toolbar chrome differences
  const toolbarDiffs = diffChromeStyles(
    ooSurface.toolbarChrome,
    woSurface.toolbarChrome,
    'toolbar'
  );
  diffs.push(...toolbarDiffs.map(d => ({
    ...d,
    type: 'toolbar-chrome',
  })));
  
  return diffs;
}

// ── Main ───────────────────────────────────────────────────────────────
(async () => {
  console.log('Chrome surface probe: capturing WO...');
  const woSurface = await captureWOSurface(WO_URL);
  console.log(`  WO: ${woSurface.controls.length} controls captured`);
  
  console.log('Chrome surface probe: capturing OO...');
  const ooSurface = await captureOOSurface(OO_DEMO);
  console.log(`  OO: ${ooSurface.controls.length} controls captured`);
  
  // Compute diffs
  const diffs = diffControls(ooSurface, woSurface);
  
  const report = {
    capturedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    woUrl: WO_URL,
    ooDemo: OO_DEMO,
    wo: woSurface,
    oo: ooSurface,
    diffs,
    summary: {
      totalDiffs: diffs.length,
      byType: {
        boxShadow: diffs.filter(d => d.property === 'boxShadow').length,
        outline: diffs.filter(d => d.property === 'outline').length,
        cursor: diffs.filter(d => d.property === 'cursor').length,
        border: diffs.filter(d => ['border', 'borderWidth', 'borderStyle', 'borderColor'].includes(d.property)).length,
        backgroundColor: diffs.filter(d => d.property === 'backgroundColor').length,
        missing: diffs.filter(d => d.type === 'missing-in-wo').length,
        stateMissing: diffs.filter(d => d.type === 'state-missing-in-wo').length,
        toolbar: diffs.filter(d => d.type === 'toolbar-chrome').length,
      },
      woControls: woSurface.controls.length,
      ooControls: ooSurface.controls.length,
    },
  };
  
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\n=== CHROME SURFACE REPORT: ${OUT} ===`);
  console.log(`Total diffs: ${report.summary.totalDiffs}`);
  console.log(`  box-shadow: ${report.summary.byType.boxShadow}`);
  console.log(`  outline: ${report.summary.byType.outline}`);
  console.log(`  cursor: ${report.summary.byType.cursor}`);
  console.log(`  border: ${report.summary.byType.border}`);
  console.log(`  background: ${report.summary.byType.backgroundColor}`);
  console.log(`\nWO controls: ${report.summary.woControls}`);
  console.log(`OO controls: ${report.summary.ooControls}`);
})().catch((e) => {
  console.error('chrome-surface.cjs fail:', e.message);
  process.exit(1);
});
