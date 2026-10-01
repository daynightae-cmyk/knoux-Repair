/**
 * KNOUX REPAIR — Station 07: Services & Processes
 * Service Operations Center Domain Model
 * Pure deterministic functions for service topology, process classification,
 * dependency blast radius evaluation, and safe operation gating.
 */

import type { BridgeTool, KnouxRunResult } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import { buildStationHistoryRow } from '../_shared/executionSemantics.ts';

export interface ServiceItem {
  name: string;
  displayName: string;
  status: 'Running' | 'Stopped' | 'Paused' | 'Unknown';
  startType: 'Automatic' | 'Manual' | 'Disabled' | 'Unknown';
  processId?: number;
  isProtected: boolean;
  dependentCount: number;
  blastRadius: 'LOW' | 'MEDIUM' | 'CRITICAL';
}

export interface ProcessItem {
  name: string;
  pid: number;
  memoryMB: number;
  cpuSeconds: number;
  responding: boolean | null;
  isProtected: boolean;
  category: 'system' | 'user' | 'service' | 'background';
}

export interface ServiceDependencyItem {
  serviceName: string;
  displayName: string;
  dependsOn: string[];
  dependedOnBy: string[];
  blastRadius: 'LOW' | 'MEDIUM' | 'CRITICAL';
}

export interface ServiceTopology {
  total: number;
  running: number;
  stopped: number;
  automatic: number;
  manual: number;
  disabled: number;
  attentionCount: number;
}

export interface StationHistoryEntry {
  id: string;
  toolId: string;
  toolName: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED' | 'CANCELLED' | 'INCONCLUSIVE';
  /** null when the envelope did not report a count. Never 0-as-default. */
  itemsProcessed: number | null;
  summary: string;
}

export const STATION07_TOOL_IDS = [
  'SP01', 'SP02', 'SP03', 'SP04', 'SP05',
  'SP06', 'SP07', 'SP08', 'SP09', 'SP10', 'SP11',
] as const;

export const PROTECTED_PROCESS_NAMES = [
  'system', 'system idle process', 'smss', 'csrss', 'wininit',
  'winlogon', 'services', 'lsass', 'svchost', 'explorer', 'dwm',
  'fontdrvhost', 'registry', 'memory compression', 'searchindexer',
  'audiodg', 'taskmgr', 'spoolsv', 'msmpeng', 'nissrv', 'wmiprvse',
  'runtimebroker', 'conhost', 'shellexperiencehost', 'textinputhost',
  'startmenuexperiencehost', 'dllhost', 'sihost', 'taskhostw',
  'securityhealthservice', 'lsm',
];

export const PROTECTED_SERVICE_NAMES = [
  'wuauserv', 'bits', 'cryptsvc', 'rpcss', 'dcomlaunch', 'eventlog',
  'plugplay', 'samss', 'lanmanserver', 'lanmanworkstation', 'dhcp',
  'dnscache', 'mpssvc', 'windefend', 'securityhealthservice', 'bfe',
];

/**
 * Check if a process name is strictly protected from termination
 */
export function isProcessProtected(name: string): boolean {
  if (!name) return true;
  const clean = name.toLowerCase().replace(/\.exe$/, '').trim();
  return PROTECTED_PROCESS_NAMES.includes(clean);
}

/**
 * Check if a Windows service is strictly protected from disabling or arbitrary stops
 */
export function isServiceProtected(name: string): boolean {
  if (!name) return true;
  const clean = name.toLowerCase().trim();
  return PROTECTED_SERVICE_NAMES.includes(clean);
}

/**
 * Classify blast radius of stopping or modifying a service
 */
export function classifyBlastRadius(serviceName: string, dependentCount: number = 0): 'LOW' | 'MEDIUM' | 'CRITICAL' {
  if (isServiceProtected(serviceName)) return 'CRITICAL';
  if (dependentCount >= 5) return 'CRITICAL';
  if (dependentCount >= 2) return 'MEDIUM';
  return 'LOW';
}

/**
 * Parse raw services array into typed ServiceItem collection
 */
export function parseServicesInventory(
  services: Array<{
    Name?: string;
    DisplayName?: string;
    Status?: string;
    State?: string;
    StartMode?: string;
    StartType?: string;
    ProcessId?: number;
    DependentServices?: string[];
  }> = []
): ServiceItem[] {
  if (!Array.isArray(services)) return [];

  return services.map((s) => {
    const name = s.Name || 'UnknownService';
    const displayName = s.DisplayName || name;
    const rawStatus = (s.Status || s.State || '').toLowerCase();
    const status: ServiceItem['status'] =
      rawStatus === 'running' ? 'Running' : rawStatus === 'stopped' ? 'Stopped' : rawStatus === 'paused' ? 'Paused' : 'Unknown';

    const rawStart = (s.StartMode || s.StartType || 'Manual').toLowerCase();
    const startType: ServiceItem['startType'] =
      rawStart.includes('auto') ? 'Automatic' : rawStart.includes('disable') ? 'Disabled' : 'Manual';

    const isProtected = isServiceProtected(name);
    const dependentCount = Array.isArray(s.DependentServices) ? s.DependentServices.length : 0;
    const blastRadius = classifyBlastRadius(name, dependentCount);

    return {
      name,
      displayName,
      status,
      startType,
      processId: s.ProcessId,
      isProtected,
      dependentCount,
      blastRadius,
    };
  });
}

/**
 * Parse raw processes array into typed ProcessItem collection
 */
export function parseProcessesInventory(
  processes: Array<{
    Name?: string;
    ProcessName?: string;
    ProcessId?: number;
    Id?: number;
    PID?: number;
    MemoryMB?: number;
    MemMB?: number;
    WorkingSetMB?: number;
    CpuSeconds?: number;
    CPUSec?: number;
    TotalProcessorTimeSeconds?: number;
    Responding?: boolean | null;
  }> = []
): ProcessItem[] {
  if (!Array.isArray(processes)) return [];

  return processes.map((p) => {
    const name = p.Name || p.ProcessName || 'Process';
    const pid = typeof p.ProcessId === 'number' ? p.ProcessId : typeof p.Id === 'number' ? p.Id : typeof p.PID === 'number' ? p.PID : 0;
    const memoryMB = typeof p.MemoryMB === 'number' ? p.MemoryMB : typeof p.MemMB === 'number' ? p.MemMB : typeof p.WorkingSetMB === 'number' ? p.WorkingSetMB : 0;
    const cpuSeconds = typeof p.CpuSeconds === 'number' ? p.CpuSeconds : typeof p.CPUSec === 'number' ? p.CPUSec : typeof p.TotalProcessorTimeSeconds === 'number' ? p.TotalProcessorTimeSeconds : 0;
    const responding = typeof p.Responding === 'boolean' ? p.Responding : null;
    const isProtected = isProcessProtected(name);

    let category: ProcessItem['category'] = 'background';
    const lower = name.toLowerCase();
    if (isProtected) {
      category = 'system';
    } else if (lower === 'explorer' || lower.includes('chrome') || lower.includes('firefox') || lower.includes('code') || lower.includes('app')) {
      category = 'user';
    } else if (lower.includes('service') || lower.includes('host')) {
      category = 'service';
    }

    return {
      name,
      pid,
      memoryMB: Math.round(memoryMB * 10) / 10,
      cpuSeconds: Math.round(cpuSeconds * 10) / 10,
      responding,
      isProtected,
      category,
    };
  });
}

/**
 * Calculate accurate topology numbers from measured services
 */
export function calculateServiceTopology(services: ServiceItem[]): ServiceTopology {
  let running = 0;
  let stopped = 0;
  let automatic = 0;
  let manual = 0;
  let disabled = 0;
  let attentionCount = 0;

  for (const s of services) {
    if (s.status === 'Running') running += 1;
    else if (s.status === 'Stopped') stopped += 1;

    if (s.startType === 'Automatic') {
      automatic += 1;
      // Automatic but stopped represents an item needing review
      if (s.status === 'Stopped' && !s.name.includes('Trigger')) {
        attentionCount += 1;
      }
    } else if (s.startType === 'Disabled') {
      disabled += 1;
    } else {
      manual += 1;
    }
  }

  return {
    total: services.length,
    running,
    stopped,
    automatic,
    manual,
    disabled,
    attentionCount,
  };
}

/**
 * Filter services by query and status type
 */
export function filterServices(
  services: ServiceItem[],
  query: string,
  filter: 'all' | 'running' | 'stopped' | 'automatic' | 'disabled' = 'all'
): ServiceItem[] {
  const q = (query || '').toLowerCase().trim();
  return services.filter((s) => {
    const matchesQuery = !q || s.name.toLowerCase().includes(q) || s.displayName.toLowerCase().includes(q);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'running' && s.status === 'Running') ||
      (filter === 'stopped' && s.status === 'Stopped') ||
      (filter === 'automatic' && s.startType === 'Automatic') ||
      (filter === 'disabled' && s.startType === 'Disabled');

    return matchesQuery && matchesFilter;
  });
}

/**
 * Filter processes by query and category
 */
export function filterProcesses(
  processes: ProcessItem[],
  query: string,
  filter: 'all' | 'notResponding' | 'highMemory' | 'user' = 'all'
): ProcessItem[] {
  const q = (query || '').toLowerCase().trim();
  return processes.filter((p) => {
    const matchesQuery = !q || p.name.toLowerCase().includes(q) || String(p.pid).includes(q);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'notResponding' && p.responding === false) ||
      (filter === 'highMemory' && p.memoryMB >= 250) ||
      (filter === 'user' && p.category === 'user');

    return matchesQuery && matchesFilter;
  });
}

/**
 * Filter tools belonging to Station 07
 */
export function stationTools(allTools: BridgeTool[]): BridgeTool[] {
  return allTools.filter(
    (t) => t.Category === '07-Services-Processes' || (t.ToolId && t.ToolId.startsWith('SP'))
  );
}

/**
 * Converts execution run result into a history entry.
 *
 * Delegates to the shared builder: the local version turned a result with no
 * status and no exit code into SUCCESS, and wrote a fabricated `0` count.
 */
export function outcomeFromRun(
  tool: BridgeTool,
  res: KnouxRunResult,
  lang: Lang = 'en'
): StationHistoryEntry {
  return buildStationHistoryRow({
    toolId: tool.ToolId,
    toolName: lang === 'ar' ? tool.ArabicName || tool.EnglishName : tool.EnglishName,
    result: res,
    successSummary:
      lang === 'ar' ? `اكتمل تنفيذ ${tool.ArabicName || tool.EnglishName} بنجاح` : `Successfully completed ${tool.EnglishName}`,
    failureSummary:
      lang === 'ar' ? `فشل تنفيذ ${tool.ArabicName || tool.EnglishName}` : `Execution failed for ${tool.EnglishName}`,
  });
}

/**
 * One measured "service depends on service" relationship.
 *
 * The dependency tab previously discarded SP07's result and rendered only a
 * static policy note, so a user who asked to trace dependencies never saw a
 * single edge. The parser is tolerant: it accepts the object-array form, the
 * `{ services: [...] }` wrapper, and a text table, because SP07 has been
 * written more than one way.
 */
export interface DependencyEdge {
  service: string;
  dependsOn: string;
  critical: boolean;
}

const CRITICAL_SERVICE_NAMES = new Set([
  'RpcSs', 'DcomLaunch', 'PlugPlay', 'EventLog', 'CryptSvc',
  'RpcEptMapper', 'NlaSvc', 'Winmgmt', 'Schedule', 'ProfSvc',
]);

/** Parse SP07's output into edges. Returns null only for an unparseable shape. */
export function extractDependencyEdges(
  output: unknown,
  criticalNames: ReadonlySet<string> = CRITICAL_SERVICE_NAMES
): DependencyEdge[] | null {
  const push = (edges: DependencyEdge[], service: unknown, dependsOn: unknown, criticalFlag?: unknown) => {
    const from = String(service ?? '').trim();
    const to = String(dependsOn ?? '').trim();
    if (!from || !to) return;
    const critical =
      typeof criticalFlag === 'boolean'
        ? criticalFlag
        : criticalNames.has(from) || criticalNames.has(to);
    edges.push({ service: from, dependsOn: to, critical });
  };

  const walk = (node: unknown, edges: DependencyEdge[], depth = 0): boolean => {
    if (depth > 4 || node === null || typeof node !== 'object') return false;
    if (Array.isArray(node)) {
      let consumed = false;
      for (const item of node) {
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const from = record.Service ?? record.Name ?? record.service ?? record.name;
          const tos = record.Dependencies ?? record.DependsOn ?? record.dependsOn ?? record.dependencies;
          if (from !== undefined && tos !== undefined) {
            const list = Array.isArray(tos) ? tos : [tos];
            for (const to of list) {
              push(edges, from, typeof to === 'string' ? to : (to as Record<string, unknown>)?.Name ?? (to as Record<string, unknown>)?.name, record.Critical);
            }
            consumed = true;
            continue;
          }
        }
        if (walk(item, edges, depth + 1)) consumed = true;
      }
      return consumed;
    }
    const record = node as Record<string, unknown>;
    for (const value of Object.values(record)) {
      if (walk(value, edges, depth + 1)) return true;
    }
    return false;
  };

  // Preferred: structured payload on the envelope or inside `output`.
  for (const candidate of [output, (output as Record<string, unknown>)?.output, (output as Record<string, unknown>)?.evidence]) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      const edges = parseDependencyTable(candidate);
      if (edges) return edges;
      continue;
    }
    const edges: DependencyEdge[] = [];
    if (walk(candidate, edges) && edges.length > 0) return edges;
  }
  return null;
}

/** Last-resort: a whitespace/pipe/comma separated "service,depends on" table. */
function parseDependencyTable(text: string): DependencyEdge[] | null {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const edges: DependencyEdge[] = [];
  for (const line of lines) {
    const parts = line.split(/\s*(?:\||,|->|=>|depends on:)\s*/i).map(part => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const from = parts[0];
      const to = parts[1];
      if (!from || !to) continue;
      edges.push({ service: from, dependsOn: to, critical: CRITICAL_SERVICE_NAMES.has(from) || CRITICAL_SERVICE_NAMES.has(to) });
    }
  }
  return edges.length > 0 ? edges : null;
}