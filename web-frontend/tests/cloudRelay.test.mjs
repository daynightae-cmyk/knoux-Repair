import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createCloudRelay, startCloudRelay, __cloudRelayTest } from '../server/cloud-relay.mjs';
import {
  createCloudReadOnlyRun,
  listCloudReadOnlyTools,
  manifest,
  menuIndex,
} from '../server/bridge-auth.mjs';

const token = 'header.payload.signature';

function response(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('cloud relay registers only supplied READ_ONLY catalog and heartbeats', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body, auth: init.headers.Authorization });
    if (url.endsWith('/bridge/register')) {
      return response(200, { ok: true, session_id: 'session-1', heartbeat_seconds: 10 });
    }
    if (url.endsWith('/bridge/heartbeat')) {
      return response(200, { ok: true, command: null });
    }
    throw new Error(`unexpected URL ${url}`);
  };

  const relay = createCloudRelay({
    fetchImpl,
    tokenProvider: async () => token,
    serviceUrl: 'https://gateway.test',
    machineId: 'a'.repeat(32),
    machineLabel: 'TEST-PC',
    toolsProvider: async () => [{
      toolId: 'SYS-INFO',
      riskLevel: 'READ_ONLY',
      name: 'System Info',
    }],
    toolRunner: async () => ({ status: 'success' }),
    log: { info() {}, warn() {} },
  });

  await relay.runOnce();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://gateway.test/bridge/register');
  assert.equal(calls[0].body.tools[0].riskLevel, 'READ_ONLY');
  assert.equal(calls[1].body.session_id, 'session-1');
  assert.equal(calls[0].auth, `Bearer ${token}`);
});
test('cloud relay executes delivered command and reports sanitized result', async () => {
  let resultResolve;
  const resultPosted = new Promise((resolve) => { resultResolve = resolve; });
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    if (url.endsWith('/bridge/register')) {
      return response(200, { ok: true, session_id: 'session-2', heartbeat_seconds: 10 });
    }
    if (url.endsWith('/bridge/heartbeat')) {
      return response(200, {
        ok: true,
        command: {
          command_id: 'cmd-1',
          kind: 'run_readonly_tool',
          tool_id: 'SYS-INFO',
          options: {},
        },
      });
    }
    if (url.endsWith('/bridge/result')) {
      resultResolve(body);
      return response(200, { ok: true, accepted: true });
    }
    throw new Error(`unexpected URL ${url}`);
  };

  const relay = createCloudRelay({
    fetchImpl,
    tokenProvider: async () => token,
    serviceUrl: 'https://gateway.test',
    machineId: 'b'.repeat(32),
    toolsProvider: async () => [{ toolId: 'SYS-INFO', riskLevel: 'READ_ONLY' }],
    toolRunner: async () => ({
      status: 'success',
      authorization: 'Bearer should-not-leave-machine',
    }),
    log: { info() {}, warn() {} },
  });

  await relay.runOnce();
  const posted = await Promise.race([
    resultPosted,
    new Promise((_, reject) => setTimeout(() => reject(new Error('result timeout')), 2000)),
  ]);
  assert.equal(posted.command_id, 'cmd-1');
  assert.equal(posted.result.status, 'completed');
  assert.equal(posted.result.run.authorization, '[redacted]');
});

test('local cloud execution gate exposes only READ_ONLY tools', () => {
  const tools = listCloudReadOnlyTools();
  assert.ok(tools.length > 0);
  assert.ok(tools.every((tool) => tool.riskLevel === 'READ_ONLY'));
});
test('local cloud execution gate rejects an available mutating tool before spawn', () => {
  let verified = false;
  for (const [toolId, tool] of manifest) {
    if (tool.RiskLevel === 'READ_ONLY') continue;
    const script = menuIndex.get(toolId);
    if (!script || !fs.existsSync(new URL(`../../${script}`, import.meta.url))) continue;
    try {
      createCloudReadOnlyRun(toolId, {});
      assert.fail(`mutating tool ${toolId} unexpectedly executed`);
    } catch (error) {
      if (error?.code === 'CLOUD_READ_ONLY_REQUIRED') {
        verified = true;
        break;
      }
      if (error?.code === 'SCRIPT_UNAVAILABLE') continue;
      throw error;
    }
  }
  assert.equal(verified, true, 'expected at least one available mutating tool to be rejected');
});

test('cloud relay sanitizer redacts credential-shaped keys', () => {
  assert.equal(__cloudRelayTest.sanitize({ apiKey: 'secret' }).apiKey, '[redacted]');
});

test('cloud relay startup is opt-in and can be disabled explicitly', () => {
  const previousEnabled = process.env.KNOUX_CLOUD_RELAY_ENABLED;
  const previousDisabled = process.env.KNOUX_CLOUD_RELAY_DISABLED;
  try {
    delete process.env.KNOUX_CLOUD_RELAY_ENABLED;
    delete process.env.KNOUX_CLOUD_RELAY_DISABLED;
    assert.equal(startCloudRelay({}), null);

    process.env.KNOUX_CLOUD_RELAY_ENABLED = '1';
    process.env.KNOUX_CLOUD_RELAY_DISABLED = '1';
    assert.equal(startCloudRelay({}), null);
  } finally {
    if (previousEnabled === undefined) delete process.env.KNOUX_CLOUD_RELAY_ENABLED;
    else process.env.KNOUX_CLOUD_RELAY_ENABLED = previousEnabled;
    if (previousDisabled === undefined) delete process.env.KNOUX_CLOUD_RELAY_DISABLED;
    else process.env.KNOUX_CLOUD_RELAY_DISABLED = previousDisabled;
  }
});
