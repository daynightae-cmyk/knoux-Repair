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

const STATION12_IDS = [
  'DT01', 'DT02', 'DT03', 'DT04', 'DT05', 'DT06', 'DT07',
  'DT08', 'DT09', 'DT10', 'DT11', 'DT12', 'DT13',
];

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station12-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station12', 'developerModel.ts')],
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

test('Station 12: manifest inventory is exactly 13 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '12-Developer-Tools');
  assert.equal(station.length, 13, 'Station 12 must have exactly 13 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION12_IDS].sort(),
    'Station 12 ToolIds must match manifest contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve on disk`);
  }
});

test('Station 12: risk levels match safety architecture', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const dt01 = manifest.find((t) => t.ToolId === 'DT01');
  assert.equal(dt01.RiskLevel, 'READ_ONLY');

  const dt02 = manifest.find((t) => t.ToolId === 'DT02');
  assert.equal(dt02.RiskLevel, 'SAFE_CLEANUP');

  const dt09 = manifest.find((t) => t.ToolId === 'DT09');
  assert.equal(dt09.RiskLevel, 'SAFE_CLEANUP');

  const dt10 = manifest.find((t) => t.ToolId === 'DT10');
  assert.equal(dt10.RiskLevel, 'SYSTEM_REPAIR');
});

/* =========================================================================
 * DOMAIN MODEL DETERMINISTIC DERIVATIONS
 * ========================================================================= */

test('Station 12: deriveWorkbenchState returns expected states truthfully', () => {
  assert.equal(model.deriveWorkbenchState(5, 0, 0), 'OPTIMAL');
  assert.equal(model.deriveWorkbenchState(5, 3, 0), 'ATTENTION_NEEDED');
  assert.equal(model.deriveWorkbenchState(5, 0, 1), 'ATTENTION_NEEDED');
  assert.equal(model.deriveWorkbenchState(0, 0, 1), 'DEGRADED');
  assert.equal(model.deriveWorkbenchState(0, 0, 0), 'INCONCLUSIVE');
});

test('Station 12: summarizeWorkbench computes metrics correctly', () => {
  const toolchain = [
    { tool: 'git', available: true, version: '2.43', primarySource: 'C:\\Git\\cmd\\git.exe', candidateCount: 1 },
    { tool: 'node', available: true, version: 'v20.10.0', primarySource: 'C:\\node\\node.exe', candidateCount: 2 },
    { tool: 'python', available: false, version: '', primarySource: '', candidateCount: 0 },
  ];
  const ports = [
    { port: 3000, address: '127.0.0.1', process: 'node', processId: 1234 },
    { port: 8080, address: '0.0.0.0', process: 'python', processId: 5678 },
  ];

  const summary = model.summarizeWorkbench(toolchain, ports, { repository: true, branch: 'main' });
  assert.equal(summary.runtimesChecked, 3);
  assert.equal(summary.runtimesAvailable, 2);
  assert.equal(summary.collisionsCount, 1);
  assert.equal(summary.activeDevPortsCount, 2);
  assert.equal(summary.gitWorktreeActive, true);
  assert.equal(summary.gitBranch, 'main');
});

test('Station 12: parseToolchainItems parses JSON correctly and safely handles malformed text', () => {
  const validJson = JSON.stringify([
    { Tool: 'node', Available: true, Version: '20.0.0', PrimarySource: 'C:\\node.exe', CandidateCount: 1 },
  ]);
  const parsed = model.parseToolchainItems(validJson);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].tool, 'node');
  assert.equal(parsed[0].available, true);

  const invalid = model.parseToolchainItems('not-json');
  assert.deepEqual(invalid, []);
});

test('Station 12: parseDevPorts parses JSON and filters invalid ports', () => {
  const json = JSON.stringify([
    { Port: 8787, Address: '127.0.0.1', Process: 'node', ProcessId: 4321 },
    { Port: 0, Address: '', Process: '', ProcessId: 0 },
  ]);
  const ports = model.parseDevPorts(json);
  assert.equal(ports.length, 1);
  assert.equal(ports[0].port, 8787);
  assert.equal(ports[0].process, 'node');
});

test('Station 12: detectDeveloperSignals identifies collisions, ports, and missing git', () => {
  const toolchain = [
    { tool: 'python', available: true, version: '3.11', primarySource: '', candidateCount: 2 },
  ];
  const ports = [
    { port: 3000, address: '127.0.0.1', process: 'node', processId: 100 },
  ];

  const signals = model.detectDeveloperSignals(toolchain, ports, { available: false });
  assert.ok(signals.some((s) => s.code === 'DEV_PATH_COLLISION'));
  assert.ok(signals.some((s) => s.code === 'DEV_PORTS_ACTIVE'));
  assert.ok(signals.some((s) => s.code === 'DEV_GIT_MISSING'));
});

test('Station 12: stationTools filters correctly', () => {
  const tools = [
    { ToolId: 'DT01', Category: '12-Developer-Tools' },
    { ToolId: 'PR01', Category: '13-Privacy' },
    { ToolId: 'DT10', Category: '12-Developer-Tools' },
  ];
  const filtered = model.stationTools(tools);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].ToolId, 'DT01');
  assert.equal(filtered[1].ToolId, 'DT10');
});
