/**
 * Local bridge ↔ AI provider HTTP contract tests.
 *
 * A mock provider is started in-process; the real bridge is spawned against it
 * with KNOUX_IGNORE_DOTENV=1 and a fake key. This proves the bridge's honest
 * outcome mapping (answer / provider error / empty / timeout) without any
 * network access or real credentials.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRIDGE_ENTRY = path.join(ROOT, 'server', 'bridge.mjs');
const MODEL_ID = 'gemini-3.8-flash';
const PROVIDER_TIMEOUT_MS = 500;

let behavior = 'success';
let mockServer;
let bridge;
let bridgeBase;
let bridgeLogs = '';

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function sendMockJson(res, status, payload) {
  if (res.destroyed) return;
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function startMockProvider(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'POST') {
        sendMockJson(res, 405, { error: { message: 'method not allowed' } });
        return;
      }
      req.on('data', () => {});
      req.on('end', () => {
        if (behavior === 'success') {
          sendMockJson(res, 200, { candidates: [{ content: { parts: [{ text: 'KNOUX_CONTRACT_OK' }] } }] });
          return;
        }
        if (behavior === 'empty') {
          sendMockJson(res, 200, { candidates: [{ content: { parts: [{ text: '   ' }] } }] });
          return;
        }
        if (behavior === 'error') {
          sendMockJson(res, 400, { error: { message: 'mock provider rejection' } });
          return;
        }
        const timer = setTimeout(() => {
          sendMockJson(res, 200, { candidates: [{ content: { parts: [{ text: 'TOO_LATE' }] } }] });
        }, 5000);
        timer.unref();
      });
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function waitForBridge() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (bridge.exitCode !== null) {
      throw new Error(`Bridge exited early (${bridge.exitCode}).\n${bridgeLogs}`);
    }
    try {
      const res = await fetch(`${bridgeBase}/api/ai/models`);
      if (res.ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Bridge did not become ready.\n${bridgeLogs}`);
}

async function generate() {
  const res = await fetch(`${bridgeBase}/api/ai/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ modelId: MODEL_ID, prompt: 'contract test prompt' }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

before(async () => {
  const [bridgePort, mockPort] = await Promise.all([getFreePort(), getFreePort()]);
  mockServer = await startMockProvider(mockPort);
  bridgeBase = `http://127.0.0.1:${bridgePort}`;
  bridge = spawn(process.execPath, [BRIDGE_ENTRY], {
    cwd: ROOT,
    env: {
      ...process.env,
      KNOUX_IGNORE_DOTENV: '1',
      KNOUX_BRIDGE_PORT: String(bridgePort),
      GEMINI_API_KEY: 'contract-test-key-0123456789',
      GEMINI_API_BASE: `http://127.0.0.1:${mockPort}/v1beta`,
      AI_PROVIDER_TIMEOUT_MS: String(PROVIDER_TIMEOUT_MS),
      OPENROUTER_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  bridge.stdout.on('data', (chunk) => { bridgeLogs += chunk.toString(); });
  bridge.stderr.on('data', (chunk) => { bridgeLogs += chunk.toString(); });
  await waitForBridge();
});

after(async () => {
  if (bridge && bridge.exitCode === null) bridge.kill();
  if (mockServer) {
    mockServer.closeAllConnections?.();
    await new Promise((resolve) => mockServer.close(resolve));
  }
});

test('catalog lists the supported Google model and not the rejected one', async () => {
  const res = await fetch(`${bridgeBase}/api/ai/models`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.hasGeminiKey, true);
  assert.equal(body.models[0].id, MODEL_ID);
  assert.equal(body.models.some((entry) => entry.id === 'gemini-2.5-flash'), false);
});

test('a provider answer passes through unmodified', async () => {
  behavior = 'success';
  const { status, body } = await generate();
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.text, 'KNOUX_CONTRACT_OK');
  assert.equal(body.model, MODEL_ID);
  assert.equal(body.provider, 'google');
});

test('a provider rejection is reported as AI_PROVIDER_ERROR', async () => {
  behavior = 'error';
  const { status, body } = await generate();
  assert.equal(status, 502);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'AI_PROVIDER_ERROR');
  assert.match(body.message, /mock provider rejection/);
  assert.equal(body.text, undefined);
});

test('an empty provider response is reported as AI_EMPTY_RESPONSE', async () => {
  behavior = 'empty';
  const { status, body } = await generate();
  assert.equal(status, 502);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'AI_EMPTY_RESPONSE');
  assert.equal(body.text, undefined);
});

test('a slow provider is reported as AI_TIMEOUT within the configured budget', async () => {
  behavior = 'timeout';
  const startedAt = Date.now();
  const { status, body } = await generate();
  const elapsed = Date.now() - startedAt;
  assert.equal(status, 504);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'AI_TIMEOUT');
  assert.match(body.message, /did not respond within 1 seconds/);
  assert.ok(elapsed < 3000, `timeout took ${elapsed}ms`);
});
