#!/usr/bin/env node
// fig/fig-collab.cjs — collab-ws oracle: the coauthoring-service WS facade
// must carry ops between participants (the property OO DocService provided).
//   1. boot coauthoring-service (SERVICE_PORT, scratch sqlite)
//   2. POST /sessions {document_id} -> session_id
//   3. alice + bob join /ws/{id}
//   4. alice inserts "Hello" -> bob receives the Edit broadcast
//   5. bob inserts " world" @5 -> alice receives it
//   6. late joiner carol connects (must not error on a live session)
// Output: fig/census/fig-collab.json — consumed by fig-check.cjs (oracle 'collab').
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const OUT = path.join(__dirname, 'census');
const PORT = process.env.COAUTH_PORT || '8004';
const BASE = `http://127.0.0.1:${PORT}`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitHealth(ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return true;
    } catch {}
    await sleep(300);
  }
  return false;
}

function waitFor(box, pred, ms = 5000) {
  return new Promise((res) => {
    const t0 = Date.now();
    const tick = () => {
      const hit = box.msgs.find(pred);
      if (hit) return res(hit);
      if (Date.now() - t0 > ms) return res(null);
      setTimeout(tick, 100);
    };
    tick();
  });
}

async function connect(sessionId, user) { return connectRaw(sessionId, user); }
const connectRaw = (sessionId, user) => new Promise((res, rej) => {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/${sessionId}?user_id=${user}&username=${user}`);
  const box = { ws, msgs: [], open: false };
  ws.onopen = () => { box.open = true; res(box); };
  ws.onerror = (e) => rej(new Error(`ws ${user}: ${e.message || 'error'}`));
  ws.onmessage = (m) => { try { box.msgs.push(JSON.parse(m.data)); } catch { box.msgs.push({ raw: String(m.data).slice(0, 100) }); } };
  ws.onclose = () => { box.open = false; };
});

const editOp = (sessionId, userId, revision, position, content) =>
  JSON.stringify({ type: 'edit', operation: {  // enum is snake_case-tagged
    session_id: sessionId, user_id: userId, revision, type: 'insert',
    position, length: 0, content, timestamp: new Date().toISOString() } });

function waitFor(box, pred, ms = 5000) {
  return new Promise((res) => {
    const t0 = Date.now();
    const tick = () => {
      const hit = box.msgs.find(pred);
      if (hit) return res(hit);
      if (Date.now() - t0 > ms) return res(null);
      setTimeout(tick, 100);
    };
    tick();
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // stale coauthoring instance would win the port race (bind fail = silent
  // child death while /health still answers — from the WRONG database)
  try { require('child_process').execSync('fuser -k 8004/tcp 2>/dev/null || true', { shell: '/bin/bash' }); } catch {}
  await sleep(300);
  const db = path.join(fs.mkdtempSync('/tmp/wo-fig-collab-'), 'sessions.db');
  // candidate chain: dev box nests harness in World-Office/ (../../server/target),
  // CI checks out the server repo at workspace root (../../target)
  const bin = process.env.COAUTH_BIN ||
    [path.resolve(__dirname, '..', '..', 'server', 'target', 'debug', 'coauthoring-service'),
     path.resolve(__dirname, '..', '..', 'target', 'debug', 'coauthoring-service')]
      .find(p => fs.existsSync(p)) ||
    path.resolve(__dirname, '..', '..', 'server', 'target', 'debug', 'coauthoring-service');
  const child = spawn(bin, [], {
    env: { ...process.env, SERVICE_PORT: PORT, SERVICE_HOST: '127.0.0.1', DATABASE_PATH: db },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', () => {});
  const out = { generated: new Date().toISOString(), base: BASE, checks: {} };
  try {
    const healthy = await waitHealth();
    out.checks.serviceBoots = healthy;
    if (!healthy) throw new Error('coauthoring-service did not come up on ' + PORT);

    const sess = await fetch(`${BASE}/sessions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ document_id: 'fig-collab-doc' }),
    }).then(r => r.json());
    const sessionId = sess.session_id || sess.id;
    out.checks.sessionCreated = !!sessionId;

    const [alice, bob] = await Promise.all([
      connect(sessionId, 'alice'), connect(sessionId, 'bob'),
    ]);
    out.checks.participantsJoin = alice.open && bob.open;

    // alice -> bob
    alice.ws.send(editOp(sessionId, 'alice', 1, 0, 'Hello'));
    const atBob = await waitFor(bob, m => m.type === 'edit' && m.operation?.content === 'Hello');
    out.checks.broadcastAtoB = !!atBob;

    // bob -> alice
    bob.ws.send(editOp(sessionId, 'bob', 1, 5, ' world'));
    const atAlice = await waitFor(alice, m => m.type === 'edit' && m.operation?.content === ' world');
    out.checks.broadcastBtoA = !!atAlice;

    // late joiner: must receive initial_state (replayable CRDT snapshot)
    const carol = await connect(sessionId, 'carol');
    const init = await waitFor(carol, m => m.type === 'initial_state_msg');
    out.checks.lateJoinerReplay = !!(init && init.state &&
      (init.state.crdt_bytes?.length || init.state.participants?.length));

    [alice, bob, carol].forEach(c => { try { c.ws.close(); } catch {} });
  } catch (e) {
    out.error = String(e.message).slice(0, 200);
  } finally {
    child.kill('SIGKILL');
  }
  const checks = { ...out.checks };
  out.ok = checks.serviceBoots && checks.sessionCreated && checks.participantsJoin
        && checks.broadcastAtoB && checks.broadcastBtoA && checks.lateJoinerReplay;
  fs.writeFileSync(path.join(OUT, 'fig-collab.json'), JSON.stringify(out, null, 1));
  console.log(`fig-collab: ${out.ok ? 'PASS' : 'FAIL'} ${JSON.stringify(out.checks)}${out.error ? ' err=' + out.error : ''}`);
  process.exit(out.ok ? 0 : 1);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
