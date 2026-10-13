#!/usr/bin/env node
// fig/fig-contracts.cjs — form contracts for the three smoke-only caps that
// need no upstream mock (hosting-discovery, conversion-formats, document-api).
// The WOPI caps stay smokes: their contract needs a live WOPI host and is
// covered by the E2E stack (real OCIS).
//   discovery : WOPI-discovery XML — <wopi-discovery><net-zone><app> with
//               <action name="edit" ext="docx" urlsrc="...">
//   formats   : {formats:[[from,to]...]} — >=50 pairs, docx->pdf present
//   documents : new -> {doc_id}; info -> {id,format,size,...}; contents PUT
//               -> {ok:true,size} then GET 200; html -> 200 DOCTYPE; meta ->
//               base_file_name
// Output: fig/census/fig-contracts.json — consumed by fig-check.cjs.
'use strict';
const fs = require('fs');
const path = require('path');
const { ensure } = require(path.join(__dirname, 'boot.cjs'));
const OUT = path.join(__dirname, 'census');

(async () => {
  const { base } = await ensure();
  const out = { generated: new Date().toISOString(), base, discovery: {}, formats: {}, documents: {} };

  // ── hosting-discovery ────────────────────────────────────────────────────
  try {
    const xml = await (await fetch(`${base}/hosting/discovery`)).text();
    const has = (re) => re.test(xml);
    out.discovery.wopiDiscoveryRoot = has(/<wopi-discovery/);
    out.discovery.netZone = has(/<net-zone[^>]*name="[^"]+"/);
    out.discovery.apps = (xml.match(/<app\b/g) || []).length;
    out.discovery.editAction = has(/<action[^>]*name="edit"[^>]*ext="docx"[^>]*urlsrc="/) ||
                               has(/<action[^>]*ext="docx"[^>]*name="edit"/);
    out.discovery.ok = out.discovery.wopiDiscoveryRoot && out.discovery.netZone &&
                       out.discovery.apps > 0 && out.discovery.editAction;
    out.discovery.detail = `root=${out.discovery.wopiDiscoveryRoot} net-zone=${out.discovery.netZone} apps=${out.discovery.apps} edit-docx-action=${out.discovery.editAction}`;
  } catch (e) { out.discovery.ok = false; out.discovery.detail = String(e.message).slice(0, 120); }

  // ── conversion-formats ───────────────────────────────────────────────────
  try {
    const j = await (await fetch(`${base}/api/conversion/formats`)).json();
    const fmts = j.formats || j;
    const pairs = Array.isArray(fmts) && fmts.every(f => Array.isArray(f) &&
      typeof f[0] === 'string' && typeof f[1] === 'string');
    out.formats.count = fmts.length;
    out.formats.pairShape = pairs;
    out.formats.docxToPdf = pairs && fmts.some(f => f[0] === 'docx' && f[1] === 'pdf');
    out.formats.ok = out.formats.count >= 50 && out.formats.pairShape && out.formats.docxToPdf;
    out.formats.detail = `${fmts.length} formats (ref 58), [from,to] shape=${out.formats.pairShape}, docx->pdf=${out.formats.docxToPdf}`;
  } catch (e) { out.formats.ok = false; out.formats.detail = String(e.message).slice(0, 120); }

  // ── document-api ─────────────────────────────────────────────────────────
  try {
    const nj = await (await fetch(`${base}/api/documents/new`, { method: 'POST' })).json();
    out.documents.newShape = !!(nj.doc_id && nj.name);
    const id = nj.doc_id;
    const info = await (await fetch(`${base}/api/documents/${id}/info`)).json();
    out.documents.infoShape = !!(info.id && info.format && typeof info.size === 'number');
    const html = await (await fetch(`${base}/api/documents/${id}/html`)).json();
    out.documents.htmlExport = typeof html.html === 'string' && html.html.includes('<!DOCTYPE html>');
    const meta = await (await fetch(`${base}/api/documents/${id}`)).json();
    out.documents.metaShape = !!meta.base_file_name;
    const body = Buffer.from('PK\x03\x04fig-contract-roundtrip');
    const put = await (await fetch(`${base}/api/documents/${id}/contents`, {
      method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body,
    })).json();
    out.documents.contentsPut = put.ok === true;
    const get = await fetch(`${base}/api/documents/${id}/contents`);
    out.documents.contentsGet = get.status === 200 &&
      Buffer.compare(Buffer.from(await get.arrayBuffer()), body) === 0; // byte-exact roundtrip
    out.documents.ok = out.documents.newShape && out.documents.infoShape && out.documents.contentsPut &&
                       out.documents.contentsGet && out.documents.htmlExport && out.documents.metaShape;
    out.documents.detail = `new=${out.documents.newShape} info=${out.documents.infoShape} put=${out.documents.contentsPut} get=${out.documents.contentsGet} html=${out.documents.htmlExport} meta=${out.documents.metaShape}`;
  } catch (e) { out.documents.ok = false; out.documents.detail = String(e.message).slice(0, 120); }

  out.ok = out.discovery.ok && out.formats.ok && out.documents.ok;
  fs.writeFileSync(path.join(OUT, 'fig-contracts.json'), JSON.stringify(out, null, 1));
  const verdict = (s) => s.ok ? 'PASS' : 'FAIL';
  console.log(`fig-contracts: ${out.ok ? 'PASS' : 'FAIL'} discovery[${verdict(out.discovery)}] formats[${verdict(out.formats)}] documents[${verdict(out.documents)}]`);
  process.exit(out.ok ? 0 : 1);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
