// probe 3 — network + console health: spell dictionaries must load (no 404 on
// .aff/.dic), no empty-aff warnings, no repeated console.error noise on boot.
const { boot, typeAt, ok, finish, sleep } = require('./e2e-lib.cjs');

(async () => {
  const { b, p, pageErrors } = await boot();
  try {
    const bad = [];
    p.on('response', (r) => {
      const u = r.request().url();
      if (r.status() >= 400) bad.push(`${r.status()} ${u.replace(/^https?:\/\/[^/]+/, '')}`);
    });
    const errors = [];
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

    // exercise the editor a little so lazy loaders fire
    await typeAt(p, 'spellcheck probe text');
    await sleep(2500);

    ok('net: no 4xx/5xx responses', bad.length === 0, bad.slice(0, 3).join(', '));
    ok('net: dictionaries (.aff/.dic) load', !bad.some((x) => /\.aff|\.dic/.test(x)));
    ok('console: no spell aff/dic warnings',
      !errors.some((e) => /aff|dictionar|hunspell/i.test(e)), errors.slice(0, 2).join(' | '));
    ok('console: no page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  } finally {
    await b.close();
  }
  finish('health');
})().catch((e) => { console.error('ERROR:', e.message); process.exit(2); });
