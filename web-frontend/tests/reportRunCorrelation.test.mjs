/**
 * KNOUX Repair — Report Run Correlation Test Suite
 *
 * A tool report on disk must be correlatable with the Bridge run that
 * produced it. The Bridge places the validated execution context (with the
 * authoritative `runId`) in `$env:KNOUX_EXECUTION_CONTEXT` before spawning
 * the category script. `Start-KnouxSession` must adopt that id, otherwise
 * every one of the 158 tools writes a report whose `runId` is an unrelated
 * random GUID and the report cannot be tied back to its run.
 *
 * These assertions execute real PowerShell against the real Core module, so
 * they prove the behavior rather than the source text.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CORE_MODULE = path.join(REPO_ROOT, 'Core', 'KnouxRepair.Core.psm1');

function psAvailable() {
  for (const shell of ['pwsh', 'powershell.exe', 'powershell']) {
    const probe = spawnSync(shell, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' });
    if (probe.status === 0) return shell;
  }
  return null;
}

const SHELL = psAvailable();

/**
 * Runs a PowerShell snippet with the Core module imported and returns stdout.
 * `context` is written to KNOUX_EXECUTION_CONTEXT exactly like the Bridge
 * does before spawning a tool script.
 */
function runCore(context, script, { projectRoot } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-runid-'));
  try {
    const payload = {
      runId: '11111111-2222-3333-4444-555555555555',
      toolId: 'NI01',
      mode: 'run',
      riskLevel: 'READ_ONLY',
      parameters: {},
      confirmation: null,
      requestedAt: '2026-10-21T00:00:00.000Z',
      ...(context || {}),
    };
    const env = { ...process.env, KNOUX_EXECUTION_CONTEXT: JSON.stringify(payload) };
    const res = spawnSync(
      SHELL,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { encoding: 'utf8', env, cwd: dir },
    );
    return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Runs a PowerShell snippet with a raw (possibly malformed) context string. */
function runCoreWithRawContext(rawContext, script) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-runid-'));
  try {
    const env = { ...process.env, KNOUX_EXECUTION_CONTEXT: rawContext };
    const res = spawnSync(
      SHELL,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { encoding: 'utf8', env, cwd: dir },
    );
    return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Extracts the last JSON document emitted by a PowerShell script. */
function lastJson(stdout) {
  const text = String(stdout || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  assert.ok(start > -1 && end > start, `No JSON document found in output: ${text.slice(0, 400)}`);
  return JSON.parse(text.slice(start, end + 1));
}

const IMPORT_CORE = `
$ErrorActionPreference = 'Stop'
Import-Module '${CORE_MODULE.replace(/\\/g, '\\\\')}' -Force
`;

test('Report correlation: the session adopts the runId from the validated execution context', { skip: !SHELL && 'no PowerShell available' }, () => {
  const script = `
${IMPORT_CORE}
$root = Join-Path $env:TEMP ('knoux-runid-' + [guid]::NewGuid().ToString('N'))
$session = Start-KnouxSession -ToolId 'NI01' -ToolName 'Test' -Category '03-Network-Internet' -RiskLevel 'READ_ONLY' -ProjectRoot $root
$session.RunId
`;
  const res = runCore(null, script);
  assert.equal(res.status, 0, `PowerShell failed: ${res.stderr}`);
  assert.equal(
    res.stdout.trim(),
    '11111111-2222-3333-4444-555555555555',
    'Start-KnouxSession must adopt the execution context runId so the report is correlatable with its run',
  );
});

test('Report correlation: a direct invocation without a context still gets a unique id', { skip: !SHELL && 'no PowerShell available' }, () => {
  const script = `
${IMPORT_CORE}
$root = Join-Path $env:TEMP ('knoux-runid-' + [guid]::NewGuid().ToString('N'))
$a = (Start-KnouxSession -ToolId 'NI01' -ToolName 'Test' -Category '03-Network-Internet' -RiskLevel 'READ_ONLY' -ProjectRoot $root).RunId
$b = (Start-KnouxSession -ToolId 'NI01' -ToolName 'Test' -Category '03-Network-Internet' -RiskLevel 'READ_ONLY' -ProjectRoot $root).RunId
[pscustomobject]@{ A = $a; B = $b; Same = ($a -eq $b) } | ConvertTo-Json
`;
  const res = runCoreWithRawContext('', script);
  assert.equal(res.status, 0, `PowerShell failed: ${res.stderr}`);
  const parsed = lastJson(res.stdout);
  assert.equal(parsed.Same, false, 'Two independent sessions must not share a run id');
  assert.ok(parsed.A && parsed.B, 'Both sessions must carry a run id');
});

test('Report correlation: an explicit RunId argument still wins over the context', { skip: !SHELL && 'no PowerShell available' }, () => {
  const script = `
${IMPORT_CORE}
$root = Join-Path $env:TEMP ('knoux-runid-' + [guid]::NewGuid().ToString('N'))
(Start-KnouxSession -ToolId 'NI01' -ToolName 'Test' -Category '03-Network-Internet' -RiskLevel 'READ_ONLY' -ProjectRoot $root -RunId 'explicit-override').RunId
`;
  const res = runCore(null, script);
  assert.equal(res.status, 0, `PowerShell failed: ${res.stderr}`);
  assert.equal(res.stdout.trim(), 'explicit-override', 'An explicit RunId must not be overridden');
});

test('Report correlation: a malformed execution context does not break the session', { skip: !SHELL && 'no PowerShell available' }, () => {
  const script = `
${IMPORT_CORE}
$root = Join-Path $env:TEMP ('knoux-runid-' + [guid]::NewGuid().ToString('N'))
$session = Start-KnouxSession -ToolId 'NI01' -ToolName 'Test' -Category '03-Network-Internet' -RiskLevel 'READ_ONLY' -ProjectRoot $root
$session.RunId
`;
  const res = runCoreWithRawContext('{ this is not valid json', script);
  assert.equal(res.status, 0, `A malformed context must not break the session: ${res.stderr}`);
  assert.ok(res.stdout.trim().length > 0, 'A session must always carry a run id even with a malformed context');
});

test('Report correlation: a context without a runId falls back to a generated id', { skip: !SHELL && 'no PowerShell available' }, () => {
  const script = `
${IMPORT_CORE}
$root = Join-Path $env:TEMP ('knoux-runid-' + [guid]::NewGuid().ToString('N'))
$session = Start-KnouxSession -ToolId 'NI01' -ToolName 'Test' -Category '03-Network-Internet' -RiskLevel 'READ_ONLY' -ProjectRoot $root
$session.RunId
`;
  const res = runCoreWithRawContext(JSON.stringify({ toolId: 'NI01', mode: 'run' }), script);
  assert.equal(res.status, 0, `PowerShell failed: ${res.stderr}`);
  const id = res.stdout.trim().split(/\r?\n/).pop();
  assert.ok(id && id.length > 0, 'A session must always carry a run id');
  assert.notEqual(id, '11111111-2222-3333-4444-555555555555', 'A context without a runId must not fabricate one');
});

test('Report correlation: the exported report carries the correlated runId', { skip: !SHELL && 'no PowerShell available' }, () => {
  const script = `
${IMPORT_CORE}
$root = Join-Path $env:TEMP ('knoux-runid-' + [guid]::NewGuid().ToString('N'))
$session = Start-KnouxSession -ToolId 'NI01' -ToolName 'Test' -Category '03-Network-Internet' -RiskLevel 'READ_ONLY' -ProjectRoot $root
$session.Status = 'Success'
$null = Stop-KnouxSession -Session $session
((Get-Content -LiteralPath (Join-Path $session.SessionDir 'results.json') -Raw) | ConvertFrom-Json) | ConvertTo-Json -Compress
`;
  const res = runCore(null, script);
  assert.equal(res.status, 0, `PowerShell failed: ${res.stderr}`);
  const parsed = lastJson(res.stdout);
  assert.equal(
    parsed.runId,
    '11111111-2222-3333-4444-555555555555',
    'The exported report must carry the same runId as the Bridge run that produced it',
  );
});

test('Report correlation: no tool script hardcodes its own run id', () => {
  const categoryDirs = fs
    .readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d\d-/.test(entry.name))
    .map((entry) => path.join(REPO_ROOT, entry.name));

  const offenders = [];
  for (const dir of categoryDirs) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.toLowerCase().endsWith('.ps1')) continue;
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      if (/Start-KnouxSession[\s\S]{0,400}?-RunId/.test(text)) {
        offenders.push(path.relative(REPO_ROOT, path.join(dir, file)));
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Tools must not pass their own run id; the Core module derives it from the execution context. Offenders: ${offenders.join(', ')}`,
  );
});
