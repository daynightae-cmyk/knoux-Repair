import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(webRoot, 'scripts/capture-final-unified-18-service-proof.mjs'), 'utf8');

const services = [
  '01-System-Maintenance', '08-Performance', '15-System-Monitoring',
  '02-System-Cleanup', '05-Duplicate-Files', '06-Disk-Space', '11-Backup-Recovery',
  '03-Network-Internet', '09-Security', '13-Privacy', '14-Driver-Management',
  '04-Programs-Applications', '16-Software-Environment', '17-PostInstall-Setup',
  '12-Developer-Tools', '18-Project-Sonar',
  '10-Diagnostics-Reports', '07-Services-Processes',
];

test('final unified proof covers exactly the canonical 18 services', () => {
  for (const service of services) assert.match(source, new RegExp(service));
  const routeEntries = source.match(/service:\s*'[^']+'/g) || [];
  assert.equal(routeEntries.length, 18);
});

test('final unified proof uses the strict 1366 desktop viewport', () => {
  assert.match(source, /width:\s*1366,\s*height:\s*768/);
});

test('final unified proof rejects duplicate chrome, overflow, and clipped controls', () => {
  assert.match(source, /toolRailVisible/);
  assert.match(source, /sentinelVisible/);
  assert.match(source, /pageOverflow > 2/);
  assert.match(source, /clippedControls\.length/);
  assert.match(source, /serviceRailVisible/);
});

test('final unified proof preserves Engineering workbench rail ownership', () => {
  assert.match(source, /target\.workbench && proof\.serviceRailVisible/);
  assert.match(source, /!target\.workbench && !proof\.serviceRailVisible/);
});

test('final unified proof never executes service actions', () => {
  assert.match(source, /execution:\s*'not-started'/);
  assert.doesNotMatch(source, /\.click\(/);
  assert.doesNotMatch(source, /Execute Action|handleLaunchTool|onRunTool/);
});

test('final unified proof keeps navigation timeout recovery narrow', () => {
  assert.match(source, /attempt <= 2/);
  assert.match(source, /Navigation timeout/i);
  assert.match(source, /if \(!timeout\) throw error/);
  assert.match(source, /page\.waitForSelector\(target\.surface/);
});
