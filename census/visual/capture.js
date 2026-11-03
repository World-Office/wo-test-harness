/**
 * Screenshot capture utility using Playwright
 * Capture pages and dialogs for visual regression testing
 */

const { chromium } = require('@playwright/test');

/**
 * Mapping of dialog names to ribbon button selectors
 * Used to open dialogs before capturing screenshots
 */
const DIALOG_RIGHTBUTTONS = {
  'about-dialog': '#id-about',
  'advanced-settings-dialog': '#id-menu-advanced-settings',
  'anchor-dialog': '#id-menuanchor-insert',
  'autocorrect-dialog': '#id-print.autocorrect',
  'cc-dialog': '#id-menu-review-tracked-changes',
  'chart-dialog': '#id-menu-insert-chart',
  'hyperlink-dialog': '#id-menu-insert-insertlink',
  'image-dialog': '#id-menu-insert-image',
  'mail-merge-dialog': null, // Not yet implemented
  'macro-dialog': null, // Not yet implemented
  'paragraph-settings-dialog': '#id-menu-format-paragraph',
  'settings-dialog': '#id-menu-file-settings',
  'symbol-dialog': '#id-menu-insert-specialch',
  'table-dialog': '#id-menu-insert-table',
  'font-dialog': '#id-menu-format-font',
  'open-dialog': '#id-menu-file-open',
  'save-as-dialog': '#id-menu-file-saveas'
};

/**
 * Wait for a dialog to open
 * @param {Page} page - Playwright page
 * @param {string} dialogName - Name of dialog to wait for
 * @param {number} timeout - Timeout in ms (default 10000)
 * @returns {Promise<boolean>}
 */
async function waitForDialog(page, dialogName, timeout = 10000) {
  try {
    await page.waitForSelector(`#${dialogName}.open`, { timeout });
    // Additional wait for any animations
    await page.waitForTimeout(500);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Open a dialog by clicking its ribbon button
 * @param {Page} page - Playwright page
 * @param {string} dialogName - Name of dialog to open
 * @returns {Promise<boolean>}
 */
async function openDialog(page, dialogName) {
  const buttonSelector = DIALOG_RIGHTBUTTONS[dialogName];
  if (!buttonSelector) {
    console.warn(`No ribbon button mapping for dialog: ${dialogName}`);
    return false;
  }
  
  try {
    await page.click(buttonSelector);
    return await waitForDialog(page, dialogName);
  } catch (error) {
    console.warn(`Failed to open ${dialogName}:`, error.message);
    return false;
  }
}

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
 * Capture a specific dialog screenshot
 * @param {string} baseUrl - Base URL of the editor
 * @param {string} dialogName - Name of dialog to capture
 * @param {string} outputPath - Output file path
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>}
 */
async function captureDialog(baseUrl, dialogName, outputPath, options = {}) {
  let browser = options.browser;
  let page = options.page;
  let context = options.context;
  
  const selfCreated = !browser;
  
  try {
    if (selfCreated) {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        ...options.context
      });
      page = await context.newPage();
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    }
    
    // Open the dialog if it's not already open
    if (options.openDialog !== false) {
      const opened = await openDialog(page, dialogName);
      if (!opened) {
        console.warn(`Dialog ${dialogName} could not be opened`);
      }
    }
    
    // Wait for dialog to be visible
    await waitForDialog(page, dialogName);
    
    // Capture the dialog
    await page.locator(`#${dialogName}`).screenshot({ path: outputPath });
    
    return true;
  } catch (error) {
    console.warn(`Failed to capture ${dialogName}:`, error.message);
    return false;
  } finally {
    if (selfCreated) {
      await browser.close();
    }
  }
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
    'hyperlink-dialog', 'image-dialog',
    'paragraph-settings-dialog', 'settings-dialog',
    'symbol-dialog', 'table-dialog', 'font-dialog',
    'open-dialog', 'save-as-dialog'
  ];
  
  const captured = [];
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  
  try {
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    
    for (const dialogId of dialogIds) {
      try {
        const outputPath = `${outputDir}/${dialogId}.png`;
        const success = await captureDialog(baseUrl, dialogId, outputPath, { page, context, browser });
        if (success) captured.push(dialogId);
        
        // Reset page state between dialogs
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
      } catch (error) {
        console.warn(`Failed to capture ${dialogId}:`, error.message);
      }
    }
  } finally {
    await browser.close();
  }
  
  return captured;
}

module.exports = { capturePage, captureAllDialogs };
