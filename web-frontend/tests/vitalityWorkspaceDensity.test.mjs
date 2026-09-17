import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const main = read('src/main.tsx');
const css = read('src/vitality-workspace-density.css');

test('System Vitality density layer loads after the final visual proof layers', () => {
  assert.match(main, /final-visual-proof\.css'[\s\S]*navigation-transition-proof\.css'[\s\S]*vitality-workspace-density\.css'/);
});

test('System Vitality gives the live operation center width instead of a permanent third column', () => {
  assert.match(css, /knoux-command-center\[data-family='vitality'\][\s\S]*grid-template-columns:\s*var\(--command-rail-width\) minmax\(0, 1fr\)/s);
  assert.match(css, /grid-template-rows:\s*minmax\(0, 1fr\) 154px/);
  assert.match(css, /knoux-command-live-column[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*1/s);
});

test('System Vitality keeps real actions reachable in a horizontal dock', () => {
  assert.match(css, /knoux-command-tool-rail[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*2/s);
  assert.match(css, /knoux-command-tool-list[\s\S]*flex-direction:\s*row/s);
  assert.match(css, /knoux-command-tool-scroll[\s\S]*overflow-x:\s*auto[\s\S]*overflow-y:\s*hidden/s);
  assert.doesNotMatch(css, /display:\s*none[^;]*;[^}]*knoux-command-tool-rail/s);
});
