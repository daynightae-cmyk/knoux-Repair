import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const WEB_ROOT = path.join(REPO_ROOT, 'web-frontend');

function readRepo(p) { return fs.readFileSync(path.join(REPO_ROOT, p), 'utf8'); }
function readWeb(p) { return fs.readFileSync(path.join(WEB_ROOT, p), 'utf8'); }

const STATION08_IDS = ['PF01', 'PF02', 'PF03', 'PF04', 'PF05', 'PF06', 'PF07', 'PF08', 'PF09', 'PF10', 'PF11', 'PF12'];

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station08-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station08', 'performanceModel.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'error',
});
const model = await import(pathToFileURL(bundlePath).href);
try { fs.unlinkSync(bundlePath); } catch { /* non-critical */ }

/* =========================================================================
 * REPOSITORY CONTRACT & MANIFEST VERIFICATION
 * ========================================================================= */

test('Station 08: manifest inventory is exactly 12 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '08-Performance');
  assert.equal(station.length, 12, 'Station 08 must have exactly 12 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION08_IDS].sort(),
    'Station 08 ToolIds must match the manifest contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve on disk`);
  }
});

test('Station 08: risk levels match safe analysis & cleanup posture', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const pf09 = manifest.find((entry) => entry.ToolId === 'PF09');
  assert.ok(pf09);
  assert.equal(pf09.RiskLevel, 'SAFE_CLEANUP', 'PF09 must be SAFE_CLEANUP');

  const readOnly = manifest.filter((entry) => entry.Category === '08-Performance' && entry.ToolId !== 'PF09');
  for (const entry of readOnly) {
    assert.equal(entry.RiskLevel, 'READ_ONLY', `${entry.ToolId} must be READ_ONLY`);
  }
});

/* =========================================================================
 * DOMAIN MODEL LOGIC VERIFICATION (performanceModel.ts)
 * ========================================================================= */

test('Station 08: derivePerformanceCondition deterministically evaluates categorical conditions', () => {
  assert.equal(model.derivePerformanceCondition(20, 40), 'OPTIMAL');
  assert.equal(model.derivePerformanceCondition(65, 50), 'MODERATE');
  assert.equal(model.derivePerformanceCondition(80, 50), 'HIGH_LOAD');
  assert.equal(model.derivePerformanceCondition(30, 85), 'HIGH_LOAD');
  assert.equal(model.derivePerformanceCondition(95, 30), 'CRITICAL_LOAD');
  assert.equal(model.derivePerformanceCondition(20, 95), 'CRITICAL_LOAD');
});

test('Station 08: analyzeBottlenecks detects CPU, memory and disk queues with citations', () => {
  const cpuBottlenecks = model.analyzeBottlenecks(85, 40, 10);
  assert.ok(cpuBottlenecks.some((b) => b.domain === 'CPU' && b.toolId === 'PF07'));

  const memBottlenecks = model.analyzeBottlenecks(30, 90, 10);
  assert.ok(memBottlenecks.some((b) => b.domain === 'MEMORY' && b.toolId === 'PF04'));

  const diskBottlenecks = model.analyzeBottlenecks(30, 40, 85);
  assert.ok(diskBottlenecks.some((b) => b.domain === 'DISK' && b.toolId === 'PF05'));

  const clear = model.analyzeBottlenecks(20, 40, 10);
  assert.equal(clear.length, 0);
});

test('Station 08: parseTopConsumers parses and sorts descending by memoryMB', () => {
  const raw = [
    { ProcessId: 1, Name: 'app_low', MemoryMB: 50, CpuSeconds: 2 },
    { ProcessId: 2, Name: 'app_high', MemoryMB: 500, CpuSeconds: 12 },
    { ProcessId: 3, Name: 'app_mid', MemoryMB: 200, CpuSeconds: 5 },
  ];
  const sorted = model.parseTopConsumers(raw);
  assert.equal(sorted.length, 3);
  assert.equal(sorted[0].name, 'app_high');
  assert.equal(sorted[0].memoryMB, 500);
  assert.equal(sorted[1].name, 'app_mid');
  assert.equal(sorted[2].name, 'app_low');
});

/* =========================================================================
 * ARCHITECTURAL INTEGRATION (ServiceApps & Components)
 * ========================================================================= */

test('Station 08: PerformanceStation and PerformanceHeroVisual components exist', () => {
  assert.ok(fs.existsSync(path.join(WEB_ROOT, 'src', 'features', 'stations', 'station08', 'PerformanceStation.tsx')));
  assert.ok(fs.existsSync(path.join(WEB_ROOT, 'src', 'features', 'stations', 'station08', 'PerformanceHeroVisual.tsx')));
  assert.ok(fs.existsSync(path.join(WEB_ROOT, 'src', 'features', 'stations', 'station08', 'performanceModel.ts')));
});

test('Station 08: ServiceApps routes activeSection performance directly to PerformanceStation', () => {
  const serviceAppsCode = readWeb('src/components/ServiceApps.tsx');
  assert.match(serviceAppsCode, /import\s+PerformanceStation\s+from/);
  assert.match(serviceAppsCode, /activeSection === ['"]performance['"]/);
  assert.match(serviceAppsCode, /<PerformanceStation/);
});
