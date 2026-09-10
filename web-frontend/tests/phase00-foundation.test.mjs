import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// ---------- Core / Config / Manifest existence ----------

test('Phase 00: Core four modules plus Config and Contracts exist', () => {
  for (const file of [
    'Core/KnouxRepair.Core.psm1',
    'Core/KnouxRepair.Safety.psm1',
    'Core/KnouxRepair.NativeCommands.psm1',
    'Core/KnouxRepair.Reporting.psm1',
    'Core/KnouxRepair.Config.psm1',
    'Core/KnouxRepair.Contracts.psm1',
  ]) {
    assert.equal(fs.existsSync(path.join(REPO_ROOT, file)), true, `${file} must exist`);
  }
  for (const file of ['Config/protected-paths.json', 'Config/protected-processes.json', 'Config/settings.json', 'Config/menus.json']) {
    const parsed = JSON.parse(readRepo(file).replace(/^\uFEFF/, ''));
    assert.ok(parsed, `${file} must parse as JSON`);
  }
});

test('Phase 00: manifest declares 158 tools with zero missing scripts and zero duplicates', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  assert.equal(manifest.length, 158, 'ManifestDeclared must be 158');
  const ids = manifest.map((entry) => entry.ToolId);
  const scriptPaths = manifest.map((entry) => entry.ScriptPath);
  assert.equal(new Set(ids).size, 158, 'DuplicateToolIds must be 0');
  assert.equal(new Set(scriptPaths).size, 158, 'DuplicateScriptPaths must be 0');
  const missing = manifest.filter((entry) => !fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)));
  assert.equal(missing.length, 0, `MissingScripts must be 0 (first: ${JSON.stringify(missing.slice(0, 3))})`);
});

test('Phase 00: category registry covers 18 categories and sums to 158', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const counts = new Map();
  for (const entry of manifest) counts.set(entry.Category, (counts.get(entry.Category) || 0) + 1);
  assert.equal(counts.size, 18, 'must have 18 categories');
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  assert.equal(total, 158, 'category counts must sum to 158');
  const menus = JSON.parse(readRepo('Config/menus.json').replace(/^\uFEFF/, ''));
  assert.equal(menus.length, 18, 'menus.json must have 18 categories');
  const menuTools = menus.reduce((sum, category) => sum + category.Tools.length, 0);
  assert.equal(menuTools, 158, 'menu entries must total 158');
});

// ---------- Confirmation safety ----------

test('Phase 00: Core confirmation is deny-by-default with no host-flag bypass', () => {
  const core = readRepo('Core/KnouxRepair.Core.psm1');
  assert.equal(core.includes('KNOUX_WPF_HOST'), false, 'Core must not reference KNOUX_WPF_HOST');
  assert.match(core, /Test-KnouxExecutionConfirmation/, 'Core must expose the authoritative confirmation check');
  assert.match(core, /Get-KnouxExecutionContext/, 'Core must read the validated bridge execution context');
  assert.match(core, /KNOUX_EXECUTION_CONTEXT/, 'Core must consume KNOUX_EXECUTION_CONTEXT');
  assert.match(core, /DENY-BY-DEFAULT|deny-by-default/i, 'Core must document deny-by-default');
  assert.match(core, /WINRE_ONLY/, 'Core must handle WINRE_ONLY');
  // No unconditional approval: the destructive gate must be able to deny.
  assert.match(core, /Destructive confirmation denied/, 'destructive gate must have a denial path');
});

test('Phase 00: bridge validates confirmation evidence against the risk matrix', () => {
  const { validateExecutionRequest, normalizeConfirmation } = bridge;
  const readOnly = { ToolId: 'T', EnglishName: 'T', RiskLevel: 'READ_ONLY' };
  const repair = { ToolId: 'T', EnglishName: 'T', RiskLevel: 'SYSTEM_REPAIR' };
  const destructive = { ToolId: 'T', EnglishName: 'T', RiskLevel: 'DESTRUCTIVE' };
  const winre = { ToolId: 'T', EnglishName: 'T', RiskLevel: 'WINRE_ONLY' };

  assert.equal(normalizeConfirmation(null), null);
  assert.equal(normalizeConfirmation('yes'), null);

  // READ_ONLY analyze/run passes without evidence.
  validateExecutionRequest({ tool: readOnly, mode: 'run', confirmation: null });
  // SYSTEM_REPAIR run without evidence is rejected.
  assert.throws(
    () => validateExecutionRequest({ tool: repair, mode: 'run', confirmation: null }),
    (err) => err.code === 'CONFIRMATION_REQUIRED',
  );
  // Confirmed but phraseless is rejected.
  assert.throws(
    () => validateExecutionRequest({ tool: destructive, mode: 'run', confirmation: normalizeConfirmation({ confirmed: true }) }),
    (err) => err.code === 'CONFIRMATION_PHRASE_REQUIRED',
  );
  // Phrase evidence passes.
  validateExecutionRequest({
    tool: destructive, mode: 'run', confirmation: normalizeConfirmation({ confirmed: true, phrase: 'CONFIRM' }),
  });
  // WINRE_ONLY never executes online.
  assert.throws(
    () => validateExecutionRequest({ tool: winre, mode: 'analyze', confirmation: normalizeConfirmation({ confirmed: true, phrase: 'X' }) }),
    (err) => err.code === 'WINRE_ONLY_ONLINE_BLOCKED',
  );
});

test('Phase 00: ExecutionRequest envelope carries confirmation evidence', () => {
  const { buildExecutionContext } = bridge;
  const confirmation = { confirmed: true, phrase: 'CONFIRM', acknowledgedRecovery: true, confirmedAt: '2026-09-10T00:00:00' };
  const context = buildExecutionContext({ runId: 'r1', toolId: 'SM01', mode: 'run', riskLevel: 'SYSTEM_REPAIR', options: {}, confirmation });
  assert.equal(context.runId, 'r1');
  assert.equal(context.toolId, 'SM01');
  assert.equal(context.mode, 'run');
  assert.equal(context.riskLevel, 'SYSTEM_REPAIR');
  assert.deepEqual(context.confirmation, confirmation);
  assert.ok(context.requestedAt);
});

// ---------- Registry / execution guards ----------

test('Phase 00: bridge registry exposes 158 runtime tools across 18 categories', () => {
  assert.equal(bridge.manifest.size, 158, 'runtime registry must hold 158 tools');
  assert.equal(bridge.menuIndex.size, 158, 'menu index must hold 158 entries');
  const categories = new Set([...bridge.manifest.values()].map((tool) => tool.Category));
  assert.equal(categories.size, 18, 'runtime registry must span 18 categories');
});

test('Phase 00: bridge rejects unknown ToolId, arbitrary paths, and unsupported modes', () => {
  assert.throws(() => bridge.createRun('NO_SUCH_TOOL', 'run', {}), (err) => err.code === 'UNKNOWN_TOOL');
  for (const evil of ['../evil', 'C:\\Windows\\evil.ps1', '/tmp/evil.ps1']) {
    assert.throws(() => bridge.createRun(evil, 'run', {}), (err) => err.code === 'UNKNOWN_TOOL');
  }
  assert.throws(() => bridge.createRun('SM01', 'destroy', {}), (err) => err.code === 'MODE_NOT_SUPPORTED');
  // Manifest-authoritative mode support: SM10 declares WhatIfSupported=false.
  assert.throws(() => bridge.createRun('SM10', 'preview', {}), (err) => err.code === 'MODE_NOT_SUPPORTED');
  // SYSTEM_REPAIR run without confirmation evidence is rejected before spawn.
  assert.throws(() => bridge.createRun('SM01', 'run', {}), (err) => err.code === 'CONFIRMATION_REQUIRED');
});

test('Phase 00: bridge exposes category registry endpoints', () => {
  const source = readWeb('server/bridge.mjs');
  assert.match(source, /pathParts\[1\] === 'categories'/, 'bridge must expose GET categories');
  assert.match(source, /pathParts\[1\] === 'tools' && pathParts\.length === 3/, 'bridge must expose GET tool metadata');
  assert.match(source, /KNOUX_EXECUTION_CONTEXT/, 'bridge must forward the validated execution context');
});

// ---------- Result contract / inconclusive ----------

test('Phase 00: structured result contract uses the canonical envelope', () => {
  const reporting = readRepo('Core/KnouxRepair.Reporting.psm1');
  for (const key of [
    'runId', 'toolId', 'category', 'status', 'durationMs', 'changedSystem', 'restartNeeded',
    'itemsFound', 'itemsProcessed', 'skippedCount', 'quarantinedCount',
    'bytesPotentiallyRecoverable', 'bytesQuarantined', 'bytesPermanentlyDeleted',
    'bytesActuallyRecovered', 'bytesMoved', 'backupPath', 'quarantinePath',
    'verificationPerformed', 'verificationResult', 'exitCode', 'errorCode',
    'errorMessage', 'evidence', 'rawOutput', 'reportPath',
  ]) {
    assert.ok(reporting.includes(key), `result contract must include ${key}`);
  }
  const bridgeSource = readWeb('server/bridge.mjs');
  assert.match(bridgeSource, /run\.status = 'inconclusive'/, 'bridge must surface INCONCLUSIVE distinctly');
  assert.equal(/run\.status = 'success'[^;]*Inconclusive/i.test(bridgeSource), false, 'bridge must not collapse Inconclusive into success');
  const core = readRepo('Core/KnouxRepair.Core.psm1');
  assert.match(core, /'Inconclusive'\s*=\s*5/, 'Inconclusive must keep exit code 5');
});

// ---------- Resource root / lifecycle ----------

test('Phase 00: packaged resource resolver has no machine-specific fallback', () => {
  const source = readWeb('server/bridge.mjs');
  assert.match(source, /resolveResourceRoot/, 'bridge must resolve resources through one resolver');
  assert.match(source, /KNOUX_PROJECT_ROOT/, 'resolver must honor KNOUX_PROJECT_ROOT');
  assert.match(source, /RESOURCE_MODE|resourceMode/, 'resolver must report DEV vs PACKAGED mode');
  const { resolveResourceRoot } = bridge;
  const resolved = resolveResourceRoot();
  assert.equal(resolved.root, REPO_ROOT, 'DEV resolution must land on the repository root');
  assert.ok(fs.existsSync(path.join(resolved.root, 'Docs', 'TOOLS-MANIFEST.json')));
  const resourceSection = source.slice(source.indexOf('resolveResourceRoot'));
  assert.equal(/D:\\Knoux-repair/.test(resourceSection), false, 'no absolute workstation fallback in resource resolution');
});

test('Phase 00: Electron owns bridge lifecycle with a readiness probe', () => {
  const main = readWeb('desktop/main.cjs');
  assert.match(main, /probeBridgeReady/, 'Electron must probe bridge readiness');
  assert.match(main, /bridgeError/, 'Electron must surface the exact offline reason');
  assert.match(main, /KNOUX_PACKAGED/, 'Electron must mark packaged mode');
  assert.match(main, /api\/tools/, 'readiness probe must validate the registry');
});

// ---------- Offline != zero / product truth ----------

test('Phase 00: offline renders UNAVAILABLE, never "0 tools"', () => {
  const offlineFiles = [
    'src/components/ActionCenter.tsx',
    'src/components/AllToolsCatalog.tsx',
    'src/components/CareDashboard.tsx',
    'src/components/ToolboxSuite.tsx',
    'src/components/Sidebar.tsx',
    'src/App.tsx',
  ];
  for (const file of offlineFiles) {
    const source = readWeb(file);
    assert.ok(/Unavailable|UNAVAILABLE|غير متاح/i.test(source), `${file} must render an unavailable state`);
  }
  const countFiles = [
    'src/components/AllToolsCatalog.tsx',
    'src/components/ActionCenter.tsx',
    'src/components/ToolboxSuite.tsx',
    'src/components/CareDashboard.tsx',
    'src/App.tsx',
  ];
  for (const file of countFiles) {
    const source = readWeb(file);
    assert.equal(
      /158\s*(Tools|TOOLS|TOOLS READY|أداة)/.test(source),
      false,
      `${file} must not hard-code the 158 tool count in UI copy`,
    );
  }
  const shared = readWeb('src/features/stations/_shared/contracts.ts');
  assert.match(shared, /registryCountOrNull/, 'station foundation must guard registry counts');
});

// ---------- Station foundation ----------

test('Phase 00: station runtime foundation exists with all primitives', () => {
  for (const file of [
    'src/features/stations/_shared/contracts.ts',
    'src/features/stations/_shared/StationToolRegistry.ts',
    'src/features/stations/_shared/StationExecutionController.ts',
    'src/features/stations/_shared/StationEvidenceViewer.tsx',
    'src/features/stations/_shared/StationHistory.tsx',
    'src/features/stations/_shared/StationErrorBoundary.tsx',
    'src/features/stations/_shared/StationPermissionGate.tsx',
    'src/features/stations/_shared/StationOfflineState.tsx',
    'src/features/stations/_shared/StationRunProgress.tsx',
    'src/features/stations/_shared/StationResultRenderer.tsx',
    'src/features/stations/_shared/bridgeLifecycle.ts',
    'src/features/stations/_shared/index.ts',
  ]) {
    assert.equal(fs.existsSync(path.join(WEB_ROOT, file)), true, `${file} must exist`);
  }
  const controller = readWeb('src/features/stations/_shared/StationExecutionController.ts');
  assert.match(controller, /WAITING_FOR_CONFIRMATION/, 'execution controller must model confirmation waits');
  assert.match(controller, /WAITING_FOR_ELEVATION/, 'execution controller must model elevation waits');
  assert.match(controller, /INCONCLUSIVE/, 'execution controller must model INCONCLUSIVE');
});

// ---------- Config reaches Safety ----------

test('Phase 00: protected configuration reaches Safety through one validated loader', () => {
  const config = readRepo('Core/KnouxRepair.Config.psm1');
  assert.match(config, /Get-KnouxProtectedPaths/, 'Config must expose protected paths');
  assert.match(config, /Get-KnouxProtectedProcesses/, 'Config must expose protected processes');
  assert.match(config, /secure defaults/i, 'Config must fail safely to secure defaults');
  const safety = readRepo('Core/KnouxRepair.Safety.psm1');
  assert.match(safety, /KnouxRepair\.Config\.psm1/, 'Safety must import the validated loader');
  assert.match(safety, /Get-KnouxProtectedPaths/, 'Safety protected paths must come from the loader');
  assert.match(safety, /Get-KnouxProtectedProcesses/, 'Safety protected processes must come from the loader');
});
