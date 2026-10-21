/**
 * KNOUX Repair — Authentication Session Persistence Test Suite
 *
 * The encrypted session store is written through Windows DPAPI, which means
 * spawning Windows PowerShell. That call costs seconds.
 *
 * The defect this suite locks down: when the DPAPI write ran INSIDE the
 * request handler, the claim request blocked for ~8 seconds. The server's
 * default 5s keep-alive timeout then closed the client's pooled socket while
 * the client was waiting, and the NEXT request on that socket failed with
 * `read ECONNRESET`. The observable symptom was an intermittent failure in
 * `authCloseout.test.mjs` (roughly 2 runs in 5) that "passed on its own".
 *
 * The contract:
 *   1. A sign-in must be answered immediately; the store is written after.
 *   2. The store must still be written, and must survive a restart.
 *   3. The server must not close a keep-alive socket before its client does.
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.KNOUX_IGNORE_DOTENV = '1';
process.env.KNOUX_AUTH_REQUIRED = 'true';
process.env.KNOUX_AUTH_FRONTEND_ORIGIN = 'http://127.0.0.1:3000';
process.env.KNOUX_BRIDGE_TOKEN = 'knoux-auth-persistence-capability-token-001';
process.env.KNOUX_BRIDGE_TEST_MODE = '1';
process.env.GOOGLE_CLIENT_ID = 'google-client-id-test';
process.env.KNOUX_GITHUB_CLIENT_ID = 'github-client-id-test';
process.env.KNOUX_GITHUB_CLIENT_SECRET = 'github-client-secret-test';
process.env.KNOUX_ENTRA_CLIENT_ID = 'entra-client-id-test';
process.env.KNOUX_ENTRA_TENANT_ID = 'organizations';
process.env.KNOUX_AUTH_SESSION_STORE = path.join(os.tmpdir(), `knoux-auth-persistence-${process.pid}.dpapi`);

const bridge = await import('../server/bridge.mjs');
const { server, __authTest } = bridge;

const TOKEN = 'knoux-auth-persistence-capability-token-001';
const ORIGIN = 'http://127.0.0.1:3000';
const handoff = (seed) => `${seed}`.padEnd(32, seed[0] || 'a').slice(0, 32);
const mutationHeaders = () => ({ Origin: ORIGIN, 'Content-Type': 'application/json', 'X-Knoux-Bridge-Token': TOKEN });
let baseUrl = '';

before(async () => {
  try { fs.unlinkSync(process.env.KNOUX_AUTH_SESSION_STORE); } catch { /* clean */ }
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(process.env.KNOUX_AUTH_SESSION_STORE); } catch { /* clean */ }
});

async function start(provider, id) {
  const response = await fetch(`${baseUrl}/api/auth/start/${provider}?handoff=${id}`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  return new URL(response.headers.get('location'));
}

test('Persistence: a sign-in claim is answered without waiting for the DPAPI write', async () => {
  const id = handoff('p');
  const auth = await start('google', id);
  const state = auth.searchParams.get('state');
  const callback = await fetch(`${baseUrl}/api/auth/callback/google?state=${encodeURIComponent(state)}&code=knoux-test-code`);
  assert.equal(callback.status, 200);

  const started = Date.now();
  const claim = await fetch(`${baseUrl}/api/auth/handoff/${id}/claim`, {
    method: 'POST', headers: mutationHeaders(), body: '{}',
  });
  const elapsed = Date.now() - started;

  assert.equal(claim.status, 200, 'The claim must succeed');
  assert.ok(
    elapsed < 3000,
    `The claim must not block on the DPAPI write (took ${elapsed}ms); a blocking write stalls the bridge and breaks the client's keep-alive socket`,
  );
});

test('Persistence: the session store is still written after the response', async () => {
  const id = handoff('w');
  const auth = await start('google', id);
  const state = auth.searchParams.get('state');
  await fetch(`${baseUrl}/api/auth/callback/google?state=${encodeURIComponent(state)}&code=knoux-test-code`);
  const claim = await fetch(`${baseUrl}/api/auth/handoff/${id}/claim`, {
    method: 'POST', headers: mutationHeaders(), body: '{}',
  });
  assert.equal(claim.status, 200);

  // The asynchronous write must land without another request forcing it.
  await __authTest.whenPersisted();

  assert.equal(fs.existsSync(__authTest.sessionStorePath), true, 'The session store must be written');
  const encrypted = fs.readFileSync(__authTest.sessionStorePath, 'utf8');
  assert.equal(encrypted.includes('test-google'), false, 'The store must not contain plaintext account metadata');
});

test('Persistence: a restart restores the session from the encrypted store', async () => {
  await __authTest.whenPersisted();
  __authTest.clearInMemorySessions();

  const restored = await __authTest.loadPersistedSessions();
  assert.equal(restored, true, 'The persisted store must be restorable');
  const status = __authTest.authStatus({ headers: { cookie: '' } });
  assert.equal(status.authenticated, false, 'No cookie means no session');
});

test('Persistence: the server never closes a keep-alive socket before its client', () => {
  // Node's default is 5s. A client that pauses longer than the server's
  // timeout can pick up a socket the server already closed (ECONNRESET).
  assert.ok(
    server.keepAliveTimeout >= 60000,
    `The bridge keep-alive timeout must exceed every client idle window (got ${server.keepAliveTimeout}ms)`,
  );
  assert.ok(
    server.headersTimeout > server.keepAliveTimeout,
    'The headers timeout must be greater than the keep-alive timeout',
  );
});

test('Persistence: the bridge does not block its startup on the DPAPI unprotect', async () => {
  // Loading the store must not gate module import: a blocking load delayed
  // the bridge by ~9s and the desktop shell probed it with a 20s budget.
  const started = Date.now();
  await __authTest.ensureSessionsLoaded();
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 3000, `The store load must not block for long (took ${elapsed}ms)`);
});
