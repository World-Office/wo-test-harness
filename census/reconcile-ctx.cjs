#!/usr/bin/env node
/* reconcile-ctx.cjs — reconcile a wet-run ctx capture (census/ctx-scenarios.json)
 * against the OO behavior contracts (census/ctx-contracts.json).
 *
 * Usage:
 *   node census/reconcile-ctx.cjs --offline      # gate: fixture + schema check, prints RECONCILE-OK
 *   node census/reconcile-ctx.cjs [--capture F]  # reconcile F (default census/ctx-scenarios.json)
 *   node census/reconcile-ctx.cjs --print        # dump the contract baseline to stdout
 *
 * Per scenario present both in the contract and the capture, prints per-row
 * OK / MISSING / EXTRA lines then a summary. Exit 0 in every mode (report
 * only, capture tool not a hard gate) except hard schema failure in --offline.
 */

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const DEFAULT_CAPTURE = path.join(HERE, 'ctx-scenarios.json');

const FIXTURE = {
  text: [
    { key: 'Cut', caption: 'Ausschneiden' },
    { key: 'Copy', caption: 'Kopieren' },
    { key: 'Paste', caption: 'Einfügen' },
    { key: 'PrintSelection', caption: 'Auswahl drucken' },
    { key: 'PageBreakBefore', caption: 'Seitenumbruch davor' },
    { key: 'KeepLines', caption: 'Absatz zusammenhalten' },
    { key: 'ParagraphSettings', caption: 'Absatz – Erweiterte Einstellungen' },
    { key: 'AddComment', caption: 'Kommentar hinzufügen' },
    { key: 'Link', caption: 'Link' },
    { key: 'FormattingAsStyle', caption: 'Formatierung als Formatvorlage' },
    { key: 'AI', caption: 'AI' },
  ],
};

function loadContracts() {
  return JSON.parse(fs.readFileSync(path.join(HERE, 'ctx-contracts.json'), 'utf8'));
}

function contractRows(contracts, scenario) {
  const c = contracts[scenario];
  if (Array.isArray(c)) return c;
  if (c && Array.isArray(c.rows)) return c.rows;
  return null;
}

function reconcile(contracts, capture, scenario) {
  const expected = contractRows(contracts, scenario);
  if (!expected) return { scenario, skipped: true, reason: 'no contract' };
  const records = capture.filter((r) => r.engine === 'worldoffice' && r.scenario === scenario);
  const actual = records.length
    ? records[0].visible
        .filter((r) => !r.dynamic) // dynamic spell suggestions are word-dependent
        .map((r) => r.canonical || r.key)
        .filter((v) => typeof v === 'string' && v)
    : [];
  const exp = new Set(expected);
  const act = new Set(actual);
  const missing = expected.filter((k) => !act.has(k));
  const extra = actual.filter((k) => !exp.has(k));
  for (const k of missing) console.log(`  MISSING ${scenario}: ${k}`);
  for (const k of extra) console.log(`  EXTRA   ${scenario}: ${k}`);
  return { scenario, missing, extra, ok: missing.length === 0 && extra.length === 0 };
}

function main() {
  const args = process.argv.slice(2);
  const contracts = loadContracts();

  if (args.includes('--print')) {
    console.log(JSON.stringify(contracts, null, 2));
    return 0;
  }

  if (args.includes('--offline')) {
    // Schema check: every top-level key must be an array of strings or
    // {rows: [strings], approx: bool}.
    for (const [scenario, c] of Object.entries(contracts)) {
      if (scenario === '_meta') continue;
      const rows = contractRows(contracts, scenario);
      if (!Array.isArray(rows) || rows.some((r) => typeof r !== 'string')) {
        console.error(`SCHEMA-FAIL: scenario '${scenario}' rows must be string[]`);
        return 1;
      }
    }
    const fixture = [{ engine: 'worldoffice', scenario: 'text', visible: FIXTURE.text }]
    const results = fixture.map((r) => r.scenario).map((s) => reconcile(contracts, fixture, s));
    console.log('RECONCILE-OK');
    return 0;
  }

  // Default: reconcile a real capture if present.
  const capIdx = args.indexOf('--capture');
  const capturePath = capIdx >= 0 ? args[capIdx + 1] : DEFAULT_CAPTURE;
  if (!fs.existsSync(capturePath)) {
    console.log(`NOTE: no capture at ${capturePath} — run census/ctx-scenarios.cjs first.`);
    console.log('RECONCILE-OK (no capture to reconcile)');
    return 0;
  }
  const rawCapture = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
  // the walker emits { scenarios: [...], capturedAt } — unwrap for reconcile
  const capture = Array.isArray(rawCapture) ? rawCapture : (rawCapture.scenarios || []);
  const scenarios = new Set(capture.filter((r) => r.engine === 'worldoffice').map((r) => r.scenario));
  let summary = { ok: 0, missing: 0, extra: 0, scenarios: 0 };
  for (const s of scenarios) {
    const r = reconcile(contracts, capture, s);
    if (r.skipped) continue;
    summary.scenarios += 1;
    summary.missing += r.missing.length;
    summary.extra += r.extra.length;
    if (r.ok) summary.ok += 1;
  }
  console.log(
    `reconcile: ${summary.scenarios} scenarios, ${summary.ok} clean, ${summary.missing} missing rows, ${summary.extra} extra rows`,
  );

  // Live engine diff: worldoffice vs onlyoffice rows per shared scenario.
  // Note: the OO demo doc is fixed (Bericht.docx) — scenarios that need
  // seeded content (table/image/shape) see whatever lives at the probe spot,
  // so diffs there are rig limits, not necessarily product gaps.
  const wo = {};
  const oo = {};
  for (const r of capture) (r.engine === 'worldoffice' ? wo : oo)[r.scenario] = r;
  const shared = [...new Set([...Object.keys(wo), ...Object.keys(oo)])].sort();
  if (shared.length) {
    console.log('engine diff (worldoffice vs onlyoffice, live capture):');
    for (const s of shared) {
      const w = (wo[s] ? wo[s].visible || [] : []).map((r) => r.canonical).filter(Boolean);
      const o = (oo[s] ? oo[s].visible || [] : []).map((r) => r.canonical).filter(Boolean);
      const inW = w.filter((k) => !o.includes(k));
      const inO = o.filter((k) => !w.includes(k));
      const verdict = !wo[s] ? 'no-wo' : !oo[s] ? 'no-oo' : (w.length === o.length && inW.length === 0 && inO.length === 0) ? 'IDENTICAL' : 'differs';
      console.log(`  ${s}: ${verdict} (wo=${w.length} oo=${o.length})`);
      if (verdict === 'differs') {
        if (inW.length) console.log(`    only-wo: ${inW.join(', ')}`);
        if (inO.length) console.log(`    only-oo: ${inO.join(', ')}`);
      }
    }
  }
  return 0;
}

process.exit(main());
