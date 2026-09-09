import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

/**
 * KNOUX Repair local web gateway.
 *
 * Product-truth rule: this process never invents Windows state, tool output, auth users,
 * duplicate groups, or Project Sonar findings. All /api traffic is proxied to the real
 * localhost-only bridge in server/bridge.mjs.
 */

const MODULE_DIR = typeof __dirname === 'string'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const BRIDGE_PORT = Number(process.env.KNOUX_BRIDGE_PORT || 8787);
const FRONTEND_ORIGIN = `http://${HOST}:${PORT}`;
const isBundledServer = path.basename(process.argv[1] || '').toLowerCase() === 'server.cjs';
const isProduction = process.env.NODE_ENV === 'production' || isBundledServer;

function resolveProjectRoot(): string {
  const candidates = [
    process.env.KNOUX_PROJECT_ROOT,
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(MODULE_DIR, '..'),
    path.resolve(MODULE_DIR, '..', '..'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const root = path.resolve(candidate);
    if (
      fs.existsSync(path.join(root, 'Docs', 'TOOLS-MANIFEST.json')) &&
      fs.existsSync(path.join(root, 'web-frontend', 'server', 'bridge.mjs'))
    ) {
      return root;
    }
  }

  throw new Error('KNOUX project root could not be resolved. Docs/TOOLS-MANIFEST.json is required.');
}

const REPO_ROOT = resolveProjectRoot();
const WEB_ROOT = path.join(REPO_ROOT, 'web-frontend');
const BRIDGE_FILE = path.join(WEB_ROOT, 'server', 'bridge.mjs');
const DIST_ROOT = path.join(WEB_ROOT, 'dist');
const BRIDGE_ORIGIN = `http://${HOST}:${BRIDGE_PORT}`;

let bridgeProcess: ChildProcess | null = null;
let appServer: http.Server | null = null;

function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (isProduction) {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
        "img-src 'self' data: https:",
        "connect-src 'self'",
      ].join('; '),
    );
  }

  next();
}

async function bridgeIsHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${BRIDGE_ORIGIN}/api/health`, {
      signal: AbortSignal.timeout(1_000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return false;
    const payload = await response.json() as { ok?: boolean; bridge?: string };
    return payload.ok === true && payload.bridge === 'knoux-bridge';
  } catch {
    return false;
  }
}

async function waitForBridge(timeoutMs = 12_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await bridgeIsHealthy()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`KNOUX bridge did not become healthy on ${BRIDGE_ORIGIN}.`);
}

async function ensureBridge(): Promise<void> {
  if (await bridgeIsHealthy()) return;
  if (!fs.existsSync(BRIDGE_FILE)) throw new Error(`Local execution bridge is missing: ${BRIDGE_FILE}`);

  bridgeProcess = spawn(process.execPath, [BRIDGE_FILE], {
    cwd: REPO_ROOT,
    windowsHide: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      KNOUX_PROJECT_ROOT: REPO_ROOT,
      KNOUX_DATA_ROOT: process.env.KNOUX_DATA_ROOT || REPO_ROOT,
      KNOUX_BRIDGE_PORT: String(BRIDGE_PORT),
      KNOUX_AUTH_FRONTEND_ORIGIN: FRONTEND_ORIGIN,
    },
  });

  bridgeProcess.once('exit', (code, signal) => {
    if (appServer?.listening) {
      console.error(`[KNOUX] Local bridge exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`);
    }
  });

  await waitForBridge();
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function proxyApi(req: Request, res: Response): void {
  const requestHeaders: http.OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(req.headers)) {
    const key = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(key) || key === 'host' || value === undefined) continue;
    requestHeaders[name] = value;
  }
  requestHeaders.host = `${HOST}:${BRIDGE_PORT}`;

  const proxyRequest = http.request(
    {
      hostname: HOST,
      port: BRIDGE_PORT,
      method: req.method,
      path: req.originalUrl,
      headers: requestHeaders,
    },
    (proxyResponse) => {
      res.statusCode = proxyResponse.statusCode || 502;
      for (const [name, value] of Object.entries(proxyResponse.headers)) {
        if (HOP_BY_HOP_HEADERS.has(name.toLowerCase()) || value === undefined) continue;
        res.setHeader(name, value);
      }
      proxyResponse.pipe(res);
    },
  );

  proxyRequest.on('error', (error) => {
    console.error('[KNOUX] Bridge proxy failure:', error instanceof Error ? error.message : String(error));
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.status(503).json({
      ok: false,
      error: 'BRIDGE_UNAVAILABLE',
      message: 'The local KNOUX execution bridge is unavailable.',
    });
  });

  req.pipe(proxyRequest);
}

async function startServer(): Promise<void> {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  if (!Number.isInteger(BRIDGE_PORT) || BRIDGE_PORT < 1 || BRIDGE_PORT > 65535) throw new Error('KNOUX_BRIDGE_PORT must be an integer between 1 and 65535.');
  if (PORT === BRIDGE_PORT) throw new Error('PORT and KNOUX_BRIDGE_PORT must be different.');

  await ensureBridge();

  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);

  // API requests remain same-origin for the browser, but all execution and evidence are
  // produced by the real localhost bridge. No request body is parsed here; it is streamed.
  app.use('/api', proxyApi);

  if (!isProduction) {
    const vite = await createViteServer({
      root: WEB_ROOT,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    if (!fs.existsSync(path.join(DIST_ROOT, 'index.html'))) {
      throw new Error(`Frontend build is missing: ${DIST_ROOT}`);
    }
    app.use(express.static(DIST_ROOT, { fallthrough: true, etag: false, maxAge: 0 }));
    app.use((_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(path.join(DIST_ROOT, 'index.html'));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[KNOUX] Unhandled local gateway error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      ok: false,
      error: 'INTERNAL_GATEWAY_ERROR',
      message: 'The local KNOUX gateway could not complete the request.',
    });
  });

  appServer = app.listen(PORT, HOST, () => {
    console.log(`[KNOUX] Local web gateway: ${FRONTEND_ORIGIN}`);
    console.log(`[KNOUX] Real execution bridge: ${BRIDGE_ORIGIN}`);
    console.log(`[KNOUX] Project root: ${REPO_ROOT}`);
  });
}

function shutdown(): void {
  try { appServer?.close(); } catch { /* non-critical shutdown */ }
  try { bridgeProcess?.kill(); } catch { /* non-critical shutdown */ }
}

process.once('SIGINT', () => { shutdown(); process.exit(0); });
process.once('SIGTERM', () => { shutdown(); process.exit(0); });
process.once('exit', shutdown);

startServer().catch((error) => {
  console.error('[KNOUX] Failed to start local web gateway:', error instanceof Error ? error.message : String(error));
  shutdown();
  process.exit(1);
});
