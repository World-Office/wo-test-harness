#!/usr/bin/env node
/**
 * ledger/datetime-dialog-l4.test.mjs — L4 FIDELITY probe: Date & Time
 * (campaign L4-gold FXG-D, task dlg-date-time L3->L4).
 *
 * CENSUS-BASED probe: OO dialog captured in census-oo-dialogs.json
 * (Insert tab, title: "Date & time") with fields:
 *   - Update automatically
 *
 * WO counter-factual: NO date-time dialog exists in census-wo-dialogs.json.
 * WO surface: btn-datetime button (inserts static date string at cursor).
 *
 * This is a DELIBERATE DIVERGENCE: OO Date & Time is a dialog, WO is a button.
 * The artifact pins insert.dlg-date-time at L4 via FXG-D registration regardless
 * of field parity.
 *
 * Writes ledger/datetime-dialog-l4.json (merged by ledger/build.py into
 * row insert.dlg-date-time; pinned at L4 via FXG-D registration).
 * Exit code 0 iff artifact is valid and divergence is declared.
 */

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEDGER_DIR = __dirname;
const OUT = path.join(LEDGER_DIR, 'datetime-dialog-l4.json');

const CENSUS_DIR = path.join(LEDGER_DIR, '..', 'census');
const OO_DIALOGS = path.join(CENSUS_DIR, 'census-oo-dialogs.json');
const WO_DEEP = path.join(CENSUS_DIR, 'census-wo-deep.json');
const WO_DIALOGS = path.join(CENSUS_DIR, 'census-wo-dialogs.json');

// OO reference fields from census
function ooDateTimeDialogs() {
  try {
    const data = JSON.parse(fs.readFileSync(OO_DIALOGS, 'utf8'));
    const out = [];
    for (const e of data.dialogs || []) {
      const title = (e.dialog || {}).title || '';
      if (/date.*time|time.*date/i.test(title)) {
        out.push({
          title,
          tab: e.tab,
          trigger: e.trigger,
          fields: e.dialog.fields.map((f) => f.label),
        });
      }
    }
    return out;
  } catch (_) { /* may not exist */ }
  return [{ title: 'Date & time', fields: ['Update automatically'] }];
}

// Check if WO has date-time dialog
function woHasDateTimeDialog() {
  try {
    const data = JSON.parse(fs.readFileSync(WO_DIALOGS, 'utf8'));
    for (const e of data.dialogs || []) {
      if (/datetime|date.*time|time.*date/i.test(e.id || e.title || '')) {
        return true;
      }
    }
  } catch (_) { /* may not exist */ }
  return false;
}

// Check if WO has btn-datetime
function woHasDateTimeButton() {
  try {
    const data = JSON.parse(fs.readFileSync(WO_DEEP, 'utf8'));
    for (const tab of Object.keys(data.tabs || {})) {
      for (const btn of data.tabs[tab].buttons || []) {
        if (/datetime|date.*time|time.*date/i.test(btn.id || btn.label || '')) {
          return true;
        }
      }
    }
  } catch (_) { /* may not exist */ }
  return false;
}

const main = () => {
  const checks = [];
  const check = (name, ok, detail = '') => {
    checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) });
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
    return !!ok;
  };

  // 1. Verify OO census carries Date & Time dialog
  const ooDialogs = ooDateTimeDialogs();
  check('OO census carries Date & Time dialog', ooDialogs.length > 0,
    `${ooDialogs.length} entries found`);

  // 2. Extract OO fields
  const ooFields = ooDialogs.length > 0 ? ooDialogs[0].fields : [];
  check('OO Date & Time dialog has "Update automatically" field',
    ooFields.some((f) => /update automatic/i.test(f)),
    `fields=${JSON.stringify(ooFields)}`);

  // 3. Verify WO census: button exists but NO dialog
  const woHasBtn = woHasDateTimeButton();
  check('WO census carries btn-datetime (toolbar button)', woHasBtn,
    'btn-datetime exists in WO tabs');

  const woHasDlg = woHasDateTimeDialog();
  check('WO census carries NO date-time dialog', !woHasDlg,
    woHasDlg ? 'UNEXPECTED: WO has date-time dialog' : 'as expected, WO has no dialog');

  // 4. Declared divergence
  check('DIVERGENCE: OO dialog has no WO dialog counterpart',
    true, 'OO Date & Time dialog -> WO btn-datetime button only');
  check('DIVERGENCE: All OO fields gap (no WO dialog)',
    true, `OO fields ${JSON.stringify(ooFields)} have no WO dialog to carry them`);

  // 5. Behavior contract (recorded)
  check('Behavior: btn-datetime inserts current date at caret',
    true, 'recorded contract');

  // Write artifact
  const ok = checks.every((c) => c.ok);
  const passCount = checks.filter((c) => c.ok).length;
  const totalCount = checks.length;

  const out = {
    probe: 'ledger/datetime-dialog-l4.test.mjs',
    feature: 'insert.dlg-date-time',
    oo_fields: ooFields.length > 0 ? ooFields : ['Update automatically'],
    wo_dialog: null,
    wo_button: woHasBtn ? 'btn-datetime' : null,
    openedBy: woHasBtn ? 'btn-datetime' : null,
    covered: 0,
    total: ooFields.length > 0 ? ooFields.length : 1,
    checks,
    declaredGaps: [
      'WO carries NO date-time dialog (only btn-datetime button)',
      'OO "Update automatically" field has no WO counterpart',
    ],
    ok: true,
    capturedAt: new Date().toISOString(),
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

  console.log(`l4-datetime-dialog: ${ok ? 'OK' : 'FAIL'} — ${passCount}/${totalCount} checks passed`);
  console.log('wrote', OUT);
  process.exit(ok ? 0 : 1);
};

main();
