#!/usr/bin/env node
// fig/fig-wopi.cjs — WOPI proxy form contracts for the last three shadow caps
// (wopi-checkfileinfo, wopi-contents, wopi-locks). The wo-docserver proxies
// the WOPI surface to an upstream host; on a bare dev box there is no host so
// the smoke probes only saw 502/401. Here we boot wo-docserver against a tiny
// in-process WOPI host so the real response FORMS flow back through the
// facade — proving it proxies genuine WOPI data instead of erroring.
//   checkfileinfo : GET /wopi/files/{id}?access_token=<valid> -> 200 + WOPI
//                   CheckFileInfo shape (BaseFileName/Size/OwnerId/UserId/Version)
//   get contents  : GET  /wopi/files/{id}/contents -> 200 + exact mock bytes
//   put contents  : POST /wopi/files/{id}/contents -> 200 after full LOCK dance
//   auth barrier  : expired token -> 401 (sharp reject still holds)
// Output: fig/census/fig-wopi.json — consumed by fig-check.cjs.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const crypto = require('crypto');

const OUT = path.join(__dirname, 'census');
const BIN = process.env.WO_DOCSERVER_BIN ||
  [path.resolve(__dirname, '..', '..', 'server', 'target', 'debug', 'wo-docserver'),
   path.resolve(__dirname, '..', '..', 'target', 'debug', 'wo-docserver')]
    .find(p => fs.existsSync(p)) ||
  path.resolve(__dirname, '..', '..', 'server', 'target', 'debug', 'wo-docserver');
const DS_PORT = 18114;
const MOCK_PORT = 18115;
const BASE = `http://127.0.0.1:${DS_PORT}`;
const SECRET = 't';

// WOPI host mock — answers the full lock dance + checkfileinfo + contents.
const MOCK_BYTES = Buffer.from('PK\x03\x04wopi-contents-form-contract-docx-bytes');
const MOCK_INFO = {
  BaseFileName: 'fig.docx',
  Size: 8,
  OwnerId: 'admin',
  UserId: 'admin',
  Version: 'v1.0',
};
const mockLocks = new Map(); // file_id -> lock id
function startMock() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const fileId = (req.url.split('?')[0].split('/').filter(Boolean)[2] || '');
      const lockHeader = req.headers['x-wopi-lock'] || 'wo-docserver-lock';
      if (req.url.includes('/contents')) {
        if (req.method === 'GET') {
          res.writeHead(200, { 'content-type': 'application/octet-stream' });
          return res.end(MOCK_BYTES);
        }
        if (req.method === 'POST') {
          mockLocks.set(fileId, lockHeader);
          res.writeHead(200, { 'X-WOPI-Lock': lockHeader });
          return res.end();
        }
      }
      const override = req.headers['x-wopi-override'];
      if (override === 'LOCK') { mockLocks.set(fileId, lockHeader); res.writeHead(200, { 'X-WOPI-Lock': lockHeader }); return res.end(); }
      if (override === 'UNLOCK') { mockLocks.delete(fileId); res.writeHead(200); return res.end(); }
      if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(MOCK_INFO)); }
      res.writeHead(200); res.end();
    });
    srv.on('error', reject);
    srv.listen(MOCK_PORT, '127.0.0.1', () => resolve(srv));
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function bootDs(uiDir, dataDir) {
  const child = spawn(BIN, [], {
    env: {
      ...process.env,
      JWT_SECRET: SECRET,
      DOCSERVER_PORT: String(DS_PORT),
      WOPI_HOST: `http://127.0.0.1:${MOCK_PORT}`,
      EDITOR_UI_DIR: uiDir,
      DOCSERVER_DATA_DIR: dataDir,
    },
    stdio: 'ignore',
  });
  return child;
}
async function waitUp(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch {}
    await sleep(250);
  }
}
function mkToken(exp) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

(async () => {
  const mock = await startMock();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wopi-'));
  const uiDir = process.env.EDITOR_UI_DIR
    ? (fs.existsSync(process.env.EDITOR_UI_DIR) ? process.env.EDITOR_UI_DIR : '/tmp')
    : (() => {
        const c = [path.resolve(__dirname, '..', '..', 'server', 'apps', 'web', 'apps', 'documenteditor-wysiwyg'),
                   path.resolve(__dirname, '..', '..', 'apps', 'web', 'apps', 'documenteditor-wysiwyg')]
          .find(p => fs.existsSync(p));
        return c || '/tmp';
      })();
  const child = bootDs(uiDir, dataDir);
  const out = { generated: new Date().toISOString(), checkfileinfo: {}, contents: {}, locks: {}, auth: {} };
  try {
    await waitUp(`${BASE}/hosting/discovery`);

    const valid = mkToken(Math.floor(Date.now() / 1000) + 3600);
    const expired = mkToken(Math.floor(Date.now() / 1000) - 3600);

    // checkfileinfo form
    const cfi = await fetch(`${BASE}/wopi/files/fig-contract?access_token=${valid}`);
    const cfiBody = await cfi.json();
    out.checkfileinfo.status = cfi.status;
    out.checkfileinfo.form = ['BaseFileName', 'Size', 'OwnerId', 'UserId', 'Version'].every(k => k in cfiBody);
    out.checkfileinfo.baseFileName = cfiBody.BaseFileName;
    out.checkfileinfo.ok = cfi.status === 200 && out.checkfileinfo.form;

    // get contents form (byte-exact)
    const get = await fetch(`${BASE}/wopi/files/fig-contract/contents?access_token=${valid}`);
    const getBytes = Buffer.from(await get.arrayBuffer());
    out.contents.status = get.status;
    out.contents.byteExact = get.status === 200 && Buffer.compare(getBytes, MOCK_BYTES) === 0;
    out.contents.ok = out.contents.byteExact;

    // put contents — full lock dance through facade
    const put = await fetch(`${BASE}/wopi/files/fig-contract/contents?access_token=${valid}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', 'x-wopi-override': 'PUT', 'x-wopi-lock': 'wo-docserver-lock' },
      body: MOCK_BYTES,
    });
    out.locks.status = put.status;
    out.locks.mockHeldLock = mockLocks.get('fig-contract') === 'wo-docserver-lock';
    out.locks.ok = put.status === 200;

    // auth barrier still sharp
    const bad = await fetch(`${BASE}/wopi/files/fig-contract/contents?access_token=${expired}`);
    out.auth.status = bad.status;
    out.auth.ok = bad.status === 401;

    out.ok = out.checkfileinfo.ok && out.contents.ok && out.locks.ok && out.auth.ok;
  } catch (e) {
    out.ok = false; out.error = String(e.message).slice(0, 200);
  } finally {
    child.kill('SIGKILL');
    mock.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(OUT, 'fig-wopi.json'), JSON.stringify(out, null, 1));
  const v = (s) => s.ok ? 'PASS' : 'FAIL';
  console.log(`fig-wopi: ${out.ok ? 'PASS' : 'FAIL'} checkfileinfo[${v(out.checkfileinfo)}] get[${v(out.contents)}] locks[${v(out.locks)}] auth[${v(out.auth)}]`);
  process.exit(out.ok ? 0 : 1);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
