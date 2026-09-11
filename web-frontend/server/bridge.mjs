/**
 * KNOUX REPAIR — Authentication closeout wrapper
 *
 * The canonical tool/runtime bridge is preserved byte-for-byte in
 * bridge-core.mjs. This wrapper owns Mission 00 authentication and delegates
 * every non-auth route to the canonical bridge request handler.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_ENV_PATH = path.join(SERVER_DIR, '..', '.env.local');

function loadLocalEnv() {
  if (process.env.KNOUX_IGNORE_DOTENV === '1' || !fs.existsSync(LOCAL_ENV_PATH)) return;
  for (const rawLine of fs.readFileSync(LOCAL_ENV_PATH, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (/^[A-Z][A-Z0-9_]*$/.test(name) && value && !process.env[name]) process.env[name] = value;
  }
}
loadLocalEnv();

if (!process.env.KNOUX_AUTH_FRONTEND_ORIGIN) {
  process.env.KNOUX_AUTH_FRONTEND_ORIGIN = 'http://127.0.0.1:3000';
}

const AUTH_REQUIRED = process.env.KNOUX_AUTH_REQUIRED === 'true';
const AUTH_FRONTEND_ORIGIN = process.env.KNOUX_AUTH_FRONTEND_ORIGIN;
const originalAuthRequired = process.env.KNOUX_AUTH_REQUIRED;
// Mission 00 auth is enforced here. Disable the legacy in-memory OAuth gate in
// the preserved core so there is one public authentication authority only.
process.env.KNOUX_AUTH_REQUIRED = 'false';
const core = await import('./bridge-core.mjs');
if (originalAuthRequired === undefined) delete process.env.KNOUX_AUTH_REQUIRED;
else process.env.KNOUX_AUTH_REQUIRED = originalAuthRequired;

const {
  resolveBrowsePath,
  browseRoots,
  browseFolders,
  createRun,
  cancelRun,
  killProcessTree,
  isAllowedOrigin,
  checkMutationGuard,
  ALLOWED_ORIGINS,
  manifest,
  menuIndex,
  EXECUTION_MODES,
  RISK_LEVELS,
  normalizeConfirmation,
  validateExecutionRequest,
  buildExecutionContext,
  resolveResourceRoot,
  RESOURCE_MODE,
  server,
  PORT,
} = core;

const TEST_MODE = process.env.KNOUX_BRIDGE_TEST_MODE === '1';
const AUTH_SESSION_TTL_MS = TEST_MODE && Number(process.env.KNOUX_AUTH_TEST_SESSION_TTL_MS) >= 250
  ? Number(process.env.KNOUX_AUTH_TEST_SESSION_TTL_MS)
  : 8 * 60 * 60 * 1000;
const AUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;
const AUTH_HANDOFF_TTL_MS = 3 * 60 * 1000;
const AUTH_COOKIE = 'knoux_auth_session';
const MAX_PENDING_AUTH = 128;
const HANDOFF_PATTERN = /^[A-Za-z0-9_-]{24,128}$/;
const AUTH_SESSION_STORE = process.env.KNOUX_AUTH_SESSION_STORE || path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'KNOUX', 'Repair', 'auth-session.dpapi',
);

const authTransactions = new Map();
const authHandoffs = new Map();
const authSessions = new Map();

function authProviders() {
  return {
    google: {
      id: 'google',
      label: 'Google',
      configured: Boolean(process.env.GOOGLE_CLIENT_ID),
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callback: `http://127.0.0.1:${PORT}/api/auth/callback/google`,
    },
    github: {
      id: 'github',
      label: 'GitHub OAuth',
      configured: Boolean(process.env.KNOUX_GITHUB_CLIENT_ID && process.env.KNOUX_GITHUB_CLIENT_SECRET),
      clientId: process.env.KNOUX_GITHUB_CLIENT_ID || '',
      clientSecret: process.env.KNOUX_GITHUB_CLIENT_SECRET || '',
      callback: `http://127.0.0.1:${PORT}/api/auth/callback/github`,
    },
    entra: {
      id: 'entra',
      label: 'Microsoft Entra ID',
      configured: Boolean(process.env.KNOUX_ENTRA_CLIENT_ID),
      clientId: process.env.KNOUX_ENTRA_CLIENT_ID || '',
      clientSecret: process.env.KNOUX_ENTRA_CLIENT_SECRET || '',
      tenant: process.env.KNOUX_ENTRA_TENANT_ID || 'organizations',
      callback: `http://localhost:${PORT}/api/auth/callback/entra`,
    },
  };
}

function base64url(bytes) { return Buffer.from(bytes).toString('base64url'); }
function randomAuthValue() { return base64url(crypto.randomBytes(32)); }
function pkceChallenge(verifier) { return crypto.createHash('sha256').update(verifier).digest('base64url'); }
function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function dpapiCommand(mode) {
  const operation = mode === 'protect' ? 'Protect' : 'Unprotect';
  return [
    "$ErrorActionPreference='Stop'",
    '$raw=[Console]::In.ReadToEnd().Trim()',
    '$bytes=[Convert]::FromBase64String($raw)',
    `$result=[System.Security.Cryptography.ProtectedData]::${operation}($bytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)`,
    '[Console]::Out.Write([Convert]::ToBase64String($result))',
  ].join(';');
}

function runDpapi(mode, inputBase64) {
  if (process.platform !== 'win32') return null;
  const powershell = path.join(process.env.windir || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (!fs.existsSync(powershell)) return null;
  const encodedCommand = Buffer.from(dpapiCommand(mode), 'utf16le').toString('base64');
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedCommand], {
    input: inputBase64,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) return null;
  const output = String(result.stdout || '').trim();
  return /^[A-Za-z0-9+/=]+$/.test(output) ? output : null;
}

function serializeSessions() {
  const now = Date.now();
  return JSON.stringify([...authSessions.entries()]
    .filter(([, session]) => session.expiresAt > now)
    .map(([id, session]) => ({ id, ...session })));
}

function persistSessions() {
  if (process.platform !== 'win32') return false;
  try {
    const payload = Buffer.from(serializeSessions(), 'utf8').toString('base64');
    const protectedPayload = runDpapi('protect', payload);
    if (!protectedPayload) return false;
    fs.mkdirSync(path.dirname(AUTH_SESSION_STORE), { recursive: true });
    const temp = `${AUTH_SESSION_STORE}.${process.pid}.tmp`;
    fs.writeFileSync(temp, protectedPayload, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, AUTH_SESSION_STORE);
    return true;
  } catch {
    return false;
  }
}

function loadPersistedSessions() {
  if (process.platform !== 'win32' || !fs.existsSync(AUTH_SESSION_STORE)) return false;
  try {
    const protectedPayload = fs.readFileSync(AUTH_SESSION_STORE, 'utf8').trim();
    const plainBase64 = runDpapi('unprotect', protectedPayload);
    if (!plainBase64) return false;
    const entries = JSON.parse(Buffer.from(plainBase64, 'base64').toString('utf8'));
    if (!Array.isArray(entries)) return false;
    const now = Date.now();
    authSessions.clear();
    for (const entry of entries) {
      if (!entry || typeof entry.id !== 'string' || entry.id.length < 24 || entry.expiresAt <= now) continue;
      if (!['google', 'github', 'entra'].includes(entry.provider) || !entry.user || typeof entry.user.id !== 'string') continue;
      authSessions.set(entry.id, {
        provider: entry.provider,
        user: {
          id: String(entry.user.id),
          name: String(entry.user.name || ''),
          handle: String(entry.user.handle || ''),
          avatarUrl: String(entry.user.avatarUrl || ''),
        },
        createdAt: Number(entry.createdAt || now),
        expiresAt: Number(entry.expiresAt),
      });
    }
    return true;
  } catch {
    return false;
  }
}
loadPersistedSessions();

function clearExpiredAuth() {
  const now = Date.now();
  for (const [id, transaction] of authTransactions) if (transaction.expiresAt < now) authTransactions.delete(id);
  for (const [id, handoff] of authHandoffs) if (handoff.expiresAt < now) authHandoffs.delete(id);
  let sessionChanged = false;
  for (const [id, session] of authSessions) {
    if (session.expiresAt < now) { authSessions.delete(id); sessionChanged = true; }
  }
  if (sessionChanged) persistSessions();
}

function authSession(req) {
  clearExpiredAuth();
  const id = parseCookies(req.headers.cookie)[AUTH_COOKIE];
  const session = id ? authSessions.get(id) : null;
  return session ? { id, ...session } : null;
}

function authStatus(req) {
  const cookieId = parseCookies(req.headers.cookie)[AUTH_COOKIE];
  const before = cookieId ? authSessions.get(cookieId) : null;
  const session = authSession(req);
  const providers = authProviders();
  return {
    required: AUTH_REQUIRED,
    mode: AUTH_REQUIRED ? 'protected' : 'local',
    authenticated: Boolean(session),
    sessionState: session ? 'active' : (cookieId && before && before.expiresAt <= Date.now() ? 'expired' : 'none'),
    providers: Object.fromEntries(Object.entries(providers).map(([id, provider]) => [id, {
      label: provider.label,
      configured: provider.configured,
    }])),
    user: session ? {
      provider: session.provider,
      id: session.user.id,
      name: session.user.name,
      handle: session.user.handle,
      avatarUrl: session.user.avatarUrl || '',
    } : null,
  };
}

function createAuthSession(identity) {
  const id = randomAuthValue();
  const now = Date.now();
  authSessions.set(id, {
    provider: identity.provider,
    user: identity.user,
    createdAt: now,
    expiresAt: now + AUTH_SESSION_TTL_MS,
  });
  persistSessions();
  return {
    id,
    cookie: `${AUTH_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(AUTH_SESSION_TTL_MS / 1000)}`,
  };
}

function clearAuthSession(req) {
  const id = parseCookies(req.headers.cookie)[AUTH_COOKIE];
  if (id) authSessions.delete(id);
  persistSessions();
  return `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

function trimPendingAuth() {
  clearExpiredAuth();
  while (authTransactions.size >= MAX_PENDING_AUTH || authHandoffs.size >= MAX_PENDING_AUTH) {
    const firstTransaction = authTransactions.keys().next().value;
    if (firstTransaction) authTransactions.delete(firstTransaction);
    const firstHandoff = authHandoffs.keys().next().value;
    if (firstHandoff) authHandoffs.delete(firstHandoff);
    if (!firstTransaction && !firstHandoff) break;
  }
}

function createAuthTransaction(providerId, handoffId) {
  trimPendingAuth();
  const providers = authProviders();
  const provider = providers[providerId];
  if (!provider || !provider.configured) {
    throw Object.assign(new Error('The requested authentication provider is not configured in the local bridge.'), { status: 503, code: 'AUTH_PROVIDER_UNAVAILABLE' });
  }
  if (!HANDOFF_PATTERN.test(handoffId || '')) {
    throw Object.assign(new Error('Authentication handoff identifier is invalid.'), { status: 400, code: 'AUTH_HANDOFF_INVALID' });
  }
  const state = randomAuthValue();
  const verifier = randomAuthValue();
  authTransactions.set(state, { providerId, verifier, handoffId, expiresAt: Date.now() + AUTH_TRANSACTION_TTL_MS });
  authHandoffs.set(handoffId, { providerId, status: 'pending', expiresAt: Date.now() + AUTH_HANDOFF_TTL_MS });
  return { provider, state, verifier };
}

function authorizationUrl(providerId, handoffId) {
  const { provider, state, verifier } = createAuthTransaction(providerId, handoffId);
  const challenge = pkceChallenge(verifier);
  if (providerId === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: provider.clientId,
      response_type: 'code',
      redirect_uri: provider.callback,
      scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    return url.toString();
  }
  if (providerId === 'github') {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.callback,
      scope: 'read:user user:email',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      allow_signup: 'false',
    }).toString();
    return url.toString();
  }
  const url = new URL(`https://login.microsoftonline.com/${encodeURIComponent(provider.tenant)}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({
    client_id: provider.clientId,
    response_type: 'code',
    redirect_uri: provider.callback,
    response_mode: 'query',
    scope: 'User.Read',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

async function readJson(response, label) {
  let payload = null;
  try { payload = await response.json(); } catch { /* normalized below */ }
  if (!response.ok || !payload || typeof payload !== 'object') {
    throw Object.assign(new Error(`${label} could not complete the authentication exchange.`), { status: 502, code: 'AUTH_EXCHANGE_FAILED' });
  }
  return payload;
}

function takeTransaction(providerId, state) {
  clearExpiredAuth();
  const transaction = typeof state === 'string' ? authTransactions.get(state) : null;
  if (state) authTransactions.delete(state);
  if (!transaction || transaction.providerId !== providerId) {
    throw Object.assign(new Error('The authentication state is invalid or expired. Start sign-in again.'), { status: 400, code: 'AUTH_STATE_INVALID' });
  }
  return transaction;
}

async function exchangeIdentity(providerId, code, transaction) {
  const providers = authProviders();
  const provider = providers[providerId];
  if (!provider || !provider.configured) {
    throw Object.assign(new Error('The authentication provider is not configured.'), { status: 503, code: 'AUTH_PROVIDER_UNAVAILABLE' });
  }
  if (!code) throw Object.assign(new Error('The authentication provider did not return a code.'), { status: 400, code: 'AUTH_CODE_MISSING' });

  if (TEST_MODE && code === 'knoux-test-code') {
    return { provider: providerId, user: { id: `test-${providerId}`, name: `Test ${provider.label}`, handle: `test-${providerId}`, avatarUrl: '' } };
  }

  if (providerId === 'google') {
    const tokenBody = new URLSearchParams({
      client_id: provider.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: provider.callback,
      code_verifier: transaction.verifier,
    });
    if (provider.clientSecret) tokenBody.set('client_secret', provider.clientSecret);
    const token = await readJson(await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    }), 'Google');
    if (typeof token.access_token !== 'string') throw Object.assign(new Error('Google did not return an access token.'), { status: 502, code: 'AUTH_TOKEN_MISSING' });
    const profile = await readJson(await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }), 'Google');
    return {
      provider: providerId,
      user: {
        id: String(profile.sub || ''),
        name: String(profile.name || profile.email || 'Google user'),
        handle: String(profile.email || ''),
        avatarUrl: typeof profile.picture === 'string' ? profile.picture : '',
      },
    };
  }

  if (providerId === 'github') {
    const token = await readJson(await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code,
        redirect_uri: provider.callback,
        code_verifier: transaction.verifier,
      }),
    }), 'GitHub');
    if (typeof token.access_token !== 'string') throw Object.assign(new Error('GitHub did not return an access token.'), { status: 502, code: 'AUTH_TOKEN_MISSING' });
    const profile = await readJson(await fetch('https://api.github.com/user', {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'KNOUX-Repair-Local' },
    }), 'GitHub');
    return {
      provider: providerId,
      user: {
        id: String(profile.id),
        name: String(profile.name || profile.login || 'GitHub user'),
        handle: String(profile.login || ''),
        avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : '',
      },
    };
  }

  const tokenBody = new URLSearchParams({
    client_id: provider.clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: provider.callback,
    code_verifier: transaction.verifier,
    scope: 'User.Read',
  });
  if (provider.clientSecret) tokenBody.set('client_secret', provider.clientSecret);
  const token = await readJson(await fetch(`https://login.microsoftonline.com/${encodeURIComponent(provider.tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
  }), 'Microsoft Entra ID');
  if (typeof token.access_token !== 'string') throw Object.assign(new Error('Microsoft Entra ID did not return an access token.'), { status: 502, code: 'AUTH_TOKEN_MISSING' });
  const profile = await readJson(await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }), 'Microsoft Entra ID');
  return {
    provider: providerId,
    user: {
      id: String(profile.id),
      name: String(profile.displayName || profile.userPrincipalName || profile.mail || 'Microsoft user'),
      handle: String(profile.userPrincipalName || profile.mail || ''),
      avatarUrl: '',
    },
  };
}

function finishHandoff(handoffId, result) {
  const current = authHandoffs.get(handoffId);
  if (!current) return;
  authHandoffs.set(handoffId, { ...current, ...result, expiresAt: Date.now() + AUTH_HANDOFF_TTL_MS });
}

function cancelHandoff(handoffId, code = 'AUTH_CANCELLED') {
  const handoff = authHandoffs.get(handoffId);
  if (!handoff) return false;
  finishHandoff(handoffId, { status: 'error', error: code, message: code === 'AUTH_CANCELLED' ? 'Authentication was cancelled.' : 'Authentication could not be completed.' });
  for (const [state, transaction] of authTransactions) if (transaction.handoffId === handoffId) authTransactions.delete(state);
  return true;
}

function corsHeadersFor(origin) {
  if (!isAllowedOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Knoux-Bridge-Token',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

function sendError(res, status, code, message, headers = {}) {
  sendJson(res, status, { ok: false, error: code, message }, headers);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function sendBrowserResult(res, ok, title, detail) {
  const safeTitle = escapeHtml(title);
  const safeDetail = escapeHtml(detail);
  res.writeHead(ok ? 200 : 400, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>html{font-family:system-ui;background:#070913;color:#eef2ff}body{min-height:100vh;display:grid;place-items:center;margin:0}.card{max-width:520px;padding:32px;border:1px solid #ffffff1f;border-radius:24px;background:#ffffff0d;box-shadow:0 24px 80px #0008}h1{margin:0 0 10px;font-size:24px}p{margin:0;color:#b9c2dd;line-height:1.6}</style></head><body><main class="card"><h1>${safeTitle}</h1><p>${safeDetail}</p></main></body></html>`);
}

function isAuthPath(parts) { return parts[0] === 'api' && parts[1] === 'auth'; }
function isProtectedRun(parts, method) { return method === 'POST' && parts[0] === 'api' && parts[1] === 'runs' && parts.length === 2; }

const [coreRequestHandler] = server.listeners('request');
if (typeof coreRequestHandler !== 'function') throw new Error('Canonical bridge request handler is unavailable.');
server.removeAllListeners('request');
server.on('request', async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const parts = url.pathname.split('/').filter(Boolean);
  const corsHeaders = corsHeadersFor(req.headers.origin);

  try {
    if (req.method === 'OPTIONS' && isAuthPath(parts)) {
      if (req.headers.origin && !isAllowedOrigin(req.headers.origin)) return sendError(res, 403, 'ORIGIN_FORBIDDEN', 'The request origin is not an approved local KNOUX origin.');
      res.writeHead(204, { ...corsHeaders, 'Cache-Control': 'no-store' });
      return res.end();
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'auth' && parts[2] === 'status' && parts.length === 3) {
      return sendJson(res, 200, { ok: true, ...authStatus(req) }, corsHeaders);
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'auth' && parts[2] === 'start' && parts[3] && parts.length === 4) {
      const providerId = decodeURIComponent(parts[3]);
      const handoffId = url.searchParams.get('handoff') || '';
      try {
        const location = authorizationUrl(providerId, handoffId);
        res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
        return res.end();
      } catch (error) {
        return sendBrowserResult(res, false, 'KNOUX Repair sign-in unavailable', error.message || 'Authentication could not be started.');
      }
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'auth' && parts[2] === 'callback' && parts[3] && parts.length === 4) {
      const providerId = decodeURIComponent(parts[3]);
      let transaction;
      try {
        transaction = takeTransaction(providerId, url.searchParams.get('state'));
        const providerError = url.searchParams.get('error');
        if (providerError) {
          const cancelled = providerError === 'access_denied' || providerError === 'user_cancelled';
          finishHandoff(transaction.handoffId, {
            status: 'error',
            error: cancelled ? 'AUTH_CANCELLED' : 'AUTH_PROVIDER_ERROR',
            message: cancelled ? 'Authentication was cancelled.' : 'The identity provider returned an authentication error.',
          });
          return sendBrowserResult(res, cancelled, cancelled ? 'Sign-in cancelled' : 'Sign-in failed', 'Return to KNOUX Repair. No credential was stored.');
        }
        const identity = await exchangeIdentity(providerId, url.searchParams.get('code'), transaction);
        finishHandoff(transaction.handoffId, { status: 'complete', identity });
        return sendBrowserResult(res, true, 'Sign-in complete', 'Return to KNOUX Repair. This browser tab can be closed.');
      } catch (error) {
        if (transaction?.handoffId) finishHandoff(transaction.handoffId, { status: 'error', error: error.code || 'AUTH_FAILED', message: error.message || 'Authentication failed.' });
        return sendBrowserResult(res, false, 'Sign-in failed', error.message || 'Authentication could not be completed.');
      }
    }

    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'auth' && parts[2] === 'handoff' && parts[3] && parts[4] === 'claim' && parts.length === 5) {
      const guard = checkMutationGuard(req);
      if (guard) return sendError(res, guard.status, guard.code, guard.message, corsHeaders);
      clearExpiredAuth();
      const handoffId = decodeURIComponent(parts[3]);
      const handoff = authHandoffs.get(handoffId);
      if (!handoff) return sendError(res, 404, 'AUTH_HANDOFF_NOT_FOUND', 'Authentication handoff is unavailable or expired.', corsHeaders);
      if (handoff.status === 'pending') return sendJson(res, 202, { ok: false, pending: true }, corsHeaders);
      if (handoff.status === 'error') {
        authHandoffs.delete(handoffId);
        return sendError(res, 409, handoff.error || 'AUTH_FAILED', handoff.message || 'Authentication failed.', corsHeaders);
      }
      if (handoff.status !== 'complete' || !handoff.identity) return sendError(res, 409, 'AUTH_HANDOFF_INVALID', 'Authentication handoff is not claimable.', corsHeaders);
      const session = createAuthSession(handoff.identity);
      authHandoffs.delete(handoffId);
      return sendJson(res, 200, { ok: true, authenticated: true, user: handoff.identity.user }, { ...corsHeaders, 'Set-Cookie': session.cookie });
    }

    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'auth' && parts[2] === 'handoff' && parts[3] && parts[4] === 'cancel' && parts.length === 5) {
      const guard = checkMutationGuard(req, { jsonBody: false });
      if (guard) return sendError(res, guard.status, guard.code, guard.message, corsHeaders);
      const found = cancelHandoff(decodeURIComponent(parts[3]));
      return sendJson(res, found ? 200 : 404, found ? { ok: true } : { ok: false, error: 'AUTH_HANDOFF_NOT_FOUND', message: 'Authentication handoff is unavailable or expired.' }, corsHeaders);
    }

    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'auth' && parts[2] === 'logout' && parts.length === 3) {
      const guard = checkMutationGuard(req);
      if (guard) return sendError(res, guard.status, guard.code, guard.message, corsHeaders);
      const cookie = clearAuthSession(req);
      return sendJson(res, 200, { ok: true }, { ...corsHeaders, 'Set-Cookie': cookie });
    }

    if (isAuthPath(parts)) return sendError(res, 404, 'NOT_FOUND', `No route for ${req.method} ${url.pathname}`, corsHeaders);

    if (AUTH_REQUIRED && isProtectedRun(parts, req.method) && !authSession(req)) {
      return sendError(res, 401, 'AUTH_REQUIRED', 'Sign in with an approved local provider before running a repair service.', corsHeaders);
    }

    return coreRequestHandler(req, res);
  } catch (error) {
    if (!res.headersSent) return sendError(res, error.status || 500, error.code || 'INTERNAL', error.message || 'Internal error', corsHeaders);
    try { res.end(); } catch { /* connection already settled */ }
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[KNOUX] Bridge listening on http://127.0.0.1:${PORT} (auth=${AUTH_REQUIRED ? 'protected' : 'local'})`);
  });
}

const __authTest = Object.freeze({
  authProviders,
  authorizationUrl,
  authStatus,
  createAuthSession,
  loadPersistedSessions,
  persistSessions,
  clearInMemorySessions() { authSessions.clear(); },
  sessionStorePath: AUTH_SESSION_STORE,
});

export {
  resolveBrowsePath,
  browseRoots,
  browseFolders,
  createRun,
  cancelRun,
  killProcessTree,
  isAllowedOrigin,
  checkMutationGuard,
  ALLOWED_ORIGINS,
  manifest,
  menuIndex,
  EXECUTION_MODES,
  RISK_LEVELS,
  normalizeConfirmation,
  validateExecutionRequest,
  buildExecutionContext,
  resolveResourceRoot,
  RESOURCE_MODE,
  server,
  PORT,
  __authTest,
};
