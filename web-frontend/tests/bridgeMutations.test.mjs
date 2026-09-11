import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

// A per-process bridge token forces the capability-token boundary on for every
// test in this file (the bridge reads it once at module load).
process.env.KNOUX_BRIDGE_TOKEN = 'knoux-test-capability-token-001';
process.env.KNOUX_IGNORE_DOTENV = '1';
delete process.env.GEMINI_API_KEY;
delete process.env.OPENROUTER_API_KEY;

const bridge = await import('../server/bridge.mjs');
const { server, createRun, cancelRun, killProcessTree, isAllowedOrigin, checkMutationGuard } = bridge;

const require = createRequire(import.meta.url);
const electronSecurity = require('../desktop/security.cjs');

const TOKEN = 'knoux-test-capability-token-001';
let baseUrl = '';

before(async () => {
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => {
    server.close(() => resolve());
  });
});

function postJson(path, body, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const ALLOWED = 'http://127.0.0.1:5173';
const HOSTILE = 'https://evil.example.com';

test('hostile Origin is actively rejected before run creation', async () => {
  const res = await postJson('/api/runs', { toolId: 'SM01', mode: 'run' }, { Origin: HOSTILE });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error, 'ORIGIN_FORBIDDEN');
});

test('opaque null origin is rejected on mutations', async () => {
  const res = await postJson('/api/runs', { toolId: 'SM01', mode: 'run' }, { Origin: 'null' });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'ORIGIN_FORBIDDEN');
});

test('malformed Origin is rejected on mutations', async () => {
  const res = await postJson('/api/runs', { toolId: 'SM01', mode: 'run' }, { Origin: 'http://127.0.0.1:5173.evil.com' });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'ORIGIN_FORBIDDEN');
});

test('allowed local Origin passes the origin check', async () => {
  // Unknown tool proves we got PAST origin/content-type/token enforcement.
  const res = await postJson(
    '/api/runs',
    { toolId: 'NO_SUCH_TOOL', mode: 'run' },
    { Origin: ALLOWED, 'X-Knoux-Bridge-Token': TOKEN },
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'UNKNOWN_TOOL');
});

test('text/plain mutation bodies are rejected before execution', async () => {
  const res = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', Origin: ALLOWED, 'X-Knoux-Bridge-Token': TOKEN },
    body: 'toolId=SM01&mode=run',
  });
  assert.equal(res.status, 415);
  assert.equal((await res.json()).error, 'UNSUPPORTED_MEDIA_TYPE');
});

test('form-urlencoded mutation bodies are rejected before execution', async () => {
  const res = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: ALLOWED, 'X-Knoux-Bridge-Token': TOKEN },
    body: 'toolId=SM01&mode=run',
  });
  assert.equal(res.status, 415);
  assert.equal((await res.json()).error, 'UNSUPPORTED_MEDIA_TYPE');
});

test('missing capability token is rejected when a bridge token is configured', async () => {
  const res = await postJson('/api/runs', { toolId: 'NO_SUCH_TOOL', mode: 'run' }, { Origin: ALLOWED });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'BRIDGE_TOKEN_INVALID');
});

test('wrong capability token is rejected', async () => {
  const res = await postJson(
    '/api/runs',
    { toolId: 'NO_SUCH_TOOL', mode: 'run' },
    { Origin: ALLOWED, 'X-Knoux-Bridge-Token': 'wrong-token' },
  );
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'BRIDGE_TOKEN_INVALID');
});

test('valid capability token is accepted past the guard', async () => {
  const res = await postJson(
    '/api/runs',
    { toolId: 'NO_SUCH_TOOL', mode: 'run' },
    { Origin: ALLOWED, 'X-Knoux-Bridge-Token': TOKEN },
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'UNKNOWN_TOOL');
});

test('cancel endpoint requires the same authorization as run creation', async () => {
  const hostile = await fetch(`${baseUrl}/api/runs/does-not-exist/cancel`, {
    method: 'POST',
    headers: { Origin: HOSTILE },
  });
  assert.equal(hostile.status, 403);
  assert.equal((await hostile.json()).error, 'ORIGIN_FORBIDDEN');

  const noToken = await fetch(`${baseUrl}/api/runs/does-not-exist/cancel`, {
    method: 'POST',
    headers: { Origin: ALLOWED },
  });
  assert.equal(noToken.status, 403);
  assert.equal((await noToken.json()).error, 'BRIDGE_TOKEN_INVALID');
});

test('traversal and arbitrary script paths never resolve to execution', () => {
  for (const evil of ['../evil', '..\\evil', '%2e%2e%2fSECRET', 'C:\\Windows\\evil.ps1', '/tmp/evil.ps1', 'SM01; rm -rf']) {
    assert.throws(() => createRun(evil, 'run', {}), (err) => err.code === 'UNKNOWN_TOOL', `must reject ${evil}`);
  }
});

test('createRun rejects unknown tool ids directly', () => {
  assert.throws(() => createRun('MALICIOUS_TOOL_INJECTION', 'run', {}), (err) => {
    assert.equal(err.status, 400);
    assert.equal(err.code, 'UNKNOWN_TOOL');
    return true;
  });
});

test('oversized sonar export bodies are rejected', async () => {
  const res = await postJson(
    '/api/sonar/export',
    { path: 'C:\\', format: 'markdown', language: 'en', pad: 'A'.repeat(20 * 1024) },
    { Origin: ALLOWED, 'X-Knoux-Bridge-Token': TOKEN },
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'BAD_REQUEST');
});

test('hostile preflight (OPTIONS) does not succeed', async () => {
  const res = await fetch(`${baseUrl}/api/runs`, {
    method: 'OPTIONS',
    headers: { Origin: HOSTILE, 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('allowed preflight succeeds with CORS headers', async () => {
  const res = await fetch(`${baseUrl}/api/runs`, {
    method: 'OPTIONS',
    headers: { Origin: ALLOWED, 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED);
});

test('mutation guard helpers enforce origin, content-type and token directly', () => {
  const json = (headers) => ({ headers });
  assert.ok(checkMutationGuard(json({})), 'missing token must fail when configured');
  assert.equal(
    checkMutationGuard(json({ origin: HOSTILE, 'content-type': 'application/json', 'x-knoux-bridge-token': TOKEN })).code,
    'ORIGIN_FORBIDDEN',
  );
  assert.equal(
    checkMutationGuard(json({ origin: ALLOWED, 'content-type': 'text/plain', 'x-knoux-bridge-token': TOKEN })).code,
    'UNSUPPORTED_MEDIA_TYPE',
  );
  assert.equal(
    checkMutationGuard(json({ origin: ALLOWED, 'content-type': 'application/json', 'x-knoux-bridge-token': 'nope' })).code,
    'BRIDGE_TOKEN_INVALID',
  );
  assert.equal(
    checkMutationGuard(json({ origin: ALLOWED, 'content-type': 'application/json; charset=utf-8', 'x-knoux-bridge-token': TOKEN })),
    null,
  );
  assert.equal(isAllowedOrigin(ALLOWED), true);
  assert.equal(isAllowedOrigin(HOSTILE), false);
  assert.equal(isAllowedOrigin('null'), false);
  assert.equal(isAllowedOrigin(''), false);
});

test('killProcessTree terminates a real Windows process tree', async () => {
  const child = spawn('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Start-Sleep -Seconds 60'], { windowsHide: true });
  assert.ok(child.pid && child.pid > 0);
  const exited = new Promise((resolve) => child.on('exit', resolve));
  killProcessTree(child);
  const timeout = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 15000));
  const result = await Promise.race([exited, timeout]);
  assert.notEqual(result, 'TIMEOUT', 'process tree must be terminated promptly');
});

test('cancelRun on unknown id returns false without side effects', () => {
  assert.equal(cancelRun('00000000-0000-0000-0000-000000000000'), false);
});

test('AI generate without provider keys returns unavailable, never fabricated text', async () => {
  const res = await postJson(
    '/api/ai/generate',
    { modelId: 'gemini-2.5-flash', prompt: 'Diagnose slow boot' },
    { Origin: ALLOWED, 'X-Knoux-Bridge-Token': TOKEN },
  );
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.available, false);
  assert.equal(body.error, 'AI_PROVIDER_NOT_CONFIGURED');
  assert.ok(!('text' in body), 'unavailable response must not include generated text');
});

test('AI models endpoint reports explicit provider availability', async () => {
  const res = await fetch(`${baseUrl}/api/ai/models`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.models) && body.models.length > 0);
  assert.equal(body.hasGeminiKey, false);
  assert.equal(body.hasOpenRouterKey, false);
});

test('Electron navigation requires exact loopback origin match', () => {
  const { isAllowedNavigation } = electronSecurity;
  assert.equal(isAllowedNavigation('http://127.0.0.1:51234/', 'http://127.0.0.1:51234'), true);
  assert.equal(isAllowedNavigation('http://127.0.0.1:51234/?bridgeToken=abc', 'http://127.0.0.1:51234'), true);
  assert.equal(isAllowedNavigation('http://127.0.0.1:51234.evil.com/', 'http://127.0.0.1:51234'), false);
  assert.equal(isAllowedNavigation('http://127.0.0.1:9999/', 'http://127.0.0.1:51234'), false);
  assert.equal(isAllowedNavigation('https://127.0.0.1:51234/', 'http://127.0.0.1:51234'), false);
  assert.equal(isAllowedNavigation('file:///etc/passwd', 'http://127.0.0.1:51234'), false);
  assert.equal(isAllowedNavigation('not a url', 'http://127.0.0.1:51234'), false);
});

test('Electron external URL gate allow-lists only https and mailto', () => {
  const { filterExternalUrl } = electronSecurity;
  assert.equal(filterExternalUrl('https://example.com/docs'), 'https://example.com/docs');
  assert.equal(filterExternalUrl('mailto:support@example.com'), 'mailto:support@example.com');
  assert.equal(filterExternalUrl('file:///C:/Windows/win.ini'), null);
  assert.equal(filterExternalUrl('javascript:alert(1)'), null);
  assert.equal(filterExternalUrl('data:text/html,<h1>x</h1>'), null);
  assert.equal(filterExternalUrl('knoux://do-evil'), null);
  assert.equal(filterExternalUrl('http://insecure.example.com/'), null);
});

test('Electron asset resolution survives malformed URI encoding', () => {
  const { resolveAssetPath } = electronSecurity;
  const root = 'C:\\app\\dist';
  const bad = resolveAssetPath(root, '/%E0%A4%A');
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'BAD_ENCODING');
  const traversal = resolveAssetPath(root, '/..%2f..%2fsecret.txt');
  assert.equal(traversal.ok, false);
  const good = resolveAssetPath(root, '/assets/app.js');
  assert.equal(good.ok, true);
  assert.ok(good.path.endsWith('app.js'));
});
