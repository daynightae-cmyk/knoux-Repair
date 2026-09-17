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
const css = readWeb('src/software-workspace.css');
const capture = readWeb('scripts/capture-18-services-evidence.mjs');
const serviceApps = readWeb('src/components/ServiceApps.tsx');

const services = [
  '04-Programs-Applications',
  '16-Software-Environment',
  '17-PostInstall-Setup',
];

test('Software workspace layer loads after Assurance', () => {
  const assuranceIndex = mainTsx.indexOf("./assurance-workspace.css");
  const softwareIndex = mainTsx.indexOf("./software-workspace.css");
  assert.ok(assuranceIndex >= 0, 'Assurance proof layer must remain loaded');
  assert.ok(softwareIndex > assuranceIndex, 'Software workspace layer must load after Assurance');
});

test('all three Software Library stations suppress duplicate outer rails', () => {
  for (const service of services) {
    assert.match(
      css,
      new RegExp(`data-family='software'\\]\\[data-service='${service}'\\][^}]*> \\.knoux-command-tool-rail`, 's'),
      `${service} must suppress the generic FamilyPage ACTIONS rail`,
    );
    assert.match(
      css,
      new RegExp(`knoux-body\\[data-view='software'\\]:has\\(\\.knoux-command-center\\[data-service='${service}'\\]\\) > \\.knoux-sentinel`),
      `${service} must suppress the global Sentinel while the station is open`,
    );
  }
  assert.match(css, /\.knoux-command-tool-rail[\s\S]*display:\s*none\s*!important/);
  assert.match(css, /\.knoux-sentinel[\s\S]*display:\s*none\s*!important/);
  assert.doesNotMatch(css, /\.knoux-body\[data-view='software'\]\s*>\s*\.knoux-sentinel\s*\{/);
});

test('Software Library preserves family navigation and gives stations full remaining width', () => {
  assert.match(css, /grid-template-columns:\s*var\(--command-rail-width\)\s+minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(css, /\.knoux-command-service-rail\s*\{\s*display:\s*none/);
  assert.match(css, /\.knoux-command-live-column[\s\S]*width:\s*100%/);
  assert.match(css, /\.knoux-workspace-stage[\s\S]*width:\s*100%/);
});

test('Software Library stations stay mounted while generic preview refreshes run', () => {
  for (const section of ['programs', 'softwareEnvironment', 'postInstall']) {
    assert.match(
      serviceApps,
      new RegExp(`\\|\\| activeSection === '${section}'`),
      `${section} must own its station lifecycle`,
    );
  }
  assert.match(serviceApps, /loading=\{loading && !stationOwnsLifecycle\}/);
});

test('Runtime Matrix and Post-Install keep KPI and quick-action content structured', () => {
  assert.match(css, /:is\(\.software-station-root, \.post-install-station-root\) \.metrics-grid/);
  assert.match(css, /display:\s*grid\s*!important/);
  assert.match(css, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.metric-card[\s\S]*display:\s*flex\s*!important/);
  assert.match(css, /\.quick-actions-bar[\s\S]*display:\s*flex\s*!important/);
  assert.match(css, /\.quick-action-pill[\s\S]*display:\s*inline-flex\s*!important/);
});

test('Post-Install keeps all station tabs visible without horizontal clipping', () => {
  assert.match(css, /post-install-station-root \.station-tabs-nav/);
  assert.match(css, /flex-wrap:\s*wrap\s*!important/);
  assert.match(css, /overflow-x:\s*visible\s*!important/);
  assert.match(css, /\.station-tabs-nav \.tab-btn[\s\S]*flex:\s*0 1 auto\s*!important/);
});

test('route evidence keeps Software Library stations as station-owned actions', () => {
  assert.match(capture, /04-Programs-Applications[^\n]*ownsActions: true/);
  assert.match(capture, /16-Software-Environment[^\n]*ownsActions: true/);
  assert.match(capture, /17-PostInstall-Setup[^\n]*ownsActions: true/);
});
