import { spawnSync } from 'node:child_process';

export const CANONICAL_MCP_SERVICE_URL = 'https://knoux-mcp-gateway-ewyqpoh6ra-uc.a.run.app';
export const CANONICAL_MCP_ENDPOINT = `${CANONICAL_MCP_SERVICE_URL}/mcp`;
export const CANONICAL_MCP_AUDIENCE = CANONICAL_MCP_SERVICE_URL;
export const DOCUMENTED_MCP_ALIAS = 'https://knoux-mcp-gateway-30719047550.us-central1.run.app';
export const DEFAULT_MCP_INVOKER_SERVICE_ACCOUNT = 'knoux-mcp-invoker@knoux-repair.iam.gserviceaccount.com';
export const MCP_TOOL = 'gateway_status';
export const MODERN_MCP_VERSION = '2026-07-28';
export const LEGACY_MCP_VERSION = '2025-11-25';
const CLIENT = { name: 'KNOUX Repair', version: '2.0.2' };
const SENSITIVE = /(secret|token|password|credential|authorization|api.?key|private.?key|cookie)/i;
const JWT = /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b/g;
const signal = ms => typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(ms) : undefined;
const isToken = value => typeof value === 'string' && value.length > 80 && value.split('.').length === 3;

export function getMcpContract(env = process.env) {
  const requested = String(env.KNOUX_MCP_ENDPOINT || '').trim();
  if (requested && requested !== CANONICAL_MCP_ENDPOINT) throw Object.assign(new Error('KNOUX_MCP_ENDPOINT must match the canonical private MCP endpoint exactly.'), { code: 'MCP_ENDPOINT_MISMATCH' });
  const audience = String(env.KNOUX_MCP_AUDIENCE || CANONICAL_MCP_AUDIENCE).trim();
  if (!audience || audience.endsWith('/') || audience.endsWith('/mcp')) throw Object.assign(new Error('KNOUX_MCP_AUDIENCE must be the Cloud Run service audience.'), { code: 'MCP_AUDIENCE_INVALID' });
  const tokenSource = String(env.KNOUX_MCP_TOKEN_SOURCE || 'auto').toLowerCase();
  if (!['auto', 'metadata', 'gcloud'].includes(tokenSource)) throw Object.assign(new Error('KNOUX_MCP_TOKEN_SOURCE must be auto, metadata, or gcloud.'), { code: 'MCP_TOKEN_SOURCE_INVALID' });
  return Object.freeze({
    endpoint: CANONICAL_MCP_ENDPOINT, audience, documentedAlias: DOCUMENTED_MCP_ALIAS,
    invokerServiceAccount: String(env.KNOUX_MCP_INVOKER_SERVICE_ACCOUNT || DEFAULT_MCP_INVOKER_SERVICE_ACCOUNT).trim(),
    service: 'knoux-mcp-gateway', region: 'us-central1', tool: MCP_TOOL,
    authentication: 'Google Cloud ID token', tokenSource, tokenSources: ['metadata', 'gcloud'],
    privateRequired: true, publicFallback: false, modernProtocol: MODERN_MCP_VERSION, legacyFallbackProtocol: LEGACY_MCP_VERSION,
  });
}

async function metadataToken(fetchImpl, audience) {
  const url = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}&format=full`;
  const r = await fetchImpl(url, { headers: { 'Metadata-Flavor': 'Google' }, signal: signal(2000) });
  if (!r.ok) throw new Error(`metadata HTTP ${r.status}`);
  const token = String(await r.text()).trim();
  if (!isToken(token)) throw new Error('metadata returned no ID token');
  return token;
}

function gcloudToken(spawn, audience, platform, account) {
  const exe = platform === 'win32' ? 'gcloud.cmd' : 'gcloud';
  const args = ['auth', 'print-identity-token', `--audiences=${audience}`, '--include-email', '--quiet', `--impersonate-service-account=${account}`];
  const r = spawn(exe, args, { encoding: 'utf8', windowsHide: true, timeout: 12000, maxBuffer: 1024 * 1024 });
  const token = String(r?.stdout || '').trim();
  if (r?.status !== 0 || !isToken(token)) throw new Error('gcloud could not mint the invoker ID token');
  return token;
}

export async function acquireMcpIdToken({ source = 'auto', audience = CANONICAL_MCP_AUDIENCE, fetchImpl = globalThis.fetch, spawnSyncImpl = spawnSync, platform = process.platform, impersonateServiceAccount = DEFAULT_MCP_INVOKER_SERVICE_ACCOUNT } = {}) {
  const attempts = source === 'auto' ? ['metadata', 'gcloud'] : [source];
  for (const candidate of attempts) {
    try {
      const token = candidate === 'metadata' ? await metadataToken(fetchImpl, audience) : gcloudToken(spawnSyncImpl, audience, platform, impersonateServiceAccount);
      return { token, source: candidate };
    } catch { /* fail closed after all configured sources */ }
  }
  throw Object.assign(new Error('No authenticated Google Cloud ID-token source is available to this runtime.'), { code: 'MCP_IDENTITY_UNAVAILABLE' });
}

function headers(token, version, sessionId = '') {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': version, ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}) };
}

async function parsed(fetchImpl, endpoint, init) {
  const r = await fetchImpl(endpoint, init);
  const text = String(await r.text());
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {
    const data = text.split(/\r?\n/).filter(x => x.startsWith('data:')).map(x => x.slice(5).trim()).filter(Boolean).at(-1);
    try { body = data ? JSON.parse(data) : null; } catch { body = null; }
  }
  return { r, body };
}
const succeeded = x => Boolean(x.r.ok && x.body?.result && !x.body?.error);

async function authenticatedCall(fetchImpl, endpoint, token) {
  const modern = await parsed(fetchImpl, endpoint, { method: 'POST', headers: { ...headers(token, MODERN_MCP_VERSION), 'Mcp-Method': 'tools/call', 'Mcp-Name': MCP_TOOL }, body: JSON.stringify({ jsonrpc: '2.0', id: 'modern', method: 'tools/call', params: { name: MCP_TOOL, arguments: {} } }), signal: signal(12000) });
  if (modern.r.status === 401 || modern.r.status === 403) throw Object.assign(new Error(`Cloud Run rejected invoker with HTTP ${modern.r.status}`), { code: 'MCP_INVOKER_DENIED' });
  if (succeeded(modern)) return { ...modern, era: 'modern', version: MODERN_MCP_VERSION, sessionBound: false };

  const init = await parsed(fetchImpl, endpoint, { method: 'POST', headers: headers(token, LEGACY_MCP_VERSION), body: JSON.stringify({ jsonrpc: '2.0', id: 'init', method: 'initialize', params: { protocolVersion: LEGACY_MCP_VERSION, capabilities: {}, clientInfo: CLIENT } }), signal: signal(12000) });
  if (!succeeded(init)) throw Object.assign(new Error(`MCP initialize failed with HTTP ${init.r.status}`), { code: 'MCP_HANDSHAKE_FAILED' });
  const sessionId = String(init.r.headers?.get?.('mcp-session-id') || '');
  const h = headers(token, LEGACY_MCP_VERSION, sessionId);
  const initialized = await fetchImpl(endpoint, { method: 'POST', headers: h, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }), signal: signal(8000) });
  if (!initialized.ok && ![202, 204].includes(initialized.status)) throw Object.assign(new Error(`MCP initialized notification failed with HTTP ${initialized.status}`), { code: 'MCP_INITIALIZED_NOTIFICATION_FAILED' });
  const tool = await parsed(fetchImpl, endpoint, { method: 'POST', headers: h, body: JSON.stringify({ jsonrpc: '2.0', id: 'gateway', method: 'tools/call', params: { name: MCP_TOOL, arguments: {} } }), signal: signal(12000) });
  if (!succeeded(tool)) throw Object.assign(new Error(`gateway_status failed with HTTP ${tool.r.status}`), { code: 'MCP_GATEWAY_STATUS_FAILED' });
  return { ...tool, era: 'legacy', version: String(init.body.result.protocolVersion || LEGACY_MCP_VERSION), sessionBound: Boolean(sessionId) };
}

function sanitize(value, key = '', depth = 0) {
  if (depth > 8) return '[depth-limit]';
  if (SENSITIVE.test(key)) return '[redacted]';
  if (typeof value === 'string') return value.replace(JWT, '[redacted-token]').slice(0, 8192);
  if (Array.isArray(value)) return value.slice(0, 100).map(x => sanitize(x, '', depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 100).map(([k, v]) => [k, sanitize(v, k, depth + 1)]));
  return value;
}

export function extractGatewayStatusPayload(body) {
  const result = body?.result;
  if (!result || result.isError === true) throw Object.assign(new Error('gateway_status returned an MCP tool error.'), { code: 'MCP_GATEWAY_STATUS_FAILED' });
  if (result.structuredContent != null) return sanitize(result.structuredContent);
  const text = Array.isArray(result.content) ? result.content.filter(x => x?.type === 'text').map(x => x.text) : [];
  if (text.length === 1) { try { return sanitize(JSON.parse(text[0])); } catch { return sanitize(text[0]); } }
  return sanitize(text.length ? text : result);
}

export async function checkPrivateMcpBoundary({ fetchImpl = globalThis.fetch, endpoint = CANONICAL_MCP_ENDPOINT } = {}) {
  try {
    const r = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': MODERN_MCP_VERSION }, body: JSON.stringify({ jsonrpc: '2.0', id: 'privacy', method: 'tools/call', params: { name: MCP_TOOL, arguments: {} } }), signal: signal(8000), redirect: 'manual' });
    if ([401, 403].includes(r.status)) return { state: 'confirmed-private', httpStatus: r.status, evidence: `Unauthenticated Cloud Run request denied with HTTP ${r.status}.` };
    if (r.ok) return { state: 'public-or-misconfigured', httpStatus: r.status, evidence: 'Unauthenticated MCP request was accepted.' };
    return { state: 'unconfirmed', httpStatus: r.status, evidence: `Unauthenticated request returned HTTP ${r.status}.` };
  } catch (error) { return { state: 'unavailable', httpStatus: null, evidence: error instanceof Error ? error.message : String(error) }; }
}

export async function runPrivateMcpProbe({ env = process.env, fetchImpl = globalThis.fetch, spawnSyncImpl = spawnSync, tokenProvider, now = () => new Date() } = {}) {
  const contract = getMcpContract(env);
  const privacy = await checkPrivateMcpBoundary({ fetchImpl, endpoint: contract.endpoint });
  const base = { contract, checkedAt: now().toISOString(), privacy, identity: { state: 'unavailable', source: null }, protocol: { state: 'unavailable', era: null, version: null, sessionBound: false }, gatewayStatus: { state: 'unavailable', tool: MCP_TOOL, payload: null, receivedAt: null } };
  if (privacy.state !== 'confirmed-private') return { ok: false, ...base, error: { code: 'MCP_PRIVATE_BOUNDARY_UNPROVEN', message: 'Private Cloud Run boundary was not proven.' } };
  let identity;
  try { identity = tokenProvider ? await tokenProvider({ audience: contract.audience }) : await acquireMcpIdToken({ source: contract.tokenSource, audience: contract.audience, fetchImpl, spawnSyncImpl, impersonateServiceAccount: contract.invokerServiceAccount }); }
  catch (error) { return { ok: false, ...base, error: { code: error?.code || 'MCP_IDENTITY_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) } }; }
  const token = typeof identity === 'string' ? identity : identity?.token;
  const source = typeof identity === 'string' ? 'injected' : identity?.source || 'injected';
  if (!isToken(token)) return { ok: false, ...base, error: { code: 'MCP_IDENTITY_INVALID', message: 'ID-token provider returned an invalid token.' } };
  try {
    const call = await authenticatedCall(fetchImpl, contract.endpoint, token);
    return { ok: true, ...base, identity: { state: 'available', source }, protocol: { state: 'success', era: call.era, version: call.version, sessionBound: call.sessionBound }, gatewayStatus: { state: 'success', tool: MCP_TOOL, payload: extractGatewayStatusPayload(call.body), receivedAt: now().toISOString() }, error: null };
  } catch (error) { return { ok: false, ...base, identity: { state: 'available', source }, error: { code: error?.code || 'MCP_PROBE_FAILED', message: error instanceof Error ? error.message : String(error) } }; }
}
