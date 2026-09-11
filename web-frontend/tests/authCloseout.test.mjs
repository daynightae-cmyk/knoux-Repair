import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

process.env.KNOUX_IGNORE_DOTENV = '1';
process.env.KNOUX_AUTH_REQUIRED = 'true';
process.env.KNOUX_AUTH_FRONTEND_ORIGIN = 'http://127.0.0.1:3000';
process.env.KNOUX_BRIDGE_TOKEN = 'knoux-auth-closeout-capability-token-001';
process.env.KNOUX_BRIDGE_TEST_MODE = '1';
process.env.GOOGLE_CLIENT_ID = 'google-client-id-test';
process.env.KNOUX_GITHUB_CLIENT_ID = 'github-client-id-test';
process.env.KNOUX_GITHUB_CLIENT_SECRET = 'github-client-secret-test';
process.env.KNOUX_ENTRA_CLIENT_ID = 'entra-client-id-test';
process.env.KNOUX_ENTRA_TENANT_ID = 'organizations';
process.env.KNOUX_AUTH_SESSION_STORE = path.join(os.tmpdir(), `knoux-auth-closeout-${process.pid}.dpapi`);

const bridge = await import('../server/bridge.mjs');
const { server, __authTest } = bridge;
const require = createRequire(import.meta.url);
const electronSecurity = require('../desktop/security.cjs');

const TOKEN = 'knoux-auth-closeout-capability-token-001';
const ORIGIN = 'http://127.0.0.1:3000';
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

function handoff(seed) { return `${seed}`.padEnd(32, seed[0] || 'a').slice(0, 32); }
function mutationHeaders() { return { Origin: ORIGIN, 'Content-Type': 'application/json', 'X-Knoux-Bridge-Token': TOKEN }; }
async function post(pathname, cookie = '') {
  return fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { ...mutationHeaders(), ...(cookie ? { Cookie: cookie } : {}) },
    body: '{}',
  });
}

async function start(provider, id) {
  const response = await fetch(`${baseUrl}/api/auth/start/${provider}?handoff=${id}`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  return new URL(response.headers.get('location'));
}

test('status exposes Google, GitHub, Entra and protected mode without secret material', async () => {
  const response = await fetch(`${baseUrl}/api/auth/status`, { headers: { Origin: ORIGIN } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.required, true);
  assert.equal(body.mode, 'protected');
  assert.equal(body.authenticated, false);
  assert.deepEqual(Object.keys(body.providers).sort(), ['entra', 'github', 'google']);
  for (const provider of Object.values(body.providers)) assert.equal(provider.configured, true);
  assert.equal(JSON.stringify(body).includes('secret-test'), false);
});

test('all provider starts use Authorization Code + PKCE S256 and exact callback authorities', async () => {
  const google = await start('google', handoff('g'));
  assert.equal(google.origin, 'https://accounts.google.com');
  assert.equal(google.searchParams.get('code_challenge_method'), 'S256');
  assert.ok((google.searchParams.get('code_challenge') || '').length >= 43);
  assert.equal(google.searchParams.get('redirect_uri'), 'http://127.0.0.1:8787/api/auth/callback/google');
  assert.ok(google.searchParams.get('state'));

  const github = await start('github', handoff('h'));
  assert.equal(github.origin, 'https://github.com');
  assert.equal(github.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(github.searchParams.get('redirect_uri'), 'http://127.0.0.1:8787/api/auth/callback/github');

  const entra = await start('entra', handoff('e'));
  assert.equal(entra.origin, 'https://login.microsoftonline.com');
  assert.equal(entra.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(entra.searchParams.get('redirect_uri'), 'http://localhost:8787/api/auth/callback/entra');
});

test('Electron external URL gate allows only exact loopback OAuth starts in addition to https/mailto', () => {
  const { filterExternalUrl } = electronSecurity;
  const good = 'http://127.0.0.1:8787/api/auth/start/google?handoff=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  assert.equal(filterExternalUrl(good), good);
  assert.equal(filterExternalUrl('http://127.0.0.1:8787/api/auth/start/google'), null);
  assert.equal(filterExternalUrl('http://127.0.0.1:8787/api/auth/start/google?handoff=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&token=secret'), null);
  assert.equal(filterExternalUrl('http://localhost:8787/api/auth/start/google?handoff=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), null);
  assert.equal(filterExternalUrl('http://127.0.0.1:8787/api/auth/callback/google?code=x'), null);
  assert.equal(filterExternalUrl('http://evil.example/api/auth/start/google?handoff=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), null);
});

test('callback state is one-time, provider-bound and invalid states are rejected', async () => {
  const id = handoff('s');
  const auth = await start('google', id);
  const state = auth.searchParams.get('state');
  const wrongProvider = await fetch(`${baseUrl}/api/auth/callback/github?state=${encodeURIComponent(state)}&code=knoux-test-code`);
  assert.equal(wrongProvider.status, 400);
  const replay = await fetch(`${baseUrl}/api/auth/callback/google?state=${encodeURIComponent(state)}&code=knoux-test-code`);
  assert.equal(replay.status, 400);
  const missing = await fetch(`${baseUrl}/api/auth/callback/google?state=not-valid&code=knoux-test-code`);
  assert.equal(missing.status, 400);
});

test('system-browser handoff creates the Electron cookie only when claimed with the local capability', async () => {
  const id = handoff('c');
  const auth = await start('google', id);
  const state = auth.searchParams.get('state');

  const callback = await fetch(`${baseUrl}/api/auth/callback/google?state=${encodeURIComponent(state)}&code=knoux-test-code`);
  assert.equal(callback.status, 200);
  assert.match(await callback.text(), /Sign-in complete/);

  const missingToken = await fetch(`${baseUrl}/api/auth/handoff/${id}/claim`, {
    method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(missingToken.status, 403);
  assert.equal((await missingToken.json()).error, 'BRIDGE_TOKEN_INVALID');

  const claim = await post(`/api/auth/handoff/${id}/claim`);
  assert.equal(claim.status, 200);
  const cookieHeader = claim.headers.get('set-cookie');
  assert.match(cookieHeader || '', /^knoux_auth_session=/);
  assert.match(cookieHeader || '', /HttpOnly/);
  assert.match(cookieHeader || '', /SameSite=Strict/);
  const cookie = (cookieHeader || '').split(';')[0];
  const body = await claim.json();
  assert.equal(body.authenticated, true);
  assert.equal(body.user.id, 'test-google');
  assert.equal(JSON.stringify(body).includes('access_token'), false);

  const status = await fetch(`${baseUrl}/api/auth/status`, { headers: { Origin: ORIGIN, Cookie: cookie } });
  const statusBody = await status.json();
  assert.equal(statusBody.authenticated, true);
  assert.equal(statusBody.user.provider, 'google');

  const unauthorizedRun = await post('/api/runs');
  assert.equal(unauthorizedRun.status, 401);
  assert.equal((await unauthorizedRun.json()).error, 'AUTH_REQUIRED');

  const authorizedUnknownTool = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST',
    headers: { ...mutationHeaders(), Cookie: cookie },
    body: JSON.stringify({ toolId: 'NO_SUCH_TOOL', mode: 'run' }),
  });
  assert.equal(authorizedUnknownTool.status, 400);
  assert.equal((await authorizedUnknownTool.json()).error, 'UNKNOWN_TOOL');

  if (process.platform === 'win32') {
    assert.equal(__authTest.persistSessions(), true, 'Windows session state must persist through DPAPI');
    const encrypted = fs.readFileSync(__authTest.sessionStorePath, 'utf8');
    assert.equal(encrypted.includes('test-google'), false, 'DPAPI store must not contain plaintext account metadata');
    __authTest.clearInMemorySessions();
    assert.equal(__authTest.loadPersistedSessions(), true, 'DPAPI session store must restore');
    const restored = __authTest.authStatus({ headers: { cookie } });
    assert.equal(restored.authenticated, true);
    assert.equal(restored.user.provider, 'google');
  }

  const logout = await post('/api/auth/logout', cookie);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie') || '', /Max-Age=0/);
  const after = await fetch(`${baseUrl}/api/auth/status`, { headers: { Origin: ORIGIN, Cookie: cookie } });
  assert.equal((await after.json()).authenticated, false);
});

test('provider cancellation and explicit app cancellation do not create sessions', async () => {
  const providerCancelId = handoff('p');
  const auth = await start('github', providerCancelId);
  const state = auth.searchParams.get('state');
  const callback = await fetch(`${baseUrl}/api/auth/callback/github?state=${encodeURIComponent(state)}&error=access_denied`);
  assert.equal(callback.status, 200);
  const claim = await post(`/api/auth/handoff/${providerCancelId}/claim`);
  assert.equal(claim.status, 409);
  assert.equal((await claim.json()).error, 'AUTH_CANCELLED');

  const appCancelId = handoff('x');
  await start('entra', appCancelId);
  const cancel = await fetch(`${baseUrl}/api/auth/handoff/${appCancelId}/cancel`, {
    method: 'POST', headers: { Origin: ORIGIN, 'X-Knoux-Bridge-Token': TOKEN },
  });
  assert.equal(cancel.status, 200);
  const cancelledClaim = await post(`/api/auth/handoff/${appCancelId}/claim`);
  assert.equal(cancelledClaim.status, 409);
  assert.equal((await cancelledClaim.json()).error, 'AUTH_CANCELLED');
});
