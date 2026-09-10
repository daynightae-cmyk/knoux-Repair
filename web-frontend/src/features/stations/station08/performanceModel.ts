/**
 * KNOUX REPAIR — Station 08: Performance
 * Performance Lab Domain Model
 * Pure deterministic functions for resource condition classification,
 * bottleneck diagnosis, top consumer analysis, and evidence-backed recommendations.
 */

import type { BridgeTool, KnouxRunResult } from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';

export type PerformanceCondition = 'OPTIMAL' | 'MODERATE' | 'HIGH_LOAD' | 'CRITICAL_LOAD';

export interface ResourceMetric {
  cpuLoadPercent: number;
  cpuName?: string;
  logicalProcessors?: number;
  memoryUsedGB: number;
  memoryTotalGB: number;
  memoryFreeGB: number;
  memoryLoadPercent: number;
  processCount: number;
  thermalAvailable: boolean;
  thermalCelsius?: number;
}

export interface PerformanceSignal {
  code: string;
  level: 'INFO' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  suggestedTool: string;
  evidenceSource: string;
}

export interface BottleneckItem {
  domain: 'CPU' | 'MEMORY' | 'DISK' | 'STARTUP';
  measuredValue: string;
  threshold: string;
  impact: string;
  recommendation: string;
  toolId: string;
}

export interface TopConsumerProcess {
  id: number;
  name: string;
  memoryMB: number;
  cpuSeconds: number | null;
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

export const STATION08_TOOL_IDS = [
  'PF01', 'PF02', 'PF03', 'PF04', 'PF05', 'PF06',
  'PF07', 'PF08', 'PF09', 'PF10', 'PF11', 'PF12',
] as const;

/**
 * Derives categorical condition from measured load inputs without inventing synthetic scores
 */
export function derivePerformanceCondition(
  cpuLoadPercent: number,
  memoryLoadPercent: number
): PerformanceCondition {
  const safeCpu = Math.max(0, Math.min(100, cpuLoadPercent || 0));
  const safeMem = Math.max(0, Math.min(100, memoryLoadPercent || 0));

  if (safeCpu >= 90 || safeMem >= 92) {
    return 'CRITICAL_LOAD';
  }
  if (safeCpu >= 75 || safeMem >= 80) {
    return 'HIGH_LOAD';
  }
  if (safeCpu >= 40 || safeMem >= 60) {
    return 'MODERATE';
  }
  return 'OPTIMAL';
}

/**
 * Analyzes measurable bottlenecks citing real evidence thresholds
 */
export function analyzeBottlenecks(
  cpuLoad: number,
  memoryLoad: number,
  diskActivePercent?: number | null,
  signals: Array<{ Code?: string; Level?: string; Message?: string; SuggestedTool?: string }> = []
): BottleneckItem[] {
  const items: BottleneckItem[] = [];

  // CPU Bottleneck Check
  if (cpuLoad >= 80) {
    items.push({
      domain: 'CPU',
      measuredValue: `${cpuLoad}% Load`,
      threshold: '>= 80% sustained',
      impact: 'Applications may experience responsiveness lag or stuttering during heavy workloads.',
      recommendation: 'Identify top CPU consumers and inspect background scheduling.',
      toolId: 'PF07',
    });
  }

  // Memory Bottleneck Check
  if (memoryLoad >= 85) {
    items.push({
      domain: 'MEMORY',
      measuredValue: `${memoryLoad}% Committed`,
      threshold: '>= 85% utilization',
      impact: 'Operating system is paging working sets to disk, causing micro-freezes.',
      recommendation: 'Perform memory pressure analysis and trim non-essential working sets.',
      toolId: 'PF04',
    });
  }

  // Disk Active Time Bottleneck Check
  if (typeof diskActivePercent === 'number' && diskActivePercent >= 80) {
    items.push({
      domain: 'DISK',
      measuredValue: `${diskActivePercent}% Active Time`,
      threshold: '>= 80% queue saturation',
      impact: 'Disk I/O queue is saturated, slowing down app launch and file access.',
      recommendation: 'Audit disk queue depth and TRIM status across solid-state drives.',
      toolId: 'PF05',
    });
  }

  // Incorporate bridge optimization signals if present
  for (const s of signals) {
    if (s.Code && s.SuggestedTool && !items.some((b) => b.toolId === s.SuggestedTool)) {
      items.push({
        domain: s.Code.includes('STARTUP') ? 'STARTUP' : 'CPU',
        measuredValue: s.Message || s.Code,
        threshold: s.Level || 'Attention',
        impact: 'Identified by Windows performance telemetry.',
        recommendation: `Run ${s.SuggestedTool} to investigate or optimize.`,
        toolId: s.SuggestedTool,
      });
    }
  }

  return items;
}

/**
 * Parses and sorts top consumer processes
 */
export function parseTopConsumers(
  processes: Array<{
    Id?: number;
    ProcessId?: number;
    Name?: string;
    MemoryMB?: number;
    CpuSeconds?: number | null;
  }> = []
): TopConsumerProcess[] {
  if (!Array.isArray(processes)) return [];

  return processes
    .map((p) => ({
      id: p.Id || p.ProcessId || 0,
      name: p.Name || 'Process',
      memoryMB: Math.round((p.MemoryMB || 0) * 10) / 10,
      cpuSeconds: typeof p.CpuSeconds === 'number' ? Math.round(p.CpuSeconds * 10) / 10 : null,
    }))
    .sort((a, b) => b.memoryMB - a.memoryMB);
}

/**
 * Filter tools belonging to Station 08
 */
export function stationTools(allTools: BridgeTool[]): BridgeTool[] {
  return allTools.filter(
    (t) => t.Category === '08-Performance' || (t.ToolId && t.ToolId.startsWith('PF'))
  );
}

/**
 * Converts execution run result into a history entry
 */
export function outcomeFromRun(
  tool: BridgeTool,
  res: KnouxRunResult,
  lang: Lang = 'en'
): StationHistoryEntry {
  const status = (res.status?.toUpperCase() || (res.exitCode === 0 ? 'SUCCESS' : 'FAILED')) as
    | 'SUCCESS'
    | 'WARNING'
    | 'FAILED'
    | 'CANCELLED'
    | 'INCONCLUSIVE';

  const processed = res.itemsProcessed || 0;
  const summary =
    res.errorMessage ||
    (status === 'SUCCESS'
      ? (lang === 'ar' ? `اكتمل فحص ${tool.ArabicName || tool.EnglishName} بنجاح` : `Successfully evaluated ${tool.EnglishName}`)
      : (lang === 'ar' ? `فشل تنفيذ ${tool.ArabicName || tool.EnglishName}` : `Execution failed for ${tool.EnglishName}`));

  return {
    id: `${tool.ToolId}-${Date.now()}`,
    toolId: tool.ToolId,
    toolName: lang === 'ar' ? tool.ArabicName || tool.EnglishName : tool.EnglishName,
    timestamp: new Date().toISOString(),
    status,
    itemsProcessed: processed,
    summary,
  };
}
