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

function proxyBridgeRequest(targetPath: string, req: Request, res: Response): void {
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
      path: targetPath,
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

function proxyApi(req: Request, res: Response): void {
  proxyBridgeRequest(req.originalUrl, req, res);
}

// Tool manifest reads always go through the authoritative local execution
// bridge (/api/tools); the gateway never caches a parallel copy.

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

  // Folder listing & picker delegate to the authoritative local execution bridge
  customRouter.get('/workspace/roots', (req: Request, res: Response) => {
    proxyBridgeRequest('/api/folders/roots', req, res);
  });

  customRouter.get('/workspace/folders', (req: Request, res: Response) => {
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    proxyBridgeRequest(`/api/folders${query}`, req, res);
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
      const { uid, toolId, toolName, action, status, details, executionTimeMs } = req.body;
      const log = await logRepairAction(
        typeof uid === 'string' && uid ? uid : 'local-workstation',
        typeof toolId === 'string' && toolId ? toolId : 'system-action',
        typeof toolName === 'string' && toolName ? toolName : (typeof toolId === 'string' && toolId ? toolId : 'system-action'),
        typeof status === 'string' && status ? status : (typeof action === 'string' && action ? action : 'success'),
        typeof executionTimeMs === 'number' ? executionTimeMs : undefined,
        details === undefined || details === null ? undefined : (typeof details === 'string' ? details : JSON.stringify(details)),
      );
      res.json({ success: true, log });
    } catch (err: any) {
      console.error('Error logging repair action:', err);
      res.status(500).json({ error: err?.message || 'Logging error' });
    }
  });

  customRouter.get('/cloudsql/repair-logs', async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const uid = typeof req.query.uid === 'string' && req.query.uid ? req.query.uid : 'local-workstation';
      const logs = await getRepairLogs(uid, limit);
      res.json({ success: true, logs });
    } catch (err: any) {
      console.error('Error fetching repair logs:', err);
      res.status(500).json({ error: err?.message || 'Fetch error' });
    }
  });

  customRouter.post('/cloudsql/telemetry', async (req: Request, res: Response) => {
    try {
      const { uid, cpuUsage, cpuLoad, ramUsagePercent, ramUsedGb, diskFreeGb, osVersion } = req.body;
      const cpuValue = Number(cpuLoad ?? cpuUsage ?? NaN);
      const entry = await recordSystemTelemetry(
        typeof uid === 'string' && uid ? uid : 'local-workstation',
        Number.isFinite(cpuValue) ? cpuValue : null,
        ramUsedGb !== undefined && ramUsedGb !== null ? String(ramUsedGb) : (ramUsagePercent !== undefined && ramUsagePercent !== null ? String(ramUsagePercent) : ''),
        diskFreeGb !== undefined && diskFreeGb !== null ? String(diskFreeGb) : '',
        typeof osVersion === 'string' ? osVersion : '',
      );
      res.json({ success: true, entry });
    } catch (err: any) {
      console.error('Error recording telemetry:', err);
      res.status(500).json({ error: err?.message || 'Telemetry error' });
    }
  });

  customRouter.post('/cloudsql/workspace-events', async (req: Request, res: Response) => {
    try {
      const { uid, service, eventType, resourceName, eventName, action, resourceId, resourceUrl } = req.body;
      const ev = await recordWorkspaceIntegrationEvent(
        typeof uid === 'string' && uid ? uid : 'local-workstation',
        typeof service === 'string' && service ? service : (typeof eventType === 'string' && eventType ? eventType : 'workspace'),
        typeof resourceName === 'string' && resourceName ? resourceName : (typeof eventName === 'string' && eventName ? eventName : 'event'),
        typeof action === 'string' && action ? action : 'recorded',
        typeof resourceId === 'string' ? resourceId : undefined,
        typeof resourceUrl === 'string' ? resourceUrl : undefined,
      );
      res.json({ success: true, event: ev });
    } catch (err: any) {
      console.error('Error recording workspace event:', err);
      res.status(500).json({ error: err?.message || 'Event error' });
    }
  });

  customRouter.get('/cloudsql/workspace-events', async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const uid = typeof req.query.uid === 'string' && req.query.uid ? req.query.uid : 'local-workstation';
      const events = await getWorkspaceIntegrationEvents(uid, limit);
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

      // Explicit provider routing: a Google key drives the Google SDK, an
      // OpenRouter key drives the OpenRouter HTTP API. One provider's key is
      // never passed to the other provider's SDK.
      const googleKey = process.env.GEMINI_API_KEY;
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      const wantsOpenRouter = typeof modelId === 'string' && (modelId.includes('/') || modelId.includes(':'));

      if (wantsOpenRouter) {
        if (!openRouterKey) {
          return res.status(503).json({
            available: false,
            reason: 'AI_PROVIDER_NOT_CONFIGURED',
            message: 'AI is unavailable: no OpenRouter key is configured.',
          });
        }
        const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openRouterKey}` },
          body: JSON.stringify({
            model: modelId,
            temperature: 0.3,
            max_tokens: 2400,
            messages: [
              { role: 'system', content: `You are the KNOUX Nexus System Diagnostic AI Assistant. Provide precise, actionable, and safe Windows system repair and maintenance troubleshooting guidance. Context: ${context}` },
              { role: 'user', content: prompt },
            ],
          }),
        });
        const payload = await upstream.json().catch(() => ({}));
        if (!upstream.ok) {
          return res.status(502).json({ error: String(payload?.error?.message || `OpenRouter returned HTTP ${upstream.status}`) });
        }
        const content = payload?.choices?.[0]?.message?.content;
        const text = Array.isArray(content)
          ? content.map((part: unknown) => (typeof part === 'string' ? part : String((part as { text?: string })?.text || ''))).join('')
          : String(content || '');
        return res.json({ text: text.trim() || 'No diagnosis generated.', model: modelId });
      }

      if (!googleKey) {
        // Product-truth rule: without a configured provider the gateway
        // reports unavailability. It never fabricates a diagnostic answer.
        return res.status(503).json({
          available: false,
          reason: 'AI_PROVIDER_NOT_CONFIGURED',
          message: 'AI is unavailable: no Google AI key is configured.',
        });
      }

      const ai = new GoogleGenAI({ apiKey: googleKey });
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
    } catch (err: unknown) {
      console.error('AI generate error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI generation failed' });
    }
  });

  // Mount custom routes under /api
  app.use('/api', customRouter);

  // All other /api requests are proxied to the real localhost bridge
  app.use('/api', proxyApi);

  // Top-level workspace folder browsing endpoints
  app.get('/workspace/roots', (req: Request, res: Response) => {
    proxyBridgeRequest('/api/folders/roots', req, res);
  });
  app.get('/workspace/folders', (req: Request, res: Response) => {
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    proxyBridgeRequest(`/api/folders${query}`, req, res);
  });

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
