#!/usr/bin/env node
// fig/fig-auth.cjs — the two remaining http-contract oracles in one boot:
//
//   jwt-auth: HS256 access tokens (secret = JWT_SECRET) gate /wopi/files/*.
//     valid token   -> NOT 400/401 (auth passed; the forward to the WOPI
//                      host may 5xx on a dev box without OCIS — that IS the
//                      pass signal)
//     expired token -> 401
//     garbage token -> 401
//
//   spellchecker: the docserver serves the Hunspell dictionaries the
//     frontend checks with. Contract = reachability + safety:
//     flat form (en-US.aff) -> 200 with a hunspell .aff header line
//     subdir form (en_US/en_US.dic) -> 200
//     path traversal -> never 200
//
// Output: fig/census/fig-auth.json — consumed by fig-check.cjs.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ensure } = require(path.join(__dirname, 'boot.cjs'));
const OUT = path.join(__dirname, 'census');

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (h, p) => crypto.createHmac('sha256', 't').update(h + '.' + p).digest('base64url');

function jwt(claims) {
  const H = b64u({ alg: 'HS256', typ: 'JWT' });
  const P = b64u(claims);
  return `${H}.${P}.${sign(H, P)}`;
}

(async () => {
  const { base } = await ensure();
  const out = { generated: new Date().toISOString(), base, jwt: {}, spell: {} };

  // ── jwt-auth ────────────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const cases = {
    valid: jwt({ exp: now + 3600, sub: 'fig-u1' }),
    expired: jwt({ exp: now - 3600, sub: 'fig-u1' }),
    garbage: 'garbage.token.here',
  };
  const resp = {};
  for (const [name, t] of Object.entries(cases)) {
    const r = await fetch(`${base}/wopi/files/fig-probe?access_token=${encodeURIComponent(t)}`)
      .catch(() => ({ status: 0 }));
    resp[name] = r.status;
  }
  out.jwt.statuses = resp;
  out.jwt.passed = resp.valid >= 500;              // auth OK, upstream forward failed (no OCIS on dev box)
  out.jwt.rejectedExpired = resp.expired === 401;
  out.jwt.rejectedGarbage = resp.garbage === 401;
  out.jwt.ok = out.jwt.passed && out.jwt.rejectedExpired && out.jwt.rejectedGarbage;
  out.jwt.detail = `valid=${resp.valid} (forward ${resp.valid >= 500 ? 'attempted — auth passed' : 'REJECTED'}), expired=${resp.expired}, garbage=${resp.garbage}`;

  // ── spellchecker (dictionary serving) ───────────────────────────────────
  const aff = await fetch(`${base}/dictionaries/en-US.aff`).catch(() => ({ status: 0 }));
  const affHead = aff.status === 200 ? (await aff.text()).slice(0, 400) : '';
  const dic = await fetch(`${base}/dictionaries/en_US/en_US.dic`).catch(() => ({ status: 0 }));
  const trav = await fetch(`${base}/dictionaries/../Cargo.toml`).catch(() => ({ status: 0 }));
  out.spell.statuses = { affFlat: aff.status, dicSubdir: dic.status, traversal: trav.status };
  out.spell.flatForm = aff.status === 200 && /SET|TRY|COMPOUND|#/.test(affHead);
  out.spell.subdirForm = dic.status === 200;
  out.spell.traversalBlocked = trav.status !== 200;
  out.spell.ok = out.spell.flatForm && out.spell.subdirForm && out.spell.traversalBlocked;
  out.spell.detail = `aff=${aff.status} (hunspell header ${out.spell.flatForm ? 'ok' : 'missing'}), dic-subdir=${dic.status}, traversal=${trav.status}`;

  out.ok = out.jwt.ok && out.spell.ok;
  fs.writeFileSync(path.join(OUT, 'fig-auth.json'), JSON.stringify(out, null, 1));
  console.log(`fig-auth: ${out.ok ? 'PASS' : 'FAIL'} jwt[${out.jwt.detail}] spell[${out.spell.detail}]`);
  process.exit(out.ok ? 0 : 1);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
