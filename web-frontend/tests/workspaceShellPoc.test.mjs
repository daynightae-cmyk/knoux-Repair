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
  assert.match(shell, /data-workspace-shell="dockview-poc"/);
  assert.match(shell, /data-runtime-owner="existing-knoux"/);
  assert.match(shell, /knoux-developer-explorer/);
  assert.match(shell, /knoux-developer-center/);
  assert.match(shell, /knoux-developer-context/);
  assert.match(shell, /referencePanel: center/);
  assert.doesNotMatch(shell, /dockview-enterprise/);
  assert.doesNotMatch(shell, /keyboardNavigation/);
});

test('Developer Tools alone opts into the PoC and canonical ServiceApps remains single-mounted', () => {
  const station = read('src/components/premium/workbench/EngineeringWorkbenchStation.tsx');

  assert.match(station, /KnouxDockWorkspace/);
  assert.match(
    station,
    /enabled=\{activeService\.id === '12-Developer-Tools' && activeTab === 'overview'\}/,
  );

  const serviceAppsMounts = station.match(/<ServiceApps/g) ?? [];
  assert.equal(
    serviceAppsMounts.length,
    1,
    `expected exactly one canonical ServiceApps mount, found ${serviceAppsMounts.length}`,
  );
});

test('PoC shell has an explicit bounded height so Dockview can render', () => {
  const css = read('src/components/workspace/knoux-dock-workspace.css');

  assert.match(css, /\.knoux-dock-workspace\s*\{/);
  assert.match(css, /height:\s*clamp\(/);
  assert.match(css, /min-height:\s*430px/);
  assert.match(css, /\.knoux-dock-slot--center/);
});
