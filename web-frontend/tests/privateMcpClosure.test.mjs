import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_MCP_ENDPOINT,
  CANONICAL_MCP_AUDIENCE,
  DOCUMENTED_MCP_ALIAS,
  DEFAULT_MCP_INVOKER_SERVICE_ACCOUNT,
  MODERN_MCP_VERSION,
  LEGACY_MCP_VERSION,
  getMcpContract,
  runPrivateMcpProbe,
} from '../server/private-mcp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const fakeToken = `eyJ${'a'.repeat(48)}.${'b'.repeat(48)}.${'c'.repeat(32)}`;

function headers(values = {}) {
  const map = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return map.get(String(name).toLowerCase()) || null; } };
}

function response(status, body = null, headerValues = {}) {
  const text = body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: headers({ 'content-type': 'application/json', ...headerValues }),
    async text() { return text; },
  };
}

test('Mission 02 pins the exact private Cloud Run endpoint and forbids public fallback', () => {
  const contract = getMcpContract({});
  assert.equal(contract.endpoint, CANONICAL_MCP_ENDPOINT);
  assert.equal(contract.audience, CANONICAL_MCP_AUDIENCE);
  assert.equal(contract.documentedAlias, DOCUMENTED_MCP_ALIAS);
  assert.equal(contract.invokerServiceAccount, DEFAULT_MCP_INVOKER_SERVICE_ACCOUNT);
  assert.equal(contract.endpoint.endsWith('/mcp'), true);
  assert.equal(contract.endpoint.endsWith('/mcp/'), false);
  assert.equal(contract.privateRequired, true);
  assert.equal(contract.publicFallback, false);
  assert.throws(() => getMcpContract({ KNOUX_MCP_ENDPOINT: `${CANONICAL_MCP_ENDPOINT}/` }), /canonical private MCP endpoint exactly/);
});

test('Mission 02 proves privacy before a modern authenticated gateway_status call and redacts secrets', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (!init.headers?.Authorization) return response(403, { message: 'Forbidden' });
    assert.equal(init.headers.Authorization, `Bearer ${fakeToken}`);
    assert.equal(init.headers['MCP-Protocol-Version'], MODERN_MCP_VERSION);
    assert.equal(init.headers['Mcp-Method'], 'tools/call');
    assert.equal(init.headers['Mcp-Name'], 'gateway_status');
    return response(200, {
      jsonrpc: '2.0', id: 'knoux-modern-gateway-status',
      result: { structuredContent: { status: 'ok', service: 'knoux-mcp-gateway', token: 'never-render-this', nested: { password: 'nope' } } },
    });
  };

  const probe = await runPrivateMcpProbe({
    fetchImpl,
    tokenProvider: async () => ({ token: fakeToken, source: 'test-identity' }),
    now: () => new Date('2026-09-12T00:00:00.000Z'),
  });

  assert.equal(probe.ok, true);
  assert.equal(probe.privacy.state, 'confirmed-private');
  assert.equal(probe.identity.source, 'test-identity');
  assert.equal(probe.protocol.era, 'modern');
  assert.equal(probe.protocol.version, MODERN_MCP_VERSION);
  assert.equal(probe.gatewayStatus.tool, 'gateway_status');
  assert.equal(probe.gatewayStatus.payload.status, 'ok');
  assert.equal(probe.gatewayStatus.payload.token, '[redacted]');
  assert.equal(probe.gatewayStatus.payload.nested.password, '[redacted]');
  assert.equal(calls.length, 2);
});

test('Mission 02 falls back to legacy initialize/session flow when modern direct tools/call is unsupported', async () => {
  let authenticatedCall = 0;
  const fetchImpl = async (_url, init = {}) => {
    if (!init.headers?.Authorization) return response(403, { message: 'Forbidden' });
    authenticatedCall += 1;
    if (authenticatedCall === 1) return response(400, { jsonrpc: '2.0', id: 'x', error: { code: -32600, message: 'initialize required' } });
    if (authenticatedCall === 2) {
      return response(200, { jsonrpc: '2.0', id: 'knoux-initialize', result: { protocolVersion: LEGACY_MCP_VERSION, capabilities: {}, serverInfo: { name: 'gateway', version: '1' } } }, { 'mcp-session-id': 'session-123' });
    }
    if (authenticatedCall === 3) return response(204, null);
    return response(200, { jsonrpc: '2.0', id: 'knoux-legacy-gateway-status', result: { content: [{ type: 'text', text: '{"status":"ready","mode":"private"}' }] } });
  };

  const probe = await runPrivateMcpProbe({ fetchImpl, tokenProvider: async () => ({ token: fakeToken, source: 'metadata' }) });
  assert.equal(probe.ok, true);
  assert.equal(probe.protocol.era, 'legacy');
  assert.equal(probe.protocol.version, LEGACY_MCP_VERSION);
  assert.equal(probe.protocol.sessionBound, true);
  assert.deepEqual(probe.gatewayStatus.payload, { status: 'ready', mode: 'private' });
});

test('Mission 02 local gcloud identity uses the dedicated invoker and the verified Cloud Run audience', async () => {
  const seen = [];
  const spawnSyncImpl = (_exe, args) => {
    seen.push(args);
    return { status: 0, stdout: `${fakeToken}\n`, stderr: 'WARNING: impersonation active\n' };
  };
  const fetchImpl = async (_url, init = {}) => {
    if (!init.headers?.Authorization) return response(403, { message: 'Forbidden' });
    return response(200, {
      jsonrpc: '2.0', id: 'knoux-modern-gateway-status',
      result: { structuredContent: { ok: true, service: 'knoux-mcp-gateway' } },
    });
  };

  const probe = await runPrivateMcpProbe({ env: { KNOUX_MCP_TOKEN_SOURCE: 'gcloud' }, fetchImpl, spawnSyncImpl });
  assert.equal(probe.ok, true);
  assert.equal(seen.length, 1);
  assert.ok(seen[0].includes(`--audiences=${CANONICAL_MCP_AUDIENCE}`));
  assert.ok(seen[0].includes('--include-email'));
  assert.ok(seen[0].includes(`--impersonate-service-account=${DEFAULT_MCP_INVOKER_SERVICE_ACCOUNT}`));
});

test('Mission 02 fails closed when identity is unavailable after the private boundary proof', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return response(403, { message: 'Forbidden' }); };
  const probe = await runPrivateMcpProbe({ fetchImpl, tokenProvider: async () => { const error = new Error('No cloud identity'); error.code = 'MCP_IDENTITY_UNAVAILABLE'; throw error; } });
  assert.equal(probe.ok, false);
  assert.equal(probe.privacy.state, 'confirmed-private');
  assert.equal(probe.error.code, 'MCP_IDENTITY_UNAVAILABLE');
  assert.equal(calls, 1, 'no authenticated tool call should run without an ID token');
});

test('Mission 02 source contracts expose the protected proof route and unique evidence UI without token leakage', () => {
  const bridge = fs.readFileSync(path.join(ROOT, 'server', 'bridge.mjs'), 'utf8');
  const main = fs.readFileSync(path.join(ROOT, 'src', 'main.tsx'), 'utf8');
  const host = fs.readFileSync(path.join(ROOT, 'src', 'components', 'McpOverlayHost.tsx'), 'utf8');
  const topbar = fs.readFileSync(path.join(ROOT, 'src', 'components', 'premium', 'TopBar.tsx'), 'utf8');
  const center = fs.readFileSync(path.join(ROOT, 'src', 'components', 'McpConnectionCenter.tsx'), 'utf8');
  const evidence = fs.readFileSync(path.join(ROOT, 'scripts', 'capture-mission02-evidence.mjs'), 'utf8');
  assert.match(bridge, /runPrivateMcpProbe/);
  assert.match(bridge, /parts\[1\] === 'mcp'/);
  assert.match(bridge, /checkMutationGuard\(req\)/);
  assert.match(main, /McpOverlayHost/);
  assert.match(host, /searchParams|get\('mcp'\)|params\.get\('mcp'\)/);
  assert.match(topbar, /knoux-mcp-topbar-trigger/);
  assert.match(topbar, /knoux:mcp-open/);
  assert.match(center, /gateway_status/);
  assert.match(center, /NO PUBLIC FALLBACK/);
  assert.doesNotMatch(center, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(center, /Authorization:\s*`Bearer/);
  assert.match(evidence, /MISSION-02_PRIVATE-MCP-CENTER\.png/);
  assert.match(evidence, /requireMcp/);
});
