/**
 * Screenshot capture utility using Playwright
 * Capture pages and dialogs for visual regression testing
 */

const { chromium } = require('@playwright/test');

/**
 * Capture a screenshot of a page or element
 * @param {string} url - URL to navigate to
 * @param {string} outputPath - Output file path
 * @param {string} selector - Optional CSS selector to capture
 * @param {Object} options - Additional options
 * @returns {Promise<void>}
 */
async function capturePage(url, outputPath, selector = null, options = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ...options.context
  });
  const page = await context.newPage();
  
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  if (options.waitSelector) {
    await page.waitForSelector(options.waitSelector, { timeout: 10000 });
  }
  
  if (selector) {
    await page.locator(selector).screenshot({ path: outputPath });
  } else {
    await page.screenshot({ path: outputPath, fullPage: options.fullPage || false });
  }
  
  await browser.close();
}

/**
 * Capture all dialogs in the editor
 * @param {string} baseUrl - Base URL of the editor
 * @param {string} outputDir - Output directory
 * @returns {Promise<string[]>}
 */
async function captureAllDialogs(baseUrl, outputDir) {
  // List of all dialog IDs to capture
  const dialogIds = [
    'about-dialog', 'advanced-settings-dialog', 'anchor-dialog',
    'autocorrect-dialog', 'cc-dialog', 'chart-dialog',
    'chart popolare-dialog', 'comments-dialog', 'contentcontrols-dialog',
    'dialog événements', 'dialog monotone', 'dialog',
    'dialog.bookmark-dialog', 'dialog.charmap-dialog',
    'dialog.portal-dialog', 'dialog.search-internet-dialog',
    'dialog.specialcharacters-dialog', 'dialog.text-to-table-dialog',
    'document-properties-dialog', 'equation-dialog', 'field-dialog',
    'file-dialog', 'find-dialog', 'font-dialog',
    'footnote-settings-dialog', 'go-to-page-dialog', 'goback-dialog',
    'header-footer-dialog', 'help-dialog', 'hyperlink-dialog',
    'image-directed-dialog', 'image-dialog', 'image-settings-dialog',
    'import-dialog', 'insert-endnote-dialog', 'local-save-as-dialog',
    'mail-merge-field-dialog', 'manage-changes-dialog', 'manualDialogDiv',
    'message-dialog', 'new-dialog', 'open-dialog',
    'paragraph-settings-dialog', 'password-dialog', 'portal-dialog',
    'print-dialog', 'properties-dialog', 'psettings-dialog',
    'replace-dialog', 'save-as-dialog', 'search-dialog',
    'settings-dialog', 'share-dialog', 'smartart-dialog',
    'source-dialog', 'spelling-add-dialog', 'spelling-edit-dialog',
    'spelling-settings-dialog', 'symbol-dialog', 'table-dialog',
    'table-properties-dialog', 'template-dialog'
  ];
  
  const captured = [];
  
  for (const dialogId of dialogIds) {
    try {
      const outputPath = `${outputDir}/${dialogId}.png`;
      await capturePage(
        `${baseUrl}?dialog=${dialogId}`,
        outputPath,
        `#${dialogId}`,
        { waitSelector: `#${dialogId}.open` }
      );
      captured.push(dialogId);
    } catch (error) {
      console.warn(`Failed to capture ${dialogId}:`, error.message);
    }
  }
  
  return captured;
}

module.exports = { capturePage, captureAllDialogs };
