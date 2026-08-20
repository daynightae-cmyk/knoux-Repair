import type { RiskLevel } from '../types';

export const BRIDGE_URL =
  (import.meta.env.VITE_KNOUX_BRIDGE_URL as string | undefined) ?? 'http://127.0.0.1:8787';

export type ExecutionMode = 'run' | 'analyze' | 'preview';
export type OfflineCapability = 'FULL' | 'PARTIAL' | 'NO' | '';

export interface ToolRunOptions {
  selection?: string;
  localSourcePath?: string;
  localSourceIndex?: number;
  quick?: boolean;
  packageId?: string;
}

export interface BridgeTool {
  ToolId: string;
  Category: string;
  ScriptPath: string;
  EnglishName: string;
  ArabicName: string;
  Purpose: string;
  RiskLevel: RiskLevel;
  RequiresAdmin: boolean;
  RequiresRestart: boolean;
  OfflineCapability: OfflineCapability;
  BackupMethod: string;
  RollbackMethod: string;
  AnalyzeOnlySupported: boolean;
  WhatIfSupported: boolean;
  Parameters: string[];
  RequiresConfirmation: boolean;
  ReportsEvidence: boolean;
  TestResult: string;
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
  mode: ExecutionMode;
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

export interface LocalFolderRoot {
  name: string;
  path: string;
  kind: 'home' | 'drive' | 'root';
}

export interface LocalFolderEntry {
  name: string;
  path: string;
}

export interface LocalFolderListing {
  path: string;
  parentPath: string | null;
  folders: LocalFolderEntry[];
  truncated: boolean;
}

export type SonarSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ProjectSonarFinding {
  Severity: SonarSeverity;
  Code: string;
  TitleEn: string;
  TitleAr: string;
  Evidence: string;
  FixEn: string;
  FixAr: string;
}

export interface ProjectSonarExport {
  id: string;
  format: 'pdf' | 'markdown';
  name: string;
  path: string;
  workspace: string;
  downloadUrl: string;
}

export interface ProjectSonarAiStatus {
  configured: boolean;
  model: string | null;
}

export interface ProjectSonarAiAnalysis {
  analysis: string;
  model: string;
  language: LangCode;
  generatedAt: string;
  privacy: { sourceFileContentsSent: boolean; workspacePathSent: boolean; localSecretsSent: boolean };
}

export type LangCode = 'ar' | 'en';

export interface ProjectSonarPreview {
  Workspace: string;
  Snapshot: {
    CapturedAt: string;
    Languages: string[];
    FileCount: number;
    PackageName: string;
    PackageVersion: string;
    PackageScripts: string[];
    TopDirectories: string[];
    Git: { Repository: boolean; Branch: string; Status: string[]; RemoteLines: string[]; LastCommit: string };
  };
  Findings: ProjectSonarFinding[];
  SeverityCounts: { Critical: number; High: number; Medium: number; Low: number };
  ServicePlan: { ToolId: string; Action: string; Changes: boolean }[];
  PromptEnglish: string;
  PromptArabic: string;
  ReportsFolder: string;
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
  folderRoots: () => request<{ roots: LocalFolderRoot[] }>('/api/folders/roots', undefined, 15000),
  folders: (folderPath?: string) => request<LocalFolderListing>(`/api/folders${folderPath ? `?path=${encodeURIComponent(folderPath)}` : ''}`, undefined, 15000),
  sonarPreview: (folderPath: string) => request<{ preview: ProjectSonarPreview }>(`/api/sonar/preview?path=${encodeURIComponent(folderPath)}`, undefined, 125000),
  sonarAiStatus: () => request<ProjectSonarAiStatus>('/api/sonar/ai-status', undefined, 15000),
  sonarExport: (folderPath: string, format: 'pdf' | 'markdown', language: LangCode) => request<{ export: ProjectSonarExport }>('/api/sonar/export', { method: 'POST', body: JSON.stringify({ path: folderPath, format, language }) }, 125000),
  sonarAnalysis: (folderPath: string, language: LangCode) => request<ProjectSonarAiAnalysis>('/api/sonar/analysis', { method: 'POST', body: JSON.stringify({ path: folderPath, language }) }, 125000),
  startRun: (toolId: string, mode: ExecutionMode = 'run', options: ToolRunOptions = {}) =>
    request<{ runId: string }>('/api/runs', { method: 'POST', body: JSON.stringify({ toolId, mode, options }) }, 15000),
  getRun: (runId: string) => request<{ run: BridgeRun }>(`/api/runs/${runId}`, undefined, 15000),
  cancelRun: (runId: string) =>
    request<{ ok: boolean }>(`/api/runs/${runId}/cancel`, { method: 'POST' }, 15000),
};
