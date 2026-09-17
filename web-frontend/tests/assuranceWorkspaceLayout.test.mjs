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
const css = readWeb('src/assurance-workspace.css');
const serviceApps = readWeb('src/components/ServiceApps.tsx');
const capture = readWeb('scripts/capture-18-services-evidence.mjs');

const services = [
  '03-Network-Internet',
  '09-Security',
  '13-Privacy',
  '14-Driver-Management',
];

test('Assurance workspace override loads after Recovery without replacing prior proof layers', () => {
  const recoveryIndex = mainTsx.indexOf("./recovery-workspace.css");
  const assuranceIndex = mainTsx.indexOf("./assurance-workspace.css");
  assert.ok(recoveryIndex >= 0, 'Recovery proof layer must remain loaded');
  assert.ok(assuranceIndex > recoveryIndex, 'Assurance override must load after Recovery');
});

test('all four Assurance services remove the duplicated outer ACTIONS rail', () => {
  for (const service of services) {
    assert.match(
      css,
      new RegExp(`data-family='assurance'\\]\\[data-service='${service}'\\][^}]*> \\.knoux-command-tool-rail`, 's'),
      `${service} must suppress the duplicated FamilyPage ACTIONS rail`,
    );
  }
  assert.match(css, /\.knoux-command-tool-rail[\s\S]*display:\s*none\s*!important/);
});

test('all four Assurance services suppress the global Sentinel only while the station is open', () => {
  for (const service of services) {
    assert.match(
      css,
      new RegExp(`knoux-body\\[data-view='assurance'\\]:has\\(\\.knoux-command-center\\[data-service='${service}'\\]\\) > \\.knoux-sentinel`),
      `${service} must suppress the duplicated global Sentinel while its station is open`,
    );
  }
  assert.match(css, /\.knoux-sentinel[\s\S]*display:\s*none\s*!important/);
  assert.doesNotMatch(css, /\.knoux-body\[data-view='assurance'\]\s*>\s*\.knoux-sentinel\s*\{/);
});

test('Assurance keeps family navigation and gives the operational station the remaining width', () => {
  assert.match(css, /grid-template-columns:\s*var\(--command-rail-width\)\s+minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(css, /\.knoux-command-service-rail\s*\{\s*display:\s*none/);
  assert.match(css, /\.knoux-command-live-column[\s\S]*width:\s*100%/);
  assert.match(css, /\.knoux-workspace-stage[\s\S]*width:\s*100%/);
});

test('Driver Management keeps all nine tabs visible without horizontal clipping', () => {
  assert.match(css, /driver-matrix-station\s*>\s*div\[style\*='overflow-x: auto'\]/);
  assert.match(css, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(118px,\s*1fr\)\)/);
  assert.match(css, /overflow-x:\s*visible\s*!important/);
  assert.match(css, /justify-content:\s*center/);
});

test('Network, Security, Privacy and Drivers stay mounted while generic preview refreshes run', () => {
  assert.match(serviceApps, /const stationOwnsLifecycle =/);
  for (const section of ['network', 'security', 'privacy', 'drivers']) {
    assert.match(serviceApps, new RegExp(`activeSection === '${section}'`));
  }
  assert.match(serviceApps, /loading=\{loading && !stationOwnsLifecycle\}/);
});

test('route evidence treats Assurance stations as owners of their real controls', () => {
  assert.match(capture, /03-Network-Internet[^\n]*ownsActions: true/);
  assert.match(capture, /09-Security[^\n]*ownsActions: true/);
  assert.match(capture, /13-Privacy[^\n]*ownsActions: true/);
  assert.match(capture, /14-Driver-Management[^\n]*ownsActions: true/);
});
