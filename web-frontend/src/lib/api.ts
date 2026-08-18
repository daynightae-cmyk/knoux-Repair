import type { RiskLevel } from '../types';

export const BRIDGE_URL =
  (import.meta.env.VITE_KNOUX_BRIDGE_URL as string | undefined) ?? 'http://127.0.0.1:8787';

export interface BridgeTool {
  ToolId: string;
  Category: string;
  ScriptPath: string;
  EnglishName: string;
  ArabicName: string;
  Purpose: string;
  RiskLevel: RiskLevel;
  RequiresAdmin: boolean;
}

export interface BridgeHealth {
  ok: boolean;
  bridge: string;
  version: string;
  elevated: boolean;
  powershell: string;
  repoRoot: string;
  tools: number;
}

export interface BridgeRunLine {
  t: string;
  s: 'out' | 'err';
  text: string;
}

export interface BridgeRun {
  id: string;
  toolId: string;
  toolName: string;
  status: 'running' | 'success' | 'error' | 'cancelled';
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
  lines: BridgeRunLine[];
  error: string | null;
}

export interface SystemDrive {
  Name: string;
  TotalGB: number;
  FreeGB: number;
}

export interface SystemSnapshot {
  Os: string;
  Version: string;
  Build: string;
  Machine: string;
  UptimeSeconds: number;
  TotalRamGB: number;
  FreeRamGB: number;
  CpuName: string;
  CpuLoad: number;
  Processes: number;
  Drives: SystemDrive[];
  Firewall: { Profile: string; Enabled: boolean }[] | null;
  DefenderRunning: boolean;
  DefenderRealtime: boolean;
  DefenderSignatures: string;
}

export class BridgeError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BRIDGE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
  } catch (e) {
    throw new BridgeError(0, 'BRIDGE_UNREACHABLE', String(e instanceof Error ? e.message : e));
  } finally {
    window.clearTimeout(timer);
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || body?.ok === false) {
    throw new BridgeError(res.status, body?.error || 'HTTP_ERROR', body?.message || `HTTP ${res.status}`);
  }
  return body as T;
}

export const api = {
  health: () => request<BridgeHealth>('/api/health', undefined, 10000),
  tools: () => request<{ tools: BridgeTool[] }>('/api/tools', undefined, 15000),
  system: () => request<{ system: SystemSnapshot }>('/api/system', undefined, 60000),
  startRun: (toolId: string) =>
    request<{ runId: string }>('/api/runs', { method: 'POST', body: JSON.stringify({ toolId }) }, 15000),
  getRun: (runId: string) => request<{ run: BridgeRun }>(`/api/runs/${runId}`, undefined, 15000),
  cancelRun: (runId: string) =>
    request<{ ok: boolean }>(`/api/runs/${runId}/cancel`, { method: 'POST' }, 15000),
};