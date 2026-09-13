import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as authBridge from './bridge-auth.mjs';
import { getMcpContract, runPrivateMcpProbe } from './private-mcp.mjs';
import {
  verifyWorkbenchKey,
  getWorkbenchLockStatus,
  revokeWorkbenchSession,
  inspectZipArchive,
  inspectLocalFile,
  detectToolchain,
  getActiveDevPorts,
} from './workbenchEndpoints.mjs';

const { server, PORT, checkMutationGuard } = authBridge;
const SERVICE_URL = 'https://knoux-mcp-gateway-ewyqpoh6ra-uc.a.run.app';
const RUNTIME_ENDPOINT = `${SERVICE_URL}/mcp`;
const MISSION_ALIAS = 'https://knoux-mcp-gateway-30719047550.us-central1.run.app/mcp';
const here = path.dirname(fileURLToPath(import.meta.url));
const delegatedSource = fs.readFileSync(path.join(here, 'bridge-auth.mjs'), 'utf8');

for (const marker of ["pathParts[1] === 'categories'", "pathParts[1] === 'tools' && pathParts.length === 3", 'KNOUX_EXECUTION_CONTEXT', "run.status = 'inconclusive'", 'resolveResourceRoot', 'KNOUX_PROJECT_ROOT', 'RESOURCE_MODE']) {
  if (!delegatedSource.includes(marker)) throw Object.assign(new Error(`Delegated bridge contract missing: ${marker}`), { code: 'DELEGATED_BRIDGE_CONTRACT_MISSING' });
}

const handlers = server.listeners('request');
if (handlers.length !== 1) throw new Error(`Expected exactly one delegated bridge request handler, found ${handlers.length}.`);
const delegated = handlers[0];
server.removeAllListeners('request');

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload), 'Cache-Control': 'no-store' });
  res.end(payload);
}

function partsFor(req) {
  try { return new URL(req.url || '/', 'http://127.0.0.1').pathname.split('/').filter(Boolean); }
  catch { return []; }
}

function runtimeEnv() {
  return { ...process.env, KNOUX_MCP_AUDIENCE: SERVICE_URL };
}

function runtimeContract() {
  return { ...getMcpContract(runtimeEnv()), endpoint: RUNTIME_ENDPOINT, audience: SERVICE_URL, documentedAlias: MISSION_ALIAS.replace(/\/mcp$/, '') };
}

function runtimeFetch(input, init) {
  const url = typeof input === 'string' ? input : input?.url;
  if (url === MISSION_ALIAS) return fetch(RUNTIME_ENDPOINT, init);
  return fetch(input, init);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 512 * 1024) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

server.on('request', async (req, res) => {
  const parts = partsFor(req);
  if (parts[0] === 'api' && parts[1] === 'workbench') {
    try {
      if (req.method === 'GET' && parts[2] === 'premium' && parts[3] === 'status') {
        return sendJson(res, 200, { ok: true, ...getWorkbenchLockStatus() });
      }
      if (req.method === 'POST' && parts[2] === 'premium' && parts[3] === 'verify') {
        const body = await readJsonBody(req);
        const result = verifyWorkbenchKey(body?.key);
        return sendJson(res, result.ok ? 200 : 401, result);
      }
      if (req.method === 'POST' && parts[2] === 'premium' && parts[3] === 'lock') {
        const body = await readJsonBody(req);
        const result = revokeWorkbenchSession(body?.sessionToken);
        return sendJson(res, 200, result);
      }
      if (req.method === 'POST' && parts[2] === 'archive' && parts[3] === 'inspect') {
        const body = await readJsonBody(req);
        const result = inspectZipArchive(body?.path);
        return sendJson(res, result.ok ? 200 : 400, result);
      }
      if (req.method === 'POST' && parts[2] === 'file' && parts[3] === 'inspect') {
        const body = await readJsonBody(req);
        const result = inspectLocalFile(body?.path);
        return sendJson(res, result.ok ? 200 : 400, result);
      }
      if (req.method === 'GET' && parts[2] === 'system' && parts[3] === 'toolchain') {
        return sendJson(res, 200, detectToolchain());
      }
      if (req.method === 'GET' && parts[2] === 'system' && parts[3] === 'ports') {
        return sendJson(res, 200, getActiveDevPorts());
      }
      return sendJson(res, 404, { ok: false, error: 'NOT_FOUND', message: `No route for ${req.method} ${req.url}` });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: 'WORKBENCH_ERROR', message: err instanceof Error ? err.message : String(err) });
    }
  }

  if (!(parts[0] === 'api' && parts[1] === 'mcp')) return delegated(req, res);
  try {
    if (req.method === 'GET' && parts[2] === 'contract' && parts.length === 3) {
      return sendJson(res, 200, { ok: true, contract: runtimeContract() });
    }
    if (req.method === 'POST' && parts[2] === 'verify' && parts.length === 3) {
      const guard = checkMutationGuard(req);
      if (guard) return sendJson(res, guard.status, { ok: false, error: guard.code, message: guard.message });
      const probe = await runPrivateMcpProbe({ env: runtimeEnv(), fetchImpl: runtimeFetch });
      probe.contract = runtimeContract();
      return sendJson(res, 200, { ok: true, probe });
    }
    return sendJson(res, 404, { ok: false, error: 'NOT_FOUND', message: `No route for ${req.method} ${req.url}` });
  } catch (error) {
    return sendJson(res, error?.status || 500, { ok: false, error: error?.code || 'MCP_INTERNAL', message: error instanceof Error ? error.message : String(error) });
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, '127.0.0.1', () => console.log(`[KNOUX] Bridge listening on http://127.0.0.1:${PORT} (private MCP wrapper active)`));
}

export * from './bridge-auth.mjs';
