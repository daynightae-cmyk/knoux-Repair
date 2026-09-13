import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(WEB_ROOT, '..');
const read = (relative) => fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');
const manifest = JSON.parse(read('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, '')).filter((tool) => tool.Category === '01-System-Maintenance');

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station01-care-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src/features/stations/station01/maintenanceModel.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'error',
});
const model = await import(pathToFileURL(bundlePath).href);
try { fs.unlinkSync(bundlePath); } catch { /* best effort */ }

function runResult(toolId, status, verificationResult, restartNeeded = false) {
  return {
    toolId, toolName: toolId, mode: 'run', status: status === 'INCONCLUSIVE' ? 'inconclusive' : status === 'FAILED' ? 'error' : 'success',
    exitCode: status === 'FAILED' ? 1 : 0, startedAt: '2026-09-13T00:00:00Z', finishedAt: '2026-09-13T00:01:00Z', lines: [], error: null,
    result: { toolId, status, verificationResult, finishedAt: '2026-09-13T00:01:00Z', changedSystem: false, restartNeeded },
  };
}

test('care scan plan contains checks only and preserves canonical order', () => {
  const checks = model.availableScanChecks(manifest);
  assert.deepEqual(checks.map((check) => check.toolId), ['SM01', 'SM03', 'SM04', 'SM08', 'SM06', 'SM10']);
  assert.ok(checks.every((check) => manifest.find((tool) => tool.ToolId === check.toolId)?.ScriptPath));
  assert.ok(checks.every((check) => !['SM02', 'SM05', 'SM07', 'SM09'].includes(check.toolId)));
  const selected = [checks[4].id, checks[0].id, checks[5].id];
  assert.deepEqual(model.buildScanPlan(selected, manifest).map((step) => step.toolId), ['SM01', 'SM06', 'SM10']);
});

test('care findings require explicit deterministic evidence', () => {
  const corruption = { SM04: model.evidenceFromRun(runResult('SM04', 'WARNING', 'CORRUPTION_FOUND')) };
  assert.deepEqual(model.buildRecommendations(corruption, manifest).map((item) => item.toolId), ['SM05']);
  const commandFailure = { SM04: model.evidenceFromRun(runResult('SM04', 'FAILED', 'FAILED')) };
  assert.deepEqual(model.buildRecommendations(commandFailure, manifest), []);
  const diskErrors = { SM06: model.evidenceFromRun(runResult('SM06', 'WARNING', 'ERRORS_FOUND')) };
  assert.deepEqual(model.buildRecommendations(diskErrors, manifest).map((item) => item.toolId), ['SM07']);
});

test('care check state never converts failure or uncertainty into clean', () => {
  const check = model.MAINTENANCE_SCAN_CHECKS.find((item) => item.toolId === 'SM04');
  assert.equal(model.deriveCheckState(check, {}, []), 'READY');
  assert.equal(model.deriveCheckState(check, {}, ['SM04']), 'RUNNING');
  assert.equal(model.deriveCheckState(check, { SM04: model.evidenceFromRun(runResult('SM04', 'SUCCESS', 'OK')) }, []), 'CLEAR');
  assert.equal(model.deriveCheckState(check, { SM04: model.evidenceFromRun(runResult('SM04', 'WARNING', 'CORRUPTION_FOUND')) }, []), 'FINDING');
  assert.equal(model.deriveCheckState(check, { SM04: model.evidenceFromRun(runResult('SM04', 'INCONCLUSIVE', 'RESULT_NOT_CLASSIFIED')) }, []), 'INCONCLUSIVE');
  assert.equal(model.deriveCheckState(check, { SM04: model.evidenceFromRun(runResult('SM04', 'FAILED', 'FAILED')) }, []), 'FAILED');
});

test('overall health requires evidence coverage across every documented minimum domain', () => {
  const contextOnly = { SM10: model.evidenceFromRun(runResult('SM10', 'SUCCESS', 'OK')) };
  assert.equal(model.deriveHealthState(contextOnly, [], true), 'PARTIALLY_CHECKED');
  const complete = Object.fromEntries([
    ['SM01', 'OK'], ['SM03', 'OK'], ['SM06', 'OK'], ['SM10', 'OK'],
  ].map(([toolId, result]) => [toolId, model.evidenceFromRun(runResult(toolId, 'SUCCESS', result))]));
  assert.equal(model.deriveHealthState(complete, [], true), 'HEALTHY');
  delete complete.SM03;
  assert.equal(model.deriveHealthState(complete, [], true), 'PARTIALLY_CHECKED');
});

test('repair completion is deny-by-default for cancelled and all unverified terminal states', () => {
  assert.equal(model.isVerifiedRepairCompletion(model.evidenceFromRun(runResult('SM02', 'SUCCESS', 'REPAIRED_VERIFIED'))), true);
  assert.equal(model.isVerifiedRepairCompletion(model.evidenceFromRun(runResult('SM05', 'SUCCESS', 'OK'))), true);
  assert.equal(model.isVerifiedRepairCompletion(model.evidenceFromRun(runResult('SM02', 'CANCELLED', 'CANCELLED'))), false);
  assert.equal(model.isVerifiedRepairCompletion(model.evidenceFromRun(runResult('SM07', 'WARNING', 'SCHEDULED', true))), false);
  assert.equal(model.isVerifiedRepairCompletion(model.evidenceFromRun(runResult('SM02', 'SUCCESS', 'REPAIRED_VERIFIED', true))), false);
  assert.equal(model.isVerifiedRepairCompletion(model.evidenceFromRun(runResult('SM02', 'SUCCESS', 'UNKNOWN'))), false);
  const bridgeCancelled = runResult('SM02', 'CANCELLED', 'CANCELLED');
  bridgeCancelled.status = 'cancelled';
  bridgeCancelled.result = null;
  assert.equal(model.evidenceFromRun(bridgeCancelled).status, 'CANCELLED');
  const bridgeError = { ...bridgeCancelled, status: 'error', error: 'bridge failure' };
  assert.equal(model.evidenceFromRun(bridgeError).status, 'FAILED');
  const unstructuredSuccess = { ...bridgeCancelled, status: 'success' };
  assert.equal(model.evidenceFromRun(unstructuredSuccess).status, 'INCONCLUSIVE');
});

test('recovery acknowledgement is distinct evidence and is never asserted implicitly', () => {
  for (const toolId of ['SM02', 'SM05', 'SM07']) {
    assert.match(manifest.find((tool) => tool.ToolId === toolId).BackupMethod, /^None\b/i);
  }
  const station = read('web-frontend/src/features/stations/station01/MaintenanceStation.tsx');
  const genericDialog = read('web-frontend/src/components/ExecutionConfirmDialog.tsx');
  assert.doesNotMatch(station, /acknowledgedRecovery:\s*true/);
  assert.match(station, /requiresRecoveryAcknowledgement \? \{ acknowledgedRecovery: recoveryAcknowledged \} : \{\}/);
  assert.match(genericDialog, /requiresRecoveryAcknowledgement \|\| recoveryAcknowledged/);
  assert.match(genericDialog, /acknowledgedRecovery: recoveryAcknowledged/);
});

test('DISM engine classifies evidence and gates RestoreHealth', () => {
  for (const relative of ['01-System-Maintenance/SM03-CheckComponentStore.ps1', '01-System-Maintenance/SM04-ScanSystemImage.ps1']) {
    const source = read(relative);
    assert.match(source, /'\/English'/);
    assert.match(source, /CORRUPTION_FOUND/);
    assert.match(source, /CORRUPTION_UNREPAIRABLE/);
    assert.match(source, /RESULT_NOT_CLASSIFIED/);
  }
  const repair = read('01-System-Maintenance/SM05-RepairSystemImage.ps1');
  assert.match(repair, /if \(\$needsRepair\)/);
  assert.match(repair, /NO_REPAIR_NEEDED/);
  assert.match(repair, /CORRUPTION_REMAINS/);
});

test('care UI exposes selection, review, typed repair confirmation, AI off, and no raw tool grid', () => {
  const source = read('web-frontend/src/features/stations/station01/MaintenanceStation.tsx');
  for (const state of ['CONFIGURE', 'SCANNING', 'REVIEW', 'APPLYING', 'COMPLETE', 'PARTIAL']) assert.match(source, new RegExp(state));
  assert.match(source, /buildScanPlan\(selectedChecks/);
  assert.match(source, /selectedRepairs/);
  assert.match(source, /confirmPhrase\.trim\(\)\.toUpperCase\(\) !== 'CONFIRM'/);
  assert.match(source, /isVerifiedRepairCompletion\(after\)/);
  assert.match(source, /requiresRecoveryAcknowledgement \? \{ acknowledgedRecovery: recoveryAcknowledged \} : \{\}/);
  assert.doesNotMatch(source, /acknowledgedRecovery:\s*true/);
  assert.match(source, /setAiEnabled\(false\)/);
  assert.doesNotMatch(source, /maint-op-actions|Specialized operations/);
  assert.doesNotMatch(source, /Math\.random|setTimeout\(\(\) => complete|fake progress/i);
});
