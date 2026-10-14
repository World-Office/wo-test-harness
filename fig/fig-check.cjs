#!/usr/bin/env node
// fig/fig-check.cjs — the strangler-fig cutover oracle.
//
// For every capability in capabilities.json:
//   1. run the live probe against the running wo-docserver (booted via the
//      parity _boot helper — same binary, same port, no duplicate boot logic)
//   2. attach the oracle verdict (parity-contracts results when the oracle
//      is parity-contracts; census/legacy-parity where available)
//   3. derive the fig state:
//        canonical  — rust serves AND oracle green  (legacy may be switched off)
//        shadow     — rust serves, oracle not yet green/defined
//        blocked    — rust probe failed (fallback to OO still required)
//        legacy     — no rust implementation yet (OO Node code canonical)
//   4. write fig-status.json + plan/FIG_STATUS.md
//
//   node fig-check.cjs [--parity-root DIR] [--out DIR] [--report plan/FIG_STATUS.md]
'use strict';
const fs = require('fs');
const path = require('path');

function arg(k, d) { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; }
const HERE = __dirname;
const PARITY = arg('--parity-root', path.resolve(HERE, '..', '..', 'server', 'tests', 'parity'));
const OUT = arg('--out', path.join(HERE, 'census'));
const REPORT = arg('--report',
  fs.existsSync(path.resolve(HERE, '..', '..', 'plan'))
    ? path.resolve(HERE, '..', '..', 'plan', 'FIG_STATUS.md')   // dev box: plan submodule
    : path.join(OUT, 'fig-status.md'));                          // CI: harness census

const caps = JSON.parse(fs.readFileSync(path.join(HERE, 'capabilities.json'), 'utf8'));
const { ensure } = require(path.join(HERE, 'boot.cjs'));

// ── boot the docserver through the shared fig helper ────────────────────
let base = 'http://127.0.0.1:18113';
let server = null, browser = null;
async function run() {
  try {
    const s = await ensure();
    base = s.base;
    return true;
  } catch (e) {
    console.error(`fig-check: cannot boot docserver (${e.message}) — probes will fail`);
    return false;
  }
}

async function probe(p) {
  if (p.method === 'skip') return { ok: null, observed: 'skipped (no live probe defined)' };
  try {
    if (p.method === 'CONVERT') {
      // conversion smoke: real golden docx through the wo-x2t router
      const file = path.resolve(HERE, '..', 'census', 'golden', 'docs', p.file);
      if (!fs.existsSync(file)) return { ok: false, observed: `golden missing: ${p.file}` };
      const b64 = fs.readFileSync(file).toString('base64');
      const res = await fetch(base + '/api/conversion/convert', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: b64, source_format: p.from, target_format: p.to }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json().catch(() => ({}));
      const outLen = j.data ? Buffer.byteLength(j.data, 'base64') : 0;
      const ok = res.ok && j.status === 'Success' && outLen > 1000;
      return { ok, observed: `HTTP ${res.status}, status=${j.status}, pdf-bytes=${outLen}` };
    }
    const res = await fetch(base + p.path, { method: p.method, signal: AbortSignal.timeout(5000) });
    const body = await res.text();
    if (p.expect === 'xml-apps>=1') {
      const apps = (body.match(/<app\b/g) || []).length;
      return { ok: res.ok && apps >= 1, observed: `HTTP ${res.status}, ${apps} app entries` };
    }
    if (p.expect === 'json') {
      let n = 0; try { n = Object.keys(JSON.parse(body)).length; } catch {}
      return { ok: n > 0, observed: `HTTP ${res.status}, JSON keys=${n}` };
    }
    if (p.expect === 'formats>=10') {
      let n = 0; try { n = (JSON.parse(body).formats || []).length; } catch {}
      return { ok: n >= 10, observed: `HTTP ${res.status}, ${n} formats` };
    }
    if (p.expect === 'ribbon-markers') {
      const ok = res.ok && /ribbon|data-tab=/.test(body);
      return { ok, observed: `HTTP ${res.status}, ribbon-markers=${/ribbon|data-tab=/.test(body)}` };
    }
    if (p.expect === 'status-200') return { ok: res.ok, observed: `HTTP ${res.status}` };
    if (p.expect === 'status-4xx') {
      // WOPI trust boundary: unauthenticated access must fail cleanly (4xx,
      // never 5xx/crash) — that IS the equivalence behavior at the facade
      const ok = res.status >= 400 && res.status < 500;
      return { ok, observed: `HTTP ${res.status} (auth boundary ${ok ? 'clean' : 'BROKEN'})` };
    }
    return { ok: res.ok, observed: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, observed: `probe failed: ${e.message}` };
  }
}

// ── oracles that read existing harness artifacts ─────────────────────────
function oracleFor(cap) {
  if (cap.oracle === 'parity-contracts') {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(PARITY, 'contract-results.json'), 'utf8'));
      const fail = (r.results || []).filter(x => !x.ok && !x.xfail).length;
      return { name: 'parity-contracts', green: fail === 0 && (r.results || []).length > 0,
               detail: `${(r.results || []).length - fail} pass / ${fail} fail (known-gaps excluded)` };
    } catch { return { name: 'parity-contracts', green: false, detail: 'no contract-results.json' }; }
  }
  if (cap.oracle === 'census') {
    // per-type presence+interaction census (fig-census.cjs): file tab renders,
    // file menu opens, ribbon floor + baseline drift guard, no page errors.
    // Stage 1 oracle — OO feature-depth census remains stage-2 debt.
    try {
      const v = JSON.parse(fs.readFileSync(path.join(HERE, 'census', 'fig-census.json'), 'utf8'));
      const t = (cap.id || '').replace('editor-ui-', '');
      const r = v.types && v.types[t];
      if (!r) return { name: 'census', green: false, detail: `no fig-census entry for ${t} (run fig-census.cjs)` };
      return { name: 'census', green: !!r.ok,
               detail: `presence census ${r.ok ? 'OK' : 'FAIL'}: buttons=${r.ribbonButtons}${r.baselineButtons ? ` (baseline ${r.baselineButtons})` : ''}, fileMenu=${r.checks && r.checks.fileMenuOpens}, canvas=${r.canvases}; OO-depth pending` };
    } catch { return { name: 'census', green: false, detail: 'fig-census.json missing (run fig-census.cjs)' };
    }
  }
  if (cap.oracle === 'wopi') {
    // fig-wopi.cjs: WOPI proxy form contracts against an in-process WOPI
    // host (checkfileinfo shape, byte-exact contents, lock dance)
    const section = { 'wopi-checkfileinfo': 'checkfileinfo', 'wopi-contents': 'contents', 'wopi-locks': 'locks' }[cap.id];
    try {
      const w = JSON.parse(fs.readFileSync(path.join(HERE, 'census', 'fig-wopi.json'), 'utf8'));
      const s = section && w[section];
      if (!s) return { name: 'wopi', green: false, detail: `no fig-wopi section for ${cap.id}` };
      return { name: 'wopi', green: s.ok === true, detail: `status=${s.status}` + (s.error ? ` error=${s.error}` : '') };
    } catch { return { name: 'wopi', green: false, detail: 'fig-wopi.json missing (run fig-wopi.cjs)' }; }
  }
  if (cap.oracle === 'contract') {
    // fig-contracts.cjs: response-form contracts for the caps that need no
    // upstream mock (discovery XML, conversion format pairs, document API)
    const section = { 'hosting-discovery': 'discovery', 'conversion-formats': 'formats', 'document-api': 'documents' }[cap.id];
    try {
      const c = JSON.parse(fs.readFileSync(path.join(HERE, 'census', 'fig-contracts.json'), 'utf8'));
      const s = section && c[section];
      if (!s) return { name: 'contract', green: false, detail: `no fig-contracts section for ${cap.id}` };
      return { name: 'contract', green: s.ok === true, detail: s.detail };
    } catch { return { name: 'contract', green: false, detail: 'fig-contracts.json missing (run fig-contracts.cjs)' }; }
  }
  if (cap.oracle === 'auth') {
    // fig-auth.cjs: jwt-auth (HS256 boundary: valid passes to forward,
    // expired/garbage -> 401) and spellchecker (hunspell dict reachability
    // + traversal safety) — one boot, two contract oracles
    try {
      const a = JSON.parse(fs.readFileSync(path.join(HERE, 'census', 'fig-auth.json'), 'utf8'));
      const sec = cap.id === 'jwt-auth' ? a.jwt : a.spell;
      if (!sec) return { name: 'auth', green: false, detail: `no fig-auth section for ${cap.id}` };
      return { name: 'auth', green: sec.ok === true, detail: sec.detail };
    } catch { return { name: 'auth', green: false, detail: 'fig-auth.json missing (run fig-auth.cjs)' }; }
  }
  if (cap.oracle === 'collab') {
    // fig-collab.cjs: live coauthoring-service — session create, ws join,
    // bidirectional edit broadcast, late-joiner CRDT replay
    try {
      const c = JSON.parse(fs.readFileSync(path.join(HERE, 'census', 'fig-collab.json'), 'utf8'));
      const k = c.checks || {};
      return { name: 'collab', green: c.ok === true,
               detail: `ws broadcast A→B=${k.broadcastAtoB} B→A=${k.broadcastBtoA}, late-joiner replay=${k.lateJoinerReplay}; editor-side integration = stage 2` };
    } catch { return { name: 'collab', green: false, detail: 'fig-collab.json missing (run fig-collab.cjs)' }; }
  }
  if (cap.oracle === 'golden') {
    // fig-golden.py: golden docx -> pdf via wo-x2t, compared against the
    // committed OO-DS reference pdfs (page sanity + text-token Jaccard).
    try {
      const g = JSON.parse(fs.readFileSync(path.join(HERE, 'census', 'fig-golden.json'), 'utf8'));
      const stems = Object.entries(g.stems || {});
      const pass = stems.filter(([, s]) => s.ok).length;
      return { name: 'golden', green: g.ok === true && pass > 0,
               detail: `${pass}/${stems.length} golden conversions pass (sim ${stems.map(([, s]) => s.textSimilarity).join('/')})` };
    } catch { return { name: 'golden', green: false, detail: 'fig-golden.json missing (run fig-golden.py)' }; }
  }
  if (cap.oracle === 'none') {
    return cap.status === 'obsolete'
      ? { name: 'none', green: false, detail: 'not ported — no WO client calls this surface (dies with legacy teardown)' }
      : { name: 'none', green: false, detail: 'oracle to be defined' };
  }
  return { name: 'http', green: null, detail: 'probe IS the oracle' };
}

(async () => {
  await run();
  fs.mkdirSync(OUT, { recursive: true });
  const rows = [];
  for (const cap of caps.capabilities) {
    const pr = await probe(cap.probe || {});
    const or = oracleFor(cap);
    let state;
    if (cap.status === 'obsolete') {
      // no WO client calls this surface — OO-internal coordination, dies
      // with the legacy teardown (command-service: only DocsCoServer calls
      // its own /command)
      state = 'obsolete';
    } else if (cap.status === 'legacy') state = 'legacy';
    else if (pr.ok === false) state = 'blocked';
    else if (or.green === true) state = 'canonical';
    else state = 'shadow';
    rows.push({ id: cap.id, declared: cap.status, probe: pr, oracle: or, state,
                wo_impl: cap.wo_impl, oo_ref: cap.oo_ref });
  }
  if (server && server.close) { try { server.close(); } catch {} }
  if (browser) { try { await browser.close(); } catch {} }

  const counts = {};
  for (const r of rows) counts[r.state] = (counts[r.state] || 0) + 1;
  const verdict = { generated: new Date().toISOString(), base, counts, rows };
  fs.writeFileSync(path.join(OUT, 'fig-status.json'), JSON.stringify(verdict, null, 1));
  console.log(`fig states: ${JSON.stringify(counts)}`);

  // ── markdown ──
  const M = [];
  M.push('# Strangler-Fig Status: OnlyOffice DocumentServer → World-Office Rust');
  M.push('');
  M.push(`Generiert ${verdict.generated}, Probes gegen ${base}.`);
  M.push('');
  M.push('Die Strangler-Fig-Fassade ist der `documentserver`-Container: dieselbe API-Fläche (discovery, WOPI, conversion, editor-Bundles), dahinter bereits der Rust docserver. Dieses Protokoll entscheidet je Capability, ob die OO-Node-Referenz (services/server) ausgeschaltet werden darf.');
  M.push('');
  M.push(`**States: canonical ${counts.canonical || 0} · shadow ${counts.shadow || 0} · blocked ${counts.blocked || 0} · legacy ${counts.legacy || 0}**`);
  M.push('');
  M.push('| Capability | State | Probe | Oracle |');
  M.push('|---|---|---|---|');
  for (const r of rows) {
    M.push(`| ${r.id} | **${r.state}** | ${r.probe.observed} | ${r.oracle.name}: ${r.oracle.detail} |`);
  }
  M.push('');
  M.push('## Cutover-Pfad je Capability');
  M.push('');
  M.push('1. **legacy → shadow**: Rust-Impl hinter der Fassade registrieren (Container-API unverändert).');
  M.push('2. **shadow → canonical**: Oracle grün — `http`: Probe; `parity-contracts`: L2-Verträge 5/0; `census`: Marker-Census; `golden`: byte/semantic compare gegen OO-Referenz-Outputs (capture-oo-goldens.py).');
  M.push('3. **canonical**: OO-Node-Pfad entfernen, Rust bleibt Rückfall nicht mehr nötig. Rollback = Git, nicht Doppelbetrieb.');
  M.push('');
  M.push('### Offene Oracles (blockiert Cutover)');
  M.push('');
  M.push('`http`-Probes sind Smokes (Fassade lebt, Formen stimmen grob) — sie allein rechtfertigen keinen Cutover, der echte Kontrakt gegen die OO-Referenz fehlt noch.');
  const open = rows.filter(r => r.state === 'shadow' && r.oracle.name !== 'http');
  for (const r of open) M.push(`- **${r.id}** — oracle \`${r.oracle.name}\`: ${r.oracle.detail}`);
  const smokes = rows.filter(r => r.state === 'shadow' && r.oracle.name === 'http');
  if (smokes.length) {
    M.push('');
    M.push('### Nur-Smoke (Kontrakt-Hochstufung offen)');
    M.push('');
    for (const r of smokes) M.push(`- **${r.id}** — probe: ${r.probe.observed}; Form-Kontrakt (Antwortschema vs. OO-Referenz) als Hochstufung`);
  }
  M.push('');
  fs.writeFileSync(REPORT, M.join('\n') + '\n');
  console.log(`report -> ${REPORT}`);
  process.exit(0); // docserver child + fetch agents would keep the loop alive
})().catch(e => { console.error(e); process.exit(1); });
