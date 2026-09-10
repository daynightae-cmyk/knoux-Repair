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

const STATION10_IDS = [
  'DR01', 'DR02', 'DR03', 'DR04', 'DR05', 'DR06',
  'DR07', 'DR08', 'DR09', 'DR10', 'DR11',
];

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station10-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station10', 'diagnosticsModel.ts')],
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

test('Station 10: manifest inventory is exactly 11 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '10-Diagnostics-Reports');
  assert.equal(station.length, 11, 'Station 10 must have exactly 11 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION10_IDS].sort(),
    'Station 10 ToolIds must match manifest contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve on disk`);
  }
});

test('Station 10: all tools are safe READ_ONLY diagnostic telemetry', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '10-Diagnostics-Reports');
  for (const entry of station) {
    assert.equal(entry.RiskLevel, 'READ_ONLY', `${entry.ToolId} must be READ_ONLY`);
    assert.equal(entry.RequiresAdmin, false, `${entry.ToolId} should not strictly require admin for telemetry`);
  }
});

/* =========================================================================
 * DOMAIN MODEL LOGIC VERIFICATION (diagnosticsModel.ts)
 * ========================================================================= */

test('Station 10: deriveDiagnosticCondition evaluates categorical health without synthetic gamification', () => {
  assert.equal(model.deriveDiagnosticCondition(0, 0, 0, 0), 'HEALTHY');
  assert.equal(model.deriveDiagnosticCondition(15, 0, 0, 0), 'ATTENTION_RECOMMENDED');
  assert.equal(model.deriveDiagnosticCondition(2, 1, 0, 0), 'ATTENTION_RECOMMENDED');
  assert.equal(model.deriveDiagnosticCondition(0, 0, 1, 0), 'ATTENTION_RECOMMENDED');
  assert.equal(model.deriveDiagnosticCondition(0, 0, 0, 1), 'CRITICAL_FINDINGS');
  assert.equal(model.deriveDiagnosticCondition(0, 0, 3, 0), 'CRITICAL_FINDINGS');
  assert.equal(model.deriveDiagnosticCondition(0, 6, 0, 0), 'CRITICAL_FINDINGS');
});

test('Station 10: summarizeDiagnostics normalizes preview metrics', () => {
  const mockPreview = {
    CapturedAt: '2026-09-10T12:00:00Z',
    System: { Os: 'Windows 11', Version: '10.0.22631', Build: '22631', Machine: 'DN-PC', Cpu: 'Ryzen 9', MemoryTotalGB: 32, MemoryFreeGB: 18, MemoryLoadPercent: 43, UptimeHours: 48, BootDurationMs: 12500 },
    Events: { WindowDays: 7, ErrorOrCriticalCount: 5, CriticalCount: 0, Recent: [] },
    Reliability: { WindowDays: 7, RecordsObserved: 12, Recent: [] },
    Devices: { ProblemsObserved: 0, Problems: [] },
    Storage: { DisksObserved: 2, SmartFailurePredicted: 0, Disks: [] },
    Safety: { ChangesMade: false, Sources: [], Notice: 'Safe' },
  };

  const summary = model.summarizeDiagnostics(mockPreview);
  assert.equal(summary.condition, 'HEALTHY');
  assert.equal(summary.errorOrCriticalEvents, 5);
  assert.equal(summary.problemDevices, 0);
  assert.equal(summary.disksMonitored, 2);
  assert.equal(summary.uptimeHours, 48);

  const empty = model.summarizeDiagnostics(null);
  assert.equal(empty.condition, 'INCONCLUSIVE');
  assert.equal(empty.errorOrCriticalEvents, 0);
});

test('Station 10: parseProblemDevices and parseDiskSmart handle real hardware signals', () => {
  const devices = model.parseProblemDevices([
    { Name: 'Faulty Driver', DeviceID: 'PCI\\VEN_10DE', Status: 'Error', ConfigManagerErrorCode: 43, ErrorDescription: 'Device stopped' },
    { Name: 'Minor Port', DeviceID: 'USB\\VID_0000', Status: 'Warning', ConfigManagerErrorCode: 1, ErrorDescription: 'Unknown problem' },
  ]);
  assert.equal(devices.length, 2);
  assert.equal(devices[0].isCritical, true);
  assert.equal(devices[1].isCritical, false);

  const disks = model.parseDiskSmart([
    { Model: 'Samsung 980 Pro', Index: 0, SizeGB: 1000, SmartAvailable: true, PredictFailure: false },
    { Model: 'Dying HDD', Index: 1, SizeGB: 2000, SmartAvailable: true, PredictFailure: true },
    { Model: 'Generic Flash', Index: 2, SizeGB: 32, SmartAvailable: false, PredictFailure: false },
  ]);
  assert.equal(disks[0].status, 'HEALTHY');
  assert.equal(disks[1].status, 'PREDICTED_FAILURE');
  assert.equal(disks[2].status, 'UNAVAILABLE');
});

test('Station 10: detectDiagnosticSignals cites actionable tools', () => {
  const signals = model.detectDiagnosticSignals({
    condition: 'CRITICAL_FINDINGS',
    errorOrCriticalEvents: 20,
    criticalEvents: 3,
    problemDevices: 2,
    smartPredictedFailures: 1,
    disksMonitored: 2,
    reliabilityRecords: 5,
    bootDurationMs: 75000,
    uptimeHours: 120,
  });

  assert.ok(signals.some((s) => s.code === 'SMART_FAILURE_PREDICTED' && s.suggestedTool === 'DR08'));
  assert.ok(signals.some((s) => s.code === 'DEVICE_MANAGER_PROBLEMS' && s.suggestedTool === 'DR05'));
  assert.ok(signals.some((s) => s.code === 'CRITICAL_EVENT_LOGS' && s.suggestedTool === 'DR03'));
  assert.ok(signals.some((s) => s.code === 'PROLONGED_BOOT_TIME' && s.suggestedTool === 'DR06'));
});

/* =========================================================================
 * COMPONENT & ROUTING INTEGRATION
 * ========================================================================= */

test('Station 10: DiagnosticsStation and DiagnosticsHeroVisual components exist', () => {
  const stationSrc = readWeb('src/features/stations/station10/DiagnosticsStation.tsx');
  assert.ok(stationSrc.includes('export default function DiagnosticsStation'), 'DiagnosticsStation component must be exported');
  assert.ok(stationSrc.includes('DR01–DR11'), 'Must cite Station 10 tool range');

  const heroSrc = readWeb('src/features/stations/station10/DiagnosticsHeroVisual.tsx');
  assert.ok(heroSrc.includes('export default function DiagnosticsHeroVisual'), 'DiagnosticsHeroVisual component must be exported');
});

test('Station 10: ServiceApps routes activeSection diagnostics directly to DiagnosticsStation', () => {
  const src = readWeb('src/components/ServiceApps.tsx');
  assert.ok(src.includes("activeSection === 'diagnostics'"), 'ServiceApps must route activeSection diagnostics');
  assert.ok(src.includes('<DiagnosticsStation'), 'ServiceApps must render DiagnosticsStation');
});
