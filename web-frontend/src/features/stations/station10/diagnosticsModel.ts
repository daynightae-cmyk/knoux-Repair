/**
 * KNOUX REPAIR — Station 10: Diagnostics & Reports
 * Diagnostic Evidence Center Domain Model
 * Pure deterministic functions for diagnostic condition classification,
 * event log categorization, device problem evaluation, SMART health assessment,
 * and evidence-backed diagnostics reporting. Zero synthetic scores.
 */

import type { BridgeTool, DiagnosticsPreview, DiagnosticsPreviewDisk, DiagnosticsPreviewEvent, KnouxRunResult } from '../../../lib/api';

export type DiagnosticCondition = 'HEALTHY' | 'ATTENTION_RECOMMENDED' | 'CRITICAL_FINDINGS' | 'INCONCLUSIVE';

export interface DiagnosticSummary {
  condition: DiagnosticCondition;
  errorOrCriticalEvents: number;
  criticalEvents: number;
  problemDevices: number;
  smartPredictedFailures: number;
  disksMonitored: number;
  reliabilityRecords: number;
  bootDurationMs: number | null;
  uptimeHours: number;
}

export interface ProblemDeviceItem {
  name: string;
  deviceId: string;
  status: string;
  errorCode: number;
  errorDescription: string;
  isCritical: boolean;
}

export interface EventLogItem {
  timeGenerated: string;
  source: string;
  eventId: number;
  entryType: string;
  message: string;
  isCritical: boolean;
}

export interface DiskSmartItem {
  model: string;
  index: number;
  sizeGB: number;
  smartAvailable: boolean;
  predictFailure: boolean;
  status: 'HEALTHY' | 'PREDICTED_FAILURE' | 'UNAVAILABLE';
}

export interface DiagnosticSignal {
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

export const STATION10_TOOL_IDS = [
  'DR01', 'DR02', 'DR03', 'DR04', 'DR05', 'DR06',
  'DR07', 'DR08', 'DR09', 'DR10', 'DR11',
] as const;

/**
 * Evaluates diagnostic condition categorically without fabricated scores
 */
export function deriveDiagnosticCondition(
  errorOrCriticalEvents: number,
  criticalEvents: number,
  problemDevices: number,
  smartFailures: number
): DiagnosticCondition {
  // Any disk failure predicted or critical hardware/device problem or high critical event storm
  if (smartFailures > 0 || problemDevices > 2 || criticalEvents > 5) {
    return 'CRITICAL_FINDINGS';
  }

  // Moderate warnings: some device problems or elevated error count
  if (problemDevices > 0 || criticalEvents > 0 || errorOrCriticalEvents > 10) {
    return 'ATTENTION_RECOMMENDED';
  }

  // Clear baseline
  return 'HEALTHY';
}

/**
 * Summarizes live diagnostics preview telemetry
 */
export function summarizeDiagnostics(preview: DiagnosticsPreview | null | undefined): DiagnosticSummary {
  if (!preview) {
    return {
      condition: 'INCONCLUSIVE',
      errorOrCriticalEvents: 0,
      criticalEvents: 0,
      problemDevices: 0,
      smartPredictedFailures: 0,
      disksMonitored: 0,
      reliabilityRecords: 0,
      bootDurationMs: null,
      uptimeHours: 0,
    };
  }

  const errorOrCriticalEvents = preview.Events?.ErrorOrCriticalCount ?? 0;
  const criticalEvents = preview.Events?.CriticalCount ?? 0;
  const problemDevices = preview.Devices?.ProblemsObserved ?? 0;
  const smartFailures = preview.Storage?.SmartFailurePredicted ?? 0;
  const disksMonitored = preview.Storage?.DisksObserved ?? 0;
  const reliabilityRecords = preview.Reliability?.RecordsObserved ?? 0;
  const bootDurationMs = preview.System?.BootDurationMs ?? null;
  const uptimeHours = preview.System?.UptimeHours ?? 0;

  const condition = deriveDiagnosticCondition(
    errorOrCriticalEvents,
    criticalEvents,
    problemDevices,
    smartFailures
  );

  return {
    condition,
    errorOrCriticalEvents,
    criticalEvents,
    problemDevices,
    smartPredictedFailures: smartFailures,
    disksMonitored,
    reliabilityRecords,
    bootDurationMs,
    uptimeHours,
  };
}

/**
 * Parses and evaluates problem devices from preview or WMI
 */
export function parseProblemDevices(
  problems: Array<{
    Name?: string;
    DeviceId?: string;
    DeviceID?: string;
    Status?: string;
    ErrorCode?: number;
    ConfigManagerErrorCode?: number;
    ErrorDescription?: string;
  }> | null | undefined
): ProblemDeviceItem[] {
  if (!problems || problems.length === 0) return [];

  return problems.map((p) => {
    const code = p.ErrorCode ?? p.ConfigManagerErrorCode ?? 0;
    // Error code 10 (device cannot start) or 22 (device disabled) or 43 (device stopped)
    const isCritical = code === 10 || code === 43;

    return {
      name: p.Name || 'Unknown Device',
      deviceId: p.DeviceId || p.DeviceID || 'Unknown Hardware ID',
      status: p.Status || 'Error',
      errorCode: code,
      errorDescription: p.ErrorDescription || `ConfigManager Error ${code}`,
      isCritical,
    };
  });
}

/**
 * Normalizes event log entries from preview
 */
export function parseEventLog(
  events: DiagnosticsPreviewEvent[] | null | undefined
): EventLogItem[] {
  if (!events || events.length === 0) return [];

  return events.map((e) => {
    const isCritical = e.Level?.toLowerCase() === 'critical' || e.Level === '1';
    return {
      timeGenerated: e.Time || 'Recent',
      source: e.Provider || e.Log || 'System',
      eventId: e.EventId || 0,
      entryType: e.Level || 'Error',
      message: `${e.Log ? `[${e.Log}] ` : ''}${e.Provider} (Event ID: ${e.EventId})`,
      isCritical,
    };
  });
}

/**
 * Evaluates storage SMART conditions across monitored disks
 */
export function parseDiskSmart(
  disks: DiagnosticsPreviewDisk[] | null | undefined
): DiskSmartItem[] {
  if (!disks || disks.length === 0) return [];

  return disks.map((d) => {
    let status: DiskSmartItem['status'] = 'UNAVAILABLE';
    if (d.SmartAvailable) {
      status = d.PredictFailure ? 'PREDICTED_FAILURE' : 'HEALTHY';
    }

    return {
      model: d.Model || `PhysicalDrive${d.Index}`,
      index: d.Index,
      sizeGB: d.SizeGB,
      smartAvailable: Boolean(d.SmartAvailable),
      predictFailure: Boolean(d.PredictFailure),
      status,
    };
  });
}

/**
 * Detects diagnostic signals and maps to relevant diagnostic tools
 */
export function detectDiagnosticSignals(summary: DiagnosticSummary): DiagnosticSignal[] {
  const signals: DiagnosticSignal[] = [];

  if (summary.smartPredictedFailures > 0) {
    signals.push({
      code: 'SMART_FAILURE_PREDICTED',
      level: 'CRITICAL',
      messageEn: `Physical storage controller reports imminent hardware failure on ${summary.smartPredictedFailures} disk(s).`,
      messageAr: `وحدة التحكم في التخزين تشير إلى احتمال وشيك لفشل عتادي في ${summary.smartPredictedFailures} قرص.`,
      suggestedTool: 'DR08',
      evidenceSource: 'MSStorageDriver_FailurePredictStatus (WMI)',
    });
  }

  if (summary.problemDevices > 0) {
    signals.push({
      code: 'DEVICE_MANAGER_PROBLEMS',
      level: 'HIGH',
      messageEn: `Device Manager reports ${summary.problemDevices} device(s) with configuration errors.`,
      messageAr: `إدارة الأجهزة ترصد ${summary.problemDevices} أجهزة بها أخطاء تكوين أو تشغيل.`,
      suggestedTool: 'DR05',
      evidenceSource: 'Win32_PnPEntity / Device Manager',
    });
  }

  if (summary.criticalEvents > 0) {
    signals.push({
      code: 'CRITICAL_EVENT_LOGS',
      level: 'HIGH',
      messageEn: `System Event Log recorded ${summary.criticalEvents} critical error event(s) in the observed window.`,
      messageAr: `سجل أحداث النظام سجّل ${summary.criticalEvents} أحداث حرجة في الفترة المراقبة.`,
      suggestedTool: 'DR03',
      evidenceSource: 'System Event Log (EventID critical level)',
    });
  }

  if (summary.bootDurationMs && summary.bootDurationMs > 60000) {
    signals.push({
      code: 'PROLONGED_BOOT_TIME',
      level: 'MEDIUM',
      messageEn: `Last recorded boot took ${(summary.bootDurationMs / 1000).toFixed(1)}s, exceeding standard baseline.`,
      messageAr: `استغرق الإقلاع الأخير ${(summary.bootDurationMs / 1000).toFixed(1)} ثانية، متجاوزاً المعدل الطبيعي.`,
      suggestedTool: 'DR06',
      evidenceSource: 'Microsoft-Windows-Diagnostics-Performance (Event 100)',
    });
  }

  return signals;
}

/**
 * Filters registered tools to only Station 10 tools
 */
export function stationTools(tools: BridgeTool[]): BridgeTool[] {
  const ids = new Set<string>(STATION10_TOOL_IDS);
  return tools.filter((t) => ids.has(t.ToolId) && t.Category === '10-Diagnostics-Reports');
}

/**
 * Maps execution result to standardized session history status
 */
export function outcomeFromRun(
  result: KnouxRunResult | null | undefined
): 'SUCCESS' | 'WARNING' | 'FAILED' | 'CANCELLED' | 'INCONCLUSIVE' {
  if (!result) return 'INCONCLUSIVE';
  if (result.Status === 'Cancelled') return 'CANCELLED';
  if (result.Status === 'Success') return 'SUCCESS';
  if (result.Status === 'Warning') return 'WARNING';
  if (result.Status === 'Failed' || result.ExitCode !== 0) return 'FAILED';
  return 'INCONCLUSIVE';
}
