import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const sentinel = fs.readFileSync(path.join(root, 'src/components/premium/SentinelPanel.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'server/bridge-core.mjs'), 'utf8');

test('Engineering Workbench Sentinel probes only canonical live APIs', () => {
  for (const call of [
    'api.health()',
    'api.tools()',
    'api.advancedSoftwarePreview()',
    'api.sonarAiStatus()',
    'api.system()',
  ]) {
    assert.ok(sentinel.includes(call), `missing Sentinel live probe: ${call}`);
  }
  assert.match(sentinel, /Promise\.allSettled\(/, 'endpoint failure must not suppress the other live indicators');
  assert.match(sentinel, /setTimeout\(\(\) => void probe\(\), 8000\)/, 'Sentinel refresh cadence must remain explicit');
});

test('Workbench live API client routes stay wired to the bridge', () => {
  for (const route of [
    '/api/health',
    '/api/tools',
    '/api/software-advanced/preview',
    '/api/sonar/ai-status',
    '/api/system',
  ]) {
    assert.ok(api.includes(route), `missing API client route: ${route}`);
  }
});

test('Bridge exposes the five Sentinel endpoints without mock transport', () => {
  for (const marker of [
    "pathParts[1] === 'health'",
    "pathParts[1] === 'tools' && pathParts.length === 2",
    "pathParts[1] === 'software-advanced' && pathParts[2] === 'preview'",
    "pathParts[1] === 'sonar' && pathParts[2] === 'ai-status'",
    "pathParts[1] === 'system'",
  ]) {
    assert.ok(bridge.includes(marker), `missing bridge route marker: ${marker}`);
  }
});
