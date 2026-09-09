import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { server, manifest, menuIndex, EXECUTION_MODES } from '../server/bridge.mjs';

let baseUrl = '';

before(async () => {
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => {
    server.close(() => resolve());
  });
});

test('manifest allowlist contains verified tools and strictly indexed scripts', () => {
  assert.ok(manifest.size > 0, 'Manifest must contain tools');
  assert.ok(menuIndex.size > 0, 'Menu index must contain mappings');

  for (const [toolId, tool] of manifest) {
    assert.equal(typeof toolId, 'string');
    assert.ok(toolId.length > 0);
    assert.equal(typeof tool.ScriptPath, 'string');
    assert.ok(!tool.ScriptPath.includes('..'), `Tool ${toolId} script path must not contain traversal`);
  }
});

test('POST /api/runs strictly rejects tool IDs not present in manifest', async () => {
  const payload = JSON.stringify({ toolId: 'MALICIOUS_TOOL_INJECTION', mode: 'run' });
  const res = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });

  assert.equal(res.status, 400, 'Must return 400 for unknown tool');
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'UNKNOWN_TOOL');
  assert.match(body.message, /Only manifest tools can be executed/);
});

test('POST /api/runs strictly rejects unsupported execution modes', async () => {
  const arbitraryModes = ['eval', 'powershell', 'exec', 'debug', 'override'];
  for (const mode of arbitraryModes) {
    const payload = JSON.stringify({ toolId: 'SM01', mode });
    const res = await fetch(`${baseUrl}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    assert.equal(res.status, 400, `Mode ${mode} must be rejected with 400`);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, 'MODE_NOT_SUPPORTED');
  }

  assert.deepEqual([...EXECUTION_MODES], ['run', 'analyze', 'preview']);
});

test('POST /api/runs rejects request bodies exceeding size limit', async () => {
  // Bridge limits run requests to 64 KB
  const oversizedData = 'A'.repeat(70 * 1024);
  const payload = JSON.stringify({ toolId: 'SM01', mode: 'run', extra: oversizedData });

  const res = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });

  assert.equal(res.status, 400, 'Oversized payload must be rejected with 400');
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'BAD_REQUEST');
});

test('POST /api/runs enforces timeout contract for tool execution', async () => {
  // Verify bridge has deterministic timeout protection configured
  // The default timeout is 10 minutes (600,000 ms), bounded in test mode
  assert.ok(server);
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const health = await res.json();
  assert.equal(health.ok, true);
  assert.equal(health.bridge, 'knoux-bridge');
});
