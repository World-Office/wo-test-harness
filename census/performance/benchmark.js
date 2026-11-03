/**
 * Performance Benchmark Suite
 * Measure WO editor performance against OO baseline
 */

/**
 * Measure editor load time
 * @returns {Promise<{time: number, memory: number}>}
 */
async function measureLoadTime() {
  const start = performance.now();
  const startMem = performance.memory?.usedJSHeapSize || 0;
  
  // Force editor initialization
  await new Promise(resolve => {
    if (window.loaded) return resolve();
    window.addEventListener('load', resolve);
  });
  
  const end = performance.now();
  const endMem = performance.memory?.usedJSHeapSize || 0;
  
  return {
    time: end - start,
    memory: endMem - startMem
  };
}

/**
 * Measure rendering time for large document
 * @param {number} pageCount - Number of pages to render
 * @returns {Promise<{time: number, fps: number}>}
 */
async function measureRenderTime(pageCount = 100) {
  const start = performance.now();
  
  // Simulate rendering 100 pages of content
  const editor = document.getElementById('editor');
  const content = '<p>Test page content</p>'.repeat(50);
  
  for (let i = 0; i < pageCount; i++) {
    editor.insertAdjacentHTML('beforeend', `<div class="page">${content}</div>`);
  }
  
  // Force layout
  await new Promise(resolve => requestAnimationFrame(resolve));
  
  const end = performance.now();
  const time = end - start;
  
  return {
    time,
    pagesPerSecond: pageCount / (time / 1000)
  };
}

/**
 * Measure keyboard input latency
 * @param {number} iterations - Number of keystrokes to test
 * @returns {Promise<{avg: number, min: number, max: number}>}
 */
async function measureInputLatency(iterations = 100) {
  const editor = document.getElementById('editor');
  editor.focus();
  
  const latencies = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    
    // Simulate a keystroke
    document.execCommand('insertText', false, 'a');
    
    // Wait for the browser to process it
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const end = performance.now();
    latencies.push(end - start);
  }
  
  return {
    avg: latencies.reduce((a, b) => a + b) / latencies.length,
    min: Math.min(...latencies),
    max: Math.max(...latencies)
  };
}

/**
 * Measure dialog open time
 * @param {string} dialogId - ID of dialog to open
 * @returns {Promise<{time: number}>}
 */
async function measureDialogOpenTime(dialogId) {
  const start = performance.now();
  
  const dialog = document.getElementById(dialogId);
  if (dialog) {
    dialog.classList.add('open');
    // Force layout
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  
  const end = performance.now();
  
  // Cleanup
  if (dialog) dialog.classList.remove('open');
  
  return { time: end - start };
}

/**
 * Run full benchmark suite
 * @returns {Promise<Object>}
 */
async function runBenchmark() {
  const results = {};
  
  // Load time
  results.load = await measureLoadTime();
  
  // Render time
  results.render = await measureRenderTime(100);
  
  // Input latency
  results.input = await measureInputLatency(100);
  
  // Dialog open time (test a few)
  const dialogs = ['about-dialog', 'settings-dialog', 'insert-image-dialog'];
  results.dialogs = {};
  for (const dlg of dialogs) {
    results.dialogs[dlg] = await measureDialogOpenTime(dlg);
  }
  
  return results;
}

/**
 * Format benchmark results for display
 * @param {Object} results
 * @returns {string}
 */
function formatResults(results) {
  return `
Benchmark Results:
==================

Load Time: ${results.load.time.toFixed(2)}ms (Memory: ${(results.load.memory / 1024 / 1024).toFixed(2)}MB)

Render 100 Pages: ${results.render.time.toFixed(2)}ms (${results.render.pagesPerSecond.toFixed(1)} pages/sec)

Input Latency (100 samples):
  Avg: ${results.input.avg.toFixed(2)}ms
  Min: ${results.input.min.toFixed(2)}ms
  Max: ${results.input.max.toFixed(2)}ms

Dialog Open Times:
${Object.entries(results.dialogs || {}).map(([id, r]) => `  ${id}: ${r.time.toFixed(2)}ms`).join('\n')}
`;
}

// Export for use in tests
module.exports = {
  measureLoadTime,
  measureRenderTime,
  measureInputLatency,
  measureDialogOpenTime,
  runBenchmark,
  formatResults
};

// Run automatically if loaded in browser console
if (typeof window !== 'undefined' && window.location.hostname.includes('graphwiz.ai')) {
  runBenchmark().then(results => console.log(formatResults(results)));
}
