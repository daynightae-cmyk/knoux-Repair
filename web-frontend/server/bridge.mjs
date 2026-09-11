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

// bridge.mjs is the authentication authority; bridge-core.mjs remains the
// canonical tool/runtime authority. Fail closed if that delegated core ever
// loses one of the Phase 00 contracts this wrapper depends on. These are
// source-level invariants because the existing Phase 00 suite intentionally
// verifies that execution, registry, result and resource-root semantics remain
// present in the deployed bridge composition.
function assertDelegatedCoreContracts() {
  const source = fs.readFileSync(path.join(SERVER_DIR, 'bridge-core.mjs'), 'utf8');
  const requiredMarkers = [
    "pathParts[1] === 'categories'",
    "pathParts[1] === 'tools' && pathParts.length === 3",
    'KNOUX_EXECUTION_CONTEXT',
    "run.status = 'inconclusive'",
    'KNOUX_PROJECT_ROOT',
  ];
  for (const marker of requiredMarkers) {
    if (!source.includes(marker)) {
      throw new Error(`KNOUX bridge-core contract missing: ${marker}`);
    }
  }
}
assertDelegatedCoreContracts();

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
  // Windows PowerShell 5.1 does not guarantee ProtectedData is type-loaded in
  // every non-interactive host. Load System.Security explicitly before using
  // CurrentUser DPAPI so persistence behaves the same in CI and packaged runs.
  const operation = mode === 'protect' ? 'Protect' : 'Unprotect';
  return [
    "$ErrorActionPreference='Stop'",
    'Add-Type -AssemblyName System.Security',
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
