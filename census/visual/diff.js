/**
 * Visual diff utility using pixelmatch
 * Compare two screenshots and return diff statistics
 */

const fs = require('fs');
// pixelmatch v6 exports { pixelmatch }; v5 was directly callable
const _pixelmatch = require('pixelmatch');
const pixelmatch = _pixelmatch.pixelmatch || _pixelmatch.default || _pixelmatch;
const { PNG } = require('pngjs');

/**
 * Thresholds per dialog type - some dialogs have dynamic content
 * that makes pixel-perfect matching impossible
 */
const DIALOG_THRESHOLDS = {
  // Small simple dialogs: near-perfect match
  'about-dialog': 0.005,
  'file-dialog': 0.005,
  'help-dialog': 0.005,
  'settings-dialog': 0.005,
  'open-dialog': 0.005,
  'save-as-dialog': 0.005,
  
  // Form dialogs with input fields: slightly more tolerance
  'hyperlink-dialog': 0.01,
  'image-dialog': 0.01,
  'table-dialog': 0.01,
  'paragraph-settings-dialog': 0.01,
  'font-dialog': 0.01,
  
  // Complex dialogs with multiple tabs/sections
  'autocorrect-dialog': 0.02,
  'advanced-settings-dialog': 0.02,
  'chart-dialog': 0.02,
  
  // Dialogs with color pickers/dynamic content
  'cc-dialog': 0.03,
  'symbol-dialog': 0.03,
  
  // Default threshold
  'default': 0.01
};

/**
 * Get threshold for a specific dialog
 * @param {string} dialogName
 * @returns {number}
 */
function getThreshold(dialogName) {
  return DIALOG_THRESHOLDS[dialogName] || DIALOG_THRESHOLDS.default;
}

/**
 * Compare two PNG screenshots
 * @param {string} img1Path - Path to first image
 * @param {string} img2Path - Path to second image
 * @param {number} threshold - 0-1, acceptable diff ratio (default 0.01)
 * @returns {Promise<{match: boolean, diffPixels: number, totalPixels: number, diffRatio: number}>}
 */
async function compareScreenshots(img1Path, img2Path, threshold = 0.01) {
  const img1 = PNG.sync.read(fs.readFileSync(img1Path));
  const img2 = PNG.sync.read(fs.readFileSync(img2Path));
  
  const { width, height } = img1;
  const diff = new PNG({ width, height });
  
  const diffPixels = pixelmatch(
    img1.data, 
    img2.data,
    diff.data,
    width, 
    height,
    { threshold: 0.1 }
  );
  
  const totalPixels = width * height;
  const diffRatio = diffPixels / totalPixels;
  const match = diffRatio <= threshold;
  
  return { match, diffPixels, totalPixels, diffRatio };
}

/**
 * Compare screenshots of a specific dialog using type-specific threshold
 * @param {string} dialogName - Name of the dialog (e.g., 'hyperlink-dialog')
 * @param {string} ooPath - Path to OO screenshot
 * @param {string} woPath - Path to WO screenshot
 * @returns {Promise<{match: boolean, diffPixels: number, totalPixels: number, diffRatio: number, threshold: number}>}
 */
async function compareDialogScreenshots(dialogName, ooPath, woPath) {
  const threshold = getThreshold(dialogName);
  const result = await compareScreenshots(ooPath, woPath, threshold);
  return { ...result, threshold };
}

/**
 * Batch compare multiple dialog screenshots
 * @param {Array<{name: string, ooPath: string, woPath: string}>} dialogs
 * @returns {Promise<Array<{name: string, match: boolean, diffRatio: number, threshold: number}>>}
 */
async function compareAllDialogs(dialogs) {
  const results = [];
  for (const { name, ooPath, woPath } of dialogs) {
    try {
      const result = await compareDialogScreenshots(name, ooPath, woPath);
      results.push({ name, match: result.match, diffRatio: result.diffRatio, threshold: result.threshold });
    } catch (error) {
      results.push({ name, match: false, diffRatio: 1, threshold: 0, error: error.message });
    }
  }
  return results;
}

/**
 * Generate visual parity report
 * @param {Array} results - From compareAllDialogs
 * @returns {string}
 */
function generateReport(results) {
  const total = results.length;
  const passed = results.filter(r => r.match).length;
  const passRate = ((passed / total) * 100).toFixed(2);
  
  let report = `Visual Parity Report\n===================\n\n`;
  report += `Total dialogs: ${total}\n`;
  report += `Passed: ${passed} (${passRate}%)\n`;
  report += `Failed: ${total - passed}\n\n`;
  
  report += `Failures:\n`;
  for (const r of results.filter(r => !r.match)) {
    report += `- ${r.name}: ${(r.diffRatio * 100).toFixed(2)}% diff (threshold: ${(r.threshold * 100).toFixed(2)}%)\n`;
  }
  
  return report;
}

module.exports = { compareScreenshots, compareDialogScreenshots, compareAllDialogs, generateReport, DIALOG_THRESHOLDS, getThreshold };
