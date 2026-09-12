import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..');
const readWeb = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');
const readRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const executionController = readWeb('src/features/stations/_shared/StationExecutionController.ts');
const bridgeCore = readWeb('server/bridge-core.mjs');
const foundationTest = readWeb('tests/phase00-foundation.test.mjs');
const familyMap = readWeb('src/data/family-map.ts');

test('station execution waits through RUNNING until a real terminal bridge state exists', () => {
  assert.match(executionController, /for\s*\(\s*;;\s*\)/, 'pollExecution must keep polling instead of taking one snapshot');
  assert.match(executionController, /if\s*\(run\.status\s*!==\s*'running'\)\s*return run/, 'only a non-running bridge record may be returned as final');
  assert.match(executionController, /await\s+wait\(delayMs\)/, 'running records must remain pending between polls');
  assert.doesNotMatch(
    executionController,
    /export async function pollExecution[^]*?const \{ run \} = await api\.getRun\(runId\);\s*return run;/,
    'single-read execution polling must not regress'
  );
});

test('terminal status mapping keeps cancellation and inconclusive distinct from success/failure', () => {
  assert.match(executionController, /case 'success': return 'SUCCESS'/);
  assert.match(executionController, /case 'error': return 'FAILED'/);
  assert.match(executionController, /case 'cancelled': return 'CANCELLED'/);
  assert.match(executionController, /case 'inconclusive': return 'INCONCLUSIVE'/);
});

test('the apparent 159th manifest record is an isolated test-only timeout probe, not a canonical product ToolId', () => {
  assert.match(bridgeCore, /const TEST_MODE = process\.env\.KNOUX_BRIDGE_TEST_MODE === '1'/);
  assert.match(bridgeCore, /const TEST_TIMEOUT_TOOL_ID = '__KNOUX_TEST_TIMEOUT__'/);
  assert.match(bridgeCore, /Category:\s*'TEST_ONLY'/);
  assert.match(bridgeCore, /if\s*\(TEST_MODE\)\s*\{[^]*?manifest\.set\(TEST_TIMEOUT_TOOL_ID/);
  assert.match(foundationTest, /assert\.equal\(bridge\.manifest\.size,\s*158/);
  assert.match(foundationTest, /assert\.equal\(bridge\.menuIndex\.size,\s*158/);
});

test('product contract remains exactly 6 families, 18 services and 158 expected tools', () => {
  const familyIds = [...familyMap.matchAll(/^\s{4}id:\s*'(vitality|recovery|assurance|software|workbench|investigation)'/gm)];
  const serviceIds = [...familyMap.matchAll(/^\s{8}id:\s*'\d{2}-[^']+'/gm)];
  const expectedToolCounts = [...familyMap.matchAll(/^\s{8}expectedTools:\s*(\d+),/gm)].map((match) => Number(match[1]));

  assert.equal(familyIds.length, 6, `expected 6 families, found ${familyIds.length}`);
  assert.equal(serviceIds.length, 18, `expected 18 services, found ${serviceIds.length}`);
  assert.equal(expectedToolCounts.reduce((sum, count) => sum + count, 0), 158, 'service tool counts must total 158');
});

// Keep repoRoot referenced so accidental test relocation fails loudly instead of silently changing scope.
test('closure test resolves the expected repository root', () => {
  assert.ok(fs.existsSync(path.join(repoRoot, 'Tests')), `expected desktop Tests directory under ${repoRoot}`);
});
