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
const css = readWeb('src/investigation-workspace.css');
const serviceApps = readWeb('src/components/ServiceApps.tsx');
const capture = readWeb('scripts/capture-18-services-evidence.mjs');

const services = ['10-Diagnostics-Reports', '07-Services-Processes'];

test('Investigation workspace layer loads after Software workspace closure', () => {
  const softwareIndex = mainTsx.indexOf("./software-workspace.css");
  const investigationIndex = mainTsx.indexOf("./investigation-workspace.css");
  assert.ok(softwareIndex >= 0, 'Software workspace proof layer must remain loaded');
  assert.ok(investigationIndex > softwareIndex, 'Investigation layer must load after Software');
});

test('both Investigation stations suppress duplicate outer chrome only while open', () => {
  for (const service of services) {
    assert.match(
      css,
      new RegExp(`data-family='investigation'\\]\\[data-service='${service}'\\][^}]*> \\.knoux-command-tool-rail`, 's'),
      `${service} must suppress the generic FamilyPage ACTIONS rail`,
    );
    assert.match(
      css,
      new RegExp(`knoux-body\\[data-view='investigation'\\]:has\\(\\.knoux-command-center\\[data-service='${service}'\\]\\) > \\.knoux-sentinel`),
      `${service} must suppress the global Sentinel while its station is open`,
    );
  }
  assert.doesNotMatch(css, /\.knoux-body\[data-view='investigation'\]\s*>\s*\.knoux-sentinel\s*\{/);
});

test('Investigation preserves family navigation and gives stations full remaining width', () => {
  assert.match(css, /grid-template-columns:\s*var\(--command-rail-width\)\s+minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(css, /\.knoux-command-service-rail\s*\{\s*display:\s*none/);
  assert.match(css, /\.knoux-command-live-column[\s\S]*width:\s*100%/);
  assert.match(css, /\.knoux-workspace-stage[\s\S]*width:\s*100%/);
});

test('Diagnostics and Services stay mounted while their preview loaders refresh', () => {
  assert.match(serviceApps, /const stationOwnsLifecycle =/);
  assert.match(serviceApps, /activeSection === 'services'/);
  assert.match(serviceApps, /activeSection === 'diagnostics'/);
  assert.match(serviceApps, /loading=\{loading && !stationOwnsLifecycle\}/);
});

test('route evidence treats both Investigation stations as owners of their real controls', () => {
  assert.match(capture, /10-Diagnostics-Reports[^\n]*ownsActions: true/);
  assert.match(capture, /07-Services-Processes[^\n]*ownsActions: true/);
});
