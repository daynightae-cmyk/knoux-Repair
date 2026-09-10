/**
 * KNOUX REPAIR — Station 15: System Monitoring
 * System Observatory Domain Model
 * Pure deterministic functions for real-time Windows processes,
 * memory consumption hierarchy, unresponsive task detection, and service states.
 * Zero synthetic gamification.
 */

import type {
  BridgeTool,
  KnouxRunResult,
  OperationsPreview,
  OperationsPreviewProcess,
  OperationsPreviewService,
} from '../../../lib/api';

export type ObservatoryCondition = 'NOMINAL' | 'ELEVATED_LOAD' | 'CRITICAL_BOTTLENECK' | 'INCONCLUSIVE';

export interface ObservatorySummary {
  condition: ObservatoryCondition;
  totalProcesses: number;
  unresponsiveCount: number;
  topMemoryProcessName: string | null;
  topMemoryMB: number;
  totalServices: number;
  runningServices: number;
  stoppedAutomaticServices: number;
}

export interface ObservatorySignal {
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

export const STATION15_TOOL_IDS = ['MO01', 'MO02', 'MO03', 'MO04'] as const;

/**
 * Categorical condition truthfully derived from unresponsive tasks and heavy memory pressure
 */
export function deriveObservatoryCondition(
  unresponsiveProcesses: number,
  heavyProcessesCount: number
): ObservatoryCondition {
  if (unresponsiveProcesses > 0) {
    return 'CRITICAL_BOTTLENECK';
  }
  if (heavyProcessesCount > 5) {
    return 'ELEVATED_LOAD';
  }
  return 'NOMINAL';
}

/**
 * Summarizes the system observatory telemetry from Operations preview
 */
export function summarizeObservatory(
  preview: OperationsPreview | null | undefined
): ObservatorySummary {
  if (!preview || !preview.Processes) {
    return {
      condition: 'INCONCLUSIVE',
      totalProcesses: 0,
      unresponsiveCount: 0,
      topMemoryProcessName: null,
      topMemoryMB: 0,
      totalServices: 0,
      runningServices: 0,
      stoppedAutomaticServices: 0,
    };
  }

  const p = preview.Processes;
  const s = preview.Services;
  const topMem = p.TopMemory?.[0] || null;
  const unresponsive = p.NotResponding || p.NotRespondingForReview?.length || 0;
  const heavyCount = (p.TopMemory || []).filter((proc) => proc.MemoryMB > 800).length;

  return {
    condition: deriveObservatoryCondition(unresponsive, heavyCount),
    totalProcesses: p.Total || 0,
    unresponsiveCount: unresponsive,
    topMemoryProcessName: topMem ? topMem.Name : null,
    topMemoryMB: topMem ? topMem.MemoryMB : 0,
    totalServices: s?.Total || 0,
    runningServices: s?.Running || 0,
    stoppedAutomaticServices: s?.AutomaticStoppedForReview?.length || 0,
  };
}

/**
 * Detects observatory signals and actionable items
 */
export function detectObservatorySignals(
  preview: OperationsPreview | null | undefined
): ObservatorySignal[] {
  if (!preview) return [];
  const signals: ObservatorySignal[] = [];

  // Unresponsive process alerts
  const unresponsive = preview.Processes?.NotRespondingForReview || [];
  if (unresponsive.length > 0) {
    signals.push({
      code: 'MONITORING_NOT_RESPONDING',
      level: 'CRITICAL',
      messageEn: `Detected ${unresponsive.length} unresponsive process(es) (e.g. ${unresponsive[0].Name}, PID ${unresponsive[0].ProcessId}).`,
      messageAr: `تم اكتشاف ${unresponsive.length} عملية متوقفة عن الاستجابة (مثل ${unresponsive[0].Name}، رقم المعرف ${unresponsive[0].ProcessId}).`,
      suggestedTool: 'MO04',
      evidenceSource: 'Process Watch (MO04/SP11)',
    });
  }

  // Automatic services stopped
  const stoppedAuto = preview.Services?.AutomaticStoppedForReview || [];
  if (stoppedAuto.length > 0) {
    signals.push({
      code: 'MONITORING_AUTO_SERVICE_STOPPED',
      level: 'MEDIUM',
      messageEn: `${stoppedAuto.length} service(s) configured for Automatic startup are currently in Stopped state.`,
      messageAr: `يوجد ${stoppedAuto.length} خدمة مضبوطة على بدء التشغيل التلقائي ولكنها في حالة توقف حالياً.`,
      suggestedTool: 'MO01',
      evidenceSource: 'Services Inventory (SP11/MO01)',
    });
  }

  // Top memory consumer
  const topMem = preview.Processes?.TopMemory?.[0];
  if (topMem && topMem.MemoryMB > 1500) {
    signals.push({
      code: 'MONITORING_HEAVY_MEMORY_CONSUMER',
      level: 'INFO',
      messageEn: `Process '${topMem.Name}' (PID ${topMem.ProcessId}) is holding ${topMem.MemoryMB} MB of working set memory.`,
      messageAr: `العملية '${topMem.Name}' (المعرف ${topMem.ProcessId}) تستهلك ${topMem.MemoryMB} ميجابايت من الذاكرة الفعلية.`,
      suggestedTool: 'MO02',
      evidenceSource: 'Top Resource Processes (MO02)',
    });
  }

  return signals;
}

/**
 * Filter processes by name or PID
 */
export function filterProcessesByName(
  processes: OperationsPreviewProcess[],
  query: string
): OperationsPreviewProcess[] {
  if (!query) return processes;
  const q = query.toLowerCase();
  return processes.filter(
    (p) => p.Name.toLowerCase().includes(q) || String(p.ProcessId).includes(q)
  );
}

/**
 * Filter tools belonging to Station 15
 */
export function stationTools(allTools: BridgeTool[]): BridgeTool[] {
  return allTools.filter(
    (t) => t.Category === '15-System-Monitoring' || (STATION15_TOOL_IDS as readonly string[]).includes(t.ToolId)
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
