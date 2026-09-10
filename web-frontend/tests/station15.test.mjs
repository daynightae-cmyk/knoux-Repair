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

const STATION15_IDS = ['MO01', 'MO02', 'MO03', 'MO04'];

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station15-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station15', 'monitoringModel.ts')],
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

test('Station 15: manifest inventory is exactly 4 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '15-System-Monitoring');
  assert.equal(station.length, 4, 'Station 15 must have exactly 4 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION15_IDS].sort(),
    'Station 15 ToolIds must match manifest contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve on disk`);
  }
});

test('Station 15: risk levels and admin requirements match safety architecture', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  for (const toolId of STATION15_IDS) {
    const tool = manifest.find((t) => t.ToolId === toolId);
    assert.equal(tool.RiskLevel, 'READ_ONLY', `${toolId} must be READ_ONLY`);
    assert.equal(tool.RequiresAdmin, false, `${toolId} must not require admin`);
  }
});

/* =========================================================================
 * DOMAIN MODEL DETERMINISTIC DERIVATIONS
 * ========================================================================= */

test('Station 15: deriveObservatoryCondition evaluates condition truthfully', () => {
  assert.equal(model.deriveObservatoryCondition(1, 0), 'CRITICAL_BOTTLENECK');
  assert.equal(model.deriveObservatoryCondition(0, 6), 'ELEVATED_LOAD');
  assert.equal(model.deriveObservatoryCondition(0, 2), 'NOMINAL');
});

test('Station 15: summarizeObservatory computes metrics truthfully', () => {
  const preview = {
    CapturedAt: '2026-09-10T12:00:00Z',
    Services: {
      Total: 250,
      Running: 180,
      Stopped: 70,
      Automatic: 190,
      AutomaticStoppedForReview: [{ Name: 'wuauserv', DisplayName: 'Windows Update', Status: 'Stopped', StartMode: 'Auto', ProcessId: 0 }],
    },
    Processes: {
      Total: 140,
      NotResponding: 0,
      TopMemory: [
        { Name: 'chrome.exe', ProcessId: 1024, MemoryMB: 650, CpuSeconds: 120, Responding: true },
        { Name: 'node.exe', ProcessId: 2048, MemoryMB: 320, CpuSeconds: 45, Responding: true },
      ],
      TopCpuTime: [],
      NotRespondingForReview: [],
    },
    Safety: { ChangesMade: false, Sources: [], Notice: '' },
  };

  const summary = model.summarizeObservatory(preview);
  assert.equal(summary.condition, 'NOMINAL');
  assert.equal(summary.totalProcesses, 140);
  assert.equal(summary.unresponsiveCount, 0);
  assert.equal(summary.topMemoryProcessName, 'chrome.exe');
  assert.equal(summary.topMemoryMB, 650);
  assert.equal(summary.runningServices, 180);
  assert.equal(summary.stoppedAutomaticServices, 1);
});

test('Station 15: detectObservatorySignals identifies unresponsive tasks and stopped services', () => {
  const preview = {
    CapturedAt: '2026-09-10T12:00:00Z',
    Services: {
      Total: 10,
      Running: 8,
      Stopped: 2,
      Automatic: 9,
      AutomaticStoppedForReview: [{ Name: 'Spooler', DisplayName: 'Print Spooler', Status: 'Stopped', StartMode: 'Auto', ProcessId: 0 }],
    },
    Processes: {
      Total: 50,
      NotResponding: 1,
      TopMemory: [{ Name: 'heavy.exe', ProcessId: 9999, MemoryMB: 2000, CpuSeconds: 900, Responding: false }],
      TopCpuTime: [],
      NotRespondingForReview: [{ Name: 'heavy.exe', ProcessId: 9999, MemoryMB: 2000, CpuSeconds: 900, Responding: false }],
    },
    Safety: { ChangesMade: false, Sources: [], Notice: '' },
  };

  const signals = model.detectObservatorySignals(preview);
  assert.ok(signals.some((s) => s.code === 'MONITORING_NOT_RESPONDING'));
  assert.ok(signals.some((s) => s.code === 'MONITORING_AUTO_SERVICE_STOPPED'));
  assert.ok(signals.some((s) => s.code === 'MONITORING_HEAVY_MEMORY_CONSUMER'));
});

test('Station 15: filterProcessesByName filters by name or PID', () => {
  const processes = [
    { Name: 'code.exe', ProcessId: 4400, MemoryMB: 200, CpuSeconds: 10, Responding: true },
    { Name: 'pwsh.exe', ProcessId: 8800, MemoryMB: 150, CpuSeconds: 5, Responding: true },
  ];

  const filteredByName = model.filterProcessesByName(processes, 'code');
  assert.equal(filteredByName.length, 1);
  assert.equal(filteredByName[0].Name, 'code.exe');

  const filteredByPid = model.filterProcessesByName(processes, '8800');
  assert.equal(filteredByPid.length, 1);
  assert.equal(filteredByPid[0].Name, 'pwsh.exe');
});
