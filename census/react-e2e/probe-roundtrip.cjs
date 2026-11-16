// probe 1 — boot health + typing + caret + selection + formatting roundtrip.
// Proves: wasm engine boots, keyboard ops reach the engine, formatting survives
// the docx export (canvas → serialize_document → Download-as).
const { boot, typeAt, exportDocx, docxXml, ok, finish, sleep } = require('./e2e-lib.cjs');
const PROBE = 'ZZQXROUNDTRIP';

(async () => {
  const { b, p, pageErrors } = await boot();
  try {
    ok('boot: zero page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
    const canvas = await p.$('canvas');
    ok('boot: canvas present', !!canvas);

    await typeAt(p, PROBE);

    // keyboard select-all + bold (engine wiring 2026-11-16)
    await p.keyboard.press('Control+a'); await sleep(400);
    await p.keyboard.press('Control+b'); await sleep(800);

    // undo removes the bold; redo restores it
    await p.keyboard.press('Control+z'); await sleep(500);
    await p.keyboard.press('Control+y'); await sleep(500);

    const name = await exportDocx(p, '/tmp/e2e-rt1.docx');
    ok('export: docx downloaded', /\.docx$/.test(name), name);
    const xml = await docxXml('/tmp/e2e-rt1.docx');
    ok('roundtrip: typed text in docx', xml.includes(PROBE));
    ok('roundtrip: bold run survives (w:b)', /<w:b\/>|<w:b [^>]*\/>/.test(xml));
  } finally {
    await b.close();
  }
  finish('roundtrip');
})().catch((e) => { console.error('ERROR:', e.message); process.exit(2); });
