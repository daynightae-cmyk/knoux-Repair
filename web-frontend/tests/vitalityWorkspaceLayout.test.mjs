import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const readWeb = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

const mainTsx = readWeb('src/main.tsx');
const css = readWeb('src/vitality-workspace.css');
const serviceApps = readWeb('src/components/ServiceApps.tsx');

const services = [
  '01-System-Maintenance',
  '08-Performance',
  '15-System-Monitoring',
];

test('System Vitality workspace override loads after the established visual closure layers', () => {
  const proofIndex = mainTsx.indexOf("./navigation-transition-proof.css");
  const vitalityIndex = mainTsx.indexOf("./vitality-workspace.css");
  assert.ok(proofIndex >= 0, 'navigation transition proof layer must remain loaded');
  assert.ok(vitalityIndex > proofIndex, 'vitality workspace override must load after prior visual proof layers');
});

test('all three System Vitality services remove the duplicated outer ACTIONS rail', () => {
  for (const service of services) {
    assert.match(
      css,
      new RegExp(`data-family='vitality'\\]\\[data-service='${service}'\\][^}]*> \\.knoux-command-tool-rail`, 's'),
      `${service} must suppress the duplicated FamilyPage ACTIONS rail`,
    );
  }
  assert.match(css, /\.knoux-command-tool-rail[\s\S]*display:\s*none\s*!important/);
});

test('all three System Vitality services suppress the global Sentinel only while the service workspace is open', () => {
  for (const service of services) {
    assert.match(css, new RegExp(`data-view='vitality'[^}]*data-service='${service}'`, 's'));
  }
  assert.match(css, /> \.knoux-sentinel[\s\S]*display:\s*none\s*!important/);
  assert.doesNotMatch(css, /\.knoux-body\[data-view='vitality'\]\s*>\s*\.knoux-sentinel\s*\{/,
    'family landing Sentinel must not be hidden unconditionally');
});

test('System Vitality keeps service navigation while the operational center expands', () => {
  assert.match(css, /grid-template-columns:\s*var\(--command-rail-width\)\s+minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(css, /\.knoux-command-service-rail\s*\{\s*display:\s*none/,
    'desktop service navigation must remain visible');
  assert.match(css, /\.knoux-command-live-column[\s\S]*width:\s*100%/);
});

test('System Vitality stations stay mounted while the generic shell refresh is loading', () => {
  assert.match(serviceApps, /const stationOwnsLifecycle =/);
  for (const section of ['maintenance', 'performance', 'monitoring']) {
    assert.match(serviceApps, new RegExp(`activeSection === '${section}'`));
  }
  assert.match(
    serviceApps,
    /loading=\{loading && !stationOwnsLifecycle\}/,
    'the outer Reading your device state must not replace the station-owned workspaces',
  );
});
