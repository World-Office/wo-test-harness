/**
 * Visual diff utility using pixelmatch
 * Compare two screenshots and return diff statistics
 */

const fs = require('fs');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');

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

module.exports = { compareScreenshots };
