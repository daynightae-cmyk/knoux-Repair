import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const readWeb = relative => fs.readFileSync(path.join(webRoot, relative), 'utf8');

const scripts = [
  ['Vitality', readWeb('scripts/capture-system-vitality-polish-evidence.mjs')],
  ['Recovery', readWeb('scripts/capture-recovery-storage-polish-evidence.mjs')],
  ['Assurance', readWeb('scripts/capture-assurance-polish-evidence.mjs')],
];

test('visual evidence navigation tolerates only committed lifecycle timeouts', () => {
  for (const [name, source] of scripts) {
    assert.match(source, /async function navigateEvidenceRoute\(/, name);
    assert.match(source, /attempt <= 2/, name);
    assert.match(source, /error\?\.name === 'TimeoutError' \|\| \/Navigation timeout\/i\.test\(message\)/, name);
    assert.match(source, /if \(!isNavigationTimeout\) throw error;/, name);
    assert.match(source, /document\.readyState/, name);
    assert.match(source, /Boolean\(await page\.\$\('body'\)\)/, name);
    assert.match(source, /if \(committed\) return;/, name);
    assert.match(source, /about:blank/, name);
  }
});

test('visual evidence routes still require canonical family and station surfaces', () => {
  for (const [name, source] of scripts) {
    assert.match(source, /\.knoux-family-page\[data-service=/, name);
    assert.match(source, /page\.waitForSelector\(selector, \{ visible: true, timeout: 20_000 \}\)/, name);
    assert.match(source, /requestAnimationFrame/, name);
  }
});
