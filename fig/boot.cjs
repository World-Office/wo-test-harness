#!/usr/bin/env node
// fig/boot.cjs — shared boot for fig probes: 5-editor-type UI root + docserver.
// The docserver child spawned by parity _boot survives its parent, so any
// stale :18113 listener is killed first (it would serve a stale word-only
// UI root and answer /sheet/ 404 while /word/ looks healthy).
'use strict';
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
// candidate chains: dev box nests the harness inside World-Office/
// (../../server/...), CI checks out the server repo at the workspace root
// (../../tests/... and ../../apps/...)
const PARITY = process.env.FIG_PARITY_ROOT ||
  [path.resolve(HERE, '..', '..', 'server', 'tests', 'parity'),
   path.resolve(HERE, '..', '..', 'tests', 'parity')].find(p => fs.existsSync(p)) ||
  path.resolve(HERE, '..', '..', 'server', 'tests', 'parity');
const WEB = [
  path.resolve(HERE, '..', '..', 'server', 'apps', 'web', 'apps'),
  path.resolve(HERE, '..', '..', 'apps', 'web', 'apps'),
].find(p => fs.existsSync(p)) || path.resolve(HERE, '..', '..', 'server', 'apps', 'web', 'apps');

// UI root with ALL five editor types, repo source / built dists
function ensureFullUiRoot() {
  const map = {
    word: path.join(WEB, 'documenteditor-wysiwyg'),
    sheet: path.join(WEB, 'spreadsheeteditor-react', 'dist'),
    slide: path.join(WEB, 'presentationeditor-react', 'dist'),
    pdf: path.join(WEB, 'pdfeditor-react', 'dist'),
    diagram: path.join(WEB, 'visioeditor-react', 'dist'),
  };
  const root = fs.mkdtempSync('/tmp/wo-fig-ui-');
  for (const [t, src] of Object.entries(map)) {
    if (fs.existsSync(path.join(src, 'index.html'))) fs.symlinkSync(src, path.join(root, t));
  }
  process.env.EDITOR_UI_DIR = root; // must be set BEFORE requiring parity _boot
  // Hunspell dictionaries live at repo assets on the dev box (default is the
  // container path /app/assets/dictionaries)
  if (!process.env.DICTIONARIES_DIR) {
    process.env.DICTIONARIES_DIR = path.resolve(WEB, '..', '..', '..', 'assets', 'dictionaries');
  }
  return root;
}

async function ensure() {
  ensureFullUiRoot();
  try { require('child_process').execSync('fuser -k 18113/tcp 2>/dev/null || true', { shell: '/bin/bash' }); } catch {}
  await new Promise(r => setTimeout(r, 300));
  const boot = require(path.join(PARITY, '_boot.cjs'));
  const server = await boot.ensureServer();
  return { base: server.base || 'http://127.0.0.1:18113', _boot: boot };
}

module.exports = { ensure, WEB, PARITY };
