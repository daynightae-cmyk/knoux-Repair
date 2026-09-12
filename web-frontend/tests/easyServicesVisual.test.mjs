import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

const read = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

const css = read('src/easy-services-polish.css');
const main = read('src/main.tsx');

test('Easy services visual layer is loaded after the existing service styles', () => {
  const baseIndex = main.indexOf("import './service-apps.css'");
  const easyIndex = main.indexOf("import './easy-services-polish.css'");
  assert.ok(baseIndex >= 0, 'service-apps.css must remain loaded');
  assert.ok(easyIndex > baseIndex, 'easy-services-polish.css must load after service-apps.css');
});

test('Easy services visual layer covers all eight customer-first stations', () => {
  for (const marker of [
    '.cleanup-station',
    '.programs-station',
    '.software-station-root',
    '.post-install-station-root',
    '#ad79ff', // Disk Space
    '#47c0e7', // Backup & Recovery
    '#eb75a7', // Privacy
    '#e5ab57', // Driver Management
  ]) {
    assert.match(css, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing easy-service marker ${marker}`);
  }
});

test('Post-install customer UI hides engineering IDs from its primary action surface', () => {
  assert.match(css, /\.post-install-station-root \.actions-pane \.tool-id-badge\s*\{\s*display:none/);
  assert.match(css, /content:"Browse apps"/);
  assert.match(css, /content:"Install selected"/);
  assert.match(css, /content:"تصفح التطبيقات"/);
  assert.match(css, /content:"تثبيت التطبيقات المحددة"/);
});

test('Post-install catalog is presented as a responsive application grid while preserving real table data', () => {
  assert.match(css, /\.catalog-pane \.station-data-table tbody\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fill,minmax\(220px,1fr\)\)/);
  assert.match(css, /td:nth-child\(3\)[\s\S]*td:nth-child\(6\)\s*\{\s*display:none/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*grid-template-columns:1fr/);
});

test('Easy services retain reduced-motion support and truthful no-fake-progress presentation', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /Math\.random|fake progress|72%|98%/i);
});
