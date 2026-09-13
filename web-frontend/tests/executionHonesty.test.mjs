import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(relativeUrl) {
  return fs.readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');
}

// Assigned Spark services must only send bridge-canonical execution modes
// (run | analyze | preview). Legacy aliases previously caused the bridge to
// reject every launch with MODE_NOT_SUPPORTED.
const TARGET_STATIONS = [
  'station04/ProgramsStation.tsx',
  'station05/DuplicateStation.tsx',
  'station06/DiskSpaceStation.tsx',
  'station10/DiagnosticsStation.tsx',
  'station12/DeveloperStation.tsx',
  'station13/PrivacyStation.tsx',
  'station14/DriversStation.tsx',
  'station15/MonitoringStation.tsx',
  'station16/SoftwareStation.tsx',
  'station17/PostInstallStation.tsx',
  'station18/ProjectSonarStation.tsx',
];

test('execution controller normalizes legacy mode aliases to canonical bridge modes', () => {
  const source = read('../src/features/stations/_shared/StationExecutionController.ts');
  assert.match(source, /export function normalizeExecutionMode/, 'controller must export a mode normalizer');
  assert.match(source, /AnalyzeOnly -> analyze/, 'AnalyzeOnly must map to analyze');
  assert.match(source, /WhatIf -> preview/, 'WhatIf must map to preview');
  assert.match(source, /Execute -> run/, 'Execute must map to run');
  assert.match(source, /repair -> run/, 'repair must map to run');
  assert.match(source, /normalizeExecutionMode\(mode \|\| 'run'\)/, 'positional startExecution must normalize');
  assert.match(source, /normalizeExecutionMode\(inputOrTool\.mode\)/, 'object-form startExecution must normalize');
});

test('execution controller polls until a terminal state instead of single-fetching', () => {
  const semantics = read('../src/features/stations/_shared/executionSemantics.ts');
  assert.match(semantics, /export async function pollUntilTerminalRun/, 'semantics must export pollUntilTerminalRun');
  assert.match(semantics, /run\.status !== 'running'|isTerminalRunStatus\(run\.status\)/, 'polling must continue while the backend reports running');
  assert.match(semantics, /POLL_TIMEOUT/, 'long-running observation must surface an honest timeout, not a fake outcome');
  assert.match(semantics, /POLL_CANCELLED/, 'local observation stops must be distinguishable from backend cancellation');
  assert.match(semantics, /export async function requestConfirmedCancel/, 'semantics must export confirmed-cancel reconciliation');
  assert.match(semantics, /CANCEL_FAILED/, 'unconfirmed cancellation must surface distinctly');
  assert.match(semantics, /export function outcomeLabelForStatus/, 'semantics must export an honest outcome label helper');
  assert.match(semantics, /export function historyMessageForTerminal/, 'semantics must export an honest history message helper');
  assert.match(semantics, /Verification inconclusive/, 'inconclusive runs must say so instead of claiming success');
  assert.match(semantics, /rememberRun|recallRun|forgetRun/, 'orphan runs must be remembered for remount rediscovery');
  const controller = read('../src/features/stations/_shared/StationExecutionController.ts');
  assert.match(controller, /pollUntilTerminalRun/, 'controller must delegate terminal polling to the tested semantics');
  assert.match(controller, /requestBackendConfirmedCancel/, 'controller must delegate confirmed cancellation');
  assert.match(controller, /export async function requestConfirmedCancel/, 'controller must export requestConfirmedCancel');
});

test('assigned stations send only canonical execution modes', () => {
  for (const file of TARGET_STATIONS) {
    const source = read(`../src/features/stations/${file}`);
    for (const alias of [`'AnalyzeOnly'`, `'WhatIf'`, `'Execute'`]) {
      assert.equal(
        source.includes(alias),
        false,
        `${file} must not send non-canonical mode ${alias} (bridge rejects with MODE_NOT_SUPPORTED)`
      );
    }
  }
  // 'repair' is a tab key in ProgramsStation, so only assert launch-call sites in owned stations.
  for (const file of [
    'station12/DeveloperStation.tsx',
    'station13/PrivacyStation.tsx',
    'station14/DriversStation.tsx',
    'station15/MonitoringStation.tsx',
    'station16/SoftwareStation.tsx',
    'station17/PostInstallStation.tsx',
    'station18/ProjectSonarStation.tsx',
  ]) {
    const source = read(`../src/features/stations/${file}`);
    assert.equal(
      /handleLaunchTool\([^)]*'repair'/.test(source),
      false,
      `${file} must not launch tools with non-canonical mode 'repair'`
    );
  }
});

test('assigned stations await terminal outcomes instead of single-fetching runs', () => {
  for (const file of [
    'station06/DiskSpaceStation.tsx',
    'station10/DiagnosticsStation.tsx',
    'station12/DeveloperStation.tsx',
    'station13/PrivacyStation.tsx',
    'station14/DriversStation.tsx',
    'station15/MonitoringStation.tsx',
    'station16/SoftwareStation.tsx',
    'station17/PostInstallStation.tsx',
    'station18/ProjectSonarStation.tsx',
  ]) {
    const source = read(`../src/features/stations/${file}`);
    assert.match(source, /pollUntilTerminal/, `${file} must poll until a terminal run state`);
    assert.match(source, /requestConfirmedCancel/, `${file} must reconcile cancellation against the backend`);
    assert.match(source, /StationActiveRunBanner/, `${file} must render the shared live running banner`);
    assert.match(source, /phase=\{activeRun\.phase\}/, `${file} must surface the running/cancelling phase`);
  }
});

test('assigned stations never report CANCELLED from local polling aborts', () => {
  for (const file of [
    'station06/DiskSpaceStation.tsx',
    'station10/DiagnosticsStation.tsx',
    'station12/DeveloperStation.tsx',
    'station13/PrivacyStation.tsx',
    'station14/DriversStation.tsx',
    'station15/MonitoringStation.tsx',
    'station16/SoftwareStation.tsx',
    'station17/PostInstallStation.tsx',
    'station18/ProjectSonarStation.tsx',
  ]) {
    const source = read(`../src/features/stations/${file}`);
    assert.equal(
      source.includes('wasCancel'),
      false,
      `${file} must not derive cancellation from a local abort flag`
    );
    assert.equal(
      /outcome = code === 'POLL_CANCELLED' \? 'cancelled'/.test(source),
      false,
      `${file} must not map a local poll abort to a cancelled outcome`
    );
    assert.match(source, /CANCEL_FAILED/, `${file} must handle unconfirmed cancellation honestly`);
    assert.match(source, /settledRef/, `${file} must guard against double-settling runs`);
  }
});

test('assigned stations remember runs for remount rediscovery instead of orphaning them', () => {
  for (const file of [
    'station06/DiskSpaceStation.tsx',
    'station10/DiagnosticsStation.tsx',
    'station12/DeveloperStation.tsx',
    'station13/PrivacyStation.tsx',
    'station14/DriversStation.tsx',
    'station15/MonitoringStation.tsx',
    'station16/SoftwareStation.tsx',
    'station17/PostInstallStation.tsx',
    'station18/ProjectSonarStation.tsx',
  ]) {
    const source = read(`../src/features/stations/${file}`);
    assert.match(source, /rememberRun\(/, `${file} must remember started runs`);
    assert.match(source, /recallRun\(/, `${file} must rediscover remembered runs on remount`);
    assert.match(source, /forgetRun\(/, `${file} must forget runs once terminally settled`);
  }
});

test('assigned stations keep selection separate from the running tool', () => {
  for (const file of [
    'station06/DiskSpaceStation.tsx',
    'station10/DiagnosticsStation.tsx',
    'station12/DeveloperStation.tsx',
    'station13/PrivacyStation.tsx',
    'station14/DriversStation.tsx',
    'station15/MonitoringStation.tsx',
    'station16/SoftwareStation.tsx',
    'station17/PostInstallStation.tsx',
    'station18/ProjectSonarStation.tsx',
  ]) {
    const source = read(`../src/features/stations/${file}`);
    assert.match(source, /activeRun/, `${file} must track the running tool independently`);
    assert.match(
      source,
      /pendingTool|pendingRun|selectedAppSelections|selectedDriverSelections|selectedGroupIds/,
      `${file} must track selection independently from the running tool`
    );
  }
});

test('assigned stations never record fabricated success messages', () => {
  for (const file of TARGET_STATIONS) {
    const source = read(`../src/features/stations/${file}`);
    assert.equal(
      source.includes('Executed ${'),
      false,
      `${file} must not interpolate fabricated "Executed X successfully" history entries`
    );
    assert.equal(
      /summary:\s*finalRun\.result\?\.output\?\.slice\(0,\s*180\)\s*\|\|\s*'Execution completed\.'/.test(source),
      false,
      `${file} must not fall back to an unearned 'Execution completed.' summary`
    );
  }
});

test('developer station never fabricates toolchain or repository presence', () => {
  const source = read('../src/features/stations/station12/DeveloperStation.tsx');
  assert.equal(
    source.includes(`version: 'detected'`),
    false,
    'DeveloperStation must not fall back to a fabricated "detected" toolchain baseline'
  );
  assert.equal(
    source.includes(`{ repository: true, branch: gitBranch, available: true }`),
    false,
    'DeveloperStation must not claim a repository before any audit evidence exists'
  );
  assert.equal(
    source.includes(`useState<string>('main')`),
    false,
    'DeveloperStation must not hard-code the git branch to main'
  );
  assert.equal(
    source.includes('Canonical repo connected'),
    false,
    'DeveloperStation must not claim a connected repo without evidence'
  );
});

test('bridge still accepts exactly the canonical execution modes', () => {
  const source = read('../server/bridge-core.mjs');
  assert.match(
    source,
    /const EXECUTION_MODES = new Set\(\['run', 'analyze', 'preview'\]\)/,
    'bridge contract is unchanged: run | analyze | preview'
  );
});
