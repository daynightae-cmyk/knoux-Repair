import { BRIDGE_TOKEN, BRIDGE_URL, BridgeError } from './api';

export type McpProofState =
  | 'idle'
  | 'confirmed-private'
  | 'public-or-misconfigured'
  | 'unconfirmed'
  | 'unavailable'
  | 'available'
  | 'success';

export interface PrivateMcpContract {
  endpoint: string;
  audience: string;
  documentedAlias: string;
  invokerServiceAccount: string;
  service: string;
  region: string;
  tool: 'gateway_status';
  authentication: string;
  tokenSource: 'auto' | 'metadata' | 'gcloud';
  tokenSources: Array<'metadata' | 'gcloud'>;
  privateRequired: true;
  publicFallback: false;
  modernProtocol: string;
  legacyFallbackProtocol: string;
}

export interface PrivateMcpProbe {
  ok: boolean;
  contract: PrivateMcpContract;
  checkedAt: string;
  privacy: {
    state: 'confirmed-private' | 'public-or-misconfigured' | 'unconfirmed' | 'unavailable';
    httpStatus: number | null;
    evidence: string;
  };
  identity: {
    state: 'available' | 'unavailable';
    source: 'metadata' | 'gcloud' | 'injected' | null;
  };
  protocol: {
    state: 'success' | 'unavailable';
    era: 'modern' | 'legacy' | null;
    version: string | null;
    sessionBound: boolean;
  };
  gatewayStatus: {
    state: 'success' | 'unavailable';
    tool: 'gateway_status';
    payload: unknown;
    receivedAt: string | null;
  };
  error: { code: string; message: string } | null;
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 20000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BRIDGE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(BRIDGE_TOKEN ? { 'X-Knoux-Bridge-Token': BRIDGE_TOKEN } : {}),
        ...(init?.headers || {}),
      },
    });
    const body = await response.json().catch(() => null) as any;
    if (!response.ok || body?.ok === false) {
      throw new BridgeError(response.status, body?.error || 'HTTP_ERROR', body?.message || `HTTP ${response.status}`);
    }
    return body as T;
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    throw new BridgeError(0, 'BRIDGE_UNREACHABLE', error instanceof Error ? error.message : String(error));
  } finally {
    window.clearTimeout(timer);
  }
}

export const mcpApi = {
  contract: async () => {
    const response = await request<{ ok: true; contract: PrivateMcpContract }>('/api/mcp/contract', undefined, 10000);
    return response.contract;
  },
  verify: async () => {
    const response = await request<{ ok: true; probe: PrivateMcpProbe }>('/api/mcp/verify', { method: 'POST', body: '{}' }, 30000);
    return response.probe;
  },
};
