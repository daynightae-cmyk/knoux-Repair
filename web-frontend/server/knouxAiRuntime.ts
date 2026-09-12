import { randomUUID } from 'node:crypto';
import type { Request, Response, Router } from 'express';
import { GoogleAuth } from 'google-auth-library';

const PROJECT_ID = process.env.KNOUX_AI_PROJECT_ID || 'knoux-repair';
const PROJECT_NUMBER = process.env.KNOUX_AI_PROJECT_NUMBER || '30719047550';
const LOCATION = process.env.KNOUX_AI_LOCATION || 'us-west1';
const ENGINE_ID = process.env.KNOUX_AI_REASONING_ENGINE_ID || '374423291676327936';
const A2A_BASE = (process.env.KNOUX_AI_A2A_ENDPOINT || `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_NUMBER}/locations/${LOCATION}/reasoningEngines/${ENGINE_ID}/a2a`).replace(/\/$/, '');
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const next = value.trim();
  return next ? next.slice(0, max) : null;
}

function boundedContext(value: unknown): Record<string, unknown> {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence.slice(0, 8).map(item => {
        const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          source: cleanText(row.source, 80) || 'unknown',
          type: cleanText(row.type, 80) || 'summary',
          summary: cleanText(row.summary, 1200) || '',
        };
      }).filter(item => item.summary)
    : [];
  const tool = raw.tool && typeof raw.tool === 'object' ? raw.tool as Record<string, unknown> : null;
  const runtime = raw.runtime && typeof raw.runtime === 'object' ? raw.runtime as Record<string, unknown> : {};

  return {
    familyId: cleanText(raw.familyId, 80),
    familyName: cleanText(raw.familyName, 120),
    serviceId: cleanText(raw.serviceId, 100),
    serviceName: cleanText(raw.serviceName, 160),
    tool: tool ? {
      id: cleanText(tool.id, 80),
      name: cleanText(tool.name, 180),
      riskLevel: cleanText(tool.riskLevel, 80),
      requiresAdmin: tool.requiresAdmin === true,
      requiresRestart: tool.requiresRestart === true,
      requiresConfirmation: tool.requiresConfirmation === true,
    } : null,
    runtime: {
      bridgeOnline: typeof runtime.bridgeOnline === 'boolean' ? runtime.bridgeOnline : null,
      bridgeElevated: runtime.bridgeElevated === true,
      toolStatus: cleanText(runtime.toolStatus, 80),
    },
    evidence,
  };
}

async function googleRequest<T>(url: string, method: 'GET' | 'POST', body?: unknown): Promise<{ status: number; data: T }> {
  const client = await auth.getClient();
  const response = await client.request<T>({
    url,
    method,
    data: body,
    headers: { 'X-Goog-User-Project': PROJECT_ID },
    timeout: 120_000,
  });
  return { status: response.status, data: response.data };
}

function replyMessage(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  if (root.message && typeof root.message === 'object') return root.message as Record<string, unknown>;
  const result = root.result && typeof root.result === 'object' ? root.result as Record<string, unknown> : null;
  return result?.message && typeof result.message === 'object' ? result.message as Record<string, unknown> : null;
}

function replyText(payload: unknown): string {
  const message = replyMessage(payload);
  const content = message && Array.isArray(message.content) ? message.content : [];
  return content.map(part => {
    const row = part && typeof part === 'object' ? part as Record<string, unknown> : {};
    return cleanText(row.text, 20_000) || '';
  }).filter(Boolean).join('\n').trim();
}

function contextId(payload: unknown): string | null {
  return cleanText(replyMessage(payload)?.contextId, 2000);
}

export function registerKnouxAiRoutes(router: Router): void {
  router.get('/knoux-ai/status', async (_req: Request, res: Response) => {
    try {
      await googleRequest(`${A2A_BASE}/v1/card`, 'GET');
      return res.json({ ok: true, available: true, state: 'available', product: 'KNOUX AI', runtime: `projects/${PROJECT_NUMBER}/locations/${LOCATION}/reasoningEngines/${ENGINE_ID}` });
    } catch (error) {
      return res.json({ ok: true, available: false, state: 'unavailable', product: 'KNOUX AI', message: error instanceof Error ? error.message : 'KNOUX AI is unavailable.' });
    }
  });

  router.post('/knoux-ai/message', async (req: Request, res: Response) => {
    const message = cleanText(req.body?.message, 4000);
    if (!message) return res.status(400).json({ ok: false, error: 'INVALID_MESSAGE', message: 'A KNOUX AI message is required.' });

    const context = boundedContext(req.body?.context);
    const sessionId = cleanText(req.body?.sessionId, 2000);
    const text = [
      'KNOUX Repair application request.',
      `User message: ${message}`,
      `Bounded application context: ${JSON.stringify(context)}`,
      'Use only explicit evidence as fact. If required evidence is absent, state exactly: Evidence unavailable.',
      'Do not claim a local action was executed. Local KNOUX policy controls execution.',
    ].join('\n\n');

    try {
      const result = await googleRequest<Record<string, unknown>>(`${A2A_BASE}/v1/message:send`, 'POST', {
        message: {
          role: 'ROLE_USER',
          content: [{ text }],
          messageId: randomUUID(),
          ...(sessionId ? { contextId: sessionId } : {}),
        },
      });
      const answer = replyText(result.data);
      if (!answer) return res.status(502).json({ ok: false, error: 'KNOUX_AI_EMPTY_RESPONSE', message: 'KNOUX AI returned no text response.' });
      return res.json({ ok: true, available: true, product: 'KNOUX AI', text: answer, sessionId: contextId(result.data) });
    } catch (error) {
      return res.status(503).json({ ok: false, error: 'KNOUX_AI_UNAVAILABLE', message: error instanceof Error ? error.message : 'KNOUX AI request failed.' });
    }
  });
}
