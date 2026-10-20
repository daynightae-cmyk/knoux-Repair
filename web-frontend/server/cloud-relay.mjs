import crypto from 'node:crypto';
import os from 'node:os';
import {
  CANONICAL_MCP_SERVICE_URL,
  CANONICAL_MCP_AUDIENCE,
  DEFAULT_MCP_INVOKER_SERVICE_ACCOUNT,
  acquireMcpIdToken,
} from './private-mcp.mjs';

const SENSITIVE = /(secret|token|password|credential|authorization|api.?key|private.?key|cookie)/i;
const JWT = /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b/g;
const DEFAULT_HEARTBEAT_MS = 10000;
const MIN_HEARTBEAT_MS = 5000;
const MAX_HEARTBEAT_MS = 15000;
const RETRY_MIN_MS = 2000;
const RETRY_MAX_MS = 30000;

function stableMachineId() {
  return crypto.createHash('sha256')
    .update(['KNOUX Repair', os.hostname(), process.platform, process.arch].join('|'))
    .digest('hex')
    .slice(0, 40);
}

function sanitize(value, key = '', depth = 0) {
  if (depth > 8) return '[depth-limit]';
  if (SENSITIVE.test(key)) return '[redacted]';
  if (typeof value === 'string') return value.replace(JWT, '[redacted-token]').slice(0, 16384);
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitize(item, '', depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).slice(0, 200).map(([k, v]) => [k, sanitize(v, k, depth + 1)]),
    );
  }
  return value;
}

function tokenExpiryMs(token) {
  try {
    const part = token.split('.')[1];
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    return Number(payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

function asError(code, message, status = 0) {
  return Object.assign(new Error(message), { code, status });
}

export function createCloudRelay({
  fetchImpl = globalThis.fetch,
  tokenProvider,
  toolsProvider,
  toolRunner,
  serviceUrl = CANONICAL_MCP_SERVICE_URL,
  audience = CANONICAL_MCP_AUDIENCE,
  machineId = stableMachineId(),
  machineLabel = os.hostname(),
  bridgeVersion = '2.0.3',
  log = console,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
  if (typeof toolsProvider !== 'function') throw new TypeError('toolsProvider is required');
  if (typeof toolRunner !== 'function') throw new TypeError('toolRunner is required');

  let stopped = false;
  let timer = null;
  let sessionId = '';
  let heartbeatMs = DEFAULT_HEARTBEAT_MS;
  let retryMs = RETRY_MIN_MS;
  let tokenCache = null;
  let commandActive = false;

  async function getToken(force = false) {
    const now = Date.now();
    if (!force && tokenCache?.token && tokenCache.expiresAt > now + 5 * 60 * 1000) {
      return tokenCache.token;
    }
    const identity = tokenProvider
      ? await tokenProvider({ audience })
      : await acquireMcpIdToken({
          audience,
          impersonateServiceAccount: DEFAULT_MCP_INVOKER_SERVICE_ACCOUNT,
        });
    const token = typeof identity === 'string' ? identity : identity?.token;
    if (!token || token.split('.').length !== 3) {
      throw asError('MCP_IDENTITY_INVALID', 'Cloud relay token provider returned an invalid ID token.');
    }
    tokenCache = { token, expiresAt: tokenExpiryMs(token) || now + 45 * 60 * 1000 };
    return token;
  }

  async function post(path, body, retryAuth = true) {
    const token = await getToken(false);
    const response = await fetchImpl(`${serviceUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(30000) : undefined,
    });
    if ((response.status === 401 || response.status === 403) && retryAuth) {
      tokenCache = null;
      await getToken(true);
      return post(path, body, false);
    }
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { /* handled below */ }
    if (!response.ok || payload?.ok === false) {
      throw asError(
        payload?.error || 'CLOUD_RELAY_HTTP_ERROR',
        payload?.message || `Cloud relay returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return payload || {};
  }

  async function register() {
    const tools = await toolsProvider();
    const result = await post('/bridge/register', {
      machine_id: machineId,
      machine_label: String(machineLabel).slice(0, 80),
      bridge_version: bridgeVersion,
      tools,
    });
    sessionId = String(result.session_id || '');
    if (!sessionId) throw asError('BRIDGE_REGISTER_FAILED', 'Gateway returned no bridge session id.');
    heartbeatMs = Math.max(
      MIN_HEARTBEAT_MS,
      Math.min(MAX_HEARTBEAT_MS, Number(result.heartbeat_seconds || 10) * 1000),
    );
    retryMs = RETRY_MIN_MS;
    log.info?.(`[KNOUX] Cloud relay registered ${result.accepted_read_only_tools || 0} READ_ONLY tools.`);
  }

  async function submit(commandId, result) {
    return post('/bridge/result', {
      machine_id: machineId,
      session_id: sessionId,
      command_id: commandId,
      result: sanitize(result),
    });
  }

  async function handleCommand(command) {
    const commandId = String(command?.command_id || '');
    if (!commandId) return;
    if (commandActive) {
      try {
        await submit(commandId, {
          status: 'error',
          error: { code: 'LOCAL_RUN_IN_PROGRESS', message: 'Another cloud-routed read-only tool is running.' },
        });
      } catch (error) {
        log.warn?.(`[KNOUX] Cloud relay could not report busy state: ${error?.code || error?.message || error}`);
      }
      return;
    }
    commandActive = true;
    try {
      if (command?.kind !== 'run_readonly_tool') {
        throw asError('COMMAND_KIND_UNSUPPORTED', 'Unsupported cloud relay command kind.');
      }
      const result = await toolRunner(String(command.tool_id || ''), command.options || {});
      await submit(commandId, { status: 'completed', run: sanitize(result) });
    } catch (error) {
      try {
        await submit(commandId, {
          status: 'error',
          error: {
            code: error?.code || 'LOCAL_TOOL_FAILED',
            message: String(error?.message || error).slice(0, 1000),
          },
        });
      } catch (reportError) {
        log.warn?.(`[KNOUX] Cloud relay result delivery failed: ${reportError?.code || reportError?.message || reportError}`);
      }
    } finally {
      commandActive = false;
    }
  }

  async function heartbeat() {
    if (!sessionId) await register();
    try {
      const result = await post('/bridge/heartbeat', {
        machine_id: machineId,
        session_id: sessionId,
      });
      retryMs = RETRY_MIN_MS;
      if (result.command) void handleCommand(result.command);
      return heartbeatMs;
    } catch (error) {
      if (['BRIDGE_SESSION_INVALID', 'LOCAL_BRIDGE_STALE'].includes(error?.code) || error?.status === 401) {
        sessionId = '';
      }
      throw error;
    }
  }

  function schedule(delay) {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => void cycle(), delay);
    timer.unref?.();
  }

  async function cycle() {
    if (stopped) return;
    try {
      const delay = await heartbeat();
      schedule(delay);
    } catch (error) {
      log.warn?.(`[KNOUX] Cloud relay unavailable: ${error?.code || error?.message || error}`);
      const delay = retryMs;
      retryMs = Math.min(RETRY_MAX_MS, retryMs * 2);
      schedule(delay);
    }
  }

  return {
    machineId,
    get connected() { return Boolean(sessionId); },
    start() {
      if (stopped) stopped = false;
      schedule(0);
      return this;
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
      sessionId = '';
    },
    async runOnce() {
      return heartbeat();
    },
  };
}

export function startCloudRelay(options = {}) {
  if (process.env.KNOUX_CLOUD_RELAY_ENABLED !== '1') return null;
  if (process.env.KNOUX_CLOUD_RELAY_DISABLED === '1') return null;
  return createCloudRelay(options).start();
}

export const __cloudRelayTest = Object.freeze({
  stableMachineId,
  sanitize,
  tokenExpiryMs,
});
