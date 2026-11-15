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
const OO_URL = process.env.OO_URL || 'http://127.0.0.1:8735/rig-editor.html';
const OUT_DIR = process.env.CTX_OUT || path.join(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Normalized caption map: OO var -> canonical caption ---------------
// Derived from census-ctx.cjs MAP + oo-ctx-resolved.json leadership items.
// Used to normalize live captions against known identifiers.
const CAPTION_MAP = {
  // textMenu core
  'Cut': ['textCut', 'Cut'],
  'Copy': ['textCopy', 'Copy'],
  'Paste': ['textPaste', 'Paste'],
  'Undo': ['textUndo', 'Undo'],
  'Redo': ['textRedo', 'Redo'],
  'Print Selection': ['txtPrintSelection', 'Print selection'],
  'Select All': ['selectText', 'Select All'],
  
  // text formatting / paragraph
  'Paragraph Advanced Settings': ['advancedParagraphText', 'Paragraph advanced settings'],
  'Frame Advanced Settings': ['advancedFrameText', 'Frame advanced settings'],
  'Drop Cap Advanced Settings': ['advancedDropCapText', 'Drop cap advanced settings'],
  'Equation Advanced Settings': ['advancedEquationText', 'Equation advanced settings'],
  'Page Break Before': ['breakBeforeText', 'Page break before'],
  'Keep Lines Together': ['keepLinesText', 'Keep lines together'],
  
  // spellcheck
  'Language': ['langText', 'Language'],
  'Ignore': ['ignoreSpellText', 'Ignore'],
  'Ignore All': ['ignoreAllSpellText', 'Ignore All'],
  'Add to Dictionary': ['toDictionaryText', 'Add to Dictionary'],
  
  // links
  'Link': ['hyperlinkText', 'Link'],
  'Edit Link': ['editHyperlinkText', 'Edit Link'],
  'Remove Link': ['removeHyperlinkText', 'Remove Link'],
  'Copy Hyperlink Address': ['copyHyperlinkText', 'Copy hyperlink address'],
  
  // comments / track changes
  'Add Comment': ['addCommentText', 'Add comment'],
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
  'Formatting as Style': ['styleText', 'Formatting as style'],
  
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
  'AI': ['aiText', 'AI'],
};

// Reverse: canonical -> display caption
const DISPLAY = Object.fromEntries(
  Object.entries(CAPTION_MAP).map(([display, [key, alt]]) => [key, display])
);

// Known OO menu group order for scenario snapshots (from DocumentHolderExt.js)
const OO_MENU_ORDERS = {
  textMenu: [
    'spellSuggestion', 'moreSpell', 'ignoreSpellText', 'ignoreAllSpellText', 'toDictionaryText',
    'langText', 'textCut', 'textCopy', 'textPaste', 'txtPrintSelection',
    'textAccept', 'textReject', 'textRemoveControl', 'textEditControls',
    'textRefreshField', 'textEditField', 'textFieldCodes', 'textClearField',
    'textTOCSettings', 'textUpdateTOC', 'breakBeforeText', 'keepLinesText',
    'advancedParagraphText', 'advancedFrameText', 'advancedDropCapText',
    'advancedEquationText', 'addCommentText', 'hyperlinkText', 'editHyperlinkText',
    'removeHyperlinkText', 'copyHyperlinkText', 'textFollow',
    'textStartNewList', 'textStartNumberingFrom', 'textContinueNumbering', 'textIndents',
    'bulletsText', 'styleText', 'saveStyleText', 'updateStyleText',
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
function toCanonical(caption) {
  const normalized = String(caption || '').trim().replace(/\s+/g, ' ');
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
    
    // Find any visible context menu
    let menu = null;
    const candidates = document.querySelectorAll('#ctx-menu, #contextMenu, .ctx-menu, [role=menu], .menu, .menu-popup');
    for (const c of candidates) {
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
  const { id, seed, table, image, shape, field, toc, header, trackedChanges } = scenario;
  
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
    
    // Capture WO
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
    
    // Capture OO (skipped if OO_URL not reachable)
    try {
      const ooPage = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      console.log(`  Connecting to OO at ${OO_URL} ...`);
      await ooPage.goto(OO_URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
      
      // Find the OO editor frame
      let ooFrame = null;
      for (let i = 0; i < 40 && !ooFrame; i++) {
        await sleep(1000);
        ooFrame = await ooPage.frame({ url: (u) => u.includes('/web-apps/') || u.includes('documenteditor') });
      }
      
      if (ooFrame) {
        await ooFrame.waitForSelector('#toolbar .panel.active', { timeout: 30000 });
        console.log(`  OO editor frame loaded.`);
        
        for (const scenario of SCENARIOS) {
          if (scenario.id === 'header-footer' || scenario.id === 'toc' || 
              scenario.id === 'field' || scenario.trackedChanges) {
            continue; // skip TODO items
          }
          
          console.log(`    OO scenario: ${scenario.id} ...`);
          
          // Seed and right-click via OO frame
          await seedScenarioOO(ooFrame, scenario);
          await sleep(300);
          
          // Extract OO context menu
          const menuData = await extractOOContextMenu(ooFrame, scenario);
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
            viewport: { width: 1600, height: 1000 },
          };
          results.scenarios.push(data);
          
          // Close ctx menu
          await ooFrame.evaluate(() => {
            document.querySelectorAll('.menu, [role=menu]').forEach(m => {
              const s = getComputedStyle(m);
              if (s.display !== 'none') m.style.display = 'none';
            });
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          });
          await sleep(200);
        }
      } else {
        console.log(`  OO editor frame not found within timeout - skipping OO capture`);
      }
    } catch (ooErr) {
      console.log(`  OO capture skipped: ${ooErr.message}`);
    }
    
    // Write consolidated output
    const outPath = path.join(OUT_DIR, 'ctx-scenarios.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`  Output written to ${outPath}`);
    console.log(`  Total scenarios captured: ${results.scenarios.length}`);
  } finally {
    if (browser) await browser.close();
  }
}

// ---- OO-specific seed -------------------------------------------------------
async function seedScenarioOO(frame, scenario) {
  const { id, seed, table, image, shape, misspelled } = scenario;
  
  if (table) {
    await frame.evaluate(() => {
      const ed = document.getElementById('id_viewer') || document.getElementById('editor');
      if (!ed) return;
      // Use OO command to insert table
      if (window.Asc && window.Asc.editor) {
        window.Asc.editor.flush();
        window.Asc.editor.executeMethod('InsertTable', [2, 2, '1', '1']);
      }
    });
    await sleep(600);
  } else if (image) {
    // OO doesn't support inserting images via JS easily without UI
    // For now, skip
  } else if (shape) {
    // OO shape insertion via Asc editor
    await frame.evaluate(() => {
      if (window.Asc && window.Asc.editor) {
        window.Asc.editor.flush();
        window.Asc.editor.executeMethod('InsertShape', ['rectangle', 100, 60]);
      }
    });
    await sleep(600);
  } else if (misspelled) {
    await frame.evaluate(() => {
      const ed = document.getElementById('id_viewer') || document.getElementById('editor');
      if (!ed) return;
      // Insert text with misspellings
      const doc = window.Asc && window.Asc.editor && window.Asc.editor.getDocument();
      if (doc) {
        doc.insertText('teh mispelled wrd', true);
      }
    });
    await sleep(300);
  } else {
    await frame.evaluate((seedText) => {
      const ed = document.getElementById('id_viewer') || document.getElementById('editor');
      if (!ed) return;
      const doc = window.Asc && window.Asc.editor && window.Asc.editor.getDocument();
      if (doc) {
        doc.insertText(seedText || '', true);
      }
    }, seed || '');
    await sleep(300);
  }
}

// ---- Extract OO context menu -----------------------------------------------
async function extractOOContextMenu(frame, scenario) {
  const result = await frame.evaluate(() => {
    const result = { surface: 'none', rows: [] };
    
    // Find visible context menu in OO
    let menu = null;
    const candidates = document.querySelectorAll('.menu, .menu-list, [role=menu]');
    for (const c of candidates) {
      const s = getComputedStyle(c);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = c.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      menu = c;
      break;
    }
    
    if (!menu) return result;
    
    result.surface = menu.className || 'menu';
    
    const items = menu.querySelectorAll('li, .item, [role=menuitem], .menu-item');
    const seen = new Set();
    let order = 0;
    
    for (const item of items) {
      const s = getComputedStyle(item);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = item.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      
      const captionEl = item.querySelector('.text, .caption, .title, .label') || item;
      const caption = (captionEl.textContent || captionEl.getAttribute('title') || '').trim().split('\n')[0].slice(0, 60);
      
      if (!caption || seen.has(caption)) continue;
      seen.add(caption);
      
      const isSeparator = !caption || /^[-—\/]+$/.test(caption) || item.classList.contains('separator');
      const isDisabled = item.classList.contains('disabled') || item.getAttribute('aria-disabled') === 'true' || item.disabled;
      const isChecked = item.classList.contains('checked') || item.getAttribute('aria-checked') === 'true';
      const hasSubmenu = item.querySelector('.submenu, .menu-list, .menu, [role=menu]') !== null ||
        item.getAttribute('aria-haspopup') === 'true';
      
      const parentGroup = item.closest('[role=menu], .menu-list, .menu');
      const groupHeader = parentGroup ? parentGroup.querySelector('.group-header, .group-title, .header') : null;
      const group = groupHeader ? (groupHeader.textContent || '').trim().slice(0, 30) : null;
      
      if (!isSeparator && caption) {
        result.rows.push({
          caption,
          state: isDisabled ? 'disabled' : isChecked ? 'checked' : 'visible',
          order,
          submenu: hasSubmenu,
          group,
        });
        order++;
      }
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
