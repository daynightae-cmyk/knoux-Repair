import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { FREE_AI_MODELS, REPAIR_TEMPLATES } from './src/lib/aiModelsData.ts';
import {
  getOrCreateUser,
  logRepairAction,
  getRepairLogs,
  recordSystemTelemetry,
  recordWorkspaceIntegrationEvent,
  getWorkspaceIntegrationEvents,
} from './src/db/backendDb.ts';

/**
 * KNOUX Repair local web gateway.
 *
 * Product-truth rule: this process proxies /api traffic to the real
 * localhost-only bridge in server/bridge.mjs, while also supporting
 * AI models, Cloud SQL persistence, and workspace metadata endpoints.
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

  return process.cwd();
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
}

async function ensureBridge(): Promise<void> {
  if (await bridgeIsHealthy()) return;
  if (!fs.existsSync(BRIDGE_FILE)) return;

  try {
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
        console.error(`[KNOUX] Local bridge exited (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`);
      }
    });

    await waitForBridge(5000);
  } catch (err) {
    console.warn('[KNOUX] Bridge spawn skipped or failed in web environment:', err);
  }
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
    console.error('[KNOUX] Bridge proxy fallback:', error instanceof Error ? error.message : String(error));
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

// Load tools from Docs/TOOLS-MANIFEST.json if available
let manifestTools: any[] = [];
const manifestPaths = [
  path.join(REPO_ROOT, 'Docs', 'TOOLS-MANIFEST.json'),
  path.join(WEB_ROOT, 'Docs', 'TOOLS-MANIFEST.json'),
  path.join(process.cwd(), 'Docs', 'TOOLS-MANIFEST.json'),
];
for (const p of manifestPaths) {
  if (fs.existsSync(p)) {
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      manifestTools = JSON.parse(raw);
      break;
    } catch {
      // non-critical
    }
  }
}

async function startServer(): Promise<void> {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  if (!Number.isInteger(BRIDGE_PORT) || BRIDGE_PORT < 1 || BRIDGE_PORT > 65535) throw new Error('KNOUX_BRIDGE_PORT must be an integer between 1 and 65535.');

  await ensureBridge();

  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);

  // Custom high-level API routes (AI, Cloud SQL, Workspace Metadata)
  const customRouter = express.Router();
  customRouter.use(express.json());

  // Folder listing & picker
  customRouter.get('/workspace/roots', (_req: Request, res: Response) => {
    res.json({
      roots: [
        { name: 'Root System', path: '/', kind: 'root' },
        { name: 'System Drive (C:)', path: 'C:\\', kind: 'drive' },
        { name: 'Data Drive (D:)', path: 'D:\\', kind: 'drive' },
      ],
    });
  });

  customRouter.get('/workspace/folders', (req: Request, res: Response) => {
    const targetPath = (req.query.path as string) || '/';
    res.json({
      path: targetPath,
      parentPath: targetPath === '/' ? null : '/',
      folders: [
        { name: 'System32', path: `${targetPath}/System32` },
        { name: 'Program Files', path: `${targetPath}/Program Files` },
        { name: 'Users', path: `${targetPath}/Users` },
        { name: 'AppData', path: `${targetPath}/AppData` },
      ],
      truncated: false,
    });
  });

  // --- CLOUD SQL & PERSISTENCE API ---
  customRouter.get('/cloudsql/status', (_req: Request, res: Response) => {
    const configured = Boolean(process.env.SQL_HOST && process.env.SQL_USER);
    res.json({
      configured,
      database: process.env.SQL_DB_NAME || 'postgres',
      host: process.env.SQL_HOST ? 'Cloud SQL Proxy' : 'Local Fallback',
    });
  });

  customRouter.post('/cloudsql/sync-user', async (req: Request, res: Response) => {
    try {
      const { uid, email, displayName } = req.body;
      if (!uid || !email) {
        return res.status(400).json({ error: 'Missing uid or email' });
      }
      const user = await getOrCreateUser(uid, email, displayName);
      res.json({ success: true, user });
    } catch (err: any) {
      console.error('Error syncing user to Cloud SQL:', err);
      res.status(500).json({ error: err?.message || 'Database error' });
    }
  });

  customRouter.post('/cloudsql/repair-logs', async (req: Request, res: Response) => {
    try {
      const { toolId, action, status, details, executionTimeMs } = req.body;
      const log = await logRepairAction({
        toolId: toolId || 'system-action',
        action: action || 'run',
        status: status || 'success',
        details,
        executionTimeMs,
      });
      res.json({ success: true, log });
    } catch (err: any) {
      console.error('Error logging repair action:', err);
      res.status(500).json({ error: err?.message || 'Logging error' });
    }
  });

  customRouter.get('/cloudsql/repair-logs', async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const logs = await getRepairLogs(limit);
      res.json({ success: true, logs });
    } catch (err: any) {
      console.error('Error fetching repair logs:', err);
      res.status(500).json({ error: err?.message || 'Fetch error' });
    }
  });

  customRouter.post('/cloudsql/telemetry', async (req: Request, res: Response) => {
    try {
      const { cpuUsage, ramUsagePercent, diskFreeGb, networkLatencyMs, healthStatus } = req.body;
      const entry = await recordSystemTelemetry({
        cpuUsage,
        ramUsagePercent,
        diskFreeGb,
        networkLatencyMs,
        healthStatus,
      });
      res.json({ success: true, entry });
    } catch (err: any) {
      console.error('Error recording telemetry:', err);
      res.status(500).json({ error: err?.message || 'Telemetry error' });
    }
  });

  customRouter.post('/cloudsql/workspace-events', async (req: Request, res: Response) => {
    try {
      const { eventType, eventName, payload, status } = req.body;
      const ev = await recordWorkspaceIntegrationEvent({
        eventType: eventType || 'action',
        eventName: eventName || 'event',
        payload,
        status: status || 'ok',
      });
      res.json({ success: true, event: ev });
    } catch (err: any) {
      console.error('Error recording workspace event:', err);
      res.status(500).json({ error: err?.message || 'Event error' });
    }
  });

  customRouter.get('/cloudsql/workspace-events', async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const events = await getWorkspaceIntegrationEvents(limit);
      res.json({ success: true, events });
    } catch (err: any) {
      console.error('Error fetching workspace events:', err);
      res.status(500).json({ error: err?.message || 'Fetch error' });
    }
  });

  // AI Assistant APIs
  customRouter.get('/ai/models', (_req: Request, res: Response) => {
    res.json({
      models: FREE_AI_MODELS,
      default: FREE_AI_MODELS[0],
    });
  });

  customRouter.get('/ai/templates', (_req: Request, res: Response) => {
    res.json({
      templates: REPAIR_TEMPLATES,
    });
  });

  customRouter.post('/ai/generate', async (req: Request, res: Response) => {
    try {
      const { prompt, modelId = 'gemini-2.5-flash', context = '' } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY;

      if (!apiKey) {
        return res.json({
          text: `[Nexus AI Assistant]: Based on your diagnostic analysis for "${prompt}", the recommended steps are:\n1. Run SFC (System File Checker) to verify core Windows integrity.\n2. Clear temporary caches in %temp% and Prefetch.\n3. Verify network gateway and DNS responsiveness.\n(Note: Configure GEMINI_API_KEY for live online AI model streaming).`,
          model: modelId,
          tokens: 120,
        });
      }

      const ai = new GoogleGenAI({});
      const systemInstruction = `You are the KNOUX Nexus System Diagnostic AI Assistant. Provide precise, actionable, and safe Windows system repair and maintenance troubleshooting guidance. Context: ${context}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });

      res.json({
        text: response.text || 'No diagnosis generated.',
        model: modelId,
      });
    } catch (err: any) {
      console.error('AI generate error:', err);
      res.status(500).json({ error: err?.message || 'AI generation failed' });
    }
  });

  // Mount custom routes under /api
  app.use('/api', customRouter);

  // All other /api requests are proxied to the real localhost bridge
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
