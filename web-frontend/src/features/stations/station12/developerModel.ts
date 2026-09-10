/**
 * KNOUX REPAIR — Station 12: Developer Tools
 * Developer Workbench Domain Model
 * Pure deterministic functions for toolchain health, runtime auditing,
 * port observatory, Git workspace telemetry, and developer cache inspection.
 * Zero synthetic gamification.
 */

import type { BridgeTool, KnouxRunResult } from '../../../lib/api';

export type DeveloperWorkbenchState = 'OPTIMAL' | 'ATTENTION_NEEDED' | 'DEGRADED' | 'INCONCLUSIVE';

export interface ToolchainItem {
  tool: string;
  available: boolean;
  version: string;
  primarySource: string;
  candidateCount: number;
  candidates?: string;
}

export interface DevPortItem {
  port: number;
  address: string;
  process: string;
  processId: number;
  started?: string;
  path?: string;
}

export interface ProjectMarker {
  marker: string;
  present: boolean;
}

export interface GitWorkspaceState {
  available: boolean;
  repository: boolean;
  branch: string;
  head: string;
  statusLinesCount: number;
  remotesCount: number;
  hasGitIgnore: boolean;
}

export interface DeveloperWorkbenchSummary {
  state: DeveloperWorkbenchState;
  runtimesAvailable: number;
  runtimesChecked: number;
  collisionsCount: number;
  activeDevPortsCount: number;
  gitWorktreeActive: boolean;
  gitBranch: string;
  dockerAvailable: boolean;
}

export interface DeveloperSignal {
  code: string;
  level: 'INFO' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  messageEn: string;
  messageAr: string;
  suggestedTool: string;
  evidenceSource: string;
}

export interface StationHistoryEntry {
  id: string;
  toolId: string;
  toolName: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED' | 'CANCELLED' | 'INCONCLUSIVE';
  itemsProcessed: number;
  summary: string;
}

export const STATION12_TOOL_IDS = [
  'DT01', 'DT02', 'DT03', 'DT04', 'DT05', 'DT06', 'DT07',
  'DT08', 'DT09', 'DT10', 'DT11', 'DT12', 'DT13',
] as const;

/**
 * Categorical workbench status derived truthfully from observed developer toolchain
 */
export function deriveWorkbenchState(
  runtimesAvailable: number,
  collisionsCount: number,
  failuresCount: number
): DeveloperWorkbenchState {
  if (runtimesAvailable === 0 && failuresCount > 0) {
    return 'DEGRADED';
  }
  if (failuresCount > 0 || collisionsCount > 2) {
    return 'ATTENTION_NEEDED';
  }
  if (runtimesAvailable > 0) {
    return 'OPTIMAL';
  }
  return 'INCONCLUSIVE';
}

/**
 * Summarizes the developer workbench metrics
 */
export function summarizeWorkbench(
  toolchain: ToolchainItem[] = [],
  ports: DevPortItem[] = [],
  git: Partial<GitWorkspaceState> | null = null,
  dockerAvailable: boolean = false
): DeveloperWorkbenchSummary {
  const runtimesChecked = toolchain.length;
  const runtimesAvailable = toolchain.filter((t) => t.available).length;
  const collisionsCount = toolchain.filter((t) => t.candidateCount > 1).length;
  const activeDevPortsCount = ports.length;
  const gitWorktreeActive = Boolean(git?.repository);
  const gitBranch = git?.branch || '';

  const state = deriveWorkbenchState(
    runtimesAvailable,
    collisionsCount,
    runtimesChecked > 0 && runtimesAvailable === 0 ? 1 : 0
  );

  return {
    state,
    runtimesAvailable,
    runtimesChecked,
    collisionsCount,
    activeDevPortsCount,
    gitWorktreeActive,
    gitBranch,
    dockerAvailable,
  };
}

/**
 * Parses raw JSON string from DT04 toolchain doctor
 */
export function parseToolchainItems(rawJson: string): ToolchainItem[] {
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      tool: String(item.Tool || item.Command || ''),
      available: Boolean(item.Available),
      version: String(item.Version || ''),
      primarySource: String(item.PrimarySource || item.Source || ''),
      candidateCount: Number(item.CandidateCount || (item.Available ? 1 : 0)),
      candidates: String(item.Candidates || ''),
    }));
  } catch {
    return [];
  }
}

/**
 * Parses raw JSON string from DT06 / DT10 port observatory
 */
export function parseDevPorts(rawJson: string): DevPortItem[] {
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      port: Number(item.Port || 0),
      address: String(item.Address || ''),
      process: String(item.Process || ''),
      processId: Number(item.ProcessId || 0),
      started: item.Started ? String(item.Started) : undefined,
      path: item.Path ? String(item.Path) : undefined,
    })).filter((p) => p.port > 0);
  } catch {
    return [];
  }
}

/**
 * Detects developer environment signals and actionable items
 */
export function detectDeveloperSignals(
  toolchain: ToolchainItem[],
  ports: DevPortItem[],
  git: Partial<GitWorkspaceState> | null
): DeveloperSignal[] {
  const signals: DeveloperSignal[] = [];

  // Collisions in PATH (multiple versions of node, python, etc.)
  const collisions = toolchain.filter((t) => t.candidateCount > 1);
  if (collisions.length > 0) {
    signals.push({
      code: 'DEV_PATH_COLLISION',
      level: 'MEDIUM',
      messageEn: `Detected ${collisions.length} toolchain collision(s) in system PATH (${collisions.map((c) => c.tool).join(', ')}). Multiple binaries may cause unpredictable runtime behavior.`,
      messageAr: `تم اكتشاف ${collisions.length} تضارب في مسارات أدوات التطوير (${collisions.map((c) => c.tool).join('، ')}). قد يؤدي تعدد المسارات لسلوك غير متوقع.`,
      suggestedTool: 'DT04',
      evidenceSource: 'Toolchain Doctor (DT04)',
    });
  }

  // Active dev ports
  if (ports.length > 0) {
    signals.push({
      code: 'DEV_PORTS_ACTIVE',
      level: 'INFO',
      messageEn: `${ports.length} developer process listener(s) active on local ports (${ports.slice(0, 3).map((p) => `:${p.port} ${p.process}`).join(', ')}${ports.length > 3 ? '...' : ''}).`,
      messageAr: `${ports.length} خادم أو عملية تطوير تستمع حالياً للمنافذ المحلية (${ports.slice(0, 3).map((p) => `:${p.port} ${p.process}`).join('، ')}${ports.length > 3 ? '...' : ''}).`,
      suggestedTool: 'DT10',
      evidenceSource: 'Port Observatory (DT06)',
    });
  }

  // Missing version control
  if (git && !git.available) {
    signals.push({
      code: 'DEV_GIT_MISSING',
      level: 'HIGH',
      messageEn: 'Git executable not found in system PATH. Version control telemetry and repository inspection are unavailable.',
      messageAr: 'أداة Git غير موجودة في مسار النظام PATH. تعذر تتبع مستودع الأكواد وفحص سجلات Git.',
      suggestedTool: 'DT01',
      evidenceSource: 'Environment Audit (DT01)',
    });
  }

  return signals;
}

/**
 * Filter tools belonging to Station 12
 */
export function stationTools(allTools: BridgeTool[]): BridgeTool[] {
  return allTools.filter(
    (t) => t.Category === '12-Developer-Tools' || (STATION12_TOOL_IDS as readonly string[]).includes(t.ToolId)
  );
}

/**
 * Extracts normalized execution outcome from Knoux run result
 */
export function outcomeFromRun(
  result: KnouxRunResult | null | undefined
): 'SUCCESS' | 'WARNING' | 'FAILED' | 'INCONCLUSIVE' {
  if (!result) return 'INCONCLUSIVE';
  const status = (result.status || result.Status || '').toUpperCase();
  if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'OK') {
    return result.exitCode === 0 ? 'SUCCESS' : 'WARNING';
  }
  if (status === 'FAILED' || status === 'ERROR') return 'FAILED';
  if (status === 'CANCELLED') return 'INCONCLUSIVE';
  return result.exitCode === 0 ? 'SUCCESS' : 'WARNING';
}
