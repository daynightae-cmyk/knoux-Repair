import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const WEB_ROOT = path.join(REPO_ROOT, 'web-frontend');

function readRepo(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function readWeb(relativePath) {
  return fs.readFileSync(path.join(WEB_ROOT, relativePath), 'utf8');
}

const bridge = await import('../server/bridge.mjs');

const STATION_IDS = ['SM01', 'SM02', 'SM03', 'SM04', 'SM05', 'SM06', 'SM07', 'SM08', 'SM09', 'SM10'];

// Bundle the pure domain model so its deterministic rules run under test.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station01-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station01', 'maintenanceModel.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'error',
});
const model = await import(pathToFileURL(bundlePath).href);
try { fs.unlinkSync(bundlePath); } catch { /* non-critical */ }

// ---------- inventory ----------

test('Station 01: manifest inventory is exactly the 10 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '01-System-Maintenance');
  assert.equal(station.length, 10, 'Station 01 must have 10 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION_IDS].sort(),
    'Station 01 ToolIds must match the contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve`);
  }
});

test('Station 01: every script honors the analyze/what-if gate', () => {
  for (const id of STATION_IDS) {
    const entry = [...bridge.manifest.values()].find((tool) => tool.ToolId === id);
    const script = readRepo(entry.ScriptPath);
    assert.match(script, /(if|elseif)\s*\(\$AnalyzeOnly\s+-or\s+\$WhatIf\)/, `${id} must branch on AnalyzeOnly/WhatIf`);
    assert.match(script, /Start-KnouxSession[^\r\n]*-Mode/, `${id} must record the Core session mode`);
  }
});

test('Station 01: SM10 analyze mode previews without generating a report', () => {
  const script = readRepo('01-System-Maintenance/SM10-SystemMaintenanceReport.ps1');
  assert.match(script, /Analyze mode: report collection preview only/, 'SM10 must preview in analyze mode');
});

// ---------- mode plumbing ----------

test('Station 01: unsupported modes are rejected, supported modes pass validation', () => {
  // Manifest-authoritative: SM10 supports analyze but not preview.
  assert.equal(bridge.manifest.get('SM10').AnalyzeOnlySupported, true);
  assert.equal(bridge.manifest.get('SM10').WhatIfSupported, false);
  assert.throws(() => bridge.createRun('SM10', 'preview', {}), (err) => err.code === 'MODE_NOT_SUPPORTED');
  assert.throws(() => bridge.createRun('SM01', 'destroy', {}), (err) => err.code === 'MODE_NOT_SUPPORTED');
  // BUILD the execution context the bridge forwards for an analyze run.
  const context = bridge.buildExecutionContext({
    runId: 'r', toolId: 'SM03', mode: 'analyze', riskLevel: 'READ_ONLY', options: {}, confirmation: null,
  });
  assert.equal(context.mode, 'analyze');
});

test('Station 01: SYSTEM_REPAIR and above require confirmation evidence', () => {
  for (const id of ['SM01', 'SM02', 'SM05', 'SM07', 'SM09']) {
    assert.throws(() => bridge.createRun(id, 'run', {}), (err) => err.code === 'CONFIRMATION_REQUIRED', `${id} run must require confirmation`);
  }
  const phrase = bridge.normalizeConfirmation({ confirmed: true, phrase: 'CONFIRM', confirmedAt: new Date().toISOString() });
  // Evidence-carrying runs validate past the gate (spawn happens after; not exercised here).
  bridge.validateExecutionRequest({ tool: bridge.manifest.get('SM01'), mode: 'run', confirmation: phrase });
  bridge.validateExecutionRequest({ tool: bridge.manifest.get('SM09'), mode: 'run', confirmation: phrase });
});

// ---------- deterministic domain rules (runtime) ----------

function runResult(toolId, { status, verificationResult = '', errorMessage = '', changedSystem = false, restartNeeded = false, mode = 'run' } = {}) {
  return {
    toolId, toolName: toolId, mode, status: 'success', exitCode: 0,
    startedAt: '2026-09-10T00:00:00', finishedAt: '2026-09-10T00:01:00', lines: [], error: null,
    result: {
      runId: 'r', toolId, category: '01-System-Maintenance', mode, status,
      startedAt: '2026-09-10T00:00:00', finishedAt: '2026-09-10T00:01:00', durationMs: 60000,
      changedSystem, restartNeeded, verificationResult, errorMessage, reportPath: `Reports/x-${toolId}`,
    },
  };
}

test('Station 01: health is categorical and evidence-owned', () => {
  assert.equal(model.deriveHealthState({}, [], true), 'NOT_SCANNED');
  assert.equal(model.deriveHealthState({}, [], false), 'ENGINE_OFFLINE');
  assert.equal(model.deriveHealthState({}, ['SM01'], true), 'CHECKING');
  assert.equal(model.deriveHealthState({}, ['SM02'], true), 'REPAIR_IN_PROGRESS');

  const healthy = { SM01: model.evidenceFromRun(runResult('SM01', { status: 'SUCCESS', verificationResult: 'OK' })) };
  assert.equal(model.deriveHealthState(healthy, [], true), 'HEALTHY');

  const violations = { SM01: model.evidenceFromRun(runResult('SM01', { status: 'WARNING', verificationResult: 'VIOLATIONS_FOUND' })) };
  assert.equal(model.deriveHealthState(violations, [], true), 'REPAIR_RECOMMENDED');

  const inconclusive = { SM01: model.evidenceFromRun(runResult('SM01', { status: 'INCONCLUSIVE', verificationResult: 'NO_CBS_EVIDENCE' })) };
  assert.equal(model.deriveHealthState(inconclusive, [], true), 'INCONCLUSIVE');

  const restart = { SM07: model.evidenceFromRun(runResult('SM07', { status: 'WARNING', verificationResult: 'SCHEDULED', restartNeeded: true })) };
  assert.equal(model.deriveHealthState(restart, [], true), 'RESTART_REQUIRED');

  const denied = { SM01: model.evidenceFromRun(runResult('SM01', { status: 'FAILED', errorMessage: 'Administrator privileges are required to run System File Checker.' })) };
  assert.equal(model.deriveHealthState(denied, [], true), 'PERMISSION_REQUIRED');
});

test('Station 01: recommendations map failures to their supported repair only', () => {
  const tools = STATION_IDS.map((id) => bridge.manifest.get(id));
  assert.deepEqual(model.buildRecommendations({}, tools), [], 'no evidence means no repair recommendation');

  const violations = { SM01: model.evidenceFromRun(runResult('SM01', { status: 'WARNING', verificationResult: 'VIOLATIONS_FOUND' })) };
  const recs = model.buildRecommendations(violations, tools);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].toolId, 'SM02');

  const storeBad = { SM04: model.evidenceFromRun(runResult('SM04', { status: 'FAILED', verificationResult: 'FAILED' })) };
  const recs2 = model.buildRecommendations(storeBad, tools);
  assert.ok(recs2.some((rec) => rec.toolId === 'SM05'), 'store corruption must recommend SM05');

  const diskBad = { SM06: model.evidenceFromRun(runResult('SM06', { status: 'WARNING', verificationResult: 'ERRORS_FOUND' })) };
  const recs3 = model.buildRecommendations(diskBad, tools);
  assert.ok(recs3.some((rec) => rec.toolId === 'SM07'), 'disk errors must recommend SM07');

  // A healthy store must NOT recommend DISM repair.
  const healthyStore = { SM04: model.evidenceFromRun(runResult('SM04', { status: 'SUCCESS', verificationResult: 'OK' })) };
  assert.ok(!model.buildRecommendations(healthyStore, tools).some((rec) => rec.toolId === 'SM05'));
});

test('Station 01: pipeline phases reflect verify/repair/restart truth', () => {
  const files = model.PIPELINE_PHASES.find((phase) => phase.id === 'files');
  assert.deepEqual(files.toolIds, ['SM01', 'SM02']);
  assert.equal(model.derivePhaseState(files, {}, []), 'NOT_CHECKED');
  assert.equal(model.derivePhaseState(files, {}, ['SM01']), 'CHECKING');
  const violations = { SM01: model.evidenceFromRun(runResult('SM01', { status: 'WARNING', verificationResult: 'VIOLATIONS_FOUND' })) };
  assert.equal(model.derivePhaseState(files, violations, []), 'REPAIR_AVAILABLE');
  const repaired = {
    ...violations,
    SM02: model.evidenceFromRun(runResult('SM02', { status: 'SUCCESS', verificationResult: 'REPAIRED_VERIFIED', changedSystem: true })),
  };
  assert.equal(model.derivePhaseState(files, repaired, []), 'REPAIR_COMPLETED');
});

test('Station 01: inconclusive evidence is never reported as success', () => {
  const item = model.evidenceFromRun(runResult('SM01', { status: 'INCONCLUSIVE', verificationResult: 'NO_CBS_EVIDENCE' }));
  assert.equal(item.status, 'INCONCLUSIVE');
  assert.notEqual(item.status, 'SUCCESS');
});

test('Station 01: report is built from measured evidence only', () => {
  const evidence = {
    SM01: model.evidenceFromRun(runResult('SM01', { status: 'WARNING', verificationResult: 'VIOLATIONS_FOUND' })),
  };
  const history = model.appendHistory([], evidence.SM01);
  assert.equal(history.length, 1);
  const report = model.buildMaintenanceReport({
    evidence, history, health: 'REPAIR_RECOMMENDED', osCaption: 'Windows 11', osBuild: '22631', lang: 'en',
  });
  assert.match(report, /SM01/);
  assert.match(report, /VIOLATIONS_FOUND/);
  assert.match(report, /No repair is claimed/);
  const empty = model.buildMaintenanceReport({ evidence: {}, history: [], health: 'NOT_SCANNED', osCaption: '', osBuild: '', lang: 'ar' });
  assert.match(empty, /لم يتم الفحص|لا توجد أدلة/);
});

// ---------- product surface ----------

test('Station 01: UI surface keeps the Health Studio identity without fabricated scores', () => {
  const station = readWeb('src/features/stations/station01/MaintenanceStation.tsx');
  const modelSource = readWeb('src/features/stations/station01/maintenanceModel.ts');
  assert.match(station, /HEALTH STUDIO/, 'station must keep the Health Studio identity');
  for (const source of [station, modelSource]) {
    assert.equal(/Math\.random/.test(source), false, 'no random telemetry');
    assert.equal(/readiness\.score|gaugeDegrees|repair readiness.*\/ 100/i.test(source), false, 'no numeric health score');
    assert.equal(/90%/.test(source), false, 'no arbitrary percentages');
  }
  assert.ok(!/System Healthy/.test(station) || /needs review|Protection needs review/.test(station), 'no blanket healthy claims');
  for (const state of ['NOT_SCANNED', 'REPAIR_RECOMMENDED', 'RESTART_REQUIRED', 'INCONCLUSIVE', 'PERMISSION_REQUIRED', 'ENGINE_OFFLINE']) {
    assert.ok(station.includes(state), `station must model ${state}`);
  }
});

test('Station 01: offline renders the shared offline state, never zero tools', () => {
  const station = readWeb('src/features/stations/station01/MaintenanceStation.tsx');
  assert.match(station, /StationOfflineState/, 'station must use the shared offline state');
  assert.equal(/158\s*(Tools|TOOLS|أداة)/.test(station), false, 'station must not hard-code tool counts');
});

test('Station 01: Arabic and English labels are both present', () => {
  const station = readWeb('src/features/stations/station01/MaintenanceStation.tsx');
  for (const label of ['فحص صحة ويندوز', 'صحة الجهاز', 'مسار السلامة', 'غير حاسم', 'يلزم إعادة التشغيل']) {
    assert.ok(station.includes(label), `station must include Arabic label: ${label}`);
  }
  assert.match(station, /dir=\{lang === 'ar' \? 'rtl' : 'ltr'\}/, 'station must switch direction');
});

test('Station 01: packaged runtime refreshes on code change, not version alone', () => {
  const main = readWeb('desktop/main.cjs');
  assert.match(main, /runtimeFingerprint/, 'Electron must fingerprint the executable runtime surface');
  assert.match(main, /\.glass-nexus-runtime-fingerprint/, 'Electron must persist the runtime fingerprint');
  assert.match(main, /bridge\.mjs/, 'fingerprint must cover the bridge');
  assert.match(main, /TOOLS-MANIFEST\.json/, 'fingerprint must cover the manifest');
});
