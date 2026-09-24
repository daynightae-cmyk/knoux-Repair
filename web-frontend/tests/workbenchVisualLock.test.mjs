import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const readWeb = (p) => fs.readFileSync(path.join(webRoot, p), 'utf8');

const station = readWeb('src/components/premium/workbench/EngineeringWorkbenchStation.tsx');
const css = readWeb('src/workbench-command-deck.css');
const dockShell = readWeb('src/components/workspace/KnouxDockWorkspace.tsx');

test('workbench is a 3-zone IDE workspace, not a card wall or giant hero', () => {
  assert.match(`${station}\n${dockShell}`, /data-workspace="ide"/);
  assert.match(station, /data-zone="explorer"/);
  assert.match(station, /data-zone="center"/);
  assert.match(station, /data-zone="context"/);
  assert.match(css, /\.knoux-deck-workspace/);
  assert.match(css, /grid-template-columns/);
});

test('center is dominant with honest tab views over the real tool pool', () => {
  for (const tab of ['overview', 'code', 'dependencies', 'scripts', 'environment', 'insights', 'output']) {
    assert.ok(station.includes(`'${tab}'`) || station.includes(`"${tab}"`), `tab ${tab} must exist`);
  }
  assert.match(station, /data-workbench-tab/);
  assert.match(station, /WORKBENCH_SERVICES\.includes\(tool\.Category as ServiceId\)/);
  assert.match(station, /activeTab === 'overview' \?/);
});

test('explorer stays compact and the hero stays a command strip', () => {
  assert.match(station, /knoux-deck-explorer__tool/);
  assert.match(css, /\.knoux-deck-explorer/);
  assert.match(css, /\.knoux-deck-side/);
  assert.match(css, /flex-basis: 16rem/);
});

test('workspace stays usable at desktop widths with center protected', () => {
  assert.match(css, /max-width: 1280px/);
  assert.match(css, /max-width: 1100px/);
  assert.match(css, /max-width: 760px/);
  assert.match(css, /minmax\(0, 1fr\)/);
});
