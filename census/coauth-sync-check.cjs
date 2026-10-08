#!/usr/bin/env node
/* coauth-sync-check.cjs — prove the E-CO-1 substrate: two browser WebSocket
 * clients to the coauthoring service; A's document_op envelope reaches B. */
const { chromium } = require('playwright')

async function main() {
  const api = process.env.CO_AUTH_API || 'http://127.0.0.1:8004'
  const wsUrl = (process.env.CO_AUTH_WS || 'ws://127.0.0.1:8004')

  const res = await fetch(`${api}/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ document_id: 'e2e-coauth-check.docx' }),
  })
  if (!res.ok) { console.error(`session create failed: ${res.status}`); process.exit(1) }
  const { session_id } = await res.json()
  console.log(`session: ${session_id}`)

  const b = await chromium.launch({ headless: true })
  const page = await b.newPage()
  const result = await page.evaluate(async ({ wsBase, sid }) => {
    const open = (uid, uname) => new Promise((resolve, reject) => {
      const s = new WebSocket(`${wsBase}/ws/${sid}?user_id=${uid}&username=${encodeURIComponent(uname)}`)
      s.onopen = () => resolve(s)
      s.onerror = (e) => reject(new Error('ws error'))
    })
    const a = await open('user-a', 'Alice')
    const b = await open('user-b', 'Bob')
    await new Promise((r) => setTimeout(r, 300)) // sessions join

    const received = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('B never received the op')), 10000)
      b.onmessage = (ev) => {
        const msg = JSON.parse(ev.data)
        if (msg && msg.envelope && (msg.envelope.op || msg.envelope.payload)) {
          clearTimeout(timeout)
          resolve(msg)
        }
      }
      const envelope = {
        version: 1,
        session_id: sid,
        user_id: 'user-a',
        revision: 1,
        timestamp: new Date().toISOString(),
        // Flattened ModelOp fields (matches the rust wire schema, WIRE_SCHEMA_VERSION=1)
        op: 'insert',
        at: { kind: 'text', para: 0, run: 0, char: 0 },
        content: 'hello from Alice',
      }
      a.send(JSON.stringify({ type: 'document_op', envelope }))
    })
    a.close(); b.close()
    const cv = received.envelope.payload?.content ?? received.envelope.content
      return { session_id: received.envelope.session_id, user: received.envelope.user_id, content: cv }
  }, { wsBase: wsUrl, sid: session_id })

  const ok = result.session_id === session_id && result.user === 'user-a' && result.content === 'hello from Alice'
  console.log(`[E-CO-1] B received from A: user=${result.user} session=${result.session_id} content="${result.content}" ${ok ? 'PASS' : 'FAIL'}`)
  await b.close()
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error('coauth-sync-check fail:', e.message); process.exit(1) })