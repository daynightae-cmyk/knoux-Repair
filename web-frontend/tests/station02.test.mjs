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

const STATION_IDS = ['SC01', 'SC02', 'SC03', 'SC04', 'SC05', 'SC06', 'SC07', 'SC08', 'SC09', 'SC10', 'SC11'];

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station02-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station02', 'cleanupModel.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'error',
});
const model = await import(pathToFileURL(bundlePath).href);
try { fs.unlinkSync(bundlePath); } catch { /* non-critical */ }

// ---------- inventory ----------

test('Station 02: manifest inventory is exactly the 11 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '02-System-Cleanup');
  assert.equal(station.length, 11, 'Station 02 must have 11 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION_IDS].sort(),
    'Station 02 ToolIds must match the contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve`);
  }
});

test('Station 02: every script honors the analyze/what-if gate and records mode', () => {
  for (const id of STATION_IDS) {
    const entry = [...bridge.manifest.values()].find((tool) => tool.ToolId === id);
    const script = readRepo(entry.ScriptPath);
    // SC11 is read-only by construction (measurement only in every mode),
    // so it proves safety by containing no mutation primitives at all.
    if (id === 'SC11') {
      for (const primitive of ['Remove-Item', 'Clear-RecycleBin', 'Move-KnouxItemToQuarantine', 'Stop-Service', 'Set-Service']) {
        assert.equal(script.includes(primitive), false, `SC11 must not contain ${primitive}`);
      }
      continue;
    }
    // The gate is either an inline branch or delegation to Invoke-KnouxCleanup,
    // which honors AnalyzeOnly/WhatIf itself (never touches the filesystem).
    const hasInlineGate = /(if|elseif)\s*\(\$AnalyzeOnly\s+-or\s+\$WhatIf\)/.test(script);
    const delegatesGate = /-AnalyzeOnly:\$AnalyzeOnly\s+-WhatIf:\$WhatIf/.test(script);
    assert.ok(hasInlineGate || delegatesGate, `${id} must gate AnalyzeOnly/WhatIf inline or via the cleanup helper`);
    assert.match(script, /Start-KnouxSession[^\r\n]*-Mode/, `${id} must record the Core session mode`);
  }
});

test('Station 02: destructive tools require typed confirmation in script', () => {
  for (const [id, phrase] of [['SC02', 'EMPTY BIN'], ['SC10', 'RUN CLEANUP']]) {
    const entry = [...bridge.manifest.values()].find((tool) => tool.ToolId === id);
    const script = readRepo(entry.ScriptPath);
    assert.match(script, /Confirm-KnouxDestructiveAction/, `${id} must use typed confirmation`);
    assert.ok(script.includes(phrase), `${id} must require the phrase ${phrase}`);
  }
});

test('Station 02: quarantine is preferred over permanent delete', () => {
  const quarantineTools = ['SC01', 'SC03', 'SC04', 'SC06', 'SC07', 'SC08', 'SC09', 'SC10'];
  for (const id of quarantineTools) {
    const entry = [...bridge.manifest.values()].find((tool) => tool.ToolId === id);
    const script = readRepo(entry.ScriptPath);
    assert.match(script, /Move-KnouxItemToQuarantine|Invoke-KnouxCleanup/, `${id} must quarantine instead of deleting`);
  }
  // SC02 is the explicit permanent-delete exception with verification.
  const sc02 = readRepo('02-System-Cleanup/SC02-EmptyRecycleBin.ps1');
  assert.match(sc02, /Clear-RecycleBin/, 'SC02 must use Clear-RecycleBin explicitly');
  assert.match(sc02, /verified empty|remaining/, 'SC02 must verify the outcome');
});

// ---------- mode + confirmation guards ----------

test('Station 02: unsupported modes are rejected, run modes are protected', () => {
  assert.equal(bridge.manifest.get('SC05').WhatIfSupported, false);
  assert.equal(bridge.manifest.get('SC11').WhatIfSupported, false);
  assert.throws(() => bridge.createRun('SC05', 'preview', {}), (err) => err.code === 'MODE_NOT_SUPPORTED');
  assert.throws(() => bridge.createRun('SC11', 'preview', {}), (err) => err.code === 'MODE_NOT_SUPPORTED');
  for (const id of ['SC02', 'SC10']) {
    assert.throws(() => bridge.createRun(id, 'run', {}), (err) => err.code === 'CONFIRMATION_REQUIRED', `${id} run must require confirmation`);
  }
  const phrase = bridge.normalizeConfirmation({ confirmed: true, phrase: 'EMPTY BIN', confirmedAt: new Date().toISOString() });
  bridge.validateExecutionRequest({ tool: bridge.manifest.get('SC02'), mode: 'run', confirmation: phrase });
});

// ---------- deterministic domain rules (runtime) ----------

function fakePreview(targets) {
  return {
    CapturedAt: '2026-09-10T00:00:00',
    Targets: targets,
    Drives: [{ Name: 'C:', TotalBytes: 1000, FreeBytes: 400 }],
    Quarantine: { Category: 'q', ToolId: 'QUARANTINE', Path: 'Q', Exists: true, FileCount: 1, SizeBytes: 10, UserDataExcluded: true, Evidence: '' },
    Summary: { TargetCount: targets.length, ExistingTargetCount: targets.length, TotalFiles: 0, EstimatedReclaimableBytes: 0, QuarantineBytes: 10 },
    Safety: { ChangesMade: false, Sources: [], Excluded: ['Documents', 'Downloads'], Notice: '' },
  };
}

function fakeRun(toolId, { status, mode = 'run', quarantined = 0, recovered = 0, deleted = 0 } = {}) {
  return {
    toolId, toolName: toolId, mode, status: 'success', exitCode: 0,
    startedAt: '2026-09-10T00:00:00', finishedAt: '2026-09-10T00:01:00', lines: [], error: null,
    result: {
      runId: 'r', toolId, category: '02-System-Cleanup', mode, status,
      startedAt: '2026-09-10T00:00:00', finishedAt: '2026-09-10T00:01:00', durationMs: 1000,
      changedSystem: recovered > 0, restartNeeded: false,
      itemsFound: 3, itemsProcessed: quarantined, skippedCount: 0, quarantinedCount: quarantined,
      bytesPotentiallyRecoverable: 100, bytesQuarantined: recovered, bytesPermanentlyDeleted: deleted,
      bytesActuallyRecovered: recovered, bytesMoved: 0,
      backupPath: null, quarantinePath: null, verificationPerformed: true, verificationResult: 'OK',
      exitCode: 0, errorCode: null, errorMessage: null, evidence: null, rawOutput: null, reportPath: `Reports/x-${toolId}`,
    },
  };
}

test('Station 02: preview targets classify into honest groups', () => {
  const { groups, unmatched } = model.classifyPreview(fakePreview([
    { Category: 'User temp', ToolId: 'SC01', Path: 'C:\\T', Exists: true, FileCount: 5, SizeBytes: 500, UserDataExcluded: true, Evidence: '' },
    { Category: 'Chrome cache', ToolId: 'SC03', Path: 'C:\\C', Exists: true, FileCount: 7, SizeBytes: 700, UserDataExcluded: true, Evidence: '' },
    { Category: 'npm cache', ToolId: 'SW04', Path: 'C:\\N', Exists: true, FileCount: 2, SizeBytes: 200, UserDataExcluded: true, Evidence: '' },
    { Category: 'Mystery zone', ToolId: 'XX', Path: 'C:\\M', Exists: true, FileCount: 1, SizeBytes: 100, UserDataExcluded: true, Evidence: '' },
  ]));
  assert.equal(groups['user-temp'].files, 5);
  assert.equal(groups['user-temp'].bytes, 500);
  assert.equal(groups['browser-cache'].files, 7);
  assert.equal(groups['dev-caches'].files, 2);
  assert.equal(unmatched.length, 1, 'unmapped targets must stay visible, never dropped');
  assert.equal(model.selectedBytes(['user-temp', 'browser-cache'], groups), 1200);
});

test('Station 02: recovered bytes never confuse estimates with results', () => {
  const outcome = model.outcomeFromRun(fakeRun('SC03', { status: 'SUCCESS', quarantined: 4, recovered: 400 }));
  assert.equal(model.actualRecoveredBytes(outcome), 400);
  assert.equal(outcome.bytesPotentiallyRecoverable, 100);
  assert.notEqual(model.actualRecoveredBytes(outcome), outcome.bytesPotentiallyRecoverable);
});

test('Station 02: state machine separates scan, clean, partial, and offline truth', () => {
  const groups = { a: { groupId: 'a', files: 3, bytes: 300, exists: true, paths: [] } };
  assert.equal(model.deriveCleanupState({ bridgeOnline: false, scanning: false, cleaning: false, preview: fakePreview([]), groups: {}, outcomes: [] }), 'ENGINE_OFFLINE');
  assert.equal(model.deriveCleanupState({ bridgeOnline: true, scanning: false, cleaning: false, preview: null, groups: {}, outcomes: [] }), 'NOT_SCANNED');
  assert.equal(model.deriveCleanupState({ bridgeOnline: true, scanning: true, cleaning: false, preview: null, groups: {}, outcomes: [] }), 'SCANNING');
  assert.equal(model.deriveCleanupState({ bridgeOnline: true, scanning: false, cleaning: true, preview: fakePreview([]), groups, outcomes: [] }), 'CLEANING');
  assert.equal(model.deriveCleanupState({ bridgeOnline: true, scanning: false, cleaning: false, preview: fakePreview([]), groups: {}, outcomes: [] }), 'NOTHING_SAFE');
  assert.equal(
    model.deriveCleanupState({ bridgeOnline: true, scanning: false, cleaning: false, preview: fakePreview([]), groups, outcomes: [] }),
    'CANDIDATES_FOUND',
  );
  const ok = [model.outcomeFromRun(fakeRun('SC01', { status: 'SUCCESS', quarantined: 2, recovered: 200 }))];
  assert.equal(model.deriveCleanupState({ bridgeOnline: true, scanning: false, cleaning: false, preview: fakePreview([]), groups, outcomes: ok }), 'VERIFIED');
  const mixed = [...ok, model.outcomeFromRun(fakeRun('SC03', { status: 'WARNING' }))];
  assert.equal(model.deriveCleanupState({ bridgeOnline: true, scanning: false, cleaning: false, preview: fakePreview([]), groups, outcomes: mixed }), 'PARTIAL');
  const failed = [model.outcomeFromRun(fakeRun('SC06', { status: 'FAILED' }))];
  assert.equal(model.deriveCleanupState({ bridgeOnline: true, scanning: false, cleaning: false, preview: fakePreview([]), groups, outcomes: failed }), 'FAILED');
  const cancelled = [model.outcomeFromRun(fakeRun('SC01', { status: 'CANCELLED' }))];
  assert.equal(model.deriveCleanupState({ bridgeOnline: true, scanning: false, cleaning: false, preview: fakePreview([]), groups, outcomes: cancelled }), 'REVIEW_REQUIRED');
});

test('Station 02: cancelled and inconclusive are never reported as success', () => {
  assert.equal(model.outcomeFromRun(fakeRun('SC01', { status: 'CANCELLED' })).status, 'CANCELLED');
  assert.equal(model.outcomeFromRun(fakeRun('SC01', { status: 'INCONCLUSIVE' })).status, 'INCONCLUSIVE');
});

test('Station 02: cleanup plan contains only reviewed tools in run mode', () => {
  const defs = {};
  for (const def of model.CLEANUP_GROUPS) defs[def.id] = def;
  const plan = model.buildCleanupPlan(['user-temp', 'recycle-bin', 'dev-caches'], defs);
  assert.deepEqual(plan.map((step) => step.toolId), ['SC01', 'SC02']);
  assert.ok(plan.every((step) => step.mode === 'run'));
  // Conservative defaults: safe on, everything else off.
  const defaults = model.CLEANUP_GROUPS.filter((def) => def.defaultSelected).map((def) => def.id);
  assert.deepEqual(defaults.sort(), ['browser-cache', 'thumbnails', 'user-temp']);
});

test('Station 02: report separates estimates from executed results', () => {
  const { groups } = model.classifyPreview(fakePreview([
    { Category: 'User temp', ToolId: 'SC01', Path: 'C:\\T', Exists: true, FileCount: 5, SizeBytes: 500, UserDataExcluded: true, Evidence: '' },
  ]));
  const outcomes = [model.outcomeFromRun(fakeRun('SC01', { status: 'SUCCESS', quarantined: 5, recovered: 500 }))];
  const history = model.appendHistory([], {
    kind: 'cleanup', toolId: 'SC01', mode: 'run', status: 'SUCCESS', candidateBytes: 500,
    selectedBytes: 500, recoveredBytes: 500, quarantined: 5, deleted: 0, skipped: 0, failed: 0,
    verification: 'OK', reportPath: 'Reports/x', finishedAt: '2026-09-10T00:01:00',
  });
  assert.equal(history.length, 1);
  const report = model.buildCleanupReport({
    groups, unmatched: [], selected: ['user-temp'], outcomes, history,
    diskFreeBefore: 400, diskFreeAfter: 900, protectedExclusions: ['Documents'], lang: 'en',
  });
  assert.match(report, /user-temp/);
  assert.match(report, /quarantined 5/);
  assert.match(report, /Estimates are not recovery/);
  const empty = model.buildCleanupReport({
    groups: {}, unmatched: [], selected: [], outcomes: [], history: [],
    diskFreeBefore: null, diskFreeAfter: null, protectedExclusions: [], lang: 'ar',
  });
  assert.match(empty, /لم يتم تنفيذ/);
});

// ---------- product surface ----------

test('Station 02: UI keeps the Space Cleaner identity without fabricated numbers', () => {
  const station = readWeb('src/features/stations/station02/CleanupStation.tsx');
  const modelSource = readWeb('src/features/stations/station02/cleanupModel.ts');
  assert.match(station, /CLEANUP PLAN/, 'station must keep the Cleanup Plan identity');
  for (const source of [station, modelSource]) {
    assert.equal(/Math\.random/.test(source), false, 'no random telemetry');
    assert.equal(/4\.2\s*GB|4200/.test(source), false, 'no decorative cleanup values');
  }
  for (const state of ['NOT_SCANNED', 'CANDIDATES_FOUND', 'NOTHING_SAFE', 'VERIFIED', 'PARTIAL', 'ENGINE_OFFLINE']) {
    assert.ok(station.includes(state), `station must model ${state}`);
  }
  assert.ok(station.includes('Potentially recoverable') || station.includes('potentiallyRecoverable'), 'byte roles must be explicit');
});

test('Station 02: offline renders the shared offline state, never zero bytes', () => {
  const station = readWeb('src/features/stations/station02/CleanupStation.tsx');
  assert.match(station, /StationOfflineState/, 'station must use the shared offline state');
  assert.equal(/0 B recoverable/.test(station), false, 'station must never show 0 B as offline state');
});

test('Station 02: Arabic and English labels are both present', () => {
  const station = readWeb('src/features/stations/station02/CleanupStation.tsx');
  for (const label of ['فحص الملفات القابلة للتنظيف', 'مساحة محتمل استردادها', 'المساحة المستردة فعليًا', 'محمي', 'تم نقله إلى العزل', 'تم التخطي']) {
    assert.ok(station.includes(label), `station must include Arabic label: ${label}`);
  }
  assert.match(station, /dir=\{lang === 'ar' \? 'rtl' : 'ltr'\}/, 'station must switch direction');
});
