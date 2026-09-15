import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const app = read('src/App.tsx');
const serviceApps = read('src/components/ServiceApps.tsx');
const workbench = read('src/components/premium/workbench/EngineeringWorkbenchStation.tsx');
const deckCss = read('src/workbench-command-deck.css');
const developer = read('src/features/stations/station12/DeveloperStation.tsx');
const familyPage = read('src/components/premium/FamilyPage.tsx');

test('entered Engineering services expose operational mode without changing the family landing contract', () => {
  assert.match(app, /data-workbench-operational=\{Boolean\(activeFamily\?\.id === 'workbench' && selectedService !== null\)\}/);
  assert.match(deckCss, /\.knoux-body\[data-workbench-operational='true'\] > \.knoux-sentinel\s*\{[^}]*display:\s*none/s);
  assert.match(deckCss, /\.knoux-command-center\[data-family='workbench'\] > \.knoux-command-service-rail\s*\{[^}]*display:\s*none/s);
});

test('Workbench center embeds the canonical station without a second LiveShell or outer ActionRail', () => {
  assert.match(serviceApps, /embedded\?: boolean/);
  assert.match(serviceApps, /if \(embedded\)/);
  assert.match(serviceApps, /className=\{`service-app-embedded service-app-embedded--\$\{activeSection\}`\}/);
  assert.match(workbench, /<ServiceApps[\s\S]*onRunTool=\{onRunTool\}[\s\S]*onCancelTool=\{onCancelTool\}[\s\S]*embedded/);
  assert.match(workbench, /data-operational="true"/);
});

test('operational Workbench gives the IDE center priority over repeated landing chrome', () => {
  assert.match(deckCss, /INTERNAL WORKBENCH OPERATIONAL MODE/);
  assert.match(deckCss, /knoux-engineering-workbench\[data-operational='true'\][\s\S]*knoux-deck-services[\s\S]*display:\s*none/);
  assert.match(deckCss, /grid-template-columns:\s*12\.5rem minmax\(0, 1fr\) 14\.5rem/);
  assert.match(deckCss, /service-app-embedded--projectSonar/);
  assert.match(deckCss, /service-app-embedded--developerTools/);
});

test('Workbench tabs are service-specific while retaining the canonical engineering tab model', () => {
  for (const id of ['overview', 'code', 'dependencies', 'scripts', 'environment', 'insights', 'output']) {
    assert.match(workbench, new RegExp(`id: '${id}'`));
  }
  assert.match(workbench, /const visibleTabs = activeService\.id === '18-Project-Sonar'/);
  assert.match(workbench, /\['overview', 'dependencies', 'insights', 'output'\]/);
  assert.match(workbench, /\['overview', 'code', 'dependencies', 'scripts', 'environment', 'output'\]/);
});




test('Developer station keeps its post-Visual human labels and gains only the embedded layout hook', () => {
  assert.match(developer, /className="developer-workbench-station developer-station-root"/);
  for (const primaryLeak of [
    'Environment Audit (DT01)',
    'Toolchain Doctor (DT04)',
    'Port Observatory (DT06)',
    'Release Servers (DT10)',
    'Git Workspace Insight (DT08)',
    'Project Intelligence (DT05)',
  ]) {
    assert.equal(developer.includes(primaryLeak), false, `primary UI leaked ToolId: ${primaryLeak}`);
  }
});

test('Software and Investigation defer to real station controls instead of the generic outer action rail', () => {
  const integrationCss = read('src/service-station-integration.css');
  for (const family of ['software', 'investigation']) {
    assert.match(
      integrationCss,
      new RegExp(`knoux-command-center\\.knoux-service-app-active\\[data-family='${family}'\\][\\s\\S]*?knoux-command-tool-rail[\\s\\S]*?display:\\s*none`),
    );
  }
});

test('Developer Tools keeps the first-class Workbench mounted during execution and drops duplicate family rails', () => {
  assert.match(familyPage, /const showWorkbenchStation = family\.id === 'workbench' && selectedService !== null/);
  assert.match(familyPage, /\{!showWorkbenchStation && \(\s*<aside className="knoux-command-rail knoux-command-service-rail"/s);
  assert.match(familyPage, /\{!showWorkbenchStation && \(\s*<aside className="knoux-command-rail knoux-command-tool-rail"/s);
  assert.doesNotMatch(familyPage, /showWorkbenchStation = family\.id === 'workbench' && !selectedTool && !executionTool/);
});

test('late Developer operational layer wins the Anima cascade and keeps ToolIds out of the visible explorer', () => {
  const main = read('src/main.tsx');
  const developerCss = read('src/workbench-developer-operational.css');
  assert.match(main, /workbench-anima-finish\.css'[\s\S]*workbench-developer-operational\.css'/);
  assert.match(developerCss, /data-service-id='12-Developer-Tools'[\s\S]*knoux-deck-tabs[\s\S]*display:\s*none/s);
  assert.match(developerCss, /knoux-deck-explorer__tool-id[\s\S]*display:\s*none/s);
  assert.match(developerCss, /grid-template-columns:\s*9\.5rem minmax\(0, 1fr\) 11rem/);
  assert.match(developerCss, /developer-workbench-station__metrics[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/s);
});
