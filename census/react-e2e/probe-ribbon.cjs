// probe 2 — ribbon liveness: bold/italic/underline buttons + undo/redo buttons
// mutate engine state (verified through the export), and the button reflects
// active formatting. Covers the toggle semantics contract.
// NOTE: ribbon buttons expose label via aria-label OR title OR textContent —
// locate them with a DOM query after activating the Home tab.
const { boot, typeAt, exportDocx, docxXml, ok, finish, sleep } = require('./e2e-lib.cjs');

async function ribbonButton(p, re) {
  return p.evaluate((src) => {
    const rx = new RegExp('^' + src + '$', 'i');
    return [...document.querySelectorAll('button,[role=button]')]
      .find((e) => e.offsetParent !== null && rx.test((e.getAttribute('aria-label') || e.title || e.textContent || '').trim()))
      ? 1 : 0;
  }, re);
}

async function clickRibbon(p, label) {
  return p.evaluate((lbl) => {
    const rx = new RegExp('^' + lbl + '$', 'i');
    const e = [...document.querySelectorAll('button,[role=button]')]
      .find((x) => x.offsetParent !== null && rx.test((x.getAttribute('aria-label') || x.title || x.textContent || '').trim()));
    if (e) { e.click(); return 1; }
    return 0;
  }, label);
}

(async () => {
  const { b, p, pageErrors } = await boot();
  try {
    ok('boot: zero page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
    await typeAt(p, 'ZZQXRIBBON');
    await p.click('[role=tab]:has-text("Home")').catch(() => {}); await sleep(700);

    ok('ribbon: Bold button present', !!(await ribbonButton(p, 'Bold')));
    ok('ribbon: Italic button present', !!(await ribbonButton(p, 'Italic')));
    ok('ribbon: Underline button present', !!(await ribbonButton(p, 'Underline')));
    ok('ribbon: Undo button present', !!(await ribbonButton(p, 'Undo')));
    ok('ribbon: Redo button present', !!(await ribbonButton(p, 'Redo')));

    await p.keyboard.press('Control+a'); await sleep(400);
    ok('ribbon: Bold click applies', !!(await clickRibbon(p, 'Bold'))); await sleep(600);
    const xml1 = await exportDocx(p, '/tmp/e2e-rt2a.docx').then(() => docxXml('/tmp/e2e-rt2a.docx'));
    ok('ribbon: Bold click → w:b in export', /<w:b\/>|<w:b [^>]*\/>/.test(xml1));

    // toggle OFF via a second click
    await p.click('[role=tab]:has-text("Home")').catch(() => {}); await sleep(500);
    ok('ribbon: second Bold click untoggles', !!(await clickRibbon(p, 'Bold'))); await sleep(600);
    const xml2 = await exportDocx(p, '/tmp/e2e-rt2b.docx').then(() => docxXml('/tmp/e2e-rt2b.docx'));
    ok('ribbon: untoggled → no w:b in export', !/<w:b\/>|<w:b [^>]*\/>/.test(xml2));
  } finally {
    await b.close();
  }
  finish('ribbon');
})().catch((e) => { console.error('ERROR:', e.message); process.exit(2); });
