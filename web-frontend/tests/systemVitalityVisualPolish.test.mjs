import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const readWeb = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

const main = readWeb('src/main.tsx');
const css = readWeb('src/system-vitality-polish.css');
const maintenance = readWeb('src/features/stations/station01/MaintenanceStation.tsx');
const performance = readWeb('src/features/stations/station08/PerformanceStation.tsx');
const monitoring = readWeb('src/features/stations/station15/MonitoringStation.tsx');

test('System Vitality polish loads after all operational workspace proof layers', () => {
  const vitalityWorkspace = main.indexOf("./vitality-workspace.css");
  const investigationWorkspace = main.indexOf("./investigation-workspace.css");
  const polish = main.indexOf("./system-vitality-polish.css");
  assert.ok(vitalityWorkspace >= 0, 'structural Vitality workspace layer must remain loaded');
  assert.ok(investigationWorkspace > vitalityWorkspace, 'existing workspace import order must remain intact');
  assert.ok(polish > investigationWorkspace, 'visual polish must be the late scoped authority layer');
});

test('all three System Vitality services have isolated premium visual scopes', () => {
  for (const service of ['01-System-Maintenance', '08-Performance', '15-System-Monitoring']) {
    assert.match(css, new RegExp(`data-service='${service}'`), `${service} must own a scoped visual treatment`);
  }
  assert.match(css, /data-family='vitality'/);
  assert.doesNotMatch(css, /\.knoux-home(?:\s|\{|__|-)/, 'polish must not restyle Home itself');
});

test('Maintenance keeps the real workflow and upgrades health groups instead of inventing a score', () => {
  assert.match(maintenance, /data-workflow=\{workflow\.toLowerCase\(\)\}/);
  assert.match(maintenance, /care-runtime-strip/);
  assert.match(maintenance, /care-scan-summary/);
  assert.match(maintenance, /care-before-after/);
  assert.match(css, /\.care-group[\s\S]*linear-gradient/);
  assert.match(css, /\.care-scan-stage[\s\S]*radial-gradient/);
  assert.doesNotMatch(css, /--score\s*:/, 'visual polish must not inject a synthetic health score');
});

test('Performance preserves verified counters and gives action cards a visible running state', () => {
  assert.match(performance, /data\?\.Cpu\?\.LoadPercent\s*\?\?\s*null/);
  assert.match(performance, /data\?\.Memory\?\.LoadPercent\s*\?\?\s*null/);
  assert.match(performance, /toolStatuses\[tool\.ToolId\]/);
  assert.match(performance, /isRunning\s*=\s*status\s*===\s*'running'/);
  assert.match(performance, /grid w-full grid-cols-2 sm:grid-cols-4/);
  assert.match(css, /performance-observatory-station[\s\S]*glass-panel/);
  assert.match(css, /:has\(button:disabled\)/, 'running tool cards need an in-card visual state');
});

test('Monitoring remains evidence-backed and action cards stay card-based', () => {
  assert.match(monitoring, /summary\.totalProcesses/);
  assert.match(monitoring, /summary\.unresponsiveCount/);
  assert.match(monitoring, /summary\.runningServices/);
  assert.match(monitoring, /availableStationTools\.map/);
  assert.match(monitoring, /startExecution/);
  assert.match(monitoring, /pollUntilTerminal/);
  assert.match(css, /minmax\(320px, 1fr\)/);
  assert.match(css, /monitoring-observatory-station[\s\S]*radial-gradient/);
});

test('System Vitality polish keeps responsive and reduced-motion fallbacks', () => {
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
