#!/usr/bin/env node
/**
 * ctx-scenarios.cjs — scenario walker that right-clicks each interaction
 * context (text/selection/table/image/shape/misspelled/field/toc/
 * tracked-changes) on WO and OO and emits normalized visible-row JSON per
 * scenario.
 *
 * Usage:
 *   node ctx-scenarios.cjs                   # Run full capture against live WO/OO
 *   node ctx-scenarios.cjs --self            # Self-check: parse + basic smoke (SELF-OK)
 *
 * Scenarios (per RESEARCH-CAPTURE-ALL.md §4.A):
 *   text, selection, table, image, shape, misspelled, field, toc,
 *   header-footer, tracked-changes-off, tracked-changes-on
 *
 * Output schema per scenario:
 *   {
 *     scenario: "text",
 *     engine: "worldoffice" | "onlyoffice",
 *     visible: [
 *       {
 *         surface: "ctx-menu" | "native" | "none",
 *         group: string | null,
 *         caption: string,
 *         state: "visible" | "disabled" | "checked",
 *         order: number,
 *         submenu: boolean
 *       }
 *     ],
 *     hidden: [ string ],  // OO-only: items absent from DOM in this context
 *     capturedAt: ISO8601
 *   }
 *
 * Normalization rules:
 *   - Captions trimmed, lowercase-matched against known variants
 *   - OO MenuItem-declared captions resolved via locale keys (en)
 *   - Separators omitted from visible[] (recorded as order gaps)
 *   - Submenus: children collapsed under parent with submenu:true
 *
 * Env (optional — live capture skips if not set):
 *   WO_URL    WorldOffice editor URL (default: http://192.168.42.42:8082/word/)
 *   OO_URL    OnlyOffice editor URL  (default: http://127.0.0.1:8735/rig-editor.html)
 *   CTX_OUT   Output dir (default: census/)
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const HERE = __dirname;
const WO_URL = process.env.WO_URL || 'http://192.168.42.42:8082/word/';
const OO_URL = process.env.OO_URL || 'https://world-office.graphwiz.ai/demo';
const OUT_DIR = process.env.CTX_OUT || __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Normalized caption map: OO var -> canonical caption ---------------
// Derived from census-ctx.cjs MAP + oo-ctx-resolved.json leadership items.
// Used to normalize live captions against known identifiers.
const CAPTION_MAP = {
  // textMenu core
  'Cut': ['Cut', 'Cut'],
  'Copy': ['Copy', 'Copy'],
  'Paste': ['Paste', 'Paste'],
  'Undo': ['Undo', 'Undo'],
  'Redo': ['Redo', 'Redo'],
  'Print Selection': ['PrintSelection', 'Print selection'],
  'Select All': ['SelectAll', 'Select All'],
  
  // text formatting / paragraph
  'Paragraph Advanced Settings': ['ParagraphSettings', 'Paragraph advanced settings'],
  'Frame Advanced Settings': ['advancedFrameText', 'Frame advanced settings'],
  'Drop Cap Advanced Settings': ['advancedDropCapText', 'Drop cap advanced settings'],
  'Equation Advanced Settings': ['advancedEquationText', 'Equation advanced settings'],
  'Page Break Before': ['PageBreakBefore', 'Page break before'],
  'Keep Lines Together': ['KeepLines', 'Keep lines together'],
  
  // spellcheck
  'Language': ['langText', 'Language'],
  'Ignore': ['ignoreSpellText', 'Ignore'],
  'Ignore All': ['ignoreAllSpellText', 'Ignore All'],
  'Add to Dictionary': ['toDictionaryText', 'Add to Dictionary'],
  
  // links
  'Link': ['Link', 'Link'],
  'Edit Link': ['editHyperlinkText', 'Edit Link'],
  'Remove Link': ['removeHyperlinkText', 'Remove Link'],
  'Copy Hyperlink Address': ['copyHyperlinkText', 'Copy hyperlink address'],
  
  // comments / track changes
  'Add Comment': ['AddComment', 'Add comment'],
  'Accept': ['textAccept', 'Accept'],
  'Reject': ['textReject', 'Reject'],
  'Follow Move': ['textFollow', 'Follow move'],
  
  // fields / TOC
  'Update Field': ['textRefreshField', 'Update field'],
  'Edit Field': ['textEditField', 'Edit field'],
  'Toggle Field Codes': ['textFieldCodes', 'Toggle field codes'],
  'Clear Field': ['textClearField', 'Clear field'],
  'TOC Settings': ['textTOCSettings', 'TOC settings'],
  'Update Table of Contents': ['textUpdateTOC', 'Update table of contents'],
  
  // lists
  'Bullets': ['bulletsText', 'Bullets'],
  'Numbering': ['bulletsText', 'Numbering'],
  'Start New List': ['textStartNewList', 'Start new list'],
  'Start Numbering from': ['textStartNumberingFrom', 'Start numbering from'],
  'Continue Numbering': ['textContinueNumbering', 'Continue numbering'],
  'List Indents': ['textIndents', 'List indents'],
  
  // styles
  'Formatting as Style': ['FormattingAsStyle', 'Formatting as style'],
  
  // table menu
  'Insert Column Left': ['insertColumnLeftText', 'Insert column left'],
  'Insert Column Right': ['insertColumnRightText', 'Insert column right'],
  'Insert Row Above': ['insertRowAboveText', 'Insert row above'],
  'Insert Row Below': ['insertRowBelowText', 'Insert row below'],
  'Delete Row': ['rowText', 'Delete row'],
  'Delete Column': ['columnText', 'Delete column'],
  'Delete Cell': ['cellText', 'Delete cell'],
  'Merge Cells': ['mergeCellsText', 'Merge cells'],
  'Split Cell': ['splitCellsText', 'Split cell'],
  'Distribute Rows': ['textDistributeRows', 'Distribute rows'],
  'Distribute Columns': ['textDistributeCols', 'Distribute columns'],
  'Table Advanced Settings': ['advancedTableText', 'Table advanced settings'],
  
  // picture / object menu
  'Save as Picture': ['textSaveAsPicture', 'Save as picture'],
  'Replace': ['textReplace', 'Replace'],
  'Remove Content Control': ['textRemoveControl', 'Remove content control'],
  'Content Control Settings': ['textEditControls', 'Content control settings'],
  'Crop': ['textCrop', 'Crop'],
  'Convert to Shape': ['textConvertToShape', 'Convert to shape'],
  'Edit Object': ['textEditObject', 'Edit object'],
  
  // wrap
  'Inline': ['txtInline', 'Inline'],
  'Square': ['txtSquare', 'Square'],
  'Tight': ['txtTight', 'Tight'],
  'Through': ['txtThrough', 'Through'],
  'Top and Bottom': ['txtTopAndBottom', 'Top and bottom'],
  'In Front of Text': ['txtInFront', 'In front of text'],
  'Behind Text': ['txtBehind', 'Behind text'],
  
  // arrange
  'Bring to Front': ['textArrangeFront', 'Bring to front'],
  'Send to Back': ['textArrangeBack', 'Send to back'],
  'Bring Forward': ['textArrangeForward', 'Bring forward'],
  'Send Backward': ['textArrangeBackward', 'Send backward'],
  
  // align (object)
  'Align Left': ['textShapeAlignLeft', 'Align left'],
  'Align Center': ['textShapeAlignCenter', 'Align center'],
  'Align Right': ['textShapeAlignRight', 'Align right'],
  'Align Top': ['textShapeAlignTop', 'Align top'],
  'Align Middle': ['textShapeAlignMiddle', 'Align middle'],
  'Align Bottom': ['textShapeAlignBottom', 'Align bottom'],
  
  // distribute
  'Distribute Horizontally': ['txtDistribHor', 'Distribute horizontally'],
  'Distribute Vertically': ['txtDistribVert', 'Distribute vertically'],
  
  // group
  'Group': ['txtGroup', 'Group'],
  'Ungroup': ['txtUngroup', 'Ungroup'],
  
  // AI
  'AI': ['AI', 'AI'],
};

// Reverse: canonical -> display caption
const DISPLAY = Object.fromEntries(
  Object.entries(CAPTION_MAP).map(([display, [key, alt]]) => [key, display])
);

// Known OO menu group order for scenario snapshots (from DocumentHolderExt.js)
const OO_MENU_ORDERS = {
  textMenu: [
    'spellSuggestion', 'moreSpell', 'ignoreSpellText', 'ignoreAllSpellText', 'toDictionaryText',
    'langText', 'Cut', 'Copy', 'Paste', 'PrintSelection',
    'textAccept', 'textReject', 'textRemoveControl', 'textEditControls',
    'textRefreshField', 'textEditField', 'textFieldCodes', 'textClearField',
    'textTOCSettings', 'textUpdateTOC', 'PageBreakBefore', 'KeepLines',
    'ParagraphSettings', 'advancedFrameText', 'advancedDropCapText',
    'advancedEquationText', 'AddComment', 'Link', 'editHyperlinkText',
    'removeHyperlinkText', 'copyHyperlinkText', 'textFollow',
    'textStartNewList', 'textStartNumberingFrom', 'textContinueNumbering', 'textIndents',
    'bulletsText', 'FormattingAsStyle', 'saveStyleText', 'updateStyleText',
  ],
  tableMenu: [
    'insertText', 'insertColumnLeftText', 'insertColumnRightText', 'insertRowAboveText',
    'insertRowBelowText', 'textSeveral', 'deleteText', 'rowText', 'columnText',
    'cellText', 'textCells', 'mergeCellsText', 'splitCellsText',
    'textDistributeRows', 'textDistributeCols', 'advancedTableText',
  ],
  pictureMenu: [
    'textSaveAsPicture', 'textReplace', 'textRemoveControl', 'textEditControls',
    'textStretchControl', 'txtInsertCaption', 'textRotate', 'textCrop',
    'textCropFill', 'textCropFit', 'textResetCrop', 'textEditPoints',
    'textConvertToShape', 'textShapesMerge', 'textEditObject', 'textEditWrapBoundary',
    'textArrange', 'textArrangeFront', 'textArrangeBack', 'textArrangeForward',
    'textArrangeBackward', 'textAlign', 'textShapeAlignLeft', 'textShapeAlignCenter',
    'textShapeAlignRight', 'textShapeAlignTop', 'textShapeAlignMiddle',
    'textShapeAlignBottom', 'txtDistribHor', 'txtDistribVert', 'textWrap',
    'txtInline', 'txtSquare', 'txtTight', 'txtThrough', 'txtTopAndBottom',
    'txtInFront', 'txtBehind', 'advancedText', 'editChartText',
  ],
};

// Normalize a live caption to a canonical key (best-effort)
// German → canonical (live OO demo runs lang=de; captions arrive German).
// Prefix match: li text concatenates nested submenu labels
// ("Formatierung als FormatvorlageNe…"), so startsWith is the right test.
const DE_MAP = [
  ['Ausschneiden', 'Cut'], ['Kopieren', 'Copy'], ['Einfügen', 'Paste'],
  ['Auswahl drucken', 'PrintSelection'], ['Seitenumbruch oberhalb', 'PageBreakBefore'],
  ['Absatz zusammenhalten', 'KeepLines'], ['Absatz - Erweiterte Einstellungen', 'ParagraphSettings'],
  ['Kommentar hinzufügen', 'AddComment'], ['Link', 'Link'],
  ['Formatierung als Formatvorlage', 'FormattingAsStyle'], ['AI', 'AI'],
  ['Rückgängig', 'Undo'], ['Wiederholen', 'Redo'], ['Alle auswählen', 'SelectAll'],
  // live OO 9.4 de strings (observed on Bericht.docx):
  ['Auslassen', 'Ignore'], ['Alle auslassen', 'IgnoreAll'],
  ['Sprache wählen', 'SelectLanguage'], ['Zum Wörterbuch hinzufügen', 'AddToDictionary'],
  ['Erweiterte Absatzeinstellungen', 'ParagraphSettings'],
  ['Aufheben', 'Undo'],
];

function toCanonical(caption) {
  const normalized = String(caption || '').trim().replace(/\s+/g, ' ');
  // German live captions first (longest prefix wins: 'Alle ignorieren' > 'Ignorieren')
  for (const [de, key] of [...DE_MAP].sort((a, b) => b[0].length - a[0].length)) {
    if (normalized.startsWith(de)) return key;
  }
  // Direct lookup in MAP keys
  for (const [display, [key]] of Object.entries(CAPTION_MAP)) {
    if (display.toLowerCase() === normalized.toLowerCase()) return key;
  }
  // Reverse lookup via alt captions in CAPTION_MAP
  for (const [, [key, alt]] of Object.entries(CAPTION_MAP)) {
    if (String(alt).toLowerCase() === normalized.toLowerCase()) return key;
  }
  // Simple var-like: textFoo -> foo
  if (/^text[A-Z]/.test(normalized)) {
    return normalized;
  }
  // Fallback: slugify
  return normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---- Scenario definitions --------------------------------------------------
const SCENARIOS = [
  { id: 'text', label: 'Plain text', seed: 'Plain text paragraph for context menu test.' },
  { id: 'selection', label: 'Text with selection', seed: 'Text with selection for testing.' },
  { id: 'multi-selection', label: 'Multi-line selection', multiline: true, seed: 'Line one.\nLine two.\nLine three.' },
  { id: 'table', label: 'Inside table cell', table: true, seed: 'Table cell content' },
  { id: 'image', label: 'Image/object selected', image: true, seed: 'image' },
  { id: 'shape', label: 'Drawing shape selected', shape: true, seed: 'shape' },
  { id: 'misspelled', label: 'Misspelled word (red underline)', misspelled: true, seed: 'teh mispelled wrd' },
  { id: 'field', label: 'Field (e.g., page number)', field: true, seed: 'field' },
  { id: 'toc', label: 'Table of Contents selected', toc: true, seed: 'toc' },
  { id: 'header-footer', label: 'Header or footer region', header: true, seed: 'header' },
  { id: 'tracked-changes-off', label: 'Tracked changes OFF (viewing)', trackedChanges: 'off', seed: 'tracked off' },
  { id: 'tracked-changes-on', label: 'Tracked changes ON (editing)', trackedChanges: 'on', seed: 'tracked on' },
];

// ---- Capture: fetch visible context menu rows from a page element -------------
async function captureContextMenu(page, scenario) {
  const { id, label } = scenario;
  
  // Step 1: ensure editor focus and seed content
  await page.waitForSelector('#editor, #id_viewer, #editor_parent', { timeout: 15000 });
  await page.waitForTimeout(500);
  
  // Inject scenario-specific seed content
  await seedScenario(page, scenario);
  await sleep(300);
  
  // Step 2: locate target element for right-click
  let clickX, clickY;
  
  if (scenario.table) {
    // Find and click inside a table cell
    await page.evaluate(() => {
      const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
      if (!ed) return;
      const table = ed.querySelector('table');
      if (table) {
        const cell = table.querySelector('td, th');
        if (cell) {
          const r = cell.getBoundingClientRect();
          cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 10, button: 2 }));
          cell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 10, button: 2 }));
          cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 10, button: 2 }));
        }
      }
    });
    await sleep(400);
  } else if (scenario.image || scenario.shape) {
    // Find and click on an image or shape object
    await page.evaluate((isImage) => {
      const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
      if (!ed) return;
      let target = null;
      if (isImage) {
        target = ed.querySelector('img') || ed.querySelector('.content-image');
      } else {
        target = ed.querySelector('.obj-square, .object, .shape');
      }
      if (target) {
        const r = target.getBoundingClientRect();
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 2 }));
        target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 2 }));
        target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 2 }));
      }
    }, scenario.image);
    await sleep(400);
  } else if (scenario.misspelled) {
    // Find and click on a misspelled word (marked up by OO/WO)
    await page.evaluate(() => {
      const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
      if (!ed) return;
      // OO marks misspelled with class .x-spelling-error-3 or similar
      // WO marks with spellcheck-error class
      const misspelled = ed.querySelector('.x-spelling-error, .spellcheck-error');
      if (!misspelled) return;
      const r = misspelled.getBoundingClientRect();
      misspelled.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 2 }));
      misspelled.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 2 }));
      misspelled.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 2 }));
    });
    await sleep(400);
  } else {
    // Default: click in the middle of the editor content area
    await page.evaluate(() => {
      const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
      if (!ed) return;
      const r = ed.getBoundingClientRect();
      const pt = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      ed.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: pt.x, clientY: pt.y, button: 2 }));
      ed.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: pt.x, clientY: pt.y, button: 2 }));
      ed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: pt.x, clientY: pt.y, button: 2 }));
    });
    await sleep(400);
    
    // If there's text content to select
    if (scenario.selection || scenario['multi-selection']) {
      await selectTextInEditor(page);
      await sleep(200);
      // Re-right-click on the selection
      await page.evaluate(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const r = sel.getRangeAt(0).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        document.elementFromPoint(r.left + 5, r.top + 5).dispatchEvent(
          new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 2 }));
        document.elementFromPoint(r.left + 5, r.top + 5).dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 2 }));
        document.elementFromPoint(r.left + 5, r.top + 5).dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 2 }));
      });
      await sleep(400);
    }
  }
  
  // Step 3: extract visible context menu rows
  const menuData = await page.evaluate(() => {
    const result = { surface: 'none', rows: [] };
    
    // Find any visible context menu — prioritize explicit ctx-menu ids over
    // generic [role=menu] (the File ribbon menu is also role=menu and sits
    // first in DOM order, so it must NOT win over a real ctx menu).
    let menu = null;
    const all = document.querySelectorAll('#ctx-menu, #contextMenu, .ctx-menu, .menu-popup, [role=menu], .menu');
    const ordered = [...all].sort((a, b) => {
      const aid = a.id === 'ctx-menu' || a.id === 'contextMenu' || a.classList.contains('ctx-menu') ? 0 : 1;
      const bid = b.id === 'ctx-menu' || b.id === 'contextMenu' || b.classList.contains('ctx-menu') ? 0 : 1;
      return aid - bid;
    });
    for (const c of ordered) {
      const s = getComputedStyle(c);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = c.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      menu = c;
      break;
    }
    
    if (!menu) {
      return result;
    }
    
    result.surface = menu.id || menu.className || 'ctx-menu';
    
    // Walk visible items: direct li/li>button elements
    const items = menu.querySelectorAll('li, li > button, li > a, button, [role=menuitem], [class*=item]');
    let order = 0;
    const seen = new Set();
    
    for (const item of items) {
      const s = getComputedStyle(item);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = item.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      
      const caption = (item.textContent || item.getAttribute('aria-label') || item.getAttribute('title') || '').trim().split('\n')[0].slice(0, 60);
      
      // Skip if already recorded (deduplication)
      if (seen.has(caption) && caption) continue;
      if (caption) seen.add(caption);
      
      const isSeparator = !caption || /^[-—\/\|]=|--+$/.test(caption.trim()) || item.classList.contains('separator');
      const isDisabled = item.disabled || item.classList.contains('disabled') || item.getAttribute('aria-disabled') === 'true';
      const isChecked = item.getAttribute('aria-checked') === 'true' || item.classList.contains('checked');
      const hasSubmenu = item.querySelector('[role=menu], ul, .submenu, .menu-list, .ctx-menu-sub') !== null ||
        item.getAttribute('aria-haspopup') === 'true';
      
      // Determine group from DOM structure
      let group = null;
      const parentLi = item.closest('li');
      const grandparent = parentLi ? parentLi.closest('[role=menu], ul, .submenu') : null;
      const groupHeader = grandparent ? grandparent.querySelector('[class*=header], [class*=title], .menu-header, .group-label') : null;
      if (groupHeader) {
        group = (groupHeader.textContent || '').trim().slice(0, 30);
      }
      
      if (!isSeparator && caption) {
        result.rows.push({
          caption,
          state: isDisabled ? 'disabled' : isChecked ? 'checked' : 'visible',
          order,
          submenu: hasSubmenu,
          group,
          canonical: null, // will be filled by normalizer
        });
        order++;
      }
    }
    
    return result;
  });
  
  // Step 4: Normalize captions to canonical keys
  const visibleRows = [];
  const hiddenKeys = new Set();
  
  // For OO engine, we know which keys *should* appear in each scenario menu.
  // For now, we just normalize what we see.
  for (const row of menuData.rows) {
    const canonical = toCanonical(row.caption);
    visibleRows.push({
      ...row,
      canonical,
    });
  }
  
  return {
    scenario: id,
    label,
    engine: null, // will be set by caller
    surface: menuData.surface,
    visible: visibleRows,
    hidden: Array.from(hiddenKeys).sort(),
    capturedAt: new Date().toISOString(),
    viewport: { width: 1600, height: 1000 },
  };
}

// ---- Seed scenario content into the editor ---------------------------------
async function seedScenario(page, scenario) {
  const { id, seed, table, image, shape, field, toc, header, trackedChanges, misspelled } = scenario;
  
  if (table) {
    await page.evaluate(() => {
      const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
      if (!ed) return;
      ed.innerHTML = '<table style="border-collapse: collapse;"><tr><td style="border: 1px solid #ccc; padding: 8px;">Table cell content</td><td style="border: 1px solid #ccc; padding: 8px;">Another cell</td></tr><tr><td style="border: 1px solid #ccc; padding: 8px;">Row 2 Col 1</td><td style="border: 1px solid #ccc; padding: 8px;">Row 2 Col 2</td></tr></table>';
    });
  } else if (image) {
    await page.evaluate(() => {
      const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
      if (!ed) return;
      const img = document.createElement('img');
      img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      img.alt = 'Test image';
      img.style.cssText = 'width: 100px; height: 60px; margin: 10px;';
      ed.innerHTML = '';
      ed.appendChild(img);
    });
  } else if (shape) {
    await page.evaluate(() => {
      const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
      if (!ed) return;
      const div = document.createElement('div');
      div.className = 'object obj-square';
      div.setAttribute('data-type', 'shape');
      div.style.cssText = 'width: 100px; height: 60px; background: #eef4ff; border: 1px solid #88f; margin: 10px;';
      div.textContent = 'Shape';
      ed.innerHTML = '';
      ed.appendChild(div);
    });
  } else if (misspelled) {
    await page.evaluate(() => {
      const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
      if (!ed) return;
      // Insert text with intentional misspellings that WO/OO should mark
      ed.innerHTML = '<p>This is teh sentense witht mispelled wrds.</p>';
    });
  } else if (field) {
    await page.evaluate(() => {
      const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
      if (!ed) return;
      // WO uses data-field markers for fields
      const field = document.createElement('span');
      field.className = 'data-field';
      field.setAttribute('data-field-type', 'page-number');
      field.textContent = 'PAGE';
      ed.innerHTML = '<p>Page: </p>';
      ed.lastChild.appendChild(field);
    });
  } else if (toc) {
    await page.evaluate(() => {
      const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
      if (!ed) return;
      ed.innerHTML = '<div class="toc" data-toc="true"><p>Table of Contents</p></div><p>Content here</p>';
    });
  } else if (header) {
    await page.evaluate(() => {
      const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
      if (!ed) return;
      ed.innerHTML = '<div class="header-content" contenteditable="true">Header text</div><p>Main content</p>';
    });
  } else {
    // Default: plain text
    await page.evaluate((seedText) => {
      const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
      if (!ed) return;
      ed.innerHTML = `<p>${seedText}</p>`;
      // Focus and place caret
      ed.focus();
    }, seed || '');
  }
  
  // Tracked changes mode
  if (trackedChanges) {
    await page.evaluate((mode) => {
      if (mode === 'on') {
        // Try to enable tracked changes
        const btn = document.getElementById('btn-track-changes') || document.querySelector('[data-cmd="trackChanges"]');
        if (btn && !btn.classList.contains('checked')) btn.click();
      } else if (mode === 'off') {
        // Try to disable tracked changes
        const btn = document.getElementById('btn-track-changes') || document.querySelector('[data-cmd="trackChanges"]');
        if (btn && btn.classList.contains('checked')) btn.click();
      }
    }, trackedChanges);
    await sleep(300);
  }
}

// ---- Select text in editor --------------------------------------------------
async function selectTextInEditor(page) {
  await page.evaluate(() => {
    const ed = document.getElementById('editor') || document.querySelector('[contenteditable]');
    if (!ed) return;
    // Select all text content
    const range = document.createRange();
    range.selectNodeContents(ed);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await sleep(100);
}

// ---- main ------------------------------------------------------------------
async function main() {
  const results = { scenarios: [], capturedAt: new Date().toISOString() };
  let browser = null;
  
  try {
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    
    // Capture WO (skip with OO_ONLY=1 to re-run just the OO side)
    if (!process.env.OO_ONLY) {
    const woPage = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    console.log(`  Connecting to WO at ${WO_URL} ...`);
    await woPage.goto(WO_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await woPage.waitForSelector('#editor, #toolbar', { timeout: 30000 });
    console.log(`  WO page loaded.`);
    
    for (const scenario of SCENARIOS) {
      if (scenario.id === 'header-footer') {
        // TODO: header/footer requires special document setup - skip for initial version
        continue;
      }
      if (scenario.id === 'toc') {
        // TODO: TOC requires actual TOC field - skip for initial version
        continue;
      }
      if (scenario.id === 'field') {
        // TODO: field requires actual field insertion - skip for initial version
        continue;
      }
      if (scenario.trackedChanges) {
        // TODO: tracked changes needs proper setup - skip for initial version
        continue;
      }
      
      console.log(`    WO scenario: ${scenario.id} ...`);
      const data = await captureContextMenu(woPage, scenario);
      data.engine = 'worldoffice';
      results.scenarios.push(data);
      
      // Close any open ctx menu
      await woPage.evaluate(() => {
        document.querySelectorAll('#ctx-menu, #contextMenu, .ctx-menu, [role=menu]').forEach(m => {
          m.hidden = true;
        });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      await sleep(200);
    }
    } // end !OO_ONLY

    // Capture OO via the live demo (real right-click; synthetic events won't
    // open OO's native menu).
    try {
      const ooResults = await captureOO(browser);
      results.scenarios.push(...ooResults);
    } catch (ooErr) {
      console.log(`  OO capture skipped: ${ooErr.message}`);
    }

    // Write consolidated output (OO_ONLY merges into the existing file,
    // replacing only the onlyoffice entries)
    const outPath = path.join(OUT_DIR, 'ctx-scenarios.json');
    let scenarios = results.scenarios;
    if (process.env.OO_ONLY && fs.existsSync(outPath)) {
      const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      scenarios = [...prev.scenarios.filter((s) => s.engine !== 'onlyoffice'), ...scenarios];
    }
    const payload = { scenarios, capturedAt: new Date().toISOString() };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(`  Output written to ${outPath}`);
    console.log(`  Total scenarios captured: ${scenarios.length}`);
  } finally {
    if (browser) await browser.close();
  }
}
// The only reliable way to open OO's context menu is a REAL right-click at a
// document-area coordinate: synthetic contextmenu events are ignored.
// Recipe (from chrome-census2.cjs): open the demo, click Bericht.docx, wait
// ~15s, widen iframe[name=frameEditor] to 1680x950, wait 3s, find the frame
// by name, then right-click at frame-local coords + the iframe page offset.
async function captureOO(browser) {
  const p = await browser.newPage({ viewport: { width: 1760, height: 950 } });
  console.log(`  Connecting to OO at ${OO_URL} ...`);
  await p.goto(OO_URL, { waitUntil: 'load', timeout: 90000 });
  await sleep(5000);
  const fileEl = await p.$('.file');
  if (fileEl) await fileEl.click();
  await sleep(15000);
  await p.addStyleTag({ content: 'iframe[name="frameEditor"] { width: 1680px !important; height: 950px !important; }' });
  await sleep(3000);
  const f = p.frames().find((fr) => fr.name() === 'frameEditor');
  if (!f) {
    console.log('  OO frameEditor not found - skipping OO capture');
    await p.close();
    return;
  }
  await f.waitForSelector('.toolbar, #toolbar, .box-tabs', { timeout: 30000 }).catch(() => {});
  const out = [];
  console.log('  OO editor frame loaded (frameEditor).');
  const offset = await p.evaluate(() => {
    const iframe = document.querySelector('iframe[name="frameEditor"]');
    if (!iframe) return { x: 0, y: 0 };
    const r = iframe.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y) };
  });

  // Right-click spots (frame-local). OO opens the text ctx menu only on
  // content — verified working spots for Bericht.docx; the ladder falls
  // through until a menu actually appears.
  const SPOTS = [
    [700, 320], [760, 340], [840, 360], [650, 380], [700, 420], [840, 500],
  ];

  for (const scenario of SCENARIOS) {
    if (scenario.id === 'header-footer' || scenario.id === 'toc' ||
        scenario.id === 'field' || scenario.trackedChanges) {
      continue; // skip TODO items
    }
    console.log(`    OO scenario: ${scenario.id} ...`);
    try {
      let menuData = { surface: 'none', rows: [] };
      let hit = null;
      for (const [fx, fy] of SPOTS) {
        await p.keyboard.press('Escape').catch(() => {});
        await sleep(200);
        if (scenario.selection || scenario['multi-selection']) {
          // double-click selects the word under the cursor, then right-click
          // the selection
          await p.mouse.dblclick(offset.x + fx, offset.y + fy, { delay: 80 });
          await sleep(250);
        }
        await p.mouse.click(offset.x + fx, offset.y + fy, { button: 'right' });
        await sleep(550);
        const md = await extractOOContextMenu(f);
        if (md.rows.length > 0) { menuData = md; hit = [fx, fy]; break; }
      }
      if (hit) console.log(`      menu at (${hit[0]},${hit[1]}): ${menuData.rows.length} rows`);
      else console.log('      no ctx menu opened at any spot');

      const visibleRows = [];
      for (const row of menuData.rows) {
        const canonical = toCanonical(row.caption);
        visibleRows.push({ ...row, canonical });
      }
      const data = {
        scenario: scenario.id,
        label: scenario.label,
        engine: 'onlyoffice',
        surface: menuData.surface,
        visible: visibleRows,
        hidden: [],
        capturedAt: new Date().toISOString(),
        viewport: { width: 1760, height: 950 },
      };
      out.push(data);

      await p.keyboard.press('Escape').catch(() => {});
      await sleep(200);
    } catch (sErr) {
      console.log(`    OO scenario ${scenario.id} failed: ${sErr.message}`);
    }
  }
  await p.close();
  return out;
}

// ---- Extract OO context menu -----------------------------------------------
async function extractOOContextMenu(frame) {
  // OO 9.x renders its context menu as a bare <ul> (no stable class) appended
  // to body. Find the visible <ul> with the most visible <li>s — that is the
  // context menu — and read each li's own text (skip nested submenu labels).
  const result = await frame.evaluate(() => {
    const result = { surface: 'none', rows: [] };
    let best = null;
    // OO appends its context menu directly to <body>; the ribbon tab bar is
    // also an 11-li <ul>, so prefer body-appended uls to avoid grabbing it.
    const all = [...document.querySelectorAll('ul')];
    const bodyUls = all.filter((u) => u.parentElement === document.body);
    for (const ul of bodyUls.length ? bodyUls : all) {
      const s = getComputedStyle(ul);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = ul.getBoundingClientRect();
      if (r.width < 80 || r.height < 40) continue;
      const lis = [...ul.querySelectorAll(':scope > li')].filter(
        (li) => li.getBoundingClientRect().height > 5 && getComputedStyle(li).display !== 'none');
      if (lis.length >= 3 && (!best || lis.length > best.lis.length)) best = { ul, lis };
    }
    if (!best) return result;
    result.surface = 'oo-ctx-ul';
    let order = 0;
    for (const li of best.lis) {
      const clone = li.cloneNode(true);
      clone.querySelectorAll('ul, .submenu, .menu').forEach((n) => n.remove());
      const caption = (clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      const isSeparator = !caption || li.classList.contains('separator') || li.hasAttribute('data-separator');
      if (isSeparator) continue;
      result.rows.push({
        caption,
        state: li.classList.contains('disabled') || li.getAttribute('aria-disabled') === 'true' ? 'disabled' : 'visible',
        order: order++,
        submenu: li.querySelector('ul, .submenu') !== null,
        group: null,
      });
    }
    return result;
  });
  return result;
}

// ---- Self-check -------------------------------------------------------------
function selfCheck() {
  // Basic parse check
  console.log('SELF-CHECK: ctx-scenarios.cjs');
  console.log('  OK parse OK');
  console.log('  OK SCENARIOS defined:', SCENARIOS.map(s => s.id).join(', '));
  console.log('  OK CAPTION_MAP entries:', Object.keys(CAPTION_MAP).length);
  console.log('  OK toCanonical function available');
  console.log('SELF-OK');
}

// ---- CLI disengagement -------------------------------------------------------
const args = process.argv.slice(2);
if (args.includes('--self')) {
  selfCheck();
  process.exit(0);
}

// Only run live capture in non-self mode
if (args.length === 0 || !args.includes('--no-run')) {
  main().catch((err) => {
    console.error('CAPTURE ERROR:', err.message);
    process.exit(1);
  });
}
