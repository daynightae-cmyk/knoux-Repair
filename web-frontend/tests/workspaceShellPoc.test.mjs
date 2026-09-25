import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

test('workspace PoC pins the free Dockview React shell without changing React major', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['dockview-react'], '^8.3.1');
  assert.match(pkg.dependencies.react, /^\^18\./);
});

test('Dockview adapter owns layout only and preserves existing KNOUX children', () => {
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');

  assert.match(shell, /DockviewReact/);
  assert.match(shell, /data-workspace-shell="dockview"/);
  assert.match(shell, /data-workspace-kind={workspace}/);
  assert.match(shell, /data-runtime-owner="existing-knoux"/);
  assert.match(shell, /prefix: 'knoux-developer'/);
  assert.match(shell, /prefix: 'knoux-sonar'/);
  assert.match(shell, /prefix: 'knoux-programs'/);
  assert.match(shell, /\$\{panelText\.prefix\}-explorer/);
  assert.match(shell, /\$\{panelText\.prefix\}-center/);
  assert.match(shell, /\$\{panelText\.prefix\}-context/);
  assert.match(shell, /referencePanel: center/);
  assert.doesNotMatch(shell, /dockview-enterprise/);
  assert.doesNotMatch(shell, /keyboardNavigation/);
});

test('Developer Tools and Project Sonar opt into the workspace shell while canonical ServiceApps stays single-mounted', () => {
  const station = read('src/components/premium/workbench/EngineeringWorkbenchStation.tsx');

  assert.match(station, /KnouxDockWorkspace/);
  assert.match(
    station,
    /workspace=\{activeService\.id === '18-Project-Sonar' \? 'sonar' : 'developer'\}/,
  );
  assert.match(
    station,
    /enabled=\{WORKBENCH_SERVICES\.includes\(activeService\.id\) && activeTab === 'overview'\}/,
  );

  const serviceAppsMounts = station.match(/<ServiceApps/g) ?? [];
  assert.equal(
    serviceAppsMounts.length,
    1,
    `expected exactly one canonical ServiceApps mount, found ${serviceAppsMounts.length}`,
  );
});

test('workbench service switches return to Overview so the matching Dockview workspace mounts predictably', () => {
  const station = read('src/components/premium/workbench/EngineeringWorkbenchStation.tsx');

  assert.match(
    station,
    /useEffect\(\(\) => \{\s*setActiveTab\('overview'\);\s*\}, \[activeService\.id\]\)/,
  );
});

test('PoC shell consumes the real flex remainder instead of leaving a blank lower viewport', () => {
  const css = read('src/components/workspace/knoux-dock-workspace.css');

  assert.match(css, /\.knoux-dock-workspace\s*\{/);
  assert.match(css, /flex:\s*1 1 auto/);
  assert.match(css, /height:\s*auto/);
  assert.match(css, /min-height:\s*0/);
  assert.doesNotMatch(css, /height:\s*clamp\(/);
  assert.match(css, /\.knoux-dock-slot--center/);
});

test('core workspace tabs cannot be accidentally closed while panels stay dockable', () => {
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');

  assert.match(shell, /DockviewDefaultTab/);
  assert.match(shell, /hideClose/);
  assert.match(shell, /tabComponents=\{tabComponents\}/);
  assert.equal((shell.match(/tabComponent: 'locked'/g) ?? []).length, 3);
});


test('Programs migrates only its service-mode surface into Dockview and keeps one canonical ServiceApps mount', () => {
  const stage = read('src/components/premium/FamilyLiveStage.tsx');
  const shell = read('src/components/workspace/KnouxDockWorkspace.tsx');
  const css = read('src/components/workspace/knoux-dock-workspace.css');

  assert.match(stage, /service\.id === '04-Programs-Applications' && serviceAppMode/);
  assert.match(stage, /workspace="programs"/);
  assert.match(stage, /embedded=\{programsDockEnabled\}/);
  assert.match(stage, /data-service-dock-zone="explorer"/);
  assert.match(stage, /data-service-dock-zone="center"/);
  assert.match(stage, /data-service-dock-zone="context"/);
  assert.match(stage, /bridgeOnline === true \? serviceTools\.length : '—'/);
  assert.match(stage, /activeSignals/);
  assert.match(shell, /explorerWidth: 180/);
  assert.match(shell, /contextWidth: 200/);
  assert.equal((stage.match(/<ServiceApps/g) ?? []).length, 1);
  assert.match(css, /\.knoux-stage-service-app--dock/);
  assert.match(css, /height:\s*100%/);
  assert.match(css, /flex:\s*1 1 auto/);
});
